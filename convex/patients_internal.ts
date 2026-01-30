import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

export const getPatientInternal = internalQuery({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.patientId);
  },
});
