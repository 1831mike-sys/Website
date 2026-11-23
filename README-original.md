# 1831M — one new website + Mike chatbot

This package puts the website, chatbot interface, and all AI/VEX backend functions on **one new Netlify project**. It does not deploy to the old chatbot project.

## Important: how the existing API keys are moved

The old chatbot project (`1831mai`) stores its API credentials in Netlify environment variables. Those values are not in the ZIP and do not automatically appear in a different Netlify project.

The included Mac deployment launcher handles this with Netlify's `env:clone` command:

1. It links to the old `1831mai` chatbot project only long enough to identify it as the source.
2. You choose or create a different Netlify project for the new website.
3. Netlify copies the old project's environment-variable settings server-to-server to the new project. Secret values are not printed in the terminal or stored in the ZIP.
4. It deploys the website and all four Netlify Functions to the new project.

The old chatbot project is left untouched as a deployment. The new project becomes the single home for the website and Mike's AI/VEX functions.

**The clone copies all environment variables on the old source project, not just the API variables.** Review the source before confirming, and only approve the copy if you are comfortable moving every variable from that project. If the old project has no value for a variable, cloning cannot create it. If Netlify reports that a protected variable cannot be cloned, that specific key will need to be set on the new project from its original provider account; never paste it into the website files.

## Deploy on macOS

1. Extract this ZIP.
2. Make sure Node.js 22.13.0 or newer is installed.
3. Double-click `deploy-to-netlify.command`.
4. Sign in to Netlify when the browser opens.
5. When asked for the SOURCE, select the old `1831mai` project that holds Mike's existing API environment variables. Confirm by typing `OLD-SOURCE`.
6. When asked for the TARGET, select your NEW website project, or choose option 2 to create a new Netlify project. Do not select `1831mai` as the target. Confirm by typing `NEW-TARGET`.
7. The launcher clones the environment-variable settings from source to target, links the folder to the target, and asks you to type `DEPLOY-NEW-SITE` before publishing.

The launcher makes you confirm both project IDs and refuses to deploy if source and target are the same project. It clears a stale local project link before asking you to select the source, so a previous run will not silently select the last target.

## Site routes after deployment

- `/` — 1831M main website
- `/chatbot.html` — Mike chatbot
- `/.netlify/functions/openrouter-chat` — OpenRouter proxy
- `/.netlify/functions/gemini-chat` — Gemini backup and fact-check proxy
- `/.netlify/functions/teamdata` — live VEX rankings, awards, and match history
- `/.netlify/functions/health` — reports whether API environment variables exist, without displaying their values

The frontend uses relative URLs, so all functions run on the new site's own domain. There are no hard-coded old-site API URLs.

## Environment variable names expected by the backend

These names match the original chatbot backend:

| Variable | Purpose | Required |
|---|---|---|
| `OPENROUTER_KEY_0` | First OpenRouter key | At least one of keys 0–4 is required |
| `OPENROUTER_KEY_1` | OpenRouter rotation | Optional |
| `OPENROUTER_KEY_2` | OpenRouter rotation | Optional |
| `OPENROUTER_KEY_3` | OpenRouter rotation | Optional |
| `OPENROUTER_KEY_4` | OpenRouter rotation | Optional |
| `FACT_CHECK_KEY` | Fact-check judge key | Optional; fact-check judge is disabled without it |
| `GEMINI_API_KEY` | Gemini backup and independent check | Optional but recommended |
| `VEX_API_TOKEN` | Live VEX team data | Optional |

The backend reads these from `process.env` at runtime. Keep them in Netlify environment settings; never paste them into HTML or commit them to source code. Netlify's `env:clone` command is used to transfer the saved variables to your separate new project.

## Free model configuration

- OpenRouter tries the free router and the listed `:free` model fallbacks. Free routing has quotas and availability limits that can change.
- Gemini uses `gemini-3.5-flash-lite` through the Gemini Developer API, which Google currently lists as a stable model and a free-tier option. Free-tier quotas and regional availability apply; the model can return quota or billing errors depending on the Google AI Studio project configuration.
- No key values are embedded in this package.

## Check after deployment

Open the new site's URL and add `/.netlify/functions/health`.

Expected fields include:
- `openrouterPrimary: true` — at least one OpenRouter key reached the new Functions environment.
- `openrouterKeyCount` — number of OpenRouter keys detected (never their values).
- `factCheck: true` — dedicated judge key detected.
- `geminiBackup: true` — Gemini key detected.
- `vexLiveData: true` — VEX token detected.

A `true` result confirms presence only, not that the provider key is valid or has available quota. Then open `/chatbot.html` and send a real test message. Check the `openrouter-chat` or `gemini-chat` function logs if a provider rejects a request.

## What is included

- Original Mike UI and system prompt.
- Streaming OpenRouter responses and non-streaming retry.
- Original five-key OpenRouter rotation and free-model fallback chain.
- Dedicated `FACT_CHECK_KEY` judge route.
- Gemini backup and background fact checking.
- VEX Events team lookup, rankings, awards, and match history.
- Main website, Ask Mike links, chatbot page, and local images.
- Netlify Functions, health endpoint, deployment launcher, and this guide.

## Verification limit

The source package can be syntax-checked and its requests tested using simulated provider responses. A real AI response still requires valid API credentials, available provider quotas, a successful new-site deploy, and a live test. The deployment launcher copies the actual existing Netlify environment variables only after you authorize Netlify login and select both projects.
