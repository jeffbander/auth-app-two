"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { ClipboardList, Trash2, Loader2 } from "lucide-react";

export default function InputPage() {
  const createPatient = useMutation(api.patients.createPatient);

  const [mrn, setMrn] = useState("");
  const [dateOfService, setDateOfService] = useState("");
  const [patientType, setPatientType] = useState<"NEW" | "FOLLOWUP">("NEW");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [insuranceInfo, setInsuranceInfo] = useState("");
  const [previousStudies, setPreviousStudies] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [lastSubmission, setLastSubmission] = useState<string | null>(null);

  const mrnRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mrnRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!mrn.trim()) {
      toast.error("MRN is required");
      return;
    }
    if (!dateOfService) {
      toast.error("Date of Service is required");
      return;
    }
    if (!clinicalNotes.trim() && !previousStudies.trim()) {
      toast.error("At least Clinical Notes or Previous Studies is required");
      return;
    }

    setSubmitting(true);
    try {
      await createPatient({
        mrn: mrn.trim(),
        dateOfService,
        patientType,
        clinicalNotes: clinicalNotes.trim(),
        insuranceInfo: insuranceInfo.trim(),
        previousStudies: previousStudies.trim(),
      });

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
      setLastSubmission(`MRN ${mrn.trim()} at ${timeStr}`);
      setSessionCount((c) => c + 1);

      // Clear text fields but keep date of service
      setMrn("");
      setClinicalNotes("");
      setInsuranceInfo("");
      setPreviousStudies("");

      toast.success("Patient queued for processing");
      mrnRef.current?.focus();
    } catch (error) {
      toast.error(
        `Submission failed: ${error instanceof Error ? error.message : "Please retry"}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearAll = () => {
    if (!confirm("Clear all fields including Date of Service?")) return;
    setMrn("");
    setDateOfService("");
    setPatientType("NEW");
    setClinicalNotes("");
    setInsuranceInfo("");
    setPreviousStudies("");
    mrnRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      handleClearAll();
    }
  };

  return (
    <div onKeyDown={handleKeyDown}>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Patient Input</h1>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
            {sessionCount} submitted this session
          </span>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {/* Top row: MRN, Date, Patient Type */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              MRN <span className="text-red-500">*</span>
            </label>
            <input
              ref={mrnRef}
              type="text"
              value={mrn}
              onChange={(e) => setMrn(e.target.value)}
              placeholder="Enter MRN"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Date of Service <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={dateOfService}
              onChange={(e) => setDateOfService(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Patient Type
            </label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setPatientType("NEW")}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  patientType === "NEW"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                New Patient
              </button>
              <button
                type="button"
                onClick={() => setPatientType("FOLLOWUP")}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  patientType === "FOLLOWUP"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Follow-up
              </button>
            </div>
          </div>
        </div>

        {/* Text areas */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Clinical Notes (All Recent Notes)
            </label>
            <textarea
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Paste ALL recent notes — ED notes, PCP notes, specialist notes, H&P, assessment/plan, problem list..."
              className="min-h-[200px] w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Insurance Information
            </label>
            <textarea
              value={insuranceInfo}
              onChange={(e) => setInsuranceInfo(e.target.value)}
              placeholder="Paste insurance name, plan, member ID..."
              className="min-h-[200px] w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Previous / Scheduled Cardiac Studies
            </label>
            <textarea
              value={previousStudies}
              onChange={(e) => setPreviousStudies(e.target.value)}
              placeholder="Paste ALL recent cardiac studies — prior EKGs, Echos, stress tests, nuclear results, scheduled orders, cancelled/no-show studies..."
              className="min-h-[200px] w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Clear All
          </button>

          <div className="flex items-center gap-4">
            {lastSubmission && (
              <span className="text-sm text-gray-500">
                Last submitted: {lastSubmission}
              </span>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Submit & Next
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400">
          Tip: Ctrl+Enter to submit, Escape to clear
        </p>
      </div>
    </div>
  );
}
