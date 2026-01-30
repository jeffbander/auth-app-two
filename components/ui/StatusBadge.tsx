"use client";

import { Loader2, CheckCircle, AlertTriangle, XCircle, HelpCircle } from "lucide-react";

type StatusBadgeProps = {
  status: string;
  decision?: string | null;
};

export function StatusBadge({ status, decision }: StatusBadgeProps) {
  if (status === "PROCESSING") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
        <Loader2 className="h-3 w-3 animate-spin" />
        Processing
      </span>
    );
  }

  if (status === "NEEDS_REVIEW") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">
        <HelpCircle className="h-3 w-3" />
        Review
      </span>
    );
  }

  if (decision === "APPROVED_CLEAN") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
        <CheckCircle className="h-3 w-3" />
        Approved
      </span>
    );
  }

  if (decision === "APPROVED_NEEDS_LETTER") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-700">
        <AlertTriangle className="h-3 w-3" />
        Needs Letter
      </span>
    );
  }

  if (decision === "DENIED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
        <XCircle className="h-3 w-3" />
        Denied
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
      Unknown
    </span>
  );
}
