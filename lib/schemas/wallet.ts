import { z } from "zod";

export const walletActionSchema = z.enum(["add", "commit", "push"]);

export const walletHashSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{8}$/i, "hash must be an 8-character SHA-256 prefix");

export const walletAddInputSchema = z.object({
  summary: z.string().trim().min(1, "summary is required"),
  files: z.array(z.string().trim().min(1, "file path cannot be empty")).min(1, "files is required")
});

export const walletPushInputSchema = z.object({
  hash: walletHashSchema
});

export const walletDraftSchema = z.object({
  stage: z.literal("add"),
  summary: z.string(),
  files: z.array(z.string()),
  updatedAt: z.string()
});

export const walletCommitSchema = z.object({
  hash: walletHashSchema,
  stage: z.enum(["commit", "push"]),
  summary: z.string(),
  files: z.array(z.string()),
  createdAt: z.string(),
  pushedAt: z.string().optional()
});

export const walletOperationStatusSchema = z.enum(["success", "error"]);

export const walletOperationLogSchema = z.object({
  action: walletActionSchema,
  status: walletOperationStatusSchema,
  message: z.string(),
  createdAt: z.string(),
  hash: walletHashSchema.optional(),
  summary: z.string().optional(),
  filesCount: z.number().int().nonnegative().optional()
});

export type WalletAction = z.infer<typeof walletActionSchema>;