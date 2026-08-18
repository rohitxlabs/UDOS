import Link from "next/link";
import { ShieldOff } from "lucide-react";

// Rendered whenever a page calls forbidden() — i.e. the caller is signed in
// but the module is not enabled for their college, or their role has no
// view permission on it. Deliberately says nothing about what the module
// contains (spec section 9: a disabled module must not leak its data).
export default function Forbidden() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
          <ShieldOff className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">You don&apos;t have access to this</h1>
        <p className="mt-2 text-sm text-slate-500">
          Either this module isn&apos;t enabled for your college, or your role hasn&apos;t been given permission to view
          it. Ask your college administrator if you think this is a mistake.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
