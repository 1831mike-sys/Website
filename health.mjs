// Safe deployment check: returns configuration presence only, never secret values.
// These are Netlify Node.js serverless Functions, so runtime secrets are
// read from process.env (Netlify's documented API for serverless Functions).
const getEnv = (name) => process.env[name] || "";

export default async (req) => {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }
  const env = {
    openrouterPrimary: [0, 1, 2, 3, 4].some(index => Boolean(getEnv(`OPENROUTER_KEY_${index}`))),
    openrouterKeyCount: [0, 1, 2, 3, 4].filter(index => Boolean(getEnv(`OPENROUTER_KEY_${index}`))).length,
    factCheck: Boolean(getEnv("FACT_CHECK_KEY")),
    geminiBackup: Boolean(getEnv("GEMINI_API_KEY")),
    vexLiveData: Boolean(getEnv("VEX_API_TOKEN"))
  };
  return new Response(JSON.stringify({ ok: env.openrouterPrimary, service: "1831M Mike", environment: env }), {
    status: 200, headers
  });
};
