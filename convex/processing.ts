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
5. Check for no-shows, cancelled, or incomplete studies — these count as "study not done". If a previously scheduled echo (or other cardiac study) was cancelled or the patient no-showed, this is important: recommend that same study be re-ordered. Flag it explicitly in the rationale (e.g., "Prior echo was scheduled on [date] but was cancelled/no-show — recommend rescheduling").
6. Check if same study is already scheduled for date of service
7. Determine if documentation is ≤60 days old (for new patients, this is required)
8. Apply authorization rules to determine:
   - Is patient eligible for a study?
   - Which study type? (Nuclear > Stress Echo > Echo > Vascular)
   - Is documentation sufficient (Clean Approval) or weak (Needs Attestation Letter)?
9. Check for contradictions: if patient is wheelchair-bound, bedbound, or amputee, do NOT mention ambulatory symptoms

===== FINDING INTERPRETATION RULES =====

You must interpret every clinical finding in the notes using these rules BEFORE making any qualification decision.

STEP A — NEGATION CHECK:
A finding is NEGATED (patient does NOT have it) if:
- The text itself is a negated compound term (e.g., "nonsmoker", "asymptomatic", "non-cardiac", "pleuritic")
- Any negation phrase appears BEFORE the finding in the same sentence: "denies", "no history of", "negative for", "without", "ruled out", "no evidence of", "absence of", "not complaining of", "never had"
- A compound negation prefix (non-, un-, a-) appears immediately before the term
- IMPORTANT: A negation only applies if there is NO sentence break (period, newline, semicolon, "but", "however") between the negation phrase and the finding. If a sentence break intervenes, the negation does not carry forward.

STEP B — UNCERTAINTY CHECK:
A finding is UNCERTAIN if any of these appear before it in the same sentence: "possible", "likely", "probable", "rule out", "r/o", "suspected", "concern for", "cannot exclude", "questionable", "?", "vs", "differential includes"
- Uncertain findings do NOT count as confirmed.

STEP C — EXPLICIT PRESENCE CHECK:
A finding is CONFIRMED PRESENT only if:
- An explicit presence phrase appears before it in the same sentence: "presents with", "history of", "diagnosed with", "complains of", "endorses", "reports", "positive for", "confirmed", "known", "established", "active", "currently experiencing", "states she/he has"
- AND it is NOT uncertain (Step B)
- AND it is NOT negated (Step A)
- If a term merely appears in the chart without explicit confirmation, it is NOT present.

FINAL DETERMINATION:
isPresent = explicitly confirmed AND NOT negated AND NOT uncertain
If the term just appears in the chart text without explicit confirmation language, treat it as NOT present.

===== SPECIALIST HIERARCHY & CONFLICT RESOLUTION =====

When multiple notes or sources report conflicting information, use this hierarchy:

PRIORITY TIERS:
| Priority | Weight | Specialists                                                                             |
|----------|--------|-----------------------------------------------------------------------------------------|
| 1 (highest) | 10  | Cardiologist, Interventional Cardiologist, Electrophysiologist, Cardiac Surgeon         |
| 2        | 8      | ED, Hospital Admission, Intensivist/ICU, Pulmonologist, Internal Medicine, Hospitalist  |
| 3        | 5      | PCP, Family Medicine, General Practice                                                  |
| 4 (lowest) | 2   | Other Specialists (urology, dermatology, neuro, GI, endo, psych, routine follow-up)    |

CONFLICT RESOLUTION:
When the same finding is reported as present by one source and absent by another (e.g., "shortness of breath" in one section and "no shortness of breath" in another), you MUST:

1. FLAG the conflict — identify exactly which sections contradict (e.g., "HPI states 'reports shortness of breath' but ROS states 'denies shortness of breath'")
2. RESOLVE the conflict — determine which is correct using these rules in order:
   a. Higher priority specialist wins (lower priority number)
   b. Assessment/Plan carries more weight than ROS for active clinical decision-making
   c. If same priority, prefer the note dated within 6 months of the date of service over one older than 6 months
   d. If both within or both outside 6 months, prefer the more recent date
   e. If the finding appears in the problem list or assessment/plan as an active problem, it is likely present regardless of a contradicting ROS denial
   f. If still unresolvable → flag for manual review (NEEDS_REVIEW)
