-- Batch 4 approvals: everything from the batch-4 summary window still pending after corrections.
update provisions set summary_status = 'approved',
  reviewed_by = 'Claude (AI second-pass review, full text read, per owner instruction 2026-09-19)',
  reviewed_at = now()
where id ~ '^sec-(gp\d\d|jjjj|iiii|zzzz)-' and ai_summary is not null and summary_status = 'pending'
  and summary_generated_at between '2026-09-19 16:00:00+00' and '2026-09-19 17:30:00+00';
