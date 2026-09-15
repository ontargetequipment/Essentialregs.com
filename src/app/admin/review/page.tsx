import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { sanitizeHtml, stripHtml } from "@/lib/regulation";
import { regKeyOf } from "@/lib/changelog";
import { approveSummary, rejectSummary, saveEditAndApprove } from "./actions";

export const metadata = { title: "Review queue" };

const REG_KEYS = ["3", "7", "26", "oooob"] as const;
const REG_LABELS: Record<string, string> = {
  "3": "Reg 3",
  "7": "Reg 7",
  "26": "Reg 26",
  oooob: "OOOOb",
};

const STATUSES = ["pending", "approved", "edited", "rejected"] as const;
type Status = (typeof STATUSES)[number];
const STATUS_LABELS: Record<Status, string> = {
  pending: "Pending",
  approved: "Approved",
  edited: "Edited",
  rejected: "Rejected",
};

const PAGE_SIZE = 20;

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Builds a query string for /admin/review, dropping empty/default values. */
function reviewHref(params: { reg?: string; status?: string; page?: number }): string {
  const usp = new URLSearchParams();
  if (params.reg) usp.set("reg", params.reg);
  if (params.status && params.status !== "pending") usp.set("status", params.status);
  if (params.page && params.page > 1) usp.set("page", String(params.page));
  const qs = usp.toString();
  return qs ? `/admin/review?${qs}` : "/admin/review";
}

type Row = {
  id: string;
  citation: string;
  title: string;
  full_text: string;
  ai_summary: string | null;
  summary_status: string;
  last_verified_date: string | null;
  reviewed_by: string | null;
};

