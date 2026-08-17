import { redirect } from "next/navigation";
import { decrypt, getSessionCookie } from "@/lib/auth/session";
import { LoginForm } from "./login-form";
import { GraduationCap } from "lucide-react";

export default async function LoginPage() {
  const token = await getSessionCookie();
  const session = await decrypt(token);
  if (session) redirect(session.scope === "PLATFORM" ? "/platform" : "/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">College ERP</h1>
          <p className="text-sm text-slate-500">Sign in with the credentials issued to you by your administrator.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