3. GENERATE AN ATTESTATION — set decision to APPROVED_NEEDS_LETTER. The attestation letter must:
   - Call out the specific conflict found in the documentation
   - State which version was determined to be correct and why
   - Use the resolved (correct) finding for the rest of the clinical note
   - Include a section in the attestationContent with header: "DOCUMENTATION CONFLICT RESOLUTION:" that explains the conflict and resolution

This replaces the old automatic-denial approach. Conflicts should be WORKED OUT, not just denied.

A single symptom from a priority 1-2 specialist is sufficient for generic qualification (Rule 4).

===== DISQUALIFICATION RULES =====

Patient does NOT qualify if:
- Only risk factors (HTN, DM, smoking, obesity, family history) without any confirmed symptoms
- Only negated findings present
- Only uncertain/suspected findings without any confirmed finding
- Insufficient documentation to determine
- FOR STRESS ECHO: Chest pain that is described as at rest only, pleuritic, positional, reproducible on palpation, musculoskeletal, or GERD-related
- FOR NUCLEAR: SOB that is only at rest, only nocturnal/PND without exertional component, or attributed to non-cardiac cause (COPD exacerbation, asthma, pneumonia, bronchitis, anxiety, hyperventilation, panic attack)

===== QUALIFICATION DECISION TREE =====

Apply these rules IN ORDER. Stop at the first match:

1. No confirmed present findings?
   - Has uncertain findings → decision = DENIED, flag "Insufficient Information — only uncertain findings"
   - Only negated findings → decision = DENIED, flag "Insufficient Information — only negated findings"
   - Nothing at all → decision = DENIED, flag "Insufficient Information"

2. Any cardiac HISTORY (MI, CHF, valve disease, cardiomyopathy, CAD, prior cardiac surgery, murmur)? → Qualified (proceed to study-specific checks)

3. Any cardiac FINDING (abnormal EKG, elevated troponin/BNP, cardiomegaly, JVD, gallop, pulmonary congestion)? → Qualified (proceed to study-specific checks)

4. 2+ confirmed cardiac SYMPTOMS (chest pain, dyspnea, palpitations, syncope, orthopnea, edema, exercise intolerance)? → Qualified (proceed to study-specific checks)

5. 1 confirmed symptom from a priority 1-2 specialist? → Qualified (proceed to study-specific checks)

6. 3+ risk factors + 1 confirmed symptom? → Qualified (proceed to study-specific checks)

7. Conflicts between sources on the same finding? → NEEDS_REVIEW

8. Exactly 1 symptom from priority 3-4 source? → NEEDS_REVIEW

9. 2+ risk factors with combined weight ≥ 6? → NEEDS_REVIEW

10. Uncertain findings alongside confirmed ones? → NEEDS_REVIEW

11. None of the above → DENIED (Not Qualified)

===== STUDY-SPECIFIC ENFORCEMENT =====

If patient passes generic qualification above, apply these additional checks:

