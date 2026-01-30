"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Download, FileText } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { generateAttestationPdf } from "@/lib/generatePdf";

type Patient = {
  _id: string;
  mrn: string;
  dateOfService: string;
  patientType: string;
  status: string;
  decision?: string;
  recommendedStudy?: string;
  rationale?: string;
  denialReason?: string;
  extractedPatientName?: string;
  extractedDob?: string;
  extractedPhysician?: string;
  attestationContent?: string;
  missingFields: string[];
  createdAt: number;
};

type PatientResultCardProps = {
  patient: Patient;
};

const STUDY_LABELS: Record<string, string> = {
  NUCLEAR: "Nuclear Stress Test",
  STRESS_ECHO: "Stress Echocardiogram",
  ECHO: "Echocardiogram",
  VASCULAR: "Vascular Study (Carotid)",
};

export function PatientResultCard({ patient }: PatientResultCardProps) {
  const [expanded, setExpanded] = useState(false);

  const handleDownloadPdf = () => {
    generateAttestationPdf({
      patientName: patient.extractedPatientName || "Unknown",
      patientDob: patient.extractedDob || "Unknown",
      mrn: patient.mrn,
      dateOfService: patient.dateOfService,
      studyOrdered: patient.recommendedStudy
        ? STUDY_LABELS[patient.recommendedStudy] || patient.recommendedStudy
        : "Not specified",
      rationale: patient.rationale || "",
      attestationContent: patient.attestationContent || null,
      physicianName: patient.extractedPhysician || "Physician",
      physicianCredentials: "",
      physicianNpi: "",
      signatureImageUrl: null,
      letterDate: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    });
  };

  const createdDate = new Date(patient.createdAt);
  const timeStr = createdDate.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Summary row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-4">
          <StatusBadge status={patient.status} decision={patient.decision} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium text-gray-900">
                MRN: {patient.mrn}
              </span>
              {patient.extractedPatientName && (
                <span className="text-sm text-gray-600">
                  — {patient.extractedPatientName}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
              <span>DOS: {patient.dateOfService}</span>
              <span>{patient.patientType === "NEW" ? "New" : "Follow-up"}</span>
              {patient.recommendedStudy && (
                <span className="font-medium text-blue-600">
                  {STUDY_LABELS[patient.recommendedStudy] || patient.recommendedStudy}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{timeStr}</span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4">
          {/* Extracted data */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Patient Name:</span>{" "}
              <span className="font-medium">
                {patient.extractedPatientName || "Not found"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">DOB:</span>{" "}
              <span className="font-medium">
                {patient.extractedDob || "Not found"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Physician:</span>{" "}
              <span className="font-medium">
                {patient.extractedPhysician || "Not found"}
              </span>
            </div>
          </div>

          {/* Rationale */}
          {patient.rationale && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700">
                  <FileText className="mr-1 inline h-4 w-4" />
                  Rationale
                </h4>
                <CopyButton text={patient.rationale} label="Copy Rationale" />
              </div>
              <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">
                {patient.rationale}
              </p>
            </div>
          )}

          {/* Denial reason */}
          {patient.decision === "DENIED" && patient.denialReason && (
            <div>
              <h4 className="mb-1 text-sm font-medium text-red-700">
                Denial Reason
              </h4>
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {patient.denialReason}
              </p>
            </div>
          )}

          {/* Missing fields */}
          {patient.missingFields.length > 0 && (
            <div>
              <h4 className="mb-1 text-sm font-medium text-orange-700">
                Missing Fields
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {patient.missingFields.map((field) => (
                  <span
                    key={field}
                    className="rounded bg-orange-50 px-2 py-0.5 text-xs text-orange-700"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Download PDF button */}
          {patient.decision === "APPROVED_NEEDS_LETTER" && (
            <button
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download Attestation PDF
            </button>
          )}
        </div>
      )}
    </div>
  );
}
