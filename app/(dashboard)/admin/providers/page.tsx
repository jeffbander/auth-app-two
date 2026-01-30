"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
} from "lucide-react";

type ProviderForm = {
  name: string;
  credentials: string;
  npi: string;
};

const emptyForm: ProviderForm = { name: "", credentials: "", npi: "" };

export default function ProvidersPage() {
  const providers = useQuery(api.providers.listProviders);
  const createProvider = useMutation(api.providers.createProvider);
  const updateProvider = useMutation(api.providers.updateProvider);
  const deleteProvider = useMutation(api.providers.deleteProvider);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProviderForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  const handleAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (provider: any) => {
    setForm({
      name: provider.name,
      credentials: provider.credentials,
      npi: provider.npi,
    });
    setEditingId(provider._id);
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete provider "${name}"?`)) return;
    try {
      await deleteProvider({ id: id as any });
      toast.success("Provider deleted");
    } catch {
      toast.error("Failed to delete provider");
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.credentials.trim() || !form.npi.trim()) {
      toast.error("All fields are required");
      return;
    }
    if (!/^\d{10}$/.test(form.npi)) {
      toast.error("NPI must be exactly 10 digits");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateProvider({
          id: editingId as any,
          name: form.name.trim(),
          credentials: form.credentials.trim(),
          npi: form.npi.trim(),
        });
        toast.success("Provider updated");
      } else {
        await createProvider({
          name: form.name.trim(),
          credentials: form.credentials.trim(),
          npi: form.npi.trim(),
        });
        toast.success("Provider added");
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
    } catch (error) {
      toast.error(
        `Failed to save: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleBulkImport = async () => {
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l);
    let imported = 0;
    for (const line of lines) {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length >= 3) {
        try {
          await createProvider({
            name: parts[0],
            credentials: parts[1],
            npi: parts[2],
          });
          imported++;
        } catch {
          toast.error(`Failed to import: ${parts[0]}`);
        }
      }
    }
    if (imported > 0) {
      toast.success(`Imported ${imported} provider(s)`);
      setBulkText("");
      setShowBulk(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">
            Provider Management
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulk(!showBulk)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Bulk Import
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Provider
          </button>
        </div>
      </div>

      {/* Bulk import */}
      {showBulk && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm text-gray-600">
            Paste providers, one per line: Name, Credentials, NPI
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="Robert Kornberg, MD FACC, 1234567890&#10;Jane Smith, MD, 0987654321"
            className="mb-2 min-h-[100px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
          />
          <button
            onClick={handleBulkImport}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Import
          </button>
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-blue-800">
            {editingId ? "Edit Provider" : "Add New Provider"}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Full Name"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
            />
            <input
              type="text"
              value={form.credentials}
              onChange={(e) =>
                setForm({ ...form, credentials: e.target.value })
              }
              placeholder="Credentials (e.g., MD, FACC)"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
            />
            <input
              type="text"
              value={form.npi}
              onChange={(e) => setForm({ ...form, npi: e.target.value })}
              placeholder="NPI (10 digits)"
              maxLength={10}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Provider table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {providers === undefined ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : providers.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="mx-auto mb-2 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">No providers added yet</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-sm font-medium text-gray-600">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Credentials</th>
                <th className="px-5 py-3">NPI</th>
                <th className="px-5 py-3">Signature</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr
                  key={p._id}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">
                    {p.name}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">
                    {p.credentials}
                  </td>
                  <td className="px-5 py-3 font-mono text-sm text-gray-600">
                    {p.npi}
                  </td>
                  <td className="px-5 py-3 text-sm">
                    {p.signatureUrl ? (
                      <span className="text-green-600">&#10003; On file</span>
                    ) : (
                      <span className="text-gray-400">&#10007; Missing</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(p)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p._id, p.name)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
