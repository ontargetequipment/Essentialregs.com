import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in" };

// A login lands on the homepage, unless the page was opened with a safe
// same-site ?next= to return to (validated in the login action).
export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;
  const nextPath = typeof next === "string" ? next : undefined;

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="font-serif text-section font-bold tracking-tight text-ink">Log in</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-ink underline underline-offset-2">
          Sign up
        </Link>
      </p>

      <LoginForm next={nextPath} />

      <p className="mt-4 text-sm text-ink-soft">
        <Link
          href="/forgot-password"
          className="font-medium text-ink underline underline-offset-2"
        >
          Forgot your password?
        </Link>
      </p>
    </div>
  );
}
