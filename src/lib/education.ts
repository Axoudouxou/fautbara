export type SchoolSystem = "ivoirien" | "francais" | "autre";

export const SCHOOL_SYSTEMS: { value: SchoolSystem; label: string; hint: string }[] = [
  { value: "ivoirien", label: "Système ivoirien", hint: "CEPE, BEPC, BAC" },
  { value: "francais", label: "Système français", hint: "Brevet, Bac" },
  { value: "autre", label: "Autre", hint: "Précisez le système" },
];

export const IVORIAN_MAIN_SERIES = ["A1", "A2", "B", "C", "D"] as const;

export const IVORIAN_ALL_SERIES = [
  "A1",
  "A2",
  "B",
  "C",
  "D",
  "E",
  "F1",
  "F2",
  "F3",
  "F4",
  "G1",
  "G2",
  "G3",
  "H",
] as const;

export type BudgetRange = "under_10000" | "10000_20000" | "over_20000";

export const BUDGET_RANGES: { value: BudgetRange; label: string }[] = [
  { value: "under_10000", label: "Moins de 10 000 FCFA" },
  { value: "10000_20000", label: "10 000 - 20 000 FCFA" },
  { value: "over_20000", label: "20 000 FCFA et plus" },
];

export type LearningStyle = "structured" | "conversational" | "practical";

export const LEARNING_STYLES: { value: LearningStyle; label: string }[] = [
  { value: "structured", label: "Structuré, avec des objectifs clairs" },
  { value: "conversational", label: "Décontracté, axé sur la conversation" },
  { value: "practical", label: "Par la pratique, exercices concrets" },
];

export type LearningObjective = "exam" | "catchup" | "advance" | "confidence";

export const LEARNING_OBJECTIVES: { value: LearningObjective; label: string }[] = [
  { value: "exam", label: "Réussir un examen" },
  { value: "catchup", label: "Combler des lacunes" },
  { value: "advance", label: "Aller plus loin" },
  { value: "confidence", label: "Reprendre confiance" },
];

export type PreferredFormat = "home" | "online" | "both";

export const PREFERRED_FORMATS: { value: PreferredFormat; label: string }[] = [
  { value: "home", label: "À domicile" },
  { value: "online", label: "En ligne" },
  { value: "both", label: "Les deux" },
];

export const AVAILABILITY_PERIODS = [
  { value: "morning", label: "Matin" },
  { value: "afternoon", label: "Après-midi" },
  { value: "evening", label: "Soir" },
] as const;

export const ONBOARDING_WEEKDAYS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
] as const;

export function budgetRangeToPriceArgs(range: BudgetRange | null): {
  prixMin?: number;
  prixMax?: number;
} {
  if (range === "under_10000") return { prixMax: 9999 };
  if (range === "10000_20000") return { prixMin: 10000, prixMax: 20000 };
  if (range === "over_20000") return { prixMin: 20000 };
  return {};
}