FOR STRESS ECHO — THREE qualifying pathways (patient needs to meet ONE):

  PATHWAY 1 — Chest Pain (all four criteria required):
    1. Chest pain must be explicitly confirmed (Step C above)
    2. Must be described as "new", "new-onset", "recurrent", "persistent", or "worsening"
    3. Must occur "with exertion" / "exertional" — chest pain only at rest does NOT qualify
    4. Must document what resolves it: "rest" and/or "nitroglycerin"
    ALL FOUR are required. If any are missing, flag each missing one in missingFields and mark APPROVED_NEEDS_LETTER.

  PATHWAY 2 — SOB + Abnormal/Uninterpretable EKG:
    SOB alone is NOT enough — must have BOTH new SOB AND an abnormal or uninterpretable EKG finding. Otherwise recommend standard Echo.
    Note: An "uninterpretable" EKG (e.g., LBBB, paced rhythm, significant ST abnormalities at baseline) is also a valid qualifier for stress echo, same as abnormal.

  PATHWAY 3 — Qualifying Cardiac Diagnosis (no symptom criteria needed):
    If any of these diagnoses are confirmed present, the patient qualifies for stress echo WITHOUT needing chest pain or SOB+EKG:
    - Aortic regurgitation
    - Aortic insufficiency
    - Coronary artery disease (CAD)
    - Pulmonary hypertension

  SUPPLEMENTARY QUALIFIERS (strengthen the case for stress echo alongside other pathways):
    - Abnormal EKG or uninterpretable EKG (LBBB, paced rhythm, baseline ST abnormalities) — good standalone reason for needing stress echo
    - Abnormal ETT (exercise treadmill test) — supports the need for stress echo imaging to further evaluate

  Also check:
  - Resting EKG documented (required by most insurers before stress testing)
  - Pharmacologic justification if dobutamine/adenosine/Lexiscan/regadenoson ordered — must document why patient cannot exercise
  - Non-cardiac chest pain flags (pleuritic, positional, reproducible, musculoskeletal, GERD-related) = DISQUALIFYING
  - Repeat stress echo interval: typically recommended every 2 years. If a prior stress echo was done within 2 years, a NEW symptom (new chest pain, new SOB, new palpitations, worsening of existing symptom, new diagnosis) will help qualify for a repeat. Without a new or changed symptom, repeats within 2 years are typically denied. Document the new symptom clearly in the attestation.

FOR NUCLEAR — enforce ALL four dyspnea criteria:
  1. Dyspnea must be explicitly confirmed (Step C above)
  2. Must be described as "new", "new-onset", "persistent", or "worsening"
  3. Must occur "with exertion" / "exertional"
  4. Must document relief by "rest" and/or "nitroglycerin"
  ALL FOUR are required. If any are missing, flag each missing one in missingFields and mark APPROVED_NEEDS_LETTER.
  Also check:
  - Resting EKG documented
  - Pharmacologic justification if applicable
  - Non-cardiac SOB flags (COPD exacerbation, asthma, pneumonia, bronchitis, anxiety, hyperventilation, panic attack) = DISQUALIFYING
  - Repeat within 2 years of prior nuclear requires documented clinical change since last study

FOR ECHO — palpitations and/or hypertension ALONE are NOT enough. The patient must also have at least one of these associated key findings to qualify:
  - Chest pain
  - Shortness of breath
  - Murmur
  - Abnormal EKG
  Without one of those, palpitations + HTN = does NOT qualify for echo.
  Echo is the fallback when stress testing criteria are not met.

CONFLICTING INFORMATION RULE (applies to ALL studies):
  If the history, assessment/plan, and problem list contain conflicting information, flag it and resolve it — do NOT automatically deny. Use the conflict resolution rules above (specialist hierarchy, assessment/plan > ROS, recency, problem list context) to determine which is correct. Set decision to APPROVED_NEEDS_LETTER and generate an attestation that documents the conflict and uses the resolved finding. Include the "DOCUMENTATION CONFLICT RESOLUTION:" section in the attestationContent.

When writing the attestationContent, the CURRENT SIGNS AND SYMPTOMS section MUST use the exact qualifying language. Do not paraphrase — use the specific terms (e.g., "new chest pain with exertion, relieved by rest" or "new-onset dyspnea on exertion, relieved by rest"). If a required element was not in the clinical notes but you are generating an attestation letter, include the element with appropriate clinical language so the note meets coverage requirements.

===== ECHO 60-DAY QUALIFICATION RULE =====

