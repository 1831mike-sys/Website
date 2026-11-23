# 1831M — Website + Mike chatbot

This repository contains the 1831M main website, the Mike chatbot page, and the Netlify Functions used by both. It is intended for the new Netlify project `1831m-website`; it does not replace the old `1831mai` project.

## Site routes

- `/` — 1831M main website
- `/chatbot.html` — Mike chatbot
- `/.netlify/functions/health` — API configuration status (presence only; never outputs key values)
- `/.netlify/functions/openrouter-chat` — OpenRouter chat proxy
- `/.netlify/functions/gemini-chat` — Gemini backup / fact-check proxy
- `/.netlify/functions/teamdata` — VEX Events data proxy

## Deploy through GitHub + Netlify

1. Extract this ZIP.
2. Upload the *contents* of the extracted folder (not the ZIP file itself) to the root of `1831mike-sys/Website` on GitHub.
3. Commit the upload to the branch connected to the new Netlify project (normally `main`).
4. Netlify should automatically build and deploy after the commit if the `1831m-website` project is linked to this repository.

`netlify.toml` sets `public` as the publish directory and `netlify/functions` as the functions directory. No separate build command is needed for this static site.

## API environment variables

Set values only in the new Netlify project's environment-variable settings. Never place keys in HTML, JavaScript, GitHub, or this ZIP.

- `OPENROUTER_KEY_0` (at least one of keys 0–4 is needed for OpenRouter chat)
- `OPENROUTER_KEY_1` through `OPENROUTER_KEY_4` (optional rotation keys)
- `FACT_CHECK_KEY` (optional fact-check model key)
- `GEMINI_API_KEY` (optional Gemini backup key)
- `VEX_API_TOKEN` (optional live VEX Events data)

Important: credentials previously shown in screenshots or chat should be treated as exposed. Rotate affected credentials with their providers and add the fresh values as secret environment variables in Netlify. Do not copy old exposed values.

## Verification

The included `TEST-RESULTS.md` records the source checks already performed. A successful deploy still needs a live site test and valid, newly rotated credentials.
