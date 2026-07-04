"use client";

import { useEffect, useState } from "react";

// De hoofdbegroeting is altijd tijdsgebonden mét naam ("Goedemiddag, Adam");
// daaronder wisselt een korte, Claude-achtige subtitel.
function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return "Goedenacht";
  if (hour < 12) return "Goedemorgen";
  if (hour < 18) return "Goedemiddag";
  return "Goedenavond";
}

export function pickGreeting(name = "Adam"): string {
  return `${timeGreeting()}, ${name}`;
}

export function pickTagline(name = "Adam"): string {
  const pool = [
    "Waarmee kan ik je helpen?",
    `Fijn je weer te zien, ${name}`,
    "Waar gaan we vandaag aan werken?",
    "Wat kan ik voor je doen?",
    "Klaar wanneer jij het bent",
    "Stel je vraag, ik denk mee",
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

// De begroeting wordt pas ná hydration gekozen, zodat de willekeur geen
// server/client-mismatch veroorzaakt, en gebruikt de naam uit Instellingen.
// Tot die tijd zijn de strings leeg — reserveer dus hoogte in de UI.
export function useGreeting(): { greeting: string; tagline: string } {
  const [texts, setTexts] = useState({ greeting: "", tagline: "" });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let name = "Adam";
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (typeof data.settings?.name === "string" && data.settings.name.trim()) {
          name = data.settings.name.trim();
        }
      } catch {
        // instellingen onbereikbaar — val terug op de standaardnaam
      }
      if (!cancelled) {
        setTexts({ greeting: pickGreeting(name), tagline: pickTagline(name) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return texts;
}
