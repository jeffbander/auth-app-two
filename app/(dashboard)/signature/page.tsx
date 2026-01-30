"use client";

import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { PenTool, Trash2, Save, Loader2 } from "lucide-react";

export default function SignaturePage() {
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);
  const [saving, setSaving] = useState(false);

  const provider = useQuery(api.providers.getProviderByClerkUser);
  const providers = useQuery(api.providers.listProviders);
  const saveSignature = useMutation(api.providers.saveSignature);
  const linkClerkUser = useMutation(api.providers.linkClerkUser);

  const [selectedProviderId, setSelectedProviderId] = useState<string>("");

  const currentProvider = provider;
  const hasSignature = currentProvider?.signatureUrl;

  const handleClear = () => {
    sigCanvasRef.current?.clear();
  };

  const handleSave = async () => {
    if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
      toast.error("Please draw your signature first");
      return;
    }

    const providerId = currentProvider?._id || selectedProviderId;
    if (!providerId) {
      toast.error("Please select your provider profile first");
      return;
    }

    setSaving(true);
    try {
      const dataUrl = sigCanvasRef.current.toDataURL("image/png");
      await saveSignature({
        providerId: providerId as any,
        signatureDataUrl: dataUrl,
      });
      toast.success("Signature saved successfully");
    } catch (error) {
      toast.error(
        `Failed to save signature: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLinkProvider = async (id: string) => {
    setSelectedProviderId(id);
    try {
      await linkClerkUser({ providerId: id as any });
      toast.success("Provider profile linked to your account");
    } catch {
      toast.error("Failed to link provider");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <PenTool className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Signature Setup</h1>
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm text-gray-600">
            Draw your signature below. This will be automatically applied to all
            attestation letters generated for your patients.
          </p>

          {/* Provider matching */}
          {!currentProvider && providers && providers.length > 0 && (
            <div className="mb-6 rounded-lg bg-yellow-50 border border-yellow-200 p-4">
              <p className="mb-2 text-sm font-medium text-yellow-800">
                Select your provider profile:
              </p>
              <select
                value={selectedProviderId}
                onChange={(e) => handleLinkProvider(e.target.value)}
                className="rounded-lg border border-yellow-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
              >
                <option value="">Select provider...</option>
                {providers.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}, {p.credentials} (NPI: {p.npi})
                  </option>
                ))}
              </select>
            </div>
          )}

          {!currentProvider && (!providers || providers.length === 0) && (
            <div className="mb-6 rounded-lg bg-orange-50 border border-orange-200 p-4">
              <p className="text-sm text-orange-800">
                No provider profiles found. Please contact an administrator to add
                your provider profile before setting up your signature.
              </p>
            </div>
          )}

          {/* Signature canvas */}
          <div className="mb-4">
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white">
              <SignatureCanvas
                ref={sigCanvasRef}
                canvasProps={{
                  width: 500,
                  height: 200,
                  className: "signature-canvas",
                  style: { width: "100%", height: "200px" },
                }}
                penColor="black"
                backgroundColor="white"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleClear}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (!currentProvider && !selectedProviderId)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Signature
            </button>
          </div>
        </div>

        {/* Current signature preview */}
        {hasSignature && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-gray-700">
              Your current signature:
            </h3>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <img
                src={currentProvider.signatureUrl!}
                alt="Current signature"
                className="max-h-[100px]"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Draw a new signature above and save to replace.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
