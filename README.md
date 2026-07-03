# AI Company & Deal Research Assistant

Voer een bedrijfsnaam in en ontvang binnen enkele minuten een gestructureerde business-analyse — aangedreven door de Claude API.

Het rapport bevat:

- **Bedrijfsprofiel** — sector, hoofdkantoor, omvang en een samenvatting
- **Marktpositie** — score (0–100), typering, sterktes en relevante markttrends
- **Concurrenten** — de belangrijkste concurrenten, gewogen op dreigingsniveau
- **Partnership-fit** — score, ideaal partnerprofiel en concrete samenwerkingskansen
- **Risico's** — de belangrijkste risico's met ernst-inschatting
- **Strategische conclusie** — eindoordeel en aanbeveling

## Hoe het werkt

De frontend stuurt de bedrijfsnaam naar een Next.js API-route (`app/api/research/route.ts`). Die roept Claude aan met:

- **Webzoeken** (server-side tool) zodat de analyse op actuele bronnen is gebaseerd
- **Structured outputs** (JSON Schema) zodat het antwoord gegarandeerd het juiste formaat heeft — geen fragiele string-parsing
- **Adaptive thinking** zodat het model zelf bepaalt hoeveel het moet redeneren

Het gevalideerde JSON-rapport wordt vervolgens gerenderd als interactief dashboard.

## Lokaal draaien

1. Installeer dependencies:

   ```bash
   npm install
   ```

2. Maak een `.env.local` aan op basis van `.env.example` en vul je Anthropic API-sleutel in:

   ```bash
   cp .env.example .env.local
   ```

3. Start de dev-server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) en voer een bedrijfsnaam in.

> Een volledige analyse duurt doorgaans 1 à 3 minuten, omdat Claude eerst actuele bronnen doorzoekt.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS 4](https://tailwindcss.com)
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) — Claude Opus 4.8

## Disclaimer

De gegenereerde analyses zijn AI-ondersteuning bij besluitvorming, geen vervanging van eigen due diligence.
