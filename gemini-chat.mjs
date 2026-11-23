// 1831M Mike — Gemini backup/fact-check proxy.
// The existing GEMINI_API_KEY remains a private Netlify environment variable.
// gemini-3.5-flash-lite currently has a documented Gemini API free tier.

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
// These are Netlify Node.js serverless Functions, so runtime secrets are
// read from process.env (Netlify's documented API for serverless Functions).
const getEnv = (name) => process.env[name] || "";

function headersFor(siteOrigin) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": siteOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

export default async (req) => {
  const siteOrigin = new URL(req.url).origin;
  const origin = req.headers.get("origin") || "";
  const headers = headersFor(siteOrigin);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }
  if (origin && origin !== siteOrigin) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers });
  }

  const apiKey = getEnv("GEMINI_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY is not configured" }), { status: 503, headers });
  }

  try {
    const rawBody = await req.text();
    if (rawBody.length > 120000) {
      return new Response(JSON.stringify({ error: "Request is too large" }), { status: 413, headers });
    }
    const { systemPrompt = "", contents } = JSON.parse(rawBody || "{}");
    if (!Array.isArray(contents) || contents.length === 0) {
      return new Response(JSON.stringify({ error: "A contents array is required" }), { status: 400, headers });
    }

    // Normalize the chat into alternating user/model turns. Gemini 3.5
    // requires the last turn to be from the user, not the model.
    const normalized = [];
    for (const item of contents) {
      if (!item || !["user", "model"].includes(item.role) || !Array.isArray(item.parts)) continue;
      const parts = item.parts.filter(part => part && typeof part.text === "string");
      if (!parts.length) continue;
      const previous = normalized[normalized.length - 1];
      if (previous && previous.role === item.role) previous.parts.push(...parts);
      else normalized.push({ role: item.role, parts: [...parts] });
    }
    while (normalized.length && normalized[0].role === "model") normalized.shift();
    while (normalized.length && normalized[normalized.length - 1].role === "model") normalized.pop();
    if (!normalized.length || normalized[normalized.length - 1].role !== "user") {
      return new Response(JSON.stringify({ error: "Gemini chat must end with a user message" }), { status: 400, headers });
    }

    // Use the Google API's camelCase REST field name: systemInstruction.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        contents: normalized,
        generationConfig: { maxOutputTokens: 1024 }
      }),
      signal: AbortSignal.timeout(45000)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const providerMessage = data.error?.message || `Gemini returned HTTP ${response.status}`;
      console.warn("Gemini provider error:", response.status, providerMessage);
      return new Response(JSON.stringify({ ok: false, status: response.status, error: providerMessage }), {
        status: 502, headers
      });
    }

    const text = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("")
      .trim();
    if (!text) {
      return new Response(JSON.stringify({ ok: false, status: "empty_response", error: "Gemini returned no text" }), {
        status: 502, headers
      });
    }
    return new Response(JSON.stringify({ ok: true, text }), { status: 200, headers });
  } catch (error) {
    console.error("gemini-chat failed:", error);
    return new Response(JSON.stringify({ ok: false, error: "Unable to contact Gemini" }), {
      status: 500, headers
    });
  }
};
