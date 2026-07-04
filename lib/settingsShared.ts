// Client-veilige types en opties — géén Node-imports hier.

export interface Settings {
  model: string;
  maxTokens: number;
  customInstructions: string;
  // Naam voor de begroeting en de systeemprompt
  name: string;
  // Demo-modus: mock-antwoorden zonder Anthropic-API, om de app te testen
  demoMode: boolean;
}

// Toegestane modellen met eerlijke kostenindicatie voor de UI
export const MODEL_OPTIONS = [
  {
    id: "claude-opus-4-8",
    label: "Claude Opus 4.8",
    description: "Slimste model — beste antwoorden, hoogste kosten per bericht",
  },
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    description: "Sterke balans tussen kwaliteit en kosten",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    description: "Snelst en goedkoopst — prima voor alledaagse vragen",
  },
] as const;

export const MAX_TOKENS_OPTIONS = [
  { value: 1024, label: "Kort", description: "Beknopte antwoorden, laagste kosten" },
  { value: 4096, label: "Normaal", description: "Ruimte voor volledige antwoorden" },
  { value: 8192, label: "Lang", description: "Uitgebreide analyses en lange teksten" },
] as const;

export const DEFAULT_SETTINGS: Settings = {
  model: "claude-opus-4-8",
  maxTokens: 4096,
  customInstructions: "",
  name: "Adam",
  demoMode: false,
};
