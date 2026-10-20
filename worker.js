// Cloudflare Worker entry: runs the contact form endpoint and serves everything else as static assets.
// Reuses the Pages Function, so the same code works on both Workers and Pages.
import { onRequestPost, onRequest } from "./functions/api/contact.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/contact") {
      return request.method === "POST" ? onRequestPost({ request, env, ctx }) : onRequest();
    }
    return env.ASSETS.fetch(request);
  },
};
