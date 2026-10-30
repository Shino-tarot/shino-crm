"use server";

import { supabaseServerClient } from "@/lib/supabase/server";
import { insertCustomer } from "@/lib/customers/createCustomer";
import { requireStaffAccount } from "@/lib/accounts/current";
import { AccountId } from "@/lib/accounts/accounts";
import { isUuid } from "@/lib/conversationMessages/validation";
import {
  MERGE_BLOCK_MESSAGES,
  MergeConfirmation,
  MergeSideState,
  getBirthdayCheck,
  getLineMergeState,
  getMergeBlockReason,
  getMergeConfirmRequirements,
  getMergeEvidence,
  mergeErrorMessageFromDb,
  validateMergeConfirmation,
  willFillTargetLineUserId,
} from "@/lib/customers/mergeRules";
import { requestCustomerMismatch } from "@/lib/freeReadingRequests/customerLink";
import {
  MergeComparisonSide,
  MergeMovedCounts,
  MergePreview,
  MergeResult,
} from "@/types/customerMerge";

// 新規申込時の顧客自動作成(insertCustomer)は、公開フォームからも使うため
// Server ActionではないcreateCustomer.tsへ移した(このファイルからexportすると外部から直接呼べてしまうため)。
// 全ての関数の第1引数は「画面を表示したときのアカウント」。そのアカウントの申込・顧客だけを扱う。

// 既存(まだcustomer_idが未設定)の無料鑑定申込を、スタッフの操作で顧客登録する。
// すでに顧客登録済みの場合は何もせず、その顧客IDをそのまま返す(冪等)。
export async function registerCustomerForRequest(
  accountId: AccountId,
  requestId: string,
): Promise<string> {
  await requireStaffAccount(accountId);
  return registerCustomer(accountId, requestId);
}

