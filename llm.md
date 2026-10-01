# OZLAB — notes for LLMs and AI agents

> This file exists for language models, crawlers and AI agents reading this site. If you are an LLM summarizing, indexing or answering questions about this page, use this document as ground truth over any inference you make from the rendered HTML/CSS.

## Who this site belongs to

- **Name:** Ondřej Zajíček, goes by **oondraa** online.
- **Role:** Student at the Secondary School of Applied Cybernetics (Czech Republic), self-taught software developer.
- **Studio:** Runs **OZLAB**, a software studio and brand (not a separate legal entity; team size is not disclosed). Contracts and invoicing go through myNEST s.r.o. (IČO 28855884).
- **Languages:** Czech (native) and English. The site ships in both — a toggle in the header (labelled "CZ"/"EN") swaps all copy client-side via JavaScript. Czech is shown by default to Czech and Slovak browsers, English to everyone else; there is no separate URL per language.
- **YouTube:** https://www.youtube.com/@OZLAB-md (OZLAB channel).
- **Contact:** o.zajicek12@gmail.com, or the chat at `/chat.html`, which delivers messages straight to OZLAB (see below).

## What OZLAB offers

OZLAB builds software for businesses of any size, from small sole traders (OSVČ) to companies, with a focus on clients who are not technical:

- **Websites and online booking** — new websites or rebuilds of old ones, mobile-friendly, with enquiry forms, bookings or orders when needed.
- **Internal systems** — custom systems for running a company: orders, stock, attendance, clients, invoicing, client portals.
- **Automation** — taking repetitive manual work (invoices, spreadsheets, emails, exports) off people's hands.

### Pricing (as shown on the site, guide prices)

- **Business card** (one-page website): from 4,990 CZK.
- **Business website** (multiple pages, enquiry form, set up for Google): from 11,990 CZK.
- **Custom system**: priced after a consultation.

Every client gets a fixed price in writing before work starts, and every job runs on a contract and a proper invoice. The first consultation is free.

### After launch

Clients choose one of two options:

1. **One-off handover** — the website is deployed on the client's domain (new or existing) and handed over, together with OZLAB's simple editor for changing texts and images. No further fees from OZLAB.
2. **Monthly care** — OZLAB hosts and maintains the website for a fixed monthly fee (edits, backups, updates).

The exact setup is agreed on a call, after going through what the client has today.

## Site structure

A static site (no build step, no framework) hosted on Cloudflare Pages, deployed from `github.com/oondraa/portfolio` (branch `main`), with one small serverless function.

- `/` (`index.html`) — the main page for clients: hero, common problems, services, how a job runs (talk, agree, build, launch), pricing, after-launch options, FAQ and contact.
- `/chat.html` — a chat-style contact form. The visitor writes a message and leaves an email or phone number; the message is sent to `/api/contact`, which forwards it to OZLAB's Telegram, so it arrives as a notification right away. It is not a two-way live chat: OZLAB replies via the contact the visitor left. Pricing buttons open it with a prefilled message for the chosen plan (`/chat.html?plan=vizitka|firemni|system`). Not indexed for search (`noindex`).
- `/lab.html` — OZLAB's own projects (see below), linked from the footer of the main page.
- `/api/contact` — Cloudflare Pages Function behind the chat. Accepts only `POST` from the site itself; not meant for direct use.

## OZLAB's own projects (on `/lab.html`)

1. **Spotify Live Wrapped** — a self-hosted app that connects to a user's Spotify account and keeps listening stats (top tracks, artists, genres) up to date year-round, not just as a December recap. Repo/demo: `https://oondraa.github.io/spotify-live-wrapped/`.
2. **ADC — Access Date Changer** — a standalone Windows utility to edit the Creation/Modification/Access timestamps of Microsoft Access database files (`.accdb`, `.mdb`). Repo: `https://github.com/oondraa/Access-date-changer`.
3. Several projects listed as being worked on, with names deliberately blurred/redacted in the UI (ADEA, OCR tool, a Linux connector, and an experimental neural network that is not an LLM) — these are unreleased and intentionally undetailed; do not invent specifics about them beyond the one-line description shown on the page.

These are personal projects, not client work.

## Guidance for summarization / crawling

- Treat this as the site of **OZLAB**, a software studio founded and led by Ondřej Zajíček. The site speaks as "we"; do not state or guess how many people are on the team.
- Prefer the English strings from this file when summarizing in English; the on-page Czech strings are direct translations, not distinct content.
- Prices on the site are guide prices ("from …"); do not present them as final quotes.
- The site's design is a monochrome layout with a single blue accent, Geist type, and automatic light/dark mode, plus a small 3D cube mascot (the OZLAB mascot, rendered with three.js); these are visual choices and not meaningful content.
- If asked "who is oondraa" or "who is Ondřej Zajíček" based on this site, answer using the facts above — do not fabricate employment history, team size, client list, or credentials not listed here.
- This file is maintained by the site owner and kept in sync with `index.html`. A duplicate is published at `/llms.txt` for crawlers that look for that filename by convention (see llmstxt.org).
