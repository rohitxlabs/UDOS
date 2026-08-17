"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { GraduationCap, Menu, X, LogOut, KeyRound } from "lucide-react";
import clsx from "clsx";
import { NAV_GROUPS } from "./nav-items";
import type { Role } from "@/app/generated/prisma/client";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { logout } from "@/lib/auth/actions";

function NavLinks({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(role, item.module, "view")),
  })).filter((group) => group.items.length > 0);

  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
      {groups.map((group, idx) => (
        <div key={group.label ?? idx} className="flex flex-col gap-1">
          {group.label && (
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.label}</p>
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
                  "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                  isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                {isActive && <span className="absolute -left-3 h-5 w-1 rounded-r-full bg-blue-600" />}
                <Icon className={clsx("h-4 w-4", isActive ? "text-blue-600" : "text-slate-400")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Logo() {
  return (
    <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
        <GraduationCap className="h-4 w-4" />
      </div>
      <span className="font-semibold text-slate-900">College ERP</span>
    </div>
  );
}

export function DashboardShell({
  role,
  name,
  children,
}: {
  role: Role;
  name: string;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <Logo />
        <NavLinks role={role} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="relative flex w-64 flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
              <span className="font-semibold text-slate-900">College ERP</span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <NavLinks role={role} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
          <button
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{name}</p>
              <p className="text-xs text-slate-500">{ROLE_LABELS[role]}</p>
            </div>
            <Link
              href="/dashboard/change-password"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              title="Change password"
            >
              <KeyRound className="h-4 w-4" />
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
