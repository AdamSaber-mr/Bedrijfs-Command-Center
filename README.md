# Vantage

Een zakelijke AI-werkplek aangedreven door de Claude API. Kernonderdelen:

1. **Dashboard** (`/`) — overzicht met recente chats, opgeslagen deal-rapporten, statistieken en een directe vraagbalk.
2. **AI-chat** (`/chat`) — chatten met Claude in een cleane interface zoals ChatGPT/Claude.ai, mét webzoeken voor actuele vragen. Elke chat wordt automatisch opgeslagen en is exporteerbaar.
3. **Chats** (`/chats`) — volledig, doorzoekbaar overzicht van alle gesprekken.
4. **Company & Deal Research Assistant** (`/research`) — voer een bedrijfsnaam in en ontvang een gestructureerde business-analyse die wordt opgeslagen, inclusief bronvermeldingen.
5. **Notities** (`/notes`) — losse markdown-notities.
6. **Aanpassen** (`/aanpassen`) — beheer van herbruikbare prompt-sjablonen.

Overal beschikbaar: een **command palette** (⌘K / Ctrl+K) om te zoeken door chats, rapporten en acties, een **inklapbare sidebar** in Claude-stijl met een account-menu, en een licht/donker/automatisch thema (in te stellen via het account-menu of Instellingen).

## AI-chat & export

- Chats verschijnen in de sidebar, gegroepeerd op datum (vandaag / gisteren / deze week / ouder), en zijn te heropenen, filteren en verwijderen.
- Nieuwe chats krijgen na de eerste uitwisseling automatisch een korte AI-titel (gegenereerd door Haiku).
- Antwoorden streamen live het scherm in met markdown-weergave en syntax highlighting; genereren is te stoppen met de **Stop**-knop (het gedeeltelijke antwoord blijft bewaard).
- De chat kan het **web doorzoeken** voor actuele vragen (nieuws, cijfers, bedrijven); geciteerde bronnen verschijnen als lijst onder het antwoord.
- Per antwoord: **kopieer**-knop en — bij het laatste antwoord — **genereer opnieuw**.
- Elk gesprek wordt server-side opgeslagen als JSON in `data/chats/` (staat in `.gitignore`, blijft dus lokaal en privé).
- Via **"Exporteer gesprekken"** in het account-menu (linksonder) download je alle gesprekken als JSONL: één regel per gesprek, `{"messages": [{"role", "content"}, ...]}`. Bruikbaar als archief, in andere tools, of desgewenst als trainingsdata voor een eigen model.

## Company & Deal Research Assistant

Bereikbaar via **Deal Research** in de sidebar. Het rapport bevat:

- **Bedrijfsprofiel** — sector, hoofdkantoor, omvang en een samenvatting
- **Marktpositie** — score (0–100), typering, sterktes en relevante markttrends
- **Concurrenten** — de belangrijkste concurrenten, gewogen op dreigingsniveau
- **Partnership-fit** — score, ideaal partnerprofiel en concrete samenwerkingskansen
- **Risico's** — de belangrijkste risico's met ernst-inschatting
- **Strategische conclusie** — eindoordeel en aanbeveling
- **Gebruikte bronnen** — de webbronnen waarop de analyse is gebaseerd

Rapporten worden opgeslagen in `data/reports/` en zijn terug te vinden via de sidebar, het dashboard en het command palette. Met **"Chat over dit rapport"** start je een chat met het volledige rapport als context voor vervolgvragen.

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
