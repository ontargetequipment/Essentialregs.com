import { plainPreviewHref, redirectScript } from "@/lib/reader-redirect";

/**
 * What /regulations/<reg> renders for a visitor with no access to a
 * regulation that exists and is released (Sprint 8, 11 Oct 2026) instead of
 * a 404: a page that sends the browser on to the focused preview. Logic and
 * reasons in src/lib/reader-redirect.ts; the shape of the rule in
 * reader-page.ts.
 *
 * Contains the regulation's NAME and nothing else of it -- it is rendered
 * for a document whose text is locked, so no summary, heading or row text
 * may be added here.
 *
 * With JavaScript: the inline script reads location.hash and replaces the
 * page with /regulations/<reg>/preview?p=<id> (or the plain preview). The
 * site's Content-Security-Policy (next.config.ts) allows inline scripts
 * ('unsafe-inline': no nonce wiring exists for Next's own bootstrap either),
 * so none is added; if the policy ever moves to nonces this script needs
 * the same nonce as Next's.
 *
 * Without it: the <noscript> meta refresh (inside <noscript>, so a browser
 * that runs the script is not raced by it) and the visible link, both to the
 * plain preview -- the hash never reaches the server, so the provision cannot
 * be kept there.
 */
export function ReaderRedirect({ reg, regName }: { reg: string; regName: string }) {
  const href = plainPreviewHref(reg);
  return (
    <div className="mx-auto max-w-3xl px-6 py-12" data-testid="reader-redirect">
      <noscript>
        <meta httpEquiv="refresh" content={`0;url=${href}`} />
      </noscript>
      <h1 className="font-serif text-section font-bold tracking-tight text-ink">{regName}</h1>
      <p className="mt-3 text-sm text-ink-soft">Opening the preview…</p>
      <p className="mt-4">
        <a href={href} className="inline-flex min-h-11 items-center font-semibold text-accent underline">
          {`Open the preview of ${regName}`}
        </a>
      </p>
      <script dangerouslySetInnerHTML={{ __html: redirectScript(reg) }} />
    </div>
  );
}
