"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { BarChart3, Archive, Loader2 } from "lucide-react";
import { PatientResultCard } from "@/components/dashboard/PatientResultCard";
import { FilterBar } from "@/components/dashboard/FilterBar";

export default function ResultsPage() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const convexStatusFilter = statusFilter === "DENIED_ONLY" ? "ALL" : statusFilter;
  const patients = useQuery(api.patients.getRecentPatients, {
    statusFilter: convexStatusFilter as "ALL" | "PROCESSING" | "COMPLETE" | "NEEDS_REVIEW",
  });

  const archiveCompleted = useMutation(api.patients.archiveCompleted);
  const [archiving, setArchiving] = useState(false);

  const filteredPatients = useMemo(() => {
    if (!patients) return [];

    let filtered = patients;

    // Client-side filter for DENIED_ONLY
    if (statusFilter === "DENIED_ONLY") {
      filtered = filtered.filter((p) => p.decision === "DENIED");
    }

    // Date of service range filter
    if (dateFrom) {
      filtered = filtered.filter((p) => p.dateOfService >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter((p) => p.dateOfService <= dateTo);
    }

    return filtered;
  }, [patients, statusFilter, dateFrom, dateTo]);

  const handleClearCompleted = async () => {
    if (!confirm("Archive all completed results? They will no longer appear in this view.")) return;
    setArchiving(true);
    try {
      await archiveCompleted({});
      toast.success("Completed results archived");
    } catch {
      toast.error("Failed to archive results");
    } finally {
      setArchiving(false);
    }
  };

  const handleClearFilters = () => {
    setStatusFilter("ALL");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">
            Authorization Results
          </h1>
          {patients && (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">
              {filteredPatients.length} result{filteredPatients.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          onClick={handleClearCompleted}
          disabled={archiving}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {archiving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
          Clear Completed
        </button>
      </div>

      <div className="mb-4">
        <FilterBar
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onClearFilters={handleClearFilters}
        />
      </div>

      {patients === undefined ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <BarChart3 className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-700">No results yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Submit patients from the Input page to see results here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPatients.map((patient) => (
            <PatientResultCard
              key={patient._id}
              patient={patient as any}
            />
          ))}
        </div>
      )}
    </div>
  );
}
