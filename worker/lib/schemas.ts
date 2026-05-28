// worker/lib/schemas.ts
// Zod schema for POST /api/confirm payload validation.
import { z } from 'zod';

export const ConfirmSchema = z.object({
  token: z.string().min(16).max(22),
  modality: z.enum(['einmalzahlung', 'raten', 'aufschub']),
  installments: z.number().int().min(2).max(3).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(), // YYYY-MM-DD
  reason: z.string().max(500).optional(),
  // Phase 8: optional extra cents the debtor wants to add as a gift on top of their debt.
  // Capped at 100000 cents (1000 €) to prevent fat-finger / abuse. 0 = no extra.
  extraCents: z.number().int().min(0).max(100000).optional(),
});

export type ConfirmPayload = z.infer<typeof ConfirmSchema>;

// POST /api/admin/mark-paid + /api/admin/reset payload validation.
export const AdminTokenSchema = z.object({
  token: z.string().min(16).max(22),
});

export type AdminTokenPayload = z.infer<typeof AdminTokenSchema>;
