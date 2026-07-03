export type ThreatLevel = "laag" | "middel" | "hoog";

export interface CompanyProfile {
  name: string;
  industry: string;
  headquarters: string;
  founded: string;
  size: string;
  summary: string;
}

export interface MarketPosition {
  score: number;
  position: string;
  strengths: string[];
  trends: string[];
  analysis: string;
}

export interface Competitor {
  name: string;
  description: string;
  threat_level: ThreatLevel;
}

export interface PartnershipFit {
  score: number;
  ideal_partner_profile: string;
  opportunities: string[];
  analysis: string;
}

export interface Risk {
  title: string;
  severity: ThreatLevel;
  description: string;
}

export interface ResearchReport {
  company: CompanyProfile;
  market_position: MarketPosition;
  competitors: Competitor[];
  partnership_fit: PartnershipFit;
  risks: Risk[];
  conclusion: string;
}

// JSON Schema voor structured outputs — Claude wordt hiermee gedwongen
// exact dit formaat terug te geven, zodat de frontend nooit hoeft te gokken.
export const RESEARCH_SCHEMA = {
  type: "object",
  properties: {
    company: {
      type: "object",
      properties: {
        name: { type: "string", description: "Officiële bedrijfsnaam" },
        industry: { type: "string", description: "Sector/branche" },
        headquarters: { type: "string", description: "Hoofdkantoor (stad, land)" },
        founded: { type: "string", description: "Oprichtingsjaar, of 'onbekend'" },
        size: { type: "string", description: "Indicatie bedrijfsgrootte (medewerkers/omzet), of 'onbekend'" },
        summary: { type: "string", description: "Korte samenvatting van wat het bedrijf doet (2-3 zinnen)" },
      },
      required: ["name", "industry", "headquarters", "founded", "size", "summary"],
      additionalProperties: false,
    },
    market_position: {
      type: "object",
      properties: {
        score: { type: "integer", description: "Marktpositie-score van 0 t/m 100" },
        position: { type: "string", description: "Typering van de positie, bv. 'Marktleider' of 'Uitdager'" },
        strengths: { type: "array", items: { type: "string" }, description: "3-4 belangrijkste sterktes" },
        trends: { type: "array", items: { type: "string" }, description: "2-4 relevante markttrends" },
        analysis: { type: "string", description: "Analyse van de marktpositie (3-5 zinnen)" },
      },
      required: ["score", "position", "strengths", "trends", "analysis"],
      additionalProperties: false,
    },
    competitors: {
      type: "array",
      description: "3 tot 5 belangrijkste concurrenten",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string", description: "Waarom dit een concurrent is en hoe ze zich verhouden (1-2 zinnen)" },
          threat_level: { type: "string", enum: ["laag", "middel", "hoog"] },
        },
        required: ["name", "description", "threat_level"],
        additionalProperties: false,
      },
    },
    partnership_fit: {
      type: "object",
      properties: {
        score: { type: "integer", description: "Partnership-potentieel van 0 t/m 100" },
        ideal_partner_profile: { type: "string", description: "Profiel van het type partner dat het beste past" },
        opportunities: { type: "array", items: { type: "string" }, description: "3-4 concrete samenwerkings- of dealkansen" },
        analysis: { type: "string", description: "Onderbouwing van de partnership-fit (3-5 zinnen)" },
      },
      required: ["score", "ideal_partner_profile", "opportunities", "analysis"],
      additionalProperties: false,
    },
    risks: {
      type: "array",
      description: "3 tot 5 belangrijkste risico's",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: ["laag", "middel", "hoog"] },
          description: { type: "string", description: "Toelichting op het risico (1-2 zinnen)" },
        },
        required: ["title", "severity", "description"],
        additionalProperties: false,
      },
    },
    conclusion: { type: "string", description: "Strategische eindconclusie en aanbeveling (3-5 zinnen)" },
  },
  required: ["company", "market_position", "competitors", "partnership_fit", "risks", "conclusion"],
  additionalProperties: false,
} as const;