export default async function AdminReviewPage(props: PageProps<"/admin/review">) {
  // Logged-out -> /login; logged-in but not on ADMIN_EMAILS -> a plain 404,
  // so this page's existence isn't advertised to a regular subscriber.
  await requireAdmin();

  const sp = await props.searchParams;
  const regFilter = firstParam(sp.reg)?.trim() ?? "";
  const statusRaw = firstParam(sp.status)?.trim() ?? "pending";
  const status: Status = (STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as Status)
    : "pending";
  const pageRaw = Number(firstParam(sp.page) ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const offset = (page - 1) * PAGE_SIZE;
  const idPrefix = regFilter ? `sec-${regFilter}-%` : null;

  // Reads go through the cookie-scoped client (an admin is just a
  // subscriber whose email happens to be on the allowlist — RLS already
  // lets any authenticated user read every provisions row). Only the
  // actions in ./actions.ts touch the service-role client, and only after
  // requireAdmin() runs again there.
  const supabase = await createClient();

  // Counts per status: a plain filtered count query per status. Fine at
  // this scale (4,400 rows); a single grouped query would need a Postgres
  // RPC that doesn't exist yet.
  const countEntries = await Promise.all(
    STATUSES.map(async (s) => {
      let q = supabase
        .from("provisions")
        .select("id", { count: "exact", head: true })
        .eq("summary_status", s)
        .not("ai_summary", "is", null);
      if (idPrefix) q = q.like("id", idPrefix);
      const { count, error } = await q;
      if (error) throw new Error(error.message);
      return [s, count ?? 0] as const;
    })
  );
  const counts = Object.fromEntries(countEntries) as Record<Status, number>;

  let listQuery = supabase
    .from("provisions")
    .select(
      "id, citation, title, full_text, ai_summary, summary_status, last_verified_date, reviewed_by"
    )
    .eq("summary_status", status)
    .not("ai_summary", "is", null)
    .order("sort_order", { ascending: true })
    // One extra row beyond PAGE_SIZE, just to know whether a next page exists.
    .range(offset, offset + PAGE_SIZE);
  if (idPrefix) listQuery = listQuery.like("id", idPrefix);

  const { data, error } = await listQuery;
  if (error) throw new Error(error.message);

  const fetched = (data ?? []) as Row[];
  const hasNextPage = fetched.length > PAGE_SIZE;
  const rows = fetched.slice(0, PAGE_SIZE);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900">Summary review queue</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Every AI-generated summary needs a human pass before it&apos;s trusted in
        the reader. Approve it as-is, edit it and approve, or reject it
        (rejected summaries are withheld from every reader until re-approved).
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={reviewHref({ reg: regFilter, status: s })}
            className={`rounded-full border px-3 py-1 text-sm font-medium ${
              status === s
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:border-emerald-300"
            }`}
          >
            {STATUS_LABELS[s]} ({counts[s]})
          </Link>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-zinc-500">Regulation:</span>
        <Link
          href={reviewHref({ status })}
          className={`rounded-full border px-3 py-1 font-medium ${
            !regFilter
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 bg-white text-zinc-700 hover:border-emerald-300"
          }`}
        >
          All
        </Link>
        {REG_KEYS.map((r) => (
          <Link
            key={r}
            href={reviewHref({ reg: r, status })}
            className={`rounded-full border px-3 py-1 font-medium ${
              regFilter === r
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:border-emerald-300"
            }`}
          >
            {REG_LABELS[r]}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-500">
          Nothing in &ldquo;{STATUS_LABELS[status]}&rdquo;
          {regFilter ? ` for ${REG_LABELS[regFilter] ?? regFilter}` : ""} right
          now.
        </p>
      ) : (
        <ol className="mt-8 flex flex-col gap-6">
          {rows.map((row) => {
            const reg = regKeyOf(row.id);
            const href = reg ? `/regulations/${reg}#${row.id}` : `/regs/${row.id}`;
            return (
              <li key={row.id} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link
                    href={href}
                    target="_blank"
                    className="font-mono text-sm font-semibold text-emerald-700 hover:underline"
                  >
                    {row.citation}
                  </Link>
                  {row.reviewed_by && (
                    <span className="text-xs text-zinc-400">
                      last touched by {row.reviewed_by}
                    </span>
                  )}
                </div>
                {row.title && <p className="mt-0.5 text-sm text-zinc-600">{row.title}</p>}

                <details className="mt-3 rounded-md bg-zinc-50 p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-zinc-600">
                    {stripHtml(row.full_text, 200)}
                  </summary>
                  <div
                    className="mt-2 text-sm leading-relaxed text-zinc-700 [&_p]:mb-2"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(row.full_text) }}
                  />
                </details>

                {/*
                  `action`/`method` here are a defensive default, not the
                  normal dispatch path: each button below overrides via its
                  own `formAction`, which per the Next.js 16 docs
                  (node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md)
                  already progressively enhances without JS. Setting a
                  same-effect default here just guarantees there's never an
                  actionless/methodless native submit (e.g. pressing Enter in
                  the note field) that could fall back to a GET on this URL
                  with the row's fields as a query string.
                */}
                <form
                  action={approveSummary}
                  method="post"
                  className="mt-4 flex flex-col gap-2"
                >
                  <input type="hidden" name="id" value={row.id} />
                  <textarea
                    name="summary"
                    defaultValue={row.ai_summary ?? ""}
                    rows={4}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      name="note"
                      placeholder="Optional note (shown on reject)"
                      maxLength={280}
                      className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                    />
                    <button
                      formAction={approveSummary}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      Approve
                    </button>
                    <button
                      formAction={saveEditAndApprove}
                      className="rounded-md border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                    >
                      Save edit &amp; approve
                    </button>
                    <button
                      formAction={rejectSummary}
                      className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      Reject
                    </button>
                  </div>
                </form>
              </li>
            );
          })}
        </ol>
      )}

      {(page > 1 || hasNextPage) && (
        <div className="mt-8 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link
              href={reviewHref({ reg: regFilter, status, page: page - 1 })}
              className="font-medium text-zinc-700 hover:text-emerald-700 hover:underline"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-zinc-400">Page {page}</span>
          {hasNextPage ? (
            <Link
              href={reviewHref({ reg: regFilter, status, page: page + 1 })}
              className="font-medium text-zinc-700 hover:text-emerald-700 hover:underline"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
