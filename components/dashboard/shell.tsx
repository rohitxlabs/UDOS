"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { GraduationCap, Menu, X, LogOut, KeyRound } from "lucide-react";
import clsx from "clsx";
import { NAV_GROUPS } from "./nav-items";
import { can } from "@/lib/permissions";
import { logout } from "@/lib/auth/actions";

function NavLinks({
  enabledModules,
  permissions,
  onNavigate,
}: {
  enabledModules: string[];
  permissions: string[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const enabledSet = new Set(enabledModules);
  const permissionSet = new Set(permissions);
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => can({ enabledModules: enabledSet, permissions: permissionSet }, item.module, "view")),
  })).filter((group) => group.items.length > 0);

  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
      {groups.map((group, idx) => (
        <div key={group.label ?? idx} className="flex flex-col gap-0.5">
          {group.label && (
            <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.label}</p>
          )}
          {group.items.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={clsx(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                  isActive ? "font-semibold text-blue-600" : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                {isActive && <span className="absolute -left-3 h-6 w-1 rounded-r-full bg-blue-600" />}
                <Icon className={clsx("h-4.5 w-4.5", isActive ? "text-blue-600" : "text-slate-400")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Logo({ collegeName }: { collegeName: string }) {
  return (
    <div className="flex h-16 items-center gap-2.5 border-b border-slate-100 px-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
        <GraduationCap className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <span className="block truncate text-[15px] font-bold leading-tight tracking-tight text-slate-900">
          {collegeName}
        </span>
        <span className="block text-[11px] font-medium leading-tight text-slate-400">College ERP</span>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
      {initial}
    </div>
  );
}

export function DashboardShell({
  collegeName,
  name,
  roleName,
  enabledModules,
  permissions,
  children,
}: {
  collegeName: string;
  name: string;
  roleName: string | null;
  enabledModules: string[];
  permissions: string[];
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col bg-white md:flex">
        <Logo collegeName={collegeName} />
        <NavLinks enabledModules={enabledModules} permissions={permissions} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="relative flex w-64 flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
              <span className="text-[15px] font-bold tracking-tight text-slate-900">{collegeName}</span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <NavLinks enabledModules={enabledModules} permissions={permissions} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between bg-white px-4 md:px-6">
          <button
            className="rounded-full bg-gray-100 p-2.5 text-slate-500 hover:bg-slate-200 md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/change-password"
              className="rounded-full bg-gray-100 p-2.5 text-slate-500 hover:bg-slate-200"
              title="Change password"
            >
              <KeyRound className="h-4 w-4" />
            </Link>
            <form action={logout}>
              <button type="submit" className="rounded-full bg-gray-100 p-2.5 text-slate-500 hover:bg-slate-200" title="Log out">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
            <div className="ml-1 flex items-center gap-2.5">
              <Avatar name={name} />
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-slate-900">{name}</p>
                <p className="text-xs text-slate-500">{roleName ?? "No role assigned"}</p>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
