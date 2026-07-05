import type { Metadata } from "next";
import { Space_Grotesk, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const bodyFont = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const monoFont = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vantage",
  description:
    "Vantage — zakelijke AI-werkplek aangedreven door Claude: chat met opgeslagen gesprekken, deal-research met gestructureerde business-analyses en exporteerbare trainingsdata.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="nl"
      suppressHydrationWarning
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <head>
        {/* Zet thema en accentkleur vóór de eerste render om flikkeren te
            voorkomen. Zonder opgeslagen keuze volgt het thema het systeem. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}var a=localStorage.getItem("accent");if(a){document.documentElement.dataset.accent=a}}catch(e){document.documentElement.classList.add("dark")}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
