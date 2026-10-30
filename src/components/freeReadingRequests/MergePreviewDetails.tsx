import { LINE_MERGE_STATE_LABELS } from "@/lib/customers/mergeRules";
import { STATUS_LABELS } from "@/lib/freeReadingRequests/labels";
import { formatDate } from "@/lib/format";
import { MergeComparisonSide, MergePreview } from "@/types/customerMerge";
import { REQUEST_CUSTOMER_MISMATCH_LABELS } from "@/lib/freeReadingRequests/customerLink";

type ComparablePreview = Exclude<MergePreview, { kind: "already_same" }>;

// 顧客番号と名前のラベル(統合元・統合先は同じLINE表示名のことが多いため、LINE表示名は使わない)
export function comparisonLabel(side: MergeComparisonSide): string {
  const name = side.readingName || side.realName || "（名前未入力）";
  return side.customerNo === null ? `${name}（顧客未登録）` : `No.${side.customerNo} ${name}`;
}

function textOrDash(value: string | null | undefined): string {
  return value && value.trim() ? value : "—";
}

function dateOrDash(value: string | null): string {
  return value ? formatDate(value) : "—";
}

// 両方に値があって一致しないとき true(片方が空なら比べられないので false)
function differs(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a ?? "").trim();
  const right = (b ?? "").trim();
  return left !== "" && right !== "" && left !== right;
}

function matches(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a ?? "").trim();
  return left !== "" && left === (b ?? "").trim();
}

interface Row {
  label: string;
  source: string;
  target: string;
  // 比べる意味のある項目のみ色を付ける(一致=緑・不一致=赤)
  compare?: { differs: boolean; matches: boolean };
}

function rowsFor(source: MergeComparisonSide, target: MergeComparisonSide): Row[] {
  const lineStatus = (side: MergeComparisonSide) =>
    side.lineLinked ? `連携あり（${side.lineContactDisplayName ?? "表示名未取得"}）` : "連携なし";
  const requestList = (side: MergeComparisonSide) =>
    side.requests
      .slice(0, 5)
      .map((request) => `${formatDate(request.date)} ${STATUS_LABELS[request.status]?.label ?? request.status}`)
      .join("\n") || "—";
  return [
    { label: "顧客番号", source: source.customerNo === null ? "未登録" : `No.${source.customerNo}`, target: target.customerNo === null ? "未登録（統合時に作成）" : `No.${target.customerNo}` },
    { label: "この申込の名前", source: textOrDash(source.requestName), target: textOrDash(target.requestName), compare: { differs: differs(source.requestName, target.requestName), matches: matches(source.requestName, target.requestName) } },
    { label: "この申込の生年月日", source: dateOrDash(source.requestBirthDate), target: dateOrDash(target.requestBirthDate), compare: { differs: differs(source.requestBirthDate, target.requestBirthDate), matches: matches(source.requestBirthDate, target.requestBirthDate) } },
    { label: "顧客の名前（鑑定名）", source: textOrDash(source.readingName), target: textOrDash(target.readingName), compare: { differs: differs(source.readingName, target.readingName), matches: matches(source.readingName, target.readingName) } },
    { label: "本名", source: textOrDash(source.realName), target: textOrDash(target.realName), compare: { differs: differs(source.realName, target.realName), matches: matches(source.realName, target.realName) } },
    { label: "顧客の生年月日", source: dateOrDash(source.birthday), target: dateOrDash(target.birthday), compare: { differs: differs(source.birthday, target.birthday), matches: matches(source.birthday, target.birthday) } },
    { label: "お相手（任意）", source: textOrDash(source.partnerName), target: textOrDash(target.partnerName) },
    { label: "お相手の生年月日（任意）", source: dateOrDash(source.partnerBirthDate), target: dateOrDash(target.partnerBirthDate) },
    { label: "LINE表示名（本人確認の根拠にはなりません）", source: textOrDash(source.lineName), target: textOrDash(target.lineName) },
    { label: "LINE連携", source: lineStatus(source), target: lineStatus(target) },
    { label: `申込（全${source.requestCount}件 / 全${target.requestCount}件）`, source: requestList(source), target: requestList(target) },
    { label: "有料鑑定", source: `${source.paidReadingCount}件`, target: `${target.paidReadingCount}件` },
  ];
}

