"use client";

import { Sidebar } from "@/components/ui/Sidebar";
import { Toaster } from "sonner";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
