import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in — EssentialRegs" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Log in</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-zinc-900 underline underline-offset-2">
          Sign up
        </Link>
      </p>

      <LoginForm />

      <p className="mt-4 text-sm text-zinc-600">
        <Link
          href="/forgot-password"
          className="font-medium text-zinc-900 underline underline-offset-2"
        >
          Forgot your password?
        </Link>
      </p>
    </div>
  );
}
