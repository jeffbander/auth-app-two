import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listProviders = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const providers = await ctx.db.query("providers").withIndex("by_name").collect();
    return providers;
  },
});

export const createProvider = mutation({
  args: {
    name: v.string(),
    credentials: v.string(),
    npi: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    if (!/^\d{10}$/.test(args.npi)) {
      throw new Error("NPI must be exactly 10 digits");
    }

    return await ctx.db.insert("providers", {
      name: args.name,
      credentials: args.credentials,
      npi: args.npi,
    });
  },
});

export const updateProvider = mutation({
  args: {
    id: v.id("providers"),
    name: v.string(),
    credentials: v.string(),
    npi: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    if (!/^\d{10}$/.test(args.npi)) {
      throw new Error("NPI must be exactly 10 digits");
    }

    await ctx.db.patch(args.id, {
      name: args.name,
      credentials: args.credentials,
      npi: args.npi,
    });
  },
});

export const deleteProvider = mutation({
  args: {
    id: v.id("providers"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    await ctx.db.delete(args.id);
  },
});

export const findProviderByName = query({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const providers = await ctx.db.query("providers").withIndex("by_name").collect();
    const searchName = args.name.toLowerCase().trim();

    // Exact match first
    const exact = providers.find(
      (p) => p.name.toLowerCase() === searchName
    );
    if (exact) return exact;

    // Partial match (last name)
    const partial = providers.find((p) => {
      const parts = p.name.toLowerCase().split(" ");
      return parts.some((part) => searchName.includes(part) || part.includes(searchName));
    });
    return partial ?? null;
  },
});

export const getProviderByClerkUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const providers = await ctx.db.query("providers").collect();
    return providers.find((p) => p.clerkUserId === identity.subject) ?? null;
  },
});

export const saveSignature = mutation({
  args: {
    providerId: v.id("providers"),
    signatureDataUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    await ctx.db.patch(args.providerId, {
      signatureUrl: args.signatureDataUrl,
      clerkUserId: identity.subject,
    });
  },
});

export const linkClerkUser = mutation({
  args: {
    providerId: v.id("providers"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    await ctx.db.patch(args.providerId, {
      clerkUserId: identity.subject,
    });
  },
});
