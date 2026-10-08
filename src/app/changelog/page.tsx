import { ChangelogBody } from "@/components/ChangelogBody";
import { buildChangelogView, denverDateLabel, fetchChangelog } from "@/lib/changelog";

export const metadata = {
  title: "Changelog",
};

/**
 * What changed in the corpus, for customers, in three sections (review 4,
 * 7 Oct 2026): regulatory changes first and open (only what came from the
 * agency; otherwise one line saying none is recorded), then links, sources
 * and corrections to our own copy of the text, then summary quality
 * collapsed to one line per day. One line per regulation per day, counts
 * only. The counts come from a stored snapshot the pipeline refreshes
 * (src/lib/changelog.ts), so the page never waits on the live aggregate and
 * renders a notice, not a 500, when the database does not answer. The same
 * page logged in or out. The per-row moderation log, with its notes, is
 * internal and stays in the database.
 */
export default async function ChangelogPage() {
  const view = buildChangelogView(await fetchChangelog(), denverDateLabel);
  return <ChangelogBody view={view} />;
}
