import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/auth/dal";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  await requireCapability("settings", "view");

  const college = await prisma.college.findFirst({ orderBy: { createdAt: "asc" } });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-lg font-semibold text-slate-900">College settings</h1>
      <p className="mt-1 text-sm text-slate-500">
        Core details used across admit cards, receipts and certificates.
      </p>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SettingsForm
          college={
            college
              ? { ...college, attendanceMinPercent: college.attendanceMinPercent.toString() }
              : null
          }
        />
      </div>
    </div>
  );
}
