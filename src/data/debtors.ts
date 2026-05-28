// src/data/debtors.ts
import raw from '../../data/debtors.json';

export type Debtor = {
  token: string;
  name: string;
  amount: number;
  backstory: string;
  characterSlug?: string; // Phase 7 — maps to /sprites/avatars/<slug>.png
  createdAt: string;
};

export const debtors: Debtor[] = raw as Debtor[];
