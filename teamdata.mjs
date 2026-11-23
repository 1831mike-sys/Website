// 1831M Mike — live VEX Events team data proxy.
// Preserves the original rankings, awards and match-history summary format.
// VEX_API_TOKEN is read privately from Netlify environment variables.

const VEX_API_BASE = "https://events.vex.com/api/v2";
const TEAM_NUMBER = "1831M";
// These are Netlify Node.js serverless Functions, so runtime secrets are
// read from process.env (Netlify's documented API for serverless Functions).
const getEnv = (name) => process.env[name] || "";

function headersFor(siteOrigin) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": siteOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=300",
    "Vary": "Origin"
  };
}

async function vexApi(token, path) {
  const response = await fetch(`${VEX_API_BASE}${path}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json"
    },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`VEX Events API ${response.status} on ${path}: ${body.substring(0, 200)}`);
  }
  return response.json();
}

function cleanEventName(name) {
  if (!name) return "Unknown event";
  let cleaned = String(name).trim();
  const parts = cleaned.split("@").map(part => part.trim());
  if (parts.length > 2 && parts[parts.length - 1] === parts[parts.length - 2]) {
    parts.pop();
    cleaned = parts.join(" @ ");
  }
  return cleaned.replace(/:\s*$/, "").trim();
}

function buildSummary(team, rankings, awards, matches) {
  const lines = [];
  lines.push(`TEAM ${team.number}${team.team_name ? " — " + team.team_name : ""}`);
  lines.push("");

  if (awards.length) {
    lines.push(`AWARDS (${awards.length} total):`);
    awards.forEach((award, index) => {
      lines.push(`${index + 1}. ${award.title} — ${cleanEventName(award.event && award.event.name)}`);
    });
    lines.push("");
  }

  if (rankings.length) {
    lines.push(`RANKINGS (${rankings.length} events):`);
    rankings.forEach(ranking => {
      lines.push(`- ${cleanEventName(ranking.event && ranking.event.name)}: Rank ${ranking.rank} (WP ${ranking.wp}, AP ${ranking.ap}, SP ${ranking.sp})`);
    });
    lines.push("");
  }

  if (matches.length) {
    const recent = matches.slice(-25);
    lines.push(`RECENT MATCHES (showing ${recent.length} most recent of ${matches.length} total):`);
    recent.forEach(match => {
      const eventName = cleanEventName(match.event && match.event.name);
      const roundName = match.round_name || match.round || "";
      const matchNumber = match.matchnum != null ? match.matchnum : "";
      const alliances = (match.alliances || []).map(alliance => ({
        names: (alliance.teams || [])
          .map(teamEntry => (teamEntry.team && teamEntry.team.name) ? teamEntry.team.name : "")
          .filter(Boolean),
        score: alliance.score || 0
      }));
      const ourAlliance = alliances.find(alliance => alliance.names.includes(TEAM_NUMBER));
      const theirAlliance = alliances.find(alliance => alliance !== ourAlliance);
      let result = "";
      if (ourAlliance && theirAlliance) {
        if (ourAlliance.score > theirAlliance.score) result = "WIN";
        else if (ourAlliance.score < theirAlliance.score) result = "LOSS";
        else result = "TIE";
      }
      const sideText = alliances.map(alliance => `${alliance.names.join("+")} ${alliance.score}`).join(" vs ");
      lines.push(`- [${eventName}] ${roundName} ${matchNumber}: ${sideText}${result ? " (" + result + ")" : ""}`);
    });
  }

  return lines.join("\n").trim();
}

export default async (req) => {
  const siteOrigin = new URL(req.url).origin;
  const origin = req.headers.get("origin") || "";
  const headers = headersFor(siteOrigin);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }
  if (origin && origin !== siteOrigin) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers });
  }

  const token = getEnv("VEX_API_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ error: "VEX_API_TOKEN is not configured on this Netlify site" }), {
      status: 503, headers
    });
  }

  try {
    const teamResponse = await vexApi(token, `/teams?number%5B%5D=${encodeURIComponent(TEAM_NUMBER)}`);
    const team = teamResponse.data && teamResponse.data[0];
    if (!team) {
      return new Response(JSON.stringify({ error: `Team ${TEAM_NUMBER} was not found in VEX Events` }), {
        status: 404, headers
      });
    }

    const teamId = encodeURIComponent(team.id);
    const [rankingsResponse, awardsResponse, matchesResponse] = await Promise.all([
      vexApi(token, `/teams/${teamId}/rankings`).catch(error => {
        console.warn("VEX rankings request failed:", error.message); return { data: [] };
      }),
      vexApi(token, `/teams/${teamId}/awards`).catch(error => {
        console.warn("VEX awards request failed:", error.message); return { data: [] };
      }),
      vexApi(token, `/teams/${teamId}/matches`).catch(error => {
        console.warn("VEX matches request failed:", error.message); return { data: [] };
      })
    ]);

    const summary = buildSummary(
      team,
      rankingsResponse.data || [],
      awardsResponse.data || [],
      matchesResponse.data || []
    );
    return new Response(JSON.stringify({ summary }), { status: 200, headers });
  } catch (error) {
    console.error("teamdata failed:", error);
    return new Response(JSON.stringify({ error: "Live VEX Events data is temporarily unavailable" }), {
      status: 502, headers
    });
  }
};
