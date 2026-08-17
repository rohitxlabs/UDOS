import { requireCapability } from "@/lib/auth/dal";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const ctx = await requireCapability("settings", "view");

  const settings = await ctx.db.settings.findUnique({ where: { id: "settings" } });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">
        {ctx.college.name}&apos;s academic rules. College identity (name, logo, contact details) is managed by the
        platform.
      </p>
      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <SettingsForm attendanceMinPercent={settings ? settings.attendanceMinPercent.toString() : "75"} />
      </div>
    </div>
  );
}
