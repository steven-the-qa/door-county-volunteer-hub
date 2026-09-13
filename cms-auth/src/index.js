// GitHub OAuth handshake for Decap CMS's "github" backend.
//
// Routes:
//   GET /auth        -> redirect the CMS login popup to GitHub's authorize page
//   GET /callback    -> exchange the code for a token, stash the result in KV
//   GET /poll        -> read (and clear) the stashed result
//   GET /relay.html  -> hidden iframe on /admin; polls /poll and relays the
//                       result to the admin tab
//
// Why this shape (skip if you just want it working): two earlier approaches
// failed for reasons that only show up in a real browser, not in code
// review, so they're recorded here to save re-discovering them.
//
//   v1: popup posts to window.opener directly. Broken -- GitHub's OAuth
//   consent page sends Cross-Origin-Opener-Policy, which permanently nulls
//   window.opener the instant the popup navigates there. Confirmed directly
//   in-browser (both a normal profile and Incognito): window.opener was
//   null on the popup every time, so there is no reference left to
//   postMessage through, full stop.
//
//   v2: a hidden same-origin iframe on /admin relays via localStorage
//   instead. The "same-origin iframe" part was necessary and correct --
//   Decap's own bundle (checked directly) requires the message's
//   event.origin to exactly equal `base_url`, and iframes (unlike popups)
//   aren't touched by COOP. But the localStorage hand-off from the popup to
//   that iframe silently never arrived: modern browsers partition storage
//   by top-level site for third-party embeds, so the iframe -- a
//   third-party context under docovolunteerhub.com -- gets a *different*
//   localStorage bucket than the popup, which visits this Worker's origin
//   top-level (first-party, unpartitioned). Confirmed by writing from one
//   top-level tab on this origin and reading from a second top-level tab
//   (worked instantly) vs. reading from the embedded iframe (never arrived).
//
//   v3 (this version): no client-side storage at all. The popup's
//   /callback stashes the result server-side in KV; the iframe polls /poll
//   over plain fetch(), which isn't subject to either of the above.
//
// Secrets (never in this repo):
//   npx wrangler secret put GITHUB_OAUTH_CLIENT_ID
//   npx wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
//
// KV (one-time setup, see cms-auth/README.md):
//   npx wrangler kv namespace create OAUTH_RESULTS
//   -> paste the printed [[kv_namespaces]] block into wrangler.toml
//   npx wrangler deploy

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const SCOPE = "public_repo"; // repo is public; this covers contents + PRs
const STATE_COOKIE = "dcvh_oauth_state";
const KV_KEY = "pending";
const ADMIN_ORIGIN = "https://docovolunteerhub.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/auth") return handleAuth(url, env);
    if (url.pathname === "/callback") return handleCallback(request, url, env);
    if (url.pathname === "/poll") return handlePoll(env);
    if (url.pathname === "/relay.html") return relayPage();
    return new Response("Not found", { status: 404 });
  },
};

function handleAuth(url, env) {
  const state = crypto.randomUUID();
  const redirectUri = new URL("/callback", url).toString();

  const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", env.GITHUB_OAUTH_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", SCOPE);
  authorizeUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.toString(),
      "Set-Cookie": `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}

async function handleCallback(request, url, env) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = readCookie(request.headers.get("Cookie") || "", STATE_COOKIE);
  const clearCookie = `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

  if (!code || !state || !cookieState || state !== cookieState) {
    return finish("error", { message: "Login state mismatch — please try again." }, env, clearCookie);
  }

  const redirectUri = new URL("/callback", url).toString();
  let tokenBody;
  try {
    const tokenRes = await fetch(GITHUB_TOKEN_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });
    tokenBody = await tokenRes.json();
  } catch {
    return finish("error", { message: "Could not reach GitHub." }, env, clearCookie);
  }

  if (!tokenBody || !tokenBody.access_token) {
    return finish(
      "error",
      { message: tokenBody && tokenBody.error_description ? tokenBody.error_description : "No token returned." },
      env,
      clearCookie
    );
  }

  return finish("success", { token: tokenBody.access_token, provider: "github" }, env, clearCookie);
}

async function finish(status, payload, env, setCookie) {
  try {
    await env.OAUTH_RESULTS.put(KV_KEY, JSON.stringify({ status, payload }), { expirationTtl: 120 });
  } catch (e) {
    return new Response(
      `Server not fully configured (KV): ${String(e)}. See cms-auth/README.md's KV setup step.`,
      { status: 500, headers: { "Set-Cookie": setCookie } }
    );
  }

  const humanNote =
    status === "success" ? "You're logged in — this window will close." : `Login failed: ${payload.message}`;
  const html = `<!doctype html>
<html>
<body>
  <p>${escapeHtml(humanNote)}</p>
  <p>If this window is still open after a few seconds, close it and try logging in again from the admin tab.</p>
  <script>setTimeout(function () { window.close(); }, 300);</script>
</body>
</html>`;

  return new Response(html, {
    status: status === "success" ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8", "Set-Cookie": setCookie },
  });
}

// Polled by the relay iframe. Reads and immediately clears the pending
// result so a stale/replayed value can't be picked up twice.
async function handlePoll(env) {
  let raw = null;
  try {
    raw = await env.OAUTH_RESULTS.get(KV_KEY);
    if (raw) await env.OAUTH_RESULTS.delete(KV_KEY);
  } catch {
    // KV hiccup — treat as "nothing yet", the iframe will just poll again.
  }
  return new Response(raw || "{}", {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function readCookie(cookieHeader, name) {
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + "="));
  return match ? match.slice(name.length + 1) : null;
}

// Embedded as a hidden iframe on /admin (added via script, after Decap's own
// script tag — Decap takes over <body> on mount and wipes anything declared
// before it). Lives on this Worker's origin the whole time the admin page is
// open, so a message it sends satisfies Decap's `event.origin === base_url`
// check. Polls /poll over plain same-origin fetch(), not client storage.
function relayPage() {
  const html = `<!doctype html>
<html>
<body>
<script>
(function () {
  var ADMIN_ORIGIN = ${JSON.stringify(ADMIN_ORIGIN)};
  var attempts = 0;
  var MAX_ATTEMPTS = 90; // ~90s at 1s apart

  function poll() {
    attempts += 1;
    fetch("/poll", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.status) {
          if (window.parent !== window) {
            // Decap only starts listening for the actual result after it
            // first sees this exact ping — send it before the real payload,
            // not instead of it. (Decap replies to the ping by messaging
            // the original popup, which is long closed by now and will
            // throw — harmless, it still installs its result listener
            // first either way.)
            window.parent.postMessage("authorizing:github", ADMIN_ORIGIN);
            var message = "authorization:github:" + data.status + ":" + JSON.stringify(data.payload);
            window.parent.postMessage(message, ADMIN_ORIGIN);
          }
          return; // stop polling either way
        }
        if (attempts < MAX_ATTEMPTS) setTimeout(poll, 1000);
      })
      .catch(function () {
        if (attempts < MAX_ATTEMPTS) setTimeout(poll, 1500);
      });
  }

  poll();
})();
</script>
</body>
</html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}
