export function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

export const STUDY_LABELS: Record<string, string> = {
  NUCLEAR: "Nuclear Stress Test",
  STRESS_ECHO: "Stress Echocardiogram",
  ECHO: "Echocardiogram",
  VASCULAR: "Vascular Study (Carotid)",
};

export const STATUS_COLORS: Record<string, string> = {
  PROCESSING: "blue",
  APPROVED_CLEAN: "green",
  APPROVED_NEEDS_LETTER: "yellow",
  DENIED: "red",
  NEEDS_REVIEW: "orange",
};
