import Link from "next/link";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="font-serif text-section font-bold tracking-tight text-ink">Reset your password</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Enter the email on your account and we&apos;ll send a link to set a new password.
      </p>

      <ForgotPasswordForm />

      <p className="mt-6 text-sm text-ink-soft">
        <Link href="/login" className="font-medium text-ink underline underline-offset-2">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
