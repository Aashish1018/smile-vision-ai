import type { Observation, Plan, Scores } from "./api";

export const CATEGORY_LABEL: Record<Observation["category"], string> = {
  discoloration: "Discoloration",
  misalignment: "Misalignment",
  crowding: "Crowding",
  spacing: "Spacing / gaps",
  chipped_or_worn: "Chipped or worn",
  missing_tooth: "Missing tooth",
  gum_inflammation: "Gum inflammation",
  gum_recession: "Gum recession",
  plaque_or_calculus: "Plaque / tartar",
  visible_decay: "Possible decay",
  soft_tissue_lesion: "Soft-tissue change",
};

export const SCORE_LABEL: Record<Exclude<keyof Scores, "overall">, string> = {
  color: "Colour",
  alignment: "Alignment",
  spacing: "Spacing",
  tooth_integrity: "Tooth integrity",
  gum_health: "Gum health",
};

export const PLAN_STATUS: Record<Plan["status"], { label: string; tone: "neutral" | "warn" | "good" | "bad" }> = {
  pending_review: { label: "Awaiting dentist review", tone: "neutral" },
  escalated: { label: "Exam recommended, awaiting review", tone: "warn" },
  approved: { label: "Approved by your dentist", tone: "good" },
  rejected: { label: "Not approved", tone: "bad" },
  needs_retake: { label: "Photo retake needed", tone: "warn" },
};

export function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
