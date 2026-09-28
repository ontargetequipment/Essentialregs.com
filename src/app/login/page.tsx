import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in" };

const INLINE_LINK = "font-medium text-ink underline underline-offset-2";

// A login lands on the homepage, unless the page was opened with a safe
// same-site ?next= to return to (validated in the login action).
// ?error=confirmation-failed is where /auth/confirm sends a link that
// couldn't be verified (expired, already used, or opened somewhere it
// couldn't complete); say so, and point at /check-email for a new one.
export default async function LoginPage(props: PageProps<"/login">) {
  const { next, error } = await props.searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  const confirmationFailed = error === "confirmation-failed";

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="font-serif text-section font-bold tracking-tight text-ink">Log in</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className={INLINE_LINK}>
          Sign up
        </Link>
      </p>

      {confirmationFailed && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <p className="font-medium">That confirmation link didn&apos;t work.</p>
          <p className="mt-1">
            It may have expired or already been used. If your email is confirmed, log in below;
            otherwise{" "}
            <Link href="/check-email" className="font-medium underline underline-offset-2">
              request a new link
            </Link>
            .
          </p>
        </div>
      )}

      <LoginForm next={nextPath} />

      <p className="mt-4 text-sm text-ink-soft">
        <Link href="/forgot-password" className={INLINE_LINK}>
          Forgot your password?
        </Link>
      </p>
    </div>
  );
}
