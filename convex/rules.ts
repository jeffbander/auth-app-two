import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listRules = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    return await ctx.db
      .query("authorizationRules")
      .withIndex("by_rule_name")
      .collect();
  },
});

export const getRule = query({
  args: {
    ruleName: v.string(),
  },
  handler: async (ctx, args) => {
    const rules = await ctx.db
      .query("authorizationRules")
      .withIndex("by_rule_name", (q) => q.eq("ruleName", args.ruleName))
      .first();
    return rules;
  },
});

export const updateRule = mutation({
  args: {
    ruleName: v.string(),
    ruleContent: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("authorizationRules")
      .withIndex("by_rule_name", (q) => q.eq("ruleName", args.ruleName))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ruleContent: args.ruleContent,
        updatedAt: Date.now(),
        updatedBy: identity.subject,
      });
    } else {
      await ctx.db.insert("authorizationRules", {
        ruleName: args.ruleName,
        ruleContent: args.ruleContent,
        updatedAt: Date.now(),
        updatedBy: identity.subject,
      });
    }
  },
});

const DEFAULT_RULES: Record<string, string> = {
  finding_interpretation: `FINDING INTERPRETATION RULES:

These rules determine whether a clinical finding counts as confirmed, negated, or uncertain.

STEP A — NEGATION CHECK:
A finding is NEGATED (patient does NOT have it) if:
- The text itself is a negated compound term (e.g., "nonsmoker", "asymptomatic", "non-cardiac", "pleuritic")
- Any negation phrase appears BEFORE the finding in the same sentence: "denies", "no history of", "negative for", "without", "ruled out", "no evidence of", "absence of", "not complaining of", "never had"
- A compound negation prefix (non-, un-, a-) appears immediately before the term
- A negation only applies if there is NO sentence break (period, newline, semicolon, "but", "however") between the negation phrase and the finding

STEP B — UNCERTAINTY CHECK:
A finding is UNCERTAIN if any of these appear before it in the same sentence: "possible", "likely", "probable", "rule out", "r/o", "suspected", "concern for", "cannot exclude", "questionable", "?", "vs", "differential includes"
Uncertain findings do NOT count as confirmed.

STEP C — EXPLICIT PRESENCE CHECK:
A finding is CONFIRMED PRESENT only if:
- An explicit presence phrase appears before it in the same sentence: "presents with", "history of", "diagnosed with", "complains of", "endorses", "reports", "positive for", "confirmed", "known", "established", "active", "currently experiencing"
- AND it is NOT uncertain (Step B)
- AND it is NOT negated (Step A)
- If a term merely appears in the chart without explicit confirmation, it is NOT present.

FINAL: isPresent = explicitly confirmed AND NOT negated AND NOT uncertain`,

  specialist_hierarchy: `SPECIALIST HIERARCHY & CONFLICT RESOLUTION:

PRIORITY TIERS:
Priority 1 (highest, weight 10): Cardiologist, Interventional Cardiologist, Electrophysiologist, Cardiac Surgeon
Priority 2 (weight 8): ED, Hospital Admission, Intensivist/ICU, Pulmonologist, Internal Medicine, Hospitalist
Priority 3 (weight 5): PCP, Family Medicine, General Practice
Priority 4 (lowest, weight 2): Other Specialists (urology, dermatology, neuro, GI, endo, psych, routine follow-up)

CONFLICT RESOLUTION (when same finding reported differently — e.g., "SOB" in one section, "denies SOB" in another):
Do NOT automatically deny. Instead, flag and resolve the conflict:
1. Higher priority specialist wins (lower priority number)
2. Assessment/Plan carries more weight than ROS for active clinical decisions
3. If same priority, prefer note within 6 months of date of service
4. If both within or both outside 6 months, prefer the more recent date
5. If finding appears in problem list or assessment/plan as active problem, it is likely present regardless of contradicting ROS
6. If still unresolvable → flag for manual review
Generate an attestation letter that calls out the conflict, states which version is correct and why, and uses the resolved finding for the note.

A single symptom from a priority 1-2 specialist is sufficient for generic qualification.`,

  disqualification_rules: `DISQUALIFICATION RULES:

Patient does NOT qualify if:
- Only risk factors (HTN, DM, smoking, obesity, family history) without any confirmed symptoms
- Only negated findings present ("denies chest pain", "no SOB")
- Only uncertain/suspected findings without any confirmed finding ("possible CAD", "rule out MI")
- Insufficient documentation to determine

STUDY-SPECIFIC DISQUALIFIERS:
- Stress Echo: Chest pain that is at rest only, pleuritic, positional, reproducible on palpation, musculoskeletal, or GERD-related
- Nuclear: SOB that is only at rest, only nocturnal/PND without exertional component, or attributed to COPD exacerbation, asthma, pneumonia, bronchitis, anxiety, hyperventilation, or panic attack`,

  generic_qualification: `GENERIC QUALIFICATION RULES (applies to ALL study types):

These rules are evaluated first for every study request. If the patient does not pass generic qualification, the study-specific rules do not matter.

| Rule | Criteria                                                                                                   | Result                   |
|------|------------------------------------------------------------------------------------------------------------|--------------------------|
| 1    | Any cardiac history (MI, CHF, valve disease, cardiomyopathy, CAD, prior surgery, murmur)                   | Qualified                |
| 2    | Any cardiac finding (abnormal EKG, elevated troponin/BNP, cardiomegaly, JVD, gallop, pulmonary congestion) | Qualified                |
| 3    | 2+ cardiac symptoms (chest pain, dyspnea, palpitations, syncope, orthopnea, edema, exercise intolerance)   | Qualified                |
| 4    | 1 symptom from a high-priority specialist (cardiologist or referring physician with priority ≤ 2)           | Qualified                |
| 5    | 3+ risk factors + 1 symptom                                                                                | Qualified                |
| 6    | Has conflicts between sources                                                                              | Review Needed            |
| 7    | Only 1 symptom (not from high-priority source)                                                             | Review Needed            |
| 8    | 2+ risk factors with total weight ≥ 6                                                                      | Review Needed            |
| 9    | Has uncertain findings alongside confirmed ones                                                            | Review Needed            |
| 10   | No confirmed findings at all                                                                               | Insufficient Information |
| 11   | None of the above met                                                                                      | Not Qualified            |

KEY INTERPRETATION RULES:
- Findings must be EXPLICITLY CONFIRMED by a presence pattern (e.g., "presents with", "history of", "diagnosed with") — mere mention is not enough.
- Negated findings ("denies chest pain", "no SOB") do NOT count as confirmed.
- Uncertain findings ("possible", "rule out", "suspected") do NOT count as confirmed.
- Non-cardiac patterns (pleuritic, positional, musculoskeletal, reproducible) actively DISQUALIFY the associated symptom.`,

  master_study_selection: `STUDY SELECTION HIERARCHY:
1. Try Nuclear Stress Test first if:
   - Patient has known CAD or prior MI
   - High pretest probability for coronary disease
   - Primary symptom is dyspnea/SOB with exertional context
   - Nuclear not contraindicated

2. If Nuclear not appropriate, try Stress Echo if:
   - Primary symptom is chest pain (must meet all chest pain criteria)
   - Need to assess wall motion abnormalities
   - Valvular disease present
   - Patient can exercise

3. If Stress Echo not appropriate, recommend Echo if:
   - Structural assessment needed
   - Valvular evaluation
   - EF assessment
   - Cannot exercise
   - SOB without abnormal EKG (does not qualify for stress echo)

4. Vascular (Carotid) is separate indication:
   - Stroke/TIA symptoms
   - Carotid bruit
   - Pre-operative assessment

DEFAULT: Recommend Echo for MVP testing when stress testing criteria are not met.`,

  echo_rules: `ECHOCARDIOGRAM AUTHORIZATION CRITERIA:

IMPORTANT — Palpitations and/or hypertension ALONE are NOT sufficient for an echocardiogram. To qualify, the patient MUST also have at least one of these associated key findings:
- Chest pain
- Shortness of breath
- Murmur
- Abnormal EKG
Without one of those key findings, palpitations + HTN = does NOT qualify.

CONFLICTING INFORMATION RULE:
If there is conflicting information between the history, assessment/plan, and problem list, flag the conflict and resolve it — do NOT automatically deny. Use the conflict resolution rules (specialist hierarchy, assessment/plan outweighs ROS, recency, problem list context) to determine the correct finding. Generate an attestation letter that documents the conflict, states the resolution, and uses the corrected finding.

Qualifying criteria (at least one required):
- Palpitations or HTN + chest pain
- Palpitations or HTN + shortness of breath
- Palpitations or HTN + murmur
- Palpitations or HTN + abnormal EKG
- Evaluation of known or suspected heart failure (confirmed CHF, reduced EF, volume overload)
- Evaluation of known valvular disease (murmur with clinical significance, known valve pathology)
- Post-intervention reassessment (post-valve repair/replacement, post-cardiac surgery)

Does NOT qualify:
- Palpitations alone
- Hypertension alone
- Palpitations + hypertension (without chest pain, SOB, murmur, or abnormal EKG)
- Risk factors only (HTN, DM, smoking) without a qualifying associated finding

Key notes:
- Echo is the fallback when stress testing criteria are not met.
- If SOB is present but no abnormal EKG, recommend Echo instead of Stress Echo.
- Standard repeat interval: no echo within 12 months unless acute clinical change is documented.

Document required: chest pain or cardiac history, relevant diagnosis, last echo date if applicable.`,

  stress_echo_rules: `STRESS ECHOCARDIOGRAM AUTHORIZATION CRITERIA:

Must pass generic qualification rules PLUS all study-specific checks below.

PRIMARY SYMPTOM: CHEST PAIN — ALL four criteria are MANDATORY:
1. Chest pain present — must be explicitly confirmed in the chart
2. Exertional context — must document chest pain occurs with exertion/activity (walking, stairs, exercise, treadmill). If chest pain is ONLY at rest, stress echo does NOT qualify.
3. Temporal pattern — must document as "new", "new-onset", "recurrent", "persistent", or "worsening"
4. Relief factor — must document relief by "nitroglycerin" or "rest"

ALTERNATIVE PATHWAY: New shortness of breath PLUS abnormal or uninterpretable EKG
- SOB alone is NOT sufficient for stress echo
- Must document BOTH new SOB AND an abnormal or uninterpretable EKG finding (ST changes, T-wave inversions, arrhythmia, bundle branch block, LVH, LBBB, paced rhythm, baseline ST abnormalities)
- An "uninterpretable" EKG is equally valid as abnormal for this pathway
- If only SOB without abnormal/uninterpretable EKG, recommend standard Echo instead

QUALIFYING CARDIAC DIAGNOSES (these alone qualify for stress echo — chest pain criteria NOT required):
- Aortic regurgitation
- Aortic insufficiency
- Coronary artery disease (CAD)
- Pulmonary hypertension
If any of these diagnoses are confirmed present in the chart, the patient qualifies for stress echo without needing to meet the chest pain or SOB+EKG pathways above.

SUPPLEMENTARY QUALIFIERS (strengthen the case alongside other pathways):
- Abnormal EKG or uninterpretable EKG — good standalone reason for needing stress echo
- Abnormal ETT (exercise treadmill test) — supports the need for stress echo imaging to further evaluate

ADDITIONAL STRESS-SPECIFIC CHECKS:
- Resting EKG: Must be documented in chart — most insurers require baseline EKG before stress testing
- Pharmacologic justification: If dobutamine/adenosine/Lexiscan/regadenoson is ordered, must document why patient cannot exercise
- Non-cardiac chest pain flag: If chest pain is described as pleuritic, positional, reproducible on palpation, musculoskeletal, or GERD-related, it is DISQUALIFYING — the study does NOT qualify
- Repeat study interval: Stress echo is typically recommended every 2 years. If prior stress echo was done within 2 years, a NEW symptom (new chest pain, new SOB, new palpitations, worsening symptoms, new diagnosis) will help qualify for a repeat. Without a new or changed symptom, repeats within 2 years are typically denied.`,

  nuclear_rules: `NUCLEAR STRESS TEST AUTHORIZATION CRITERIA:

Must pass generic qualification rules PLUS all study-specific checks below.

PRIMARY SYMPTOM: DYSPNEA (Shortness of Breath) — ALL four criteria are MANDATORY:
1. Dyspnea present — must be explicitly confirmed in the chart
2. Exertional context — must document SOB occurs with exertion/activity
3. Temporal pattern — must document as "new", "new-onset", "persistent", or "worsening"
4. Relief factor — must document relief by "nitroglycerin" or "rest"

ADDITIONAL NUCLEAR-SPECIFIC CHECKS:
- Resting EKG: Must be documented in chart
- Pharmacologic justification: If pharmacologic agent is ordered, must document why patient cannot exercise
- Non-cardiac SOB flag: If chart mentions COPD exacerbation, asthma, pneumonia, bronchitis, anxiety-related, hyperventilation, or panic attack as the cause of SOB, it is DISQUALIFYING — the study does NOT qualify
- Repeat study interval: If prior nuclear study exists, must document clinical change since last study — insurers typically deny repeats within 2 years without documented change`,

  vascular_rules: `VASCULAR STUDIES (CAROTID) AUTHORIZATION CRITERIA:

General criteria:
- TIA or stroke symptoms
- Carotid bruit on exam
- Pre-CABG or valve surgery assessment
- Follow-up of known carotid stenosis

Document required: neurological symptoms, exam findings, relevant history`,

  insurance_rules: `INSURANCE-BASED AUTHORIZATION RULES:

ECHO — NO AUTHORIZATION NEEDED (auto-approve, no clinical review required):
- Healthfirst
- MetroPlus
- United Healthcare Medicare
- Fidelis
- Medicare (Traditional / Regular Medicare)
If the patient has one of these insurances and the requested study is an ECHO, approve immediately. Still generate documentation for records.

ECHO — COMMERCIAL INSURANCES:
All other commercial insurance plans require full authorization review using echo qualification criteria.

NUCLEAR — NO AUTHORIZATION NEEDED (auto-approve, no prior approval required):
- United Healthcare Medicare (UHC Medicare)
- Medicare (Traditional / Straight Medicare)
- ElderPlan
- MetroPlus
- VNS (Visiting Nurse Service)
Any other insurance requires full authorization review for nuclear studies.

STRESS ECHO / VASCULAR:
All insurances require full authorization review regardless of carrier.

GENERAL:
- Medicare (Traditional): Auto-approve if ANY clinical rationale exists (all study types)
- Medicare Advantage: Apply full rules like commercial
- Commercial: Apply full clinical rule set`,
};

export const seedDefaultRules = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    for (const [ruleName, ruleContent] of Object.entries(DEFAULT_RULES)) {
      const existing = await ctx.db
        .query("authorizationRules")
        .withIndex("by_rule_name", (q) => q.eq("ruleName", ruleName))
        .first();

      if (!existing) {
        await ctx.db.insert("authorizationRules", {
          ruleName,
          ruleContent,
          updatedAt: Date.now(),
          updatedBy: identity.subject,
        });
      }
    }
  },
});
