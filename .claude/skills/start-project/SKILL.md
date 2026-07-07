---
name: start-project
description: Start het Bedrijfs Command Center project (Next.js dev server) op http://localhost:3000/. Gebruik deze skill wanneer de gebruiker zegt "start mijn project", "start de project", "start de dev server", "run het project" of iets vergelijkbaars.
---

# Start project

Start de Next.js dev server van dit project op poort 3000.

## Stappen

1. Controleer of poort 3000 al bezet is:
   ```bash
   lsof -nP -iTCP:3000 -sTCP:LISTEN
   ```
   - Draait er al een Next.js dev server van dit project? Meld dan dat het project al draait op http://localhost:3000/ en stop.
   - Draait er een ander proces op poort 3000? Meld dit aan de gebruiker en vraag of dat proces gestopt mag worden.

2. Start de dev server in de achtergrond vanaf de projectroot:
   ```bash
   npm run dev -- --port 3000
   ```
   (gebruik `run_in_background: true`)

3. Wacht tot de server reageert:
   ```bash
   for i in $(seq 1 30); do curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ && break; sleep 1; done
   ```
   Elke HTTP-statuscode (ook 307/redirect) betekent dat de server draait.

4. Meld aan de gebruiker dat het project draait op **http://localhost:3000/**.
