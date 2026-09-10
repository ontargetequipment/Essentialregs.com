import Link from "next/link";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Sign up — EssentialRegs" };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Create an account</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Already have one?{" "}
        <Link href="/login" className="font-medium text-zinc-900 underline underline-offset-2">
          Log in
        </Link>
      </p>
      <p className="mt-4 text-sm text-zinc-600">
        Subscription checkout isn&apos;t live yet, so a new account gets sample
        content only until early access is turned on for it.
      </p>

      <SignupForm />
    </div>
  );
}
