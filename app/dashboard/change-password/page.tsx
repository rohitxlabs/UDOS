import { verifySession } from "@/lib/auth/dal";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const session = await verifySession();

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-lg font-semibold text-slate-900">Change password</h1>
      <p className="mt-1 text-sm text-slate-500">
        {session.mustChangePassword
          ? "You must set a new password before continuing."
          : "Update the password used to sign in."}
      </p>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
