-- 件数の確認(読み取りのみ)。0017の前後で同じ数になることを確かめる
select 'customers' as table_name, count(*) from public.customers
union all select 'free_reading_requests', count(*) from public.free_reading_requests
union all select 'paid_readings', count(*) from public.paid_readings
union all select 'upsell_purchases', count(*) from public.upsell_purchases
union all select 'customer_records', count(*) from public.customer_records
union all select 'line_contacts', count(*) from public.line_contacts
union all select 'conversation_messages', count(*) from public.conversation_messages
union all select 'customer_merges', count(*) from public.customer_merges
order by 1;
