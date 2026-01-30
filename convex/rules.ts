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
  master_study_selection: `STUDY SELECTION HIERARCHY:
1. Try Nuclear Stress Test first if:
   - Patient has known CAD or prior MI
   - High pretest probability for coronary disease
   - Nuclear not contraindicated

2. If Nuclear not appropriate, try Stress Echo if:
   - Need to assess wall motion abnormalities
   - Valvular disease present
   - Patient can exercise

3. If Stress Echo not appropriate, recommend Echo if:
   - Structural assessment needed
   - Valvular evaluation
   - EF assessment
   - Cannot exercise

4. Vascular (Carotid) is separate indication:
   - Stroke/TIA symptoms
   - Carotid bruit
   - Pre-operative assessment

DEFAULT: Recommend Echo or Stress Echo for MVP testing.`,

  echo_rules: `ECHOCARDIOGRAM AUTHORIZATION CRITERIA:

General criteria:
- New or changed cardiac symptoms
- Evaluation of known or suspected heart failure
- Evaluation of valvular disease
- No echo in past 12 months (unless acute change)

Document required: symptoms, relevant diagnosis, last echo date`,

  stress_echo_rules: `STRESS ECHOCARDIOGRAM AUTHORIZATION CRITERIA:

General criteria:
- Evaluation of chest pain or dyspnea on exertion
- Known or suspected CAD
- Preoperative cardiac risk assessment
- Patient able to exercise

Document required: symptoms, exercise capacity, relevant diagnosis`,

  nuclear_rules: `NUCLEAR STRESS TEST AUTHORIZATION CRITERIA:

General criteria:
- Evaluation of known or suspected CAD
- Risk stratification post-MI
- Intermediate to high pretest probability
- Unable to exercise (pharmacologic stress available)

Document required: cardiac history, symptoms, risk factors`,

  vascular_rules: `VASCULAR STUDIES (CAROTID) AUTHORIZATION CRITERIA:

General criteria:
- TIA or stroke symptoms
- Carotid bruit on exam
- Pre-CABG or valve surgery assessment
- Follow-up of known carotid stenosis

Document required: neurological symptoms, exam findings, relevant history`,
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
