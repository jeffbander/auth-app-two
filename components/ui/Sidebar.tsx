"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  ClipboardList,
  BarChart3,
  Users,
  BookOpen,
  PenTool,
} from "lucide-react";

const navItems = [
  { href: "/input", label: "Input", icon: ClipboardList },
  { href: "/results", label: "Results", icon: BarChart3 },
  { href: "/admin/providers", label: "Providers", icon: Users },
  { href: "/admin/rules", label: "Rules", icon: BookOpen },
  { href: "/signature", label: "Signature", icon: PenTool },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
          CA
        </div>
        <h1 className="text-xl font-bold text-blue-600">CardioAuth</h1>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 px-4 py-4">
        <div className="flex items-center gap-3">
          <UserButton afterSignOutUrl="/" />
          <span className="text-sm text-gray-600">Account</span>
        </div>
      </div>
    </aside>
  );
}
