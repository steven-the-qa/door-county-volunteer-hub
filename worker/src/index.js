// Door County Volunteer Hub — form handler.
// Receives the interest form POST from the site, sends two branded emails via Resend:
//   1. notification to team@docovolunteerhub.com (Reply-To: the volunteer)
//   2. confirmation to the volunteer      (Reply-To: team@docovolunteerhub.com)
//
// Secret: RESEND_API_KEY  ->  npx wrangler secret put RESEND_API_KEY

import { teamNotificationEmail, volunteerConfirmationEmail } from "./emails.js";

// Origin is allowed by hostname, so http/https during the HTTPS-cert rollout and
// the github.io fallback all work without listing every scheme.
const ALLOWED_HOSTS = new Set([
  "docovolunteerhub.com",
  "www.docovolunteerhub.com",
  "steven-the-qa.github.io",
]);

function originAllowed(origin) {
  try {
    return ALLOWED_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

const FROM = "Door County Volunteer Hub <team@docovolunteerhub.com>";
const TEAM_INBOX = "team@docovolunteerhub.com";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const originOk = originAllowed(origin);
    const cors = {
      "Access-Control-Allow-Origin": originOk ? origin : "https://docovolunteerhub.com",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, cors);
    if (!originOk) return json({ ok: false, error: "forbidden_origin" }, 403, cors);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400, cors);
    }

    // Honeypot: real people leave the "company" field empty. Pretend success for bots.
    if (typeof body.company === "string" && body.company.trim() !== "") {
      return json({ ok: true }, 200, cors);
    }

    const firstName = str(body.firstName, 80);
    const lastName = str(body.lastName, 80);
    const email = str(body.email, 254);
    const opportunityTitle = str(body.opportunityTitle, 160);
    const opportunityId = str(body.opportunityId, 80);
    const orgName = str(body.orgName, 160);

    if (!firstName || !lastName || !email || !opportunityTitle || !orgName) {
      return json({ ok: false, error: "missing_fields" }, 400, cors);
    }
    if (!isEmail(email)) {
      return json({ ok: false, error: "invalid_email" }, 400, cors);
    }
    if (!env.RESEND_API_KEY) {
      return json({ ok: false, error: "not_configured" }, 500, cors);
    }

    const fullName = `${firstName} ${lastName}`;

    const [teamResult, volunteerResult] = await Promise.all([
      sendViaResend(env.RESEND_API_KEY, {
        from: FROM,
        to: [TEAM_INBOX],
        reply_to: email,
        subject: `New volunteer interest — ${opportunityTitle}`,
        html: teamNotificationEmail({ fullName, email, opportunityTitle, opportunityId, orgName }),
      }),
      sendViaResend(env.RESEND_API_KEY, {
        from: FROM,
        to: [email],
        reply_to: TEAM_INBOX,
        subject: "We got your volunteer interest — Door County Volunteer Hub",
        html: volunteerConfirmationEmail({ firstName, opportunityTitle, orgName }),
      }),
    ]);

    // The team notification is the one that can't be lost — fail loudly if it didn't send.
    if (!teamResult.ok) {
      console.error("team notification failed", teamResult.status, teamResult.detail);
      return json({ ok: false, error: "send_failed" }, 502, cors);
    }
    if (!volunteerResult.ok) {
      console.error("volunteer confirmation failed", volunteerResult.status, volunteerResult.detail);
    }

    return json({ ok: true, confirmationSent: volunteerResult.ok }, 200, cors);
  },
};

async function sendViaResend(apiKey, payload) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true, status: res.status };
    return { ok: false, status: res.status, detail: await res.text().catch(() => "") };
  } catch (err) {
    return { ok: false, status: 0, detail: String(err) };
  }
}

function str(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
