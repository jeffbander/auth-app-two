"use node";

import Anthropic from "@anthropic-ai/sdk";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const processPatient = internalAction({
  args: {
    patientId: v.id("patients"),
  },
  handler: async (ctx, args) => {
    // Fetch patient data
    const patient = await ctx.runQuery(internal.patients_internal.getPatientInternal, {
      patientId: args.patientId,
    });

    if (!patient) {
      console.error("Patient not found:", args.patientId);
      return;
    }

    // Fetch authorization rules
    const rules = await ctx.runQuery(internal.rules_internal.listRulesInternal);

    const rulesText = rules
      .map((r) => `=== ${r.ruleName.toUpperCase()} ===\n${r.ruleContent}`)
      .join("\n\n");

    const prompt = `You are a cardiology authorization specialist. Analyze the following patient documentation and determine authorization eligibility.

PATIENT TYPE: ${patient.patientType}
DATE OF SERVICE: ${patient.dateOfService}

=== CLINICAL NOTES ===
${patient.clinicalNotes || "None provided"}

=== INSURANCE INFORMATION ===
${patient.insuranceInfo || "None provided"}

=== PREVIOUS STUDIES ===
${patient.previousStudies || "None provided"}

=== AUTHORIZATION RULES ===
${rulesText}

INSTRUCTIONS:
1. Extract: patient name, date of birth, ordering physician name
2. Identify any diagnoses: CAD, AFib, Heart Failure, valvular disease, etc.
3. Identify symptoms: chest pain, shortness of breath, palpitations, etc.
4. Find dates of prior EKGs, Echos, stress tests
5. Check for no-shows or incomplete studies (these count as "study not done")
6. Check if same study is already scheduled for date of service
7. Determine if documentation is ≤60 days old (for new patients, this is required)
8. Apply authorization rules to determine:
   - Is patient eligible for a study?
   - Which study type? (Nuclear > Stress Echo > Echo > Vascular)
   - Is documentation sufficient (Clean Approval) or weak (Needs Attestation Letter)?
9. Check for contradictions: if patient is wheelchair-bound, bedbound, or amputee, do NOT mention ambulatory symptoms

IMPORTANT FOR INSURANCE:
- Medicare (Traditional): Auto-approve if ANY clinical rationale exists
- Medicare Advantage: Apply full rules like commercial
- Commercial: Apply full rule set

Respond ONLY with valid JSON (no markdown, no code fences):
{
  "extractedPatientName": "string or null",
  "extractedDob": "string or null",
  "extractedPhysician": "string or null",
  "decision": "APPROVED_CLEAN" | "APPROVED_NEEDS_LETTER" | "DENIED",
  "recommendedStudy": "NUCLEAR" | "STRESS_ECHO" | "ECHO" | "VASCULAR" | null,
  "rationale": "Brief rationale for Evicore (copy/paste ready)",
  "denialReason": "Why denied + suggestions (if denied, otherwise null)",
  "missingFields": ["list", "of", "fields", "not", "found"],
  "attestationContent": "Full content for attestation letter if needed (null if clean approval)"
}`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text response from Claude");
      }

      let result;
      try {
        result = JSON.parse(textBlock.text);
      } catch {
        // Try extracting JSON from the response
        const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Failed to parse JSON from Claude response");
        }
      }

      // Map the result to valid enum values
      const validStudies = ["NUCLEAR", "STRESS_ECHO", "ECHO", "VASCULAR"];
      const validDecisions = ["APPROVED_CLEAN", "APPROVED_NEEDS_LETTER", "DENIED"];

      const decision = validDecisions.includes(result.decision)
        ? result.decision
        : "DENIED";

      const recommendedStudy = validStudies.includes(result.recommendedStudy)
        ? result.recommendedStudy
        : undefined;

      await ctx.runMutation(internal.patients.updatePatientResult, {
        patientId: args.patientId,
        status: "COMPLETE",
        decision,
        recommendedStudy,
        rationale: result.rationale || undefined,
        denialReason: result.denialReason || undefined,
        extractedPatientName: result.extractedPatientName || undefined,
        extractedDob: result.extractedDob || undefined,
        extractedPhysician: result.extractedPhysician || undefined,
        missingFields: Array.isArray(result.missingFields)
          ? result.missingFields
          : [],
        attestationContent: result.attestationContent || undefined,
      });
    } catch (error) {
      console.error("Processing error:", error);

      await ctx.runMutation(internal.patients.updatePatientResult, {
        patientId: args.patientId,
        status: "NEEDS_REVIEW",
        rationale: `Processing error: ${error instanceof Error ? error.message : "Unknown error"}`,
        missingFields: ["processing_error"],
      });
    }
  },
});
