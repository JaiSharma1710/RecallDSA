import { Card } from "@/app/_components/Card";
import { LoginForm } from "@/app/_components/LoginForm";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-md items-center">
      <Card className="w-full rounded-2xl border-slate-200 p-8 shadow-lg shadow-slate-200/60">
        <div className="mb-6 space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            RecallDSA Access
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">Sign in</h1>
          <p className="text-sm text-slate-600">
            Use the username and password configured in your environment file.
          </p>
        </div>
        <LoginForm />
      </Card>
    </div>
  );
}