- If the clinical notes or prior studies are dated within 60 days of the date of service, the echo qualifies automatically — no extra justification needed.
- If the documentation is OUTSIDE 60 days (older than 60 days from the date of service), the note MUST include a justification section explaining why the echo is still clinically necessary. This justification should cite the patient's chronic condition requiring ongoing monitoring (e.g., heart failure with serial EF tracking, moderate-severe valvular disease, cardiomyopathy surveillance) AND the patient's current presenting symptoms that support the need for the study now.
- This justification must appear in the attestationContent as a 5th section with the header: "JUSTIFICATION FOR ECHOCARDIOGRAM OUTSIDE 60-DAY WINDOW:"
- This rule applies to all echocardiogram requests (ECHO and STRESS_ECHO).

===== INSURANCE RULES =====

ECHO — NO AUTHORIZATION NEEDED for these insurances (auto-approve immediately, no clinical review required):
- Healthfirst
- MetroPlus
- United Healthcare Medicare
- Fidelis
- Medicare (Traditional / Regular Medicare)
If the patient has one of these insurances and the study is an ECHO, set decision to APPROVED_CLEAN regardless of clinical criteria. Still generate the attestationContent for documentation purposes.

ECHO — COMMERCIAL INSURANCES:
All other commercial plans require full authorization review. Check clinical criteria on a case-by-case basis using the echo qualification rules.

NUCLEAR — NO AUTHORIZATION NEEDED for these insurances (auto-approve immediately, no prior approval required):
- United Healthcare Medicare (UHC Medicare)
- Medicare (Traditional / Straight Medicare)
- ElderPlan
- MetroPlus
- VNS (Visiting Nurse Service)
If the patient has one of these insurances and the study is NUCLEAR, set decision to APPROVED_CLEAN regardless of clinical criteria. Still generate the attestationContent for documentation purposes.

NUCLEAR — ALL OTHER INSURANCES:
Any insurance not listed above requires full authorization review for nuclear studies.

STRESS ECHO / VASCULAR — all insurances require full authorization review.

GENERAL INSURANCE RULES:
- Medicare (Traditional): Auto-approve if ANY clinical rationale exists (applies to all study types)
- Medicare Advantage: Apply full rules like commercial
- Commercial: Apply full rule set

ATTESTATION CONTENT REQUIREMENTS:
When generating the attestationContent, you MUST include ALL of the following structured sections. Each section must be clearly written and clinically accurate based on the documentation provided. If information is not available for a section, state "Not documented in available records."

1. CURRENT SIGNS AND SYMPTOMS: List the patient's current presenting signs and symptoms that indicate the need for the requested study. Include relevant vital signs, physical exam findings, and subjective complaints.

2. PRIOR DIAGNOSTIC STUDIES AND RESULTS: List all prior diagnostic studies (EKGs, echocardiograms, stress tests, catheterizations, labs, etc.) with their dates and results. Include both normal and abnormal findings.

3. PRIOR MANAGEMENT AND CONSERVATIVE THERAPIES: Describe prior treatments and conservative management attempted, including lifestyle modifications, cardiac rehabilitation, physical therapy, or other non-invasive interventions and their outcomes.

4. MEDICATIONS: List all relevant cardiac/related medications with dose and duration when available (e.g., "Metoprolol 50mg BID x 6 months"). Include any medication changes or titrations.

Format the attestationContent as a single string with these exact section headers:
"CURRENT SIGNS AND SYMPTOMS:\n[content]\n\nPRIOR DIAGNOSTIC STUDIES AND RESULTS:\n[content]\n\nPRIOR MANAGEMENT AND CONSERVATIVE THERAPIES:\n[content]\n\nMEDICATIONS:\n[content]"

If the documentation is outside the 60-day window and the recommended study is ECHO or STRESS_ECHO, append a 5th section:
"\n\nJUSTIFICATION FOR ECHOCARDIOGRAM OUTSIDE 60-DAY WINDOW:\n[chronic condition requiring monitoring + current presenting symptoms justifying the study now]"

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
  "attestationContent": "Full structured attestation content with all 4 required sections (ALWAYS generate this for APPROVED_NEEDS_LETTER and APPROVED_CLEAN decisions, null only if DENIED)"
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
