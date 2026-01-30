"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { BookOpen, Save, Loader2, RefreshCw } from "lucide-react";

const RULE_DISPLAY_NAMES: Record<string, string> = {
  master_study_selection: "Master Study Selection",
  echo_rules: "Echocardiogram Rules",
  stress_echo_rules: "Stress Echo Rules",
  nuclear_rules: "Nuclear Stress Test Rules",
  vascular_rules: "Vascular Studies Rules",
};

const RULE_ORDER = [
  "master_study_selection",
  "echo_rules",
  "stress_echo_rules",
  "nuclear_rules",
  "vascular_rules",
];

export default function RulesPage() {
  const rules = useQuery(api.rules.listRules);
  const updateRule = useMutation(api.rules.updateRule);
  const seedRules = useMutation(api.rules.seedDefaultRules);

  const [editedContent, setEditedContent] = useState<Record<string, string>>(
    {}
  );
  const [savingRule, setSavingRule] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Initialize edited content from fetched rules
  useEffect(() => {
    if (rules) {
      const content: Record<string, string> = {};
      for (const rule of rules) {
        if (!(rule.ruleName in editedContent)) {
          content[rule.ruleName] = rule.ruleContent;
        }
      }
      if (Object.keys(content).length > 0) {
        setEditedContent((prev) => ({ ...content, ...prev }));
      }
    }
  }, [rules]);

  const handleSaveRule = async (ruleName: string) => {
    const content = editedContent[ruleName];
    if (!content) return;

    setSavingRule(ruleName);
    try {
      await updateRule({ ruleName, ruleContent: content });
      toast.success(`${RULE_DISPLAY_NAMES[ruleName] || ruleName} saved`);
    } catch {
      toast.error("Failed to save rule");
    } finally {
      setSavingRule(null);
    }
  };

  const handleSeedRules = async () => {
    setSeeding(true);
    try {
      await seedRules({});
      toast.success("Default rules seeded");
    } catch {
      toast.error("Failed to seed rules");
    } finally {
      setSeeding(false);
    }
  };

  const rulesMap = new Map(
    (rules || []).map((r) => [r.ruleName, r])
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">
            Authorization Rules
          </h1>
        </div>
        <button
          onClick={handleSeedRules}
          disabled={seeding}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {seeding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Seed Default Rules
        </button>
      </div>

      <p className="mb-4 text-sm text-gray-600">
        These rules control how the AI makes authorization decisions. Edit
        carefully.
      </p>

      {rules === undefined ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="space-y-4">
          {RULE_ORDER.map((ruleName) => {
            const rule = rulesMap.get(ruleName);
            const content = editedContent[ruleName] || rule?.ruleContent || "";
            const hasChanges = rule && content !== rule.ruleContent;

            return (
              <div
                key={ruleName}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">
                    {RULE_DISPLAY_NAMES[ruleName] || ruleName}
                  </h3>
                  <div className="flex items-center gap-3">
                    {rule && (
                      <span className="text-xs text-gray-400">
                        Updated:{" "}
                        {new Date(rule.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                    <button
                      onClick={() => handleSaveRule(ruleName)}
                      disabled={savingRule === ruleName || !content}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        hasChanges
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                      } disabled:opacity-50`}
                    >
                      {savingRule === ruleName ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Save
                    </button>
                  </div>
                </div>
                <textarea
                  value={content}
                  onChange={(e) =>
                    setEditedContent((prev) => ({
                      ...prev,
                      [ruleName]: e.target.value,
                    }))
                  }
                  className="min-h-[180px] w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                  placeholder={
                    rule
                      ? undefined
                      : "No rule content yet. Click 'Seed Default Rules' to populate."
                  }
                />
              </div>
            );
          })}

          {/* Future placeholder */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 opacity-60">
            <h3 className="text-base font-semibold text-gray-500">
              Insurance-Specific Rules
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              Coming soon — per-payer rule sets for Aetna, BCBS, United, etc.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