function cellClass(row: Row): string {
  if (row.compare?.differs) return "bg-red-50 text-red-800";
  if (row.compare?.matches) return "bg-emerald-50 text-emerald-800";
  return "text-zinc-900";
}

// 統合前の確認画面に出す内容(2人の比較表、引き継ぐ件数、LINE紐づけの状態)
export function MergePreviewDetails({ preview }: { preview: ComparablePreview }) {
  const rows = rowsFor(preview.source, preview.target);
  const mismatchSides = [
    { label: "統合元", side: preview.source },
    { label: "統合先", side: preview.target },
  ].filter(({ side }) => side.requestMismatch.length > 0);
  return (
    <div className="space-y-3">
      <p className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
        「<strong>{comparisonLabel(preview.source)}</strong>」のデータを、今開いている申込の顧客「
        <strong>{comparisonLabel(preview.target)}</strong>」にまとめます。
        {preview.kind === "merge" && <>「{comparisonLabel(preview.source)}」は非表示になります。</>}
        <br />
        <span className="text-xs">
          逆向き(「{comparisonLabel(preview.target)}」を非表示にしたい)場合は、キャンセルして、残したい顧客の申込画面から操作してください。
        </span>
      </p>
      {mismatchSides.map(({ label, side }) => (
        <p key={label} className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {label}の申込（{side.requestName || "名前未入力"}
          {side.requestBirthDate ? `・${formatDate(side.requestBirthDate)}` : ""}）は、顧客「{comparisonLabel(side)}
          {side.birthday ? `・${formatDate(side.birthday)}` : ""}」に登録されています。
          申込の{side.requestMismatch.map((m) => REQUEST_CUSTOMER_MISMATCH_LABELS[m]).join("・")}が顧客の情報と違うため、
          別の人の申込がこの顧客に登録されている可能性があります。統合すると、この顧客のデータがまとめて移ります。
        </p>
      ))}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-xs">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="w-1/4 border-b border-zinc-200 py-1 pr-2 font-medium">項目</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">
                統合元（下の候補の顧客・<span className="text-red-700">非表示になります</span>）<br />
                <span className="font-semibold text-zinc-900">{comparisonLabel(preview.source)}</span>
              </th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">
                統合先（今開いている申込の顧客・<span className="text-emerald-700">残ります</span>）<br />
                <span className="font-semibold text-zinc-900">{comparisonLabel(preview.target)}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="align-top">
                <th className="border-b border-zinc-100 py-1 pr-2 text-left font-normal text-zinc-500">{row.label}</th>
                <td className={`whitespace-pre-line border-b border-zinc-100 px-2 py-1 ${cellClass(row)}`}>{row.source}</td>
                <td className={`whitespace-pre-line border-b border-zinc-100 px-2 py-1 ${cellClass(row)}`}>{row.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview.kind === "attach_request" ? (
        <p>統合元の申込はまだ顧客登録されていないため、この申込1件を統合先のお客様に紐付けます。</p>
      ) : (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">
          <p className="font-medium">統合先へ引き継ぐデータ（削除済みのものも含む）</p>
          <ul className="mt-1 grid grid-cols-2 gap-x-4 text-sm">
            <li>無料鑑定申込：{preview.counts.requests}件</li>
            <li>有料鑑定：{preview.counts.paidReadings}件</li>
            <li>アップセル：{preview.counts.upsellPurchases}件</li>
            <li>過去の記録：{preview.counts.customerRecords}件</li>
            <li>会話履歴（手動）：{preview.counts.manualMessages}件</li>
            <li>会話履歴（LINE）：{preview.counts.lineMessages}件</li>
          </ul>
        </div>
      )}
      <p>
        <span className="font-medium">LINE紐づけ：</span>
        {LINE_MERGE_STATE_LABELS[preview.lineState]}
      </p>
      {preview.lineState === "move_from_source" && preview.counts.lineMessages > 0 && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
          統合元のLINE受信履歴{preview.counts.lineMessages}件が、統合先のお客様の会話履歴に表示されるようになります。別人の場合、他人のLINE履歴が付いてしまうため特にご注意ください。
        </p>
      )}
      {preview.fillsTargetLineUserId && (
        <p className="text-xs text-zinc-500">
          統合先のLINE User IDが未登録のため、統合元のLINE User IDを統合先へ移します。
        </p>
      )}
      <p className="text-xs text-zinc-500">
        名前・生年月日などの基本情報は変更しません（統合先の内容のままです）。
      </p>
    </div>
  );
}
