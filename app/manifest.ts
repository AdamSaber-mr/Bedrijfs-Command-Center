import type { MetadataRoute } from "next";

// Maakt de app installeerbaar (PWA): eigen venster, icoon in dock/homescreen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vantage",
    short_name: "Vantage",
    description:
      "Vantage — zakelijke AI-werkplek: chat, deal-research, projecten en notities.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0f1a",
    theme_color: "#10b981",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
