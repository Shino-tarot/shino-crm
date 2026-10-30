-- バックアップの確認(読み取りのみ)。各テーブルの件数が counts.sql の結果と同じなら成功
select 'customers' as table_name, count(*) from backup_before_0017.customers
union all select 'free_reading_requests', count(*) from backup_before_0017.free_reading_requests
union all select 'paid_readings', count(*) from backup_before_0017.paid_readings
union all select 'upsell_purchases', count(*) from backup_before_0017.upsell_purchases
union all select 'customer_records', count(*) from backup_before_0017.customer_records
union all select 'line_contacts', count(*) from backup_before_0017.line_contacts
union all select 'conversation_messages', count(*) from backup_before_0017.conversation_messages
union all select 'customer_merges', count(*) from backup_before_0017.customer_merges
order by 1;
