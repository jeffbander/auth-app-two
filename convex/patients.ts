import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const createPatient = mutation({
  args: {
    mrn: v.string(),
    dateOfService: v.string(),
    patientType: v.union(v.literal("NEW"), v.literal("FOLLOWUP")),
    clinicalNotes: v.string(),
    insuranceInfo: v.string(),
    previousStudies: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const patientId = await ctx.db.insert("patients", {
      ...args,
      status: "PROCESSING",
      missingFields: [],
      createdAt: Date.now(),
      createdBy: identity.subject,
    });

    // Schedule AI processing
    await ctx.scheduler.runAfter(0, internal.processing.processPatient, {
      patientId,
    });

    return patientId;
  },
});

export const getRecentPatients = query({
  args: {
    statusFilter: v.optional(
      v.union(
        v.literal("PROCESSING"),
        v.literal("COMPLETE"),
        v.literal("NEEDS_REVIEW"),
        v.literal("ALL")
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    let patients;
    if (args.statusFilter && args.statusFilter !== "ALL") {
      patients = await ctx.db
        .query("patients")
        .withIndex("by_status", (q) => q.eq("status", args.statusFilter as "PROCESSING" | "COMPLETE" | "NEEDS_REVIEW"))
        .order("desc")
        .collect();
    } else {
      patients = await ctx.db
        .query("patients")
        .order("desc")
        .collect();
    }

    // Filter out archived
    return patients.filter((p) => !p.archived);
  },
});

export const getPatientsByStatus = query({
  args: {
    status: v.union(
      v.literal("PROCESSING"),
      v.literal("COMPLETE"),
      v.literal("NEEDS_REVIEW")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { count: 0, patients: [] };
    }

    const patients = await ctx.db
      .query("patients")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();

    const active = patients.filter((p) => !p.archived);
    return { count: active.length, patients: active };
  },
});

export const updatePatientResult = internalMutation({
  args: {
    patientId: v.id("patients"),
    status: v.union(
      v.literal("PROCESSING"),
      v.literal("COMPLETE"),
      v.literal("NEEDS_REVIEW")
    ),
    decision: v.optional(
      v.union(
        v.literal("APPROVED_CLEAN"),
        v.literal("APPROVED_NEEDS_LETTER"),
        v.literal("DENIED")
      )
    ),
    recommendedStudy: v.optional(
      v.union(
        v.literal("NUCLEAR"),
        v.literal("STRESS_ECHO"),
        v.literal("ECHO"),
        v.literal("VASCULAR")
      )
    ),
    rationale: v.optional(v.string()),
    denialReason: v.optional(v.string()),
    extractedPatientName: v.optional(v.string()),
    extractedDob: v.optional(v.string()),
    extractedPhysician: v.optional(v.string()),
    missingFields: v.optional(v.array(v.string())),
    attestationContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { patientId, attestationContent, ...updates } = args;
    await ctx.db.patch(patientId, {
      ...updates,
      ...(updates.missingFields ? { missingFields: updates.missingFields } : {}),
    });
  },
});

export const archivePatient = mutation({
  args: {
    patientId: v.id("patients"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    await ctx.db.patch(args.patientId, { archived: true });
  },
});

export const archiveCompleted = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const completed = await ctx.db
      .query("patients")
      .withIndex("by_status", (q) => q.eq("status", "COMPLETE"))
      .collect();

    for (const patient of completed) {
      if (!patient.archived) {
        await ctx.db.patch(patient._id, { archived: true });
      }
    }
  },
});

export const getPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.patientId);
  },
});
