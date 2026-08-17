import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SetupRequired({ message, href, cta }: { message: string; href: string; cta: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="text-sm text-slate-500">{message}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        {cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
