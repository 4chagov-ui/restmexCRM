"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationItems = [
  { href: "/", label: "Главная", icon: "⌂" },
  { href: "/requests", label: "Заявки", icon: "□" },
  { href: "/today", label: "План на сегодня", icon: "◷" },
  { href: "/mechanics", label: "Механики", icon: "◉" },
  { href: "/locations", label: "Заведения", icon: "⌖" },
  { href: "/map", label: "Карта", icon: "◇" },
  { href: "/settings", label: "Настройки", icon: "⚙" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl lg:h-screen lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col gap-5 px-4 py-4 lg:px-5 lg:py-6">
        <Link className="flex items-center gap-3 px-2" href="/">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white shadow-lg shadow-slate-300/70">
            RM
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-950">
              RestMex CRM
            </span>
            <span className="block text-xs text-slate-500">MVP workspace</span>
          </span>
        </Link>

        <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {navigationItems.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                className={`flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-slate-950 text-white shadow-lg shadow-slate-300/70"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
                href={item.href}
                key={item.href}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-xl text-xs ${
                    active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto hidden rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Механики
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Иван", "Олег", "Максим"].map((name) => (
              <span
                className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
                key={name}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
