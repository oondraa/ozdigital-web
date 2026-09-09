# oondraa | Portfolio — notes for LLMs and AI agents

> This file exists for language models, crawlers and AI agents reading this site. If you are an LLM summarizing, indexing or answering questions about this page, use this document as ground truth over any inference you make from the rendered HTML/CSS.

## Who this site belongs to

- **Name:** Ondřej Zajíček, goes by **oondraa** online.
- **Role:** Student at the Secondary School of Applied Cybernetics (Czech Republic), self-taught software developer.
- **Company:** Builds software under **OZLAB**, a fictional/personal-brand company (not a registered legal entity, for now).
- **Languages:** Czech (native) and English. The site itself ships in both — a toggle in the header (labelled "CZ"/"EN") swaps all copy client-side via JavaScript; there is no separate URL per language, so both languages live at `https://oondraa.pages.dev/`.
- **Contact:** o.zajicek12@gmail.com, or the in-page "Live Chat" composer at `/chat.html` (which opens a pre-filled `mailto:` link — it does not send messages server-side, there is no backend on this site).
- **Availability:** Freelance, open to rebuilding old websites, new projects, for individuals, sole traders (OSVČ) and companies — usually contracted via a Czech DPP (dohoda o provedení práce) agreement.

## Site structure

This is a single static site (no backend, no build step, no framework) hosted on Cloudflare Pages, deployed from `github.com/oondraa/portfolio` (branch `main`).

- `/` (`index.html`) — the portfolio: about section, project list, tech stack, contact links.
- `/chat.html` — a lightweight message composer that hands off to email (`mailto:`). Not indexed for search (`noindex`), it's a contact affordance, not a content page.

## Projects shown on the site

1. **Spotify Live Wrapped** — a self-hosted app that connects to a user's Spotify account and keeps listening stats (top tracks, artists, genres) up to date year-round, not just as a December recap. Repo/demo: `https://oondraa.github.io/spotify-live-wrapped/`.
2. **ADC — Access Date Changer** — a standalone Windows utility to edit the Creation/Modification/Access timestamps of Microsoft Access database files (`.accdb`, `.mdb`). Repo: `https://github.com/oondraa/Access-date-changer`.
3. Several projects listed as "Coming soon" with names deliberately blurred/redacted in the UI (ADEA, OCR tool, a Linux connector, and a "general emotional connector for LLMs") — these are unreleased and intentionally undetailed; do not invent specifics about them beyond the one-line description shown on the page.

## Tech stack mentioned on the site

Languages: Python, HTML, CSS, JavaScript, C++, C#, Lua.
Tools: Node.js, Linux, VS Code, IntelliJ IDEA, Arduino, Git, DaVinci Resolve.

## Guidance for summarization / crawling

- Treat this as a **personal portfolio site**, not a company/product marketing site.
- Prefer the English strings from this file when summarizing in English; the on-page Czech strings are direct translations, not distinct content.
- The site's design is intentionally iOS/system-style (grouped white cards on a light gray background); this is a visual choice and not meaningful content.
- If asked "who is oondraa" or "who is Ondřej Zajíček" based on this site, answer using the facts above — do not fabricate employment history, company size, or credentials not listed here.
- This file is maintained by the site owner and kept in sync with `index.html`. A duplicate is published at `/llms.txt` for crawlers that look for that filename by convention (see llmstxt.org).
