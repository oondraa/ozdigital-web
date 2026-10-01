// Cloudflare Pages Function: POST /api/contact
// Forwards a message from chat.html to a Telegram chat, so it lands on the phone as a push notification.
// Needs two environment variables (Pages project > Settings > Variables and Secrets, locally in .dev.vars):
//   TELEGRAM_BOT_TOKEN  token from @BotFather
//   TELEGRAM_CHAT_ID    your chat id with the bot

const MAX_MESSAGE = 4000;
const MAX_CONTACT = 200;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function onRequestPost({ request, env }) {
  // Only accept posts made from this site's own pages.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  let data;
  try {
    data = await request.json();
  } catch (e) {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  // Honeypot: a hidden field people never fill in, bots often do. Pretend it worked.
  if (data.website) return json({ ok: true });

  const message = String(data.message || "").trim().slice(0, MAX_MESSAGE);
  const contact = String(data.contact || "").trim().slice(0, MAX_CONTACT);
  const lang = data.lang === "cz" ? "CZ" : "EN";
  if (!message || !contact) return json({ ok: false, error: "missing_fields" }, 400);

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return json({ ok: false, error: "not_configured" }, 500);
  }

  const when = new Date().toLocaleString("cs-CZ", { timeZone: "Europe/Prague" });
  const text = "💬 Nová zpráva z webu\n\n" + message + "\n\n📇 " + contact + "\n🕑 " + when + " · " + lang;

  const res = await fetch("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
  });
  if (!res.ok) {
    console.error("Telegram sendMessage failed:", res.status, await res.text());
    return json({ ok: false, error: "telegram" }, 502);
  }

  return json({ ok: true });
}

export function onRequest() {
  return json({ ok: false, error: "method_not_allowed" }, 405);
}
