import { internalQuery } from "./_generated/server";

export const listRulesInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("authorizationRules")
      .withIndex("by_rule_name")
      .collect();
  },
});
