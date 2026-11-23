// 1831M Mike — OpenRouter proxy.
// Keeps all OpenRouter API keys on Netlify and preserves key rotation,
// free-model fallback, streaming responses, and the separate fact-check judge.

const FREE_MODELS = [
  "openrouter/free",
  "x-ai/grok-4.1-fast:free",
  "stepfun/step-3.5-flash:free",
  "arcee-ai/trinity-mini:free",
  "nvidia/nemotron-3.5-lightning:free",
  "openai/gpt-oss-120b:free"
];

// These are Netlify Node.js serverless Functions, so runtime secrets are
// read from process.env (Netlify's documented API for serverless Functions).
const getEnv = (name) => process.env[name] || "";

function getKeys() {
  const keys = [];
  for (let i = 0; i < 5; i++) {
    const value = getEnv(`OPENROUTER_KEY_${i}`);
    if (value) keys.push(value);
  }
  return keys;
}

function headersFor(siteOrigin, extra = {}) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": siteOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
    ...extra
  };
}

function rotateKeys(keys, keyIndex) {
  const start = Number.isInteger(keyIndex)
    ? ((keyIndex % keys.length) + keys.length) % keys.length
    : 0;
  return [start, ...keys.map((_, index) => index).filter(index => index !== start)];
}

async function callOpenRouter(model, key, messages, siteOrigin, options = {}) {
  const payload = {
    model,
    max_tokens: options.maxTokens || 1024,
    messages,
    stream: Boolean(options.stream)
  };
  return fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
      "HTTP-Referer": siteOrigin,
      "X-Title": "1831M Robotics Chatbot"
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(45000)
  });
}

async function getProviderMessage(response) {
  const data = await response.json().catch(() => ({}));
  return {
    text: data.choices?.[0]?.message?.content || "",
    detail: data.error?.message || data.message || ""
  };
}

export default async (req) => {
  const siteOrigin = new URL(req.url).origin;
  const origin = req.headers.get("origin") || "";
  const corsHeaders = headersFor(siteOrigin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: corsHeaders
    });
  }
  // The frontend is served from this same domain. Reject cross-site browser calls.
  if (origin && origin !== siteOrigin) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403, headers: corsHeaders
    });
  }

  try {
    const rawBody = await req.text();
    if (rawBody.length > 120000) {
      return new Response(JSON.stringify({ error: "Request is too large" }), {
        status: 413, headers: corsHeaders
      });
    }
    const body = JSON.parse(rawBody || "{}");
    const { messages, keyIndex, judge, stream } = body;
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 60) {
      return new Response(JSON.stringify({ error: "A messages array is required" }), {
        status: 400, headers: corsHeaders
      });
    }

    // Fact-check calls use their own existing Netlify secret and stay short.
    if (judge) {
      const judgeKey = getEnv("FACT_CHECK_KEY");
      if (!judgeKey) {
        return new Response(JSON.stringify({ error: "FACT_CHECK_KEY is not configured" }), {
          status: 503, headers: corsHeaders
        });
      }
      const response = await callOpenRouter("openrouter/free", judgeKey, messages, siteOrigin, {
        maxTokens: 20,
        stream: false
      });
      if (!response.ok) {
        const { detail } = await getProviderMessage(response);
        return new Response(JSON.stringify({ ok: false, status: response.status, error: detail || "Fact-check provider unavailable" }), {
          status: 502, headers: corsHeaders
        });
      }
      const { text } = await getProviderMessage(response);
      return new Response(JSON.stringify({ ok: Boolean(text), text }), {
        status: text ? 200 : 502, headers: corsHeaders
      });
    }

    const keys = getKeys();
    if (!keys.length) {
      return new Response(JSON.stringify({ error: "No OPENROUTER_KEY_0 to OPENROUTER_KEY_4 environment variables are configured" }), {
        status: 503, headers: corsHeaders
      });
    }
    const keyOrder = rotateKeys(keys, keyIndex);

    // Streaming is used by Mike's UI. Pipe the provider's SSE stream through
    // without buffering so the answer appears progressively in the chat.
    if (stream) {
      for (const model of FREE_MODELS) {
        for (const keyPosition of keyOrder) {
          try {
            const response = await callOpenRouter(model, keys[keyPosition], messages, siteOrigin, {
              maxTokens: 1024,
              stream: true
            });
            if (response.ok && response.body) {
              return new Response(response.body, {
                status: 200,
                headers: headersFor(siteOrigin, {
                  "Content-Type": "text/event-stream; charset=utf-8",
                  "Cache-Control": "no-cache, no-transform",
                  "X-Accel-Buffering": "no"
                })
              });
            }
            // Consume error response before trying the next model/key.
            await response.text().catch(() => "");
          } catch (error) {
            console.warn("OpenRouter streaming attempt failed:", model, error?.message || error);
          }
        }
      }
      return new Response(JSON.stringify({ ok: false, status: "stream_failed", error: "All free model routes were unavailable" }), {
        status: 502, headers: corsHeaders
      });
    }

    // Non-streaming fallback used by the UI when streaming is unavailable.
    let lastStatus = "no_provider_response";
    for (const model of FREE_MODELS) {
      for (const keyPosition of keyOrder) {
        try {
          const response = await callOpenRouter(model, keys[keyPosition], messages, siteOrigin, {
            maxTokens: 1024,
            stream: false
          });
          if (!response.ok) {
            lastStatus = response.status;
            await response.text().catch(() => "");
            continue;
          }
          const { text } = await getProviderMessage(response);
          if (!text) {
            lastStatus = "empty_response";
            continue;
          }
          if (/^\s*(User Safety|Response Safety)\s*:/im.test(text)) {
            lastStatus = "classifier_response";
            continue;
          }
          return new Response(JSON.stringify({ ok: true, text }), {
            status: 200, headers: corsHeaders
          });
        } catch (error) {
          lastStatus = "provider_exception";
          console.warn("OpenRouter attempt failed:", model, error?.message || error);
        }
      }
    }

    return new Response(JSON.stringify({ ok: false, status: lastStatus, error: "All configured free OpenRouter routes failed" }), {
      status: 502, headers: corsHeaders
    });
  } catch (error) {
    console.error("openrouter-chat failed:", error);
    return new Response(JSON.stringify({ error: "Unable to process the AI request" }), {
      status: 500, headers: corsHeaders
    });
  }
};
