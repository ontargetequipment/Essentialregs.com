select summary_status, count(*), count(*) filter (where summary_original is not null) corrected
from provisions where id ~ '^sec-(gp\d\d|jjjj|iiii|zzzz)-' and ai_summary is not null
  and summary_generated_at between '2026-09-19 16:00:00+00' and '2026-09-19 17:30:00+00'
group by 1;
