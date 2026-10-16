import Link from "next/link";
import { pageContainerClass } from "@/lib/ui";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { REQUEST_STATUSES, jurisdictionLabel, type RequestStatus } from "@/lib/regulation-request";
import { updateRegulationRequest } from "./actions";

export const metadata = { title: "Regulation requests" };

const STATUS_LABELS: Record<RequestStatus, string> = {
  new: "New",
  planned: "Planned",
  building: "Building",
  done: "Done",
  declined: "Declined",
};

/** Rows shown per load. Newest first; the status filter narrows it. */
const LIMIT = 200;

type Row = {
  id: string;
  created_at: string;
  regulation: string;
  jurisdiction: string;
  agency: string | null;
  source_url: string | null;
  reason: string | null;
  email: string;
  company: string | null;
  user_id: string | null;
  status: RequestStatus;
  notes: string | null;
};

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function requestsHref(status?: string): string {
  return status ? `/admin/requests?status=${encodeURIComponent(status)}` : "/admin/requests";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The regulation request queue (12 Oct 2026): every row from /request, newest
 * first, with counts by status at the top, a status dropdown and a notes field
 * per row. Same gate and layout as /admin/review.
 */
export default async function AdminRequestsPage(props: PageProps<"/admin/requests">) {
  // Logged-out -> /login; logged-in but not on ADMIN_EMAILS -> a plain 404.
  await requireAdmin();

  const sp = await props.searchParams;
  const statusRaw = firstParam(sp.status)?.trim() ?? "";
  const filter: RequestStatus | null = (REQUEST_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as RequestStatus)
    : null;

  // Service-role reads after requireAdmin(): the table has no policies for
  // any client role (migration 20261012031424).
  const supabase = createAdminClient();

  const countEntries = await Promise.all(
    REQUEST_STATUSES.map(async (s) => {
      const { count, error } = await supabase
        .from("regulation_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", s);
      if (error) throw new Error(error.message);
      return [s, count ?? 0] as const;
    })
  );
  const counts = Object.fromEntries(countEntries) as Record<RequestStatus, number>;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  let query = supabase
    .from("regulation_requests")
    .select("id, created_at, regulation, jurisdiction, agency, source_url, reason, email, company, user_id, status, notes")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (filter) query = query.eq("status", filter);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];

  return (
    <div className={pageContainerClass("py-12")}>
      <h1 className="text-2xl font-bold text-zinc-900">Regulation requests</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Every request sent through{" "}
        <Link href="/request" className="font-medium text-emerald-700 hover:underline">
          /request
        </Link>
        , newest first. What people ask for decides what gets imported next. Change a
        row&rsquo;s status or add a note, then Save. A copy of each request is also
        emailed to regrequest@essentialregs.com when RESEND_API_KEY is set
        (docs/regulation-requests.md).
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={requestsHref()}
          className={`rounded-full border px-3 py-1 text-sm font-medium ${
            !filter
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 bg-white text-zinc-700 hover:border-emerald-300"
          }`}
        >
          All ({total})
        </Link>
        {REQUEST_STATUSES.map((s) => (
          <Link
            key={s}
            href={requestsHref(s)}
            className={`rounded-full border px-3 py-1 text-sm font-medium ${
              filter === s
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:border-emerald-300"
            }`}
          >
            {STATUS_LABELS[s]} ({counts[s]})
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-500">
          No requests{filter ? ` in "${STATUS_LABELS[filter]}"` : ""} yet.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Regulation</th>
                <th className="px-3 py-2">Jurisdiction</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Status / notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 align-top">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-3">
                    <p className="font-medium text-zinc-900">{row.regulation}</p>
                    {row.agency && <p className="mt-0.5 text-xs text-zinc-600">{row.agency}</p>}
                    {row.source_url && (
                      <a
                        href={row.source_url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="mt-0.5 block break-all text-xs text-emerald-700 hover:underline"
                      >
                        {row.source_url}
                      </a>
                    )}
                    {row.reason && (
                      <p className="mt-1 whitespace-pre-line text-xs text-zinc-600">{row.reason}</p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-zinc-700">{jurisdictionLabel(row.jurisdiction)}</td>
                  <td className="px-3 py-3">
                    <a href={`mailto:${row.email}`} className="break-all text-emerald-700 hover:underline">
                      {row.email}
                    </a>
                    {row.user_id && <p className="mt-0.5 text-xs text-zinc-400">signed in</p>}
                  </td>
                  <td className="px-3 py-3 text-zinc-700">{row.company ?? <span className="text-zinc-400">—</span>}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-zinc-600">{formatDate(row.created_at)}</td>
                  <td className="px-3 py-3">
                    <form action={updateRegulationRequest} method="post" className="flex min-w-56 flex-col gap-2">
                      <input type="hidden" name="id" value={row.id} />
                      <select
                        name="status"
                        defaultValue={row.status}
                        aria-label="Status"
                        className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                      >
                        {REQUEST_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                      <textarea
                        name="notes"
                        defaultValue={row.notes ?? ""}
                        rows={2}
                        maxLength={2000}
                        placeholder="Notes"
                        aria-label="Notes"
                        className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                      />
                      <button
                        type="submit"
                        className="self-start rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                      >
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length === LIMIT && (
        <p className="mt-3 text-xs text-zinc-500">Showing the newest {LIMIT}. Filter by status to see older rows.</p>
      )}
    </div>
  );
}
