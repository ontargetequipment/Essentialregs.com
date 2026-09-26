import Link from "next/link";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Sign up" };

export default async function SignupPage(props: PageProps<"/signup">) {
  const { next } = await props.searchParams;
  const nextPath = typeof next === "string" ? next : undefined;

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="font-serif text-section font-bold tracking-tight text-ink">Create an account</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Already have one?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-2">
          Log in
        </Link>
      </p>
      <p className="mt-4 text-sm text-ink-soft">
        An account is free and includes the sample content. Subscribe from
        your account page to unlock the full regulations.
      </p>

      <SignupForm next={nextPath} />
    </div>
  );
}
