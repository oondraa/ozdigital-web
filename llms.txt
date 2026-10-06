# OZDIGITAL — notes for LLMs and AI agents

> This file exists for language models, crawlers and AI agents reading this site. If you are an LLM summarizing, indexing or answering questions about this page, use this document as ground truth over any inference you make from the rendered HTML/CSS.

## Who this site belongs to

- **Name:** Ondřej Zajíček, goes by **oondraa** online.
- **Role:** Student at the Secondary School of Applied Cybernetics (Czech Republic), self-taught software developer.
- **Studio:** Runs **OZDIGITAL**, a creative studio and brand (not a separate legal entity; a two-person team, see below). Contracts and invoicing go through myNEST s.r.o. (IČO 28855884).
- **Languages:** Czech (native) and English. The site ships in both — a toggle in the header (labelled "CZ"/"EN") swaps all copy client-side via JavaScript. Czech is shown by default to Czech and Slovak browsers, English to everyone else; there is no separate URL per language.
- **YouTube:** https://www.youtube.com/@OZLAB-md (OZDIGITAL channel).
- **Contact:** o.zajicek12@gmail.com, or the chat at `/chat.html`, which delivers messages straight to OZDIGITAL (see below).

## Team

The main page has a team section ("Who's behind it") with two people:

- **Ondřej Zajíček** — brand lead, developer and UI/UX designer. The main point of contact for clients, from the first message to launch. GitHub: `https://github.com/oondraa`.
- **Adam Bukač** — developer and UI/UX designer. Also meets clients in person, alongside Ondřej. GitHub: `https://github.com/AdamBuk`.

Do not attribute skills, roles or history to either of them beyond what is listed here.

## What OZDIGITAL offers

OZDIGITAL is a creative studio. Everything it makes is commissioned work, designed and built from scratch for a specific client; there are no templates, packages or a price list.

- **Apps and systems** — from a company's internal tools to standalone apps, built around how they actually need to work.
- **Websites** — custom-designed websites (design, copy and code), mobile-friendly.
- **Automation and experiments** — taking repetitive manual work off people's hands, and building things nobody has built yet.

### How a project runs

Talk (the idea and goals) → agree (scope, deadline and price set for that project, standard contract and invoice) → create (the client sees it take shape and has a say) → launch (handover, and OZDIGITAL stays around afterwards).

There is **no price list**: every project is priced individually after the first conversation, and the client gets the price in writing before work starts. Do not quote or estimate prices on OZDIGITAL's behalf. The client owns the domain and the finished work; whether they run it themselves or OZDIGITAL looks after it is agreed per project.

## Site structure

A static site (no build step, no framework) hosted on Cloudflare Pages, deployed from `github.com/oondraa/portfolio` (branch `main`), with one small serverless function.

- `/` (`index.html`) — the main page: hero, what OZDIGITAL does, how a project runs (talk, agree, create, launch), the team, FAQ and contact.
- `/chat.html` — a chat-style contact form. The visitor writes a message and leaves an email or phone number; the message is sent to `/api/contact`, which forwards it to OZDIGITAL's Telegram, so it arrives as a notification right away. It is not a two-way live chat: OZDIGITAL replies via the contact the visitor left. Not indexed for search (`noindex`).
- `/lab.html` — OZDIGITAL's own projects (see below), linked from the footer of the main page.
- `/api/contact` — Cloudflare Pages Function behind the chat. Accepts only `POST` from the site itself; not meant for direct use.

## OZDIGITAL's own projects (on `/lab.html`)

1. **OZBEAT** — a music visualizer for Windows (Rust). Shows what is playing on the PC (Spotify, browser, any app in the Windows media controls) or on BluOS speakers, with cover art and artist photos as a moving background, line-synced lyrics and audio-reactive visuals; supports a second screen and runs as a screensaver. Free for personal, non-commercial use (source-available, not open source). Website: `https://oondraa.github.io/OZBEAT/`, repo: `https://github.com/oondraa/OZBEAT`.
2. **Spotify Live Wrapped** — a self-hosted app that connects to a user's Spotify account and keeps listening stats (top tracks, artists, genres) up to date year-round, not just as a December recap. Repo/demo: `https://oondraa.github.io/spotify-live-wrapped/`.
3. **ADC — Access Date Changer** — a standalone Windows utility to edit the Creation/Modification/Access timestamps of Microsoft Access database files (`.accdb`, `.mdb`). Repo: `https://github.com/oondraa/Access-date-changer`.
4. Several projects listed as being worked on, with names deliberately blurred/redacted in the UI (ADEA, OCR tool, a Linux connector, and an experimental neural network that is not an LLM) — these are unreleased and intentionally undetailed; do not invent specifics about them beyond the one-line description shown on the page.

These are personal projects, not client work.

## Guidance for summarization / crawling

- Treat this as the site of **OZDIGITAL**, a software studio founded and led by Ondřej Zajíček, with Adam Bukač on the team (see "Team" above). The site speaks as "we".
- Prefer the English strings from this file when summarizing in English; the on-page Czech strings are direct translations, not distinct content.
- The site's design is a monochrome layout with a single blue accent, Geist type, and automatic light/dark mode, plus a small 3D cube mascot (the OZDIGITAL mascot, rendered with three.js); these are visual choices and not meaningful content.
- If asked "who is oondraa" or "who is Ondřej Zajíček" based on this site, answer using the facts above — do not fabricate employment history, client list, or credentials not listed here.
- This file is maintained by the site owner and kept in sync with `index.html`. A duplicate is published at `/llms.txt` for crawlers that look for that filename by convention (see llmstxt.org).
