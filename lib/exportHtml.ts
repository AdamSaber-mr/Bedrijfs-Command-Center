import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import type { Chat } from "./chatStore";
import type { SavedReport } from "./reportStore";

// Standalone HTML-exports om te delen: zelfvoorzienend bestand (inline CSS,
// licht/donker via prefers-color-scheme, print-vriendelijk) in Vantage-stijl.

// Zelfde remark-pijplijn als react-markdown, maar dan server-side naar een
// HTML-string (react-dom/server is niet toegestaan in route handlers).
const processor = unified().use(remarkParse).use(remarkRehype).use(rehypeStringify);

function md(content: string): string {
  return String(processor.processSync(content));
}

function esc(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const STYLE = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: #f8fafc; color: #1e293b; line-height: 1.65;
    padding: 48px 20px;
  }
  .sheet { max-width: 760px; margin: 0 auto; }
  header { margin-bottom: 36px; }
  .brand {
    font-family: Georgia, "Times New Roman", serif; font-weight: 600;
    font-size: 20px; letter-spacing: -0.01em;
  }
  h1 {
    font-family: Georgia, "Times New Roman", serif; font-size: 30px;
    letter-spacing: -0.01em; margin-top: 14px; line-height: 1.25;
  }
  .meta { color: #64748b; font-size: 13px; margin-top: 8px; }
  .divider { border: 0; border-top: 1px solid rgba(15,23,42,.1); margin: 28px 0; }
  .msg { margin-bottom: 26px; }
  .who { font-size: 12px; font-weight: 600; text-transform: uppercase;
         letter-spacing: .08em; color: #64748b; margin-bottom: 6px; }
  .who.user { color: #059669; }
  .bubble p + p, .prose p + p { margin-top: 10px; }
  .bubble ul, .bubble ol, .prose ul, .prose ol { padding-left: 22px; margin: 10px 0; }
  .bubble pre, .prose pre {
    background: rgba(15,23,42,.05); border-radius: 10px; padding: 12px 14px;
    overflow-x: auto; font-size: 13px; margin: 10px 0;
  }
  .bubble code, .prose code { font-family: ui-monospace, Menlo, monospace; font-size: .9em; }
  .bubble h1,.bubble h2,.bubble h3,.prose h1,.prose h2,.prose h3 { margin: 16px 0 8px; }
  .bubble blockquote, .prose blockquote {
    border-left: 3px solid #10b981; padding-left: 12px; color: #475569; margin: 10px 0;
  }
  .bubble a, .prose a { color: #047857; }
  h2.section {
    font-family: Georgia, "Times New Roman", serif; font-size: 20px;
    margin: 30px 0 12px;
  }
  .card {
    background: #fff; border: 1px solid rgba(15,23,42,.08);
    border-radius: 14px; padding: 18px 20px; margin-bottom: 12px;
  }
  .kv { display: grid; grid-template-columns: 130px 1fr; gap: 4px 16px; font-size: 14px; }
  .kv dt { color: #64748b; }
  .score { font-weight: 700; color: #059669; }
  .pill {
    display: inline-block; font-size: 11px; font-weight: 600; border-radius: 999px;
    padding: 2px 10px; margin-left: 8px; vertical-align: middle;
  }
  .pill.laag { background: rgba(16,185,129,.12); color: #047857; }
  .pill.middel { background: rgba(245,158,11,.15); color: #b45309; }
  .pill.hoog { background: rgba(244,63,94,.14); color: #be123c; }
  ul.clean { padding-left: 22px; font-size: 14px; }
  ul.clean li + li { margin-top: 5px; }
  .sources { font-size: 13px; }
  .sources li + li { margin-top: 4px; }
  footer { margin-top: 44px; color: #94a3b8; font-size: 12px; }
  .atts { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
  .att-img { max-width: 320px; max-height: 240px; border-radius: 10px;
             border: 1px solid rgba(15,23,42,.1); }
  .att-chip { display: inline-block; font-size: 12px; color: #475569;
              background: rgba(15,23,42,.05); border: 1px solid rgba(15,23,42,.08);
              border-radius: 8px; padding: 4px 10px; }
  @media (prefers-color-scheme: dark) {
    .att-img { border-color: rgba(255,255,255,.12); }
    .att-chip { color: #94a3b8; background: rgba(255,255,255,.06);
                border-color: rgba(255,255,255,.1); }
    body { background: #0a0f1a; color: #e2e8f0; }
    .meta { color: #94a3b8; }
    .divider { border-top-color: rgba(255,255,255,.12); }
    .card { background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.1); }
    .bubble pre, .prose pre { background: rgba(255,255,255,.07); }
    .bubble a, .prose a { color: #34d399; }
    .who { color: #94a3b8; }
    .who.user { color: #34d399; }
    .kv dt { color: #94a3b8; }
    footer { color: #64748b; }
  }
  @media print {
    body { background: #fff; padding: 0; }
    .card { break-inside: avoid; }
  }
`;

function page(title: string, meta: string, body: string): string {
  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Vantage</title>
<style>${STYLE}</style>
</head>
<body>
<div class="sheet">
<header>
<div class="brand">Vantage</div>
<h1>${esc(title)}</h1>
<p class="meta">${esc(meta)}</p>
</header>
${body}
<footer>Geëxporteerd uit Vantage</footer>
</div>
</body>
</html>`;
}

export function chatToHtml(chat: Chat, userName: string): string {
  const body = chat.messages
    .map((m) => {
      const who = m.role === "user" ? esc(userName || "Jij") : "Vantage";
      const at = m.at
        ? ` · ${new Date(m.at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}`
        : "";
      // Bijlagen: afbeeldingen worden in het bestand geëmbed (data-URI),
      // overige bijlagen als vermelding met bestandsnaam.
      const attachments = (m.attachments ?? [])
        .map((att) =>
          att.mediaType.startsWith("image/")
            ? `<img class="att-img" src="data:${esc(att.mediaType)};base64,${att.data.replace(/[^A-Za-z0-9+/=]/g, "")}" alt="${esc(att.name)}">`
            : `<span class="att-chip">📎 ${esc(att.name)}</span>`
        )
        .join("");
      return `<section class="msg">
<p class="who ${m.role === "user" ? "user" : ""}">${who}${at}</p>
${attachments ? `<div class="atts">${attachments}</div>` : ""}
<div class="bubble">${md(m.content)}</div>
</section>`;
    })
    .join("\n<hr class=\"divider\">\n");
  return page(chat.title, `Gesprek · ${dateLabel(chat.createdAt)}`, body);
}

export function reportToHtml(saved: SavedReport): string {
  const r = saved.report;
  const list = (items: string[]) =>
    `<ul class="clean">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;

  const body = `
<h2 class="section">Bedrijfsprofiel</h2>
<div class="card">
  <dl class="kv">
    <dt>Sector</dt><dd>${esc(r.company.industry)}</dd>
    <dt>Hoofdkantoor</dt><dd>${esc(r.company.headquarters)}</dd>
    <dt>Opgericht</dt><dd>${esc(r.company.founded)}</dd>
    <dt>Omvang</dt><dd>${esc(r.company.size)}</dd>
  </dl>
  <div class="prose" style="margin-top:12px">${md(r.company.summary)}</div>
</div>

<h2 class="section">Marktpositie <span class="score">${r.market_position.score}/100</span></h2>
<div class="card">
  <p style="font-size:14px"><strong>${esc(r.market_position.position)}</strong></p>
  <div class="prose" style="margin-top:8px">${md(r.market_position.analysis)}</div>
  <p style="margin-top:12px;font-size:13px;color:#64748b">Sterktes</p>
  ${list(r.market_position.strengths)}
  <p style="margin-top:12px;font-size:13px;color:#64748b">Markttrends</p>
  ${list(r.market_position.trends)}
</div>

<h2 class="section">Concurrenten</h2>
${r.competitors
  .map(
    (c) => `<div class="card">
  <p style="font-size:14px"><strong>${esc(c.name)}</strong><span class="pill ${c.threat_level}">${c.threat_level}</span></p>
  <p style="font-size:14px;margin-top:6px">${esc(c.description)}</p>
</div>`
  )
  .join("")}

<h2 class="section">Partnership-fit <span class="score">${r.partnership_fit.score}/100</span></h2>
<div class="card">
  <div class="prose">${md(r.partnership_fit.analysis)}</div>
  <p style="margin-top:12px;font-size:13px;color:#64748b">Ideaal partnerprofiel</p>
  <p style="font-size:14px">${esc(r.partnership_fit.ideal_partner_profile)}</p>
  <p style="margin-top:12px;font-size:13px;color:#64748b">Kansen</p>
  ${list(r.partnership_fit.opportunities)}
</div>

<h2 class="section">Risico's</h2>
${r.risks
  .map(
    (risk) => `<div class="card">
  <p style="font-size:14px"><strong>${esc(risk.title)}</strong><span class="pill ${risk.severity}">${risk.severity}</span></p>
  <p style="font-size:14px;margin-top:6px">${esc(risk.description)}</p>
</div>`
  )
  .join("")}

<h2 class="section">Strategische conclusie</h2>
<div class="card"><div class="prose">${md(r.conclusion)}</div></div>

${
  saved.citations.length
    ? `<h2 class="section">Bronnen</h2>
<div class="card"><ol class="sources">${saved.citations
        .map((c) => `<li><a href="${esc(c.url)}">${esc(c.title || c.url)}</a></li>`)
        .join("")}</ol></div>`
    : ""
}`;

  return page(
    r.company.name || saved.company,
    `Deal-onderzoek · ${dateLabel(saved.createdAt)}`,
    body
  );
}
