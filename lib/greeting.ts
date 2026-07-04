"use client";

import { useEffect, useState } from "react";

// Wisselende, Claude-achtige begroetingen. Tijdsgebonden varianten wegen
// dubbel zodat "Goedemiddag, Adam" het vaakst voorbijkomt.
function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return "Goedenacht";
  if (hour < 12) return "Goedemorgen";
  if (hour < 18) return "Goedemiddag";
  return "Goedenavond";
}

export function pickGreeting(name = "Adam"): string {
  const timed = `${timeGreeting()}, ${name}`;
  const pool = [
    timed,
    timed,
    "Waarmee kan ik je helpen?",
    `Fijn je weer te zien, ${name}`,
    "Waar gaan we vandaag aan werken?",
    `Wat kan ik voor je doen, ${name}?`,
    "Klaar wanneer jij het bent",
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

// De begroeting wordt pas ná hydration gekozen (via rAF), zodat de
// willekeur geen server/client-mismatch veroorzaakt. Tot die tijd is
// de string leeg — reserveer dus hoogte in de UI.
export function useGreeting(name = "Adam"): string {
  const [greeting, setGreeting] = useState("");
  useEffect(() => {
    const id = requestAnimationFrame(() => setGreeting(pickGreeting(name)));
    return () => cancelAnimationFrame(id);
  }, [name]);
  return greeting;
}
