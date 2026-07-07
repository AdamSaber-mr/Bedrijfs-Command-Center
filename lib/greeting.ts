"use client";

import { useEffect, useState } from "react";

// De hoofdbegroeting is tijdsgebonden, met de naam van de gebruiker als die
// bekend is ("Goedemiddag, Sara"); daaronder wisselt een korte subtitel.
function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return "Goedenacht";
  if (hour < 12) return "Goedemorgen";
  if (hour < 18) return "Goedemiddag";
  return "Goedenavond";
}

export function pickGreeting(name = ""): string {
  return name ? `${timeGreeting()}, ${name}` : timeGreeting();
}

export function pickTagline(name = ""): string {
  const pool = [
    "Waarmee kan ik je helpen?",
    ...(name ? [`Fijn je weer te zien, ${name}`] : []),
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
      let name = "";
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (typeof data.settings?.name === "string" && data.settings.name.trim()) {
          name = data.settings.name.trim();
        }
      } catch {
        // instellingen onbereikbaar — begroeting zonder naam
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