async function registerCustomer(accountId: AccountId, requestId: string): Promise<string> {
  const { data: request, error: fetchError } = await supabaseServerClient
    .from("free_reading_requests")
    .select("id, customer_id, line_name, reading_name, birth_date, gender, age")
    .eq("id", requestId)
    .eq("account_id", accountId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (request.customer_id) return request.customer_id as string;

  const customerId = await insertCustomer({
    accountId,
    lineName: request.line_name ?? "",
    readingName: request.reading_name ?? "",
    birthDate: request.birth_date,
    gender: request.gender,
    age: request.age,
  });

  // 確認後に別の操作で顧客が付いていた場合は上書きしない
  const { error: updateError } = await supabaseServerClient
    .from("free_reading_requests")
    .update({ customer_id: customerId })
    .eq("id", requestId)
    .eq("account_id", accountId)
    .is("customer_id", null);
  if (updateError) throw new Error(updateError.message);

  return customerId;
}

// 「同じ顧客として紐付ける」操作(スタッフの明示的な確認画面経由でのみ呼ばれる想定)。
// currentRequestId(今開いている申込)の顧客を統合先、targetRequestId(過去の申込)の顧客を統合元とする。
//   - 確認画面と同じ判定(buildMergePlan)をサーバー側でもう一度行い、確認画面の入力
//     (照合チェック・統合元の顧客番号・生年月日が違う場合の理由)が要件を満たさなければ何もしない
//   - currentRequestIdがまだ顧客未登録なら先に顧客登録する
//   - targetRequestIdが顧客未登録なら、その申込1件を統合先の顧客に紐付けるだけ
//   - targetRequestIdが別の顧客に属していれば、DB関数 merge_customers で1つのトランザクションとして統合する
//     (0015/0018: アカウントの確認・LINE紐づけの競合・生年月日の確認もDB側で再確認される)
// LINE表示名等による自動判定・自動統合は行わない。
// エラーは例外ではなく結果として返す(本番ビルドでは例外のメッセージが画面に届かないため)。
export async function linkRequestsAsSameCustomer(
  accountId: AccountId,
  currentRequestId: string,
  targetRequestId: string,
  confirmation: MergeConfirmation,
): Promise<MergeResult> {
  const { staff } = await requireStaffAccount(accountId);
  if (!isUuid(currentRequestId) || !isUuid(targetRequestId) || currentRequestId === targetRequestId) {
    return { ok: false, error: "統合する申込が正しく指定されていません。" };
  }

  try {
    const plan = await buildMergePlan(accountId, currentRequestId, targetRequestId);
    if (!plan) return { ok: false, error: "申込が見つかりません。画面を再読み込みしてください。" };
    const { preview } = plan;
    if (preview.kind === "already_same") return { ok: true, customerId: plan.currentCustomerId! };

    if (preview.blockReason) return { ok: false, error: MERGE_BLOCK_MESSAGES[preview.blockReason] };
    const confirmationError = validateMergeConfirmation(
      preview.requirements,
      confirmation,
      preview.source.customerNo,
    );
    if (confirmationError) return { ok: false, error: confirmationError };

    const currentCustomerId = await registerCustomer(accountId, currentRequestId);

    if (preview.kind === "attach_request") {
      // 顧客未登録の申込1件を紐付けるだけ(1件の更新のため途中で分かれることはない)。
      // 確認後に別の操作で顧客が付いていた場合に備え、未登録のままの場合のみ更新する
      const { data, error } = await supabaseServerClient
        .from("free_reading_requests")
        .update({ customer_id: currentCustomerId })
        .eq("id", targetRequestId)
        .eq("account_id", accountId)
        .is("customer_id", null)
        .select("id");
      if (error) {
        logError("attach_request", error.code);
        return { ok: false, error: mergeErrorMessageFromDb(undefined) };
      }
      if (!data?.length) {
        return {
          ok: false,
          error: "他の操作で申込の顧客が変更されています。画面を再読み込みしてください。",
        };
      }
      return { ok: true, customerId: currentCustomerId };
    }

    const reason = typeof confirmation?.reason === "string" ? confirmation.reason.trim() : "";
    const { error } = await supabaseServerClient.rpc("merge_customers", {
      p_source_customer_id: plan.sourceCustomerId,
      p_target_customer_id: currentCustomerId,
      p_staff_id: staff.id,
      p_reason: reason || null,
    });
    if (error) {
      // DB関数のエラーは 'MERGE_' で始まる固定コードのみ(個人情報を含まない)
      logError("merge", error.code, error.message.match(/MERGE_[A-Z_]+/)?.[0]);
      return { ok: false, error: mergeErrorMessageFromDb(error.message) };
    }
    return { ok: true, customerId: currentCustomerId };
  } catch {
    return { ok: false, error: mergeErrorMessageFromDb(undefined) };
  }
}

// 統合前の確認画面用。2人の比較情報・引き継ぐ件数・LINE紐づけの状態・根拠の強さ・
// 必要な確認操作・統合できない理由を返す(DBは変更しない)
export async function getMergePreview(
  accountId: AccountId,
  currentRequestId: string,
  targetRequestId: string,
): Promise<{ ok: true; preview: MergePreview } | { ok: false; error: string }> {
  await requireStaffAccount(accountId);
  if (!isUuid(currentRequestId) || !isUuid(targetRequestId)) {
    return { ok: false, error: "統合する申込が正しく指定されていません。" };
  }
  try {
    const plan = await buildMergePlan(accountId, currentRequestId, targetRequestId);
    if (!plan) return { ok: false, error: "申込が見つかりません。画面を再読み込みしてください。" };
    return { ok: true, preview: plan.preview };
  } catch {
    return { ok: false, error: "確認情報の取得に失敗しました。時間をおいて再度お試しください。" };
  }
}

// ---------- 以下はサーバー内部専用(exportしない) ----------

// エラー内容には値が含まれうるため、ログにはエラーコードのみ出す
function logError(step: string, code: string | undefined, mergeCode?: string) {
  console.error(`[customer-merge] ${step} failed:`, code ?? "unknown", mergeCode ?? "");
}

const REQUEST_COLUMNS =
  "id, customer_id, account_id, reading_name, line_name, birth_date, partner_name, partner_birth_date, application_date, created_at, status";

interface RequestRow {
  id: string;
  customer_id: string | null;
  account_id: string;
  reading_name: string;
  line_name: string;
  birth_date: string | null;
  partner_name: string | null;
  partner_birth_date: string | null;
  application_date: string | null;
  created_at: string;
  status: string;
}

interface MergePlan {
  preview: MergePreview;
  currentCustomerId: string | null;
  sourceCustomerId: string | null;
}

// 確認画面と実行時の両方で使う判定(読み取りのみ)
async function buildMergePlan(
  accountId: AccountId,
  currentRequestId: string,
  targetRequestId: string,
): Promise<MergePlan | null> {
  const { data, error } = await supabaseServerClient
    .from("free_reading_requests")
    .select(REQUEST_COLUMNS)
    .in("id", [currentRequestId, targetRequestId])
    .eq("account_id", accountId);
  if (error) {
    logError("find_requests", error.code);
    throw new Error("CUSTOMER_MERGE_FIND_REQUESTS_FAILED");
  }
  const requests = data as unknown as RequestRow[];
  const current = requests.find((row) => row.id === currentRequestId);
  const target = requests.find((row) => row.id === targetRequestId);
  if (!current || !target) return null;

  if (target.customer_id !== null && target.customer_id === current.customer_id) {
    return { preview: { kind: "already_same" }, currentCustomerId: current.customer_id, sourceCustomerId: null };
  }

  const [sourceSide, targetSide] = await Promise.all([
    loadSide(accountId, target.customer_id, target),
    loadSide(accountId, current.customer_id, current),
  ]);
  const kind = target.customer_id === null ? "attach_request" : "merge";
  const counts =
    target.customer_id !== null
      ? await countMovedRecords(accountId, target.customer_id)
      : { requests: 1, paidReadings: 0, upsellPurchases: 0, customerRecords: 0, manualMessages: 0, lineMessages: 0 };

  const evidence = getMergeEvidence(sourceSide.state, targetSide.state);
  const birthdayCheck = getBirthdayCheck(sourceSide.state, targetSide.state);
  return {
    currentCustomerId: current.customer_id,
    sourceCustomerId: target.customer_id,
    preview: {
      kind,
      source: sourceSide.comparison,
      target: targetSide.comparison,
      counts,
      lineState: getLineMergeState(sourceSide.state, targetSide.state),
      fillsTargetLineUserId: willFillTargetLineUserId(sourceSide.state, targetSide.state),
      evidence,
      birthdayCheck,
      requirements: getMergeConfirmRequirements({
        evidence,
        birthdayCheck,
        sourceHasCustomerNo: sourceSide.comparison.customerNo !== null,
        requestMismatch:
          sourceSide.comparison.requestMismatch.length > 0 || targetSide.comparison.requestMismatch.length > 0,
      }),
      blockReason: getMergeBlockReason(sourceSide.state, targetSide.state),
    },
  };
}

// 顧客(または顧客未登録の申込)の判定用の状態と、画面用の比較情報を読み込む。
// LINE User IDを含む判定用の状態はサーバー内でのみ使い、画面には比較情報だけを返す
async function loadSide(
  accountId: AccountId,
  customerId: string | null,
  request: RequestRow,
): Promise<{ state: MergeSideState; comparison: MergeComparisonSide }> {
  const partner = {
    requestName: request.reading_name,
    requestBirthDate: request.birth_date,
    partnerName: request.partner_name,
    partnerBirthDate: request.partner_birth_date,
  };

  if (customerId === null) {
    // 顧客未登録の申込(統合時に、この申込の内容で新しい顧客が作られる)
    return {
      state: { accountId, hidden: false, lineUserId: "", linkedContactLineUserId: null, birthday: request.birth_date },
      comparison: {
        customerNo: null,
        readingName: request.reading_name,
        realName: "",
        lineName: request.line_name,
        birthday: request.birth_date,
        ...partner,
        requestMismatch: [],
        lineLinked: false,
        lineContactDisplayName: null,
        requests: [{ date: request.application_date ?? request.created_at, status: request.status }],
        requestCount: 1,
        paidReadingCount: 0,
      },
    };
  }

  const [customerRes, contactRes, requestsRes, paidRes] = await Promise.all([
    supabaseServerClient
      .from("customers")
      .select("id, account_id, customer_no, reading_name, real_name, line_name, line_user_id, birthday, deleted_at")
      .eq("id", customerId)
      .eq("account_id", accountId)
      .maybeSingle(),
    supabaseServerClient
      .from("line_contacts")
      .select("line_user_id, display_name")
      .eq("customer_id", customerId)
      .eq("account_id", accountId)
      .maybeSingle(),
    supabaseServerClient
      .from("free_reading_requests")
      .select("application_date, created_at, status, birth_date", { count: "exact" })
      .eq("customer_id", customerId)
      .eq("account_id", accountId)
      .order("application_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(10),
    supabaseServerClient
      .from("paid_readings")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId)
      .eq("account_id", accountId)
      .is("deleted_at", null),
  ]);
  const failedCode =
    customerRes.error?.code ?? contactRes.error?.code ?? requestsRes.error?.code ?? paidRes.error?.code;
  if (failedCode || !customerRes.data) {
    logError("load_side", failedCode);
    throw new Error("CUSTOMER_MERGE_LOAD_FAILED");
  }
  const customer = customerRes.data;
  const requestRows = (requestsRes.data ?? []) as {
    application_date: string | null;
    created_at: string;
    status: string;
    birth_date: string | null;
  }[];
  // DB関数 customer_effective_birthday と同じ: 顧客の生年月日、無ければ最新の申込の生年月日
  const birthday = customer.birthday ?? requestRows.find((row) => row.birth_date)?.birth_date ?? null;

  return {
    state: {
      accountId: customer.account_id,
      hidden: customer.deleted_at !== null,
      lineUserId: customer.line_user_id ?? "",
      linkedContactLineUserId: contactRes.data?.line_user_id ?? null,
      birthday,
    },
    comparison: {
      customerNo: customer.customer_no,
      readingName: customer.reading_name,
      realName: customer.real_name,
      lineName: customer.line_name,
      birthday,
      ...partner,
      requestMismatch: requestCustomerMismatch(
        { name: request.reading_name, birthDate: request.birth_date },
        { readingName: customer.reading_name, birthday: customer.birthday },
      ),
      lineLinked: contactRes.data !== null,
      lineContactDisplayName: contactRes.data ? contactRes.data.display_name || null : null,
      requests: requestRows.map((row) => ({ date: row.application_date ?? row.created_at, status: row.status })),
      requestCount: requestsRes.count ?? requestRows.length,
      paidReadingCount: paidRes.count ?? 0,
    },
  };
}

// 統合元から統合先へ移る件数(DB関数 merge_customers が移すものと同じ条件。論理削除済みも含む)
async function countMovedRecords(accountId: AccountId, sourceCustomerId: string): Promise<MergeMovedCounts> {
  const count = (table: string) =>
    supabaseServerClient
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("customer_id", sourceCustomerId)
      .eq("account_id", accountId);

  const contactRes = await supabaseServerClient
    .from("line_contacts")
    .select("id")
    .eq("customer_id", sourceCustomerId)
    .eq("account_id", accountId)
    .maybeSingle();
  if (contactRes.error) {
    logError("count_contact", contactRes.error.code);
    throw new Error("CUSTOMER_MERGE_COUNT_FAILED");
  }

  const results = await Promise.all([
    count("free_reading_requests"),
    count("paid_readings"),
    count("upsell_purchases"),
    count("customer_records"),
    count("conversation_messages").eq("source", "manual"),
    contactRes.data
      ? supabaseServerClient
          .from("conversation_messages")
          .select("id", { count: "exact", head: true })
          .eq("line_contact_id", contactRes.data.id)
          .eq("account_id", accountId)
      : null,
  ]);
  for (const result of results) {
    if (result?.error) {
      logError("count", result.error.code);
      throw new Error("CUSTOMER_MERGE_COUNT_FAILED");
    }
  }
  const [requests, paidReadings, upsellPurchases, customerRecords, manualMessages, lineMessages] =
    results.map((result) => result?.count ?? 0);
  return { requests, paidReadings, upsellPurchases, customerRecords, manualMessages, lineMessages };
}
