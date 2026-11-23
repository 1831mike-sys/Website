# Local checks performed on this package

- `node --check` for all `.mjs` Netlify Functions.
- Parsed `package.json` and checked Netlify configuration.
- Checked `deploy-to-netlify.command` with `bash -n`.
- Verified all frontend calls use relative same-site Netlify Function paths.
- Verified no hard-coded `1831mai.netlify.app` backend URL remains in the frontend or deployment target logic.
- Verified backend secret names match the original backend: `OPENROUTER_KEY_0` through `_4`, `FACT_CHECK_KEY`, `GEMINI_API_KEY`, `VEX_API_TOKEN`.
- Confirmed the health endpoint reveals presence/counts only, never secret values.
- Verified ZIP can be opened and extracted.

These are local source/package checks. No real Netlify account deploy or live API call is claimed. After running the launcher, use `/.netlify/functions/health` on the NEW site, then send a test message in `/chatbot.html`.
