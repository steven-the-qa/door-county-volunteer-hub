// GitHub OAuth handshake for Decap CMS's "github" backend.
//
// Routes:
//   GET /auth        -> redirect the CMS login popup to GitHub's authorize page
//   GET /callback     -> exchange the code for a token, write the result to
//                        this origin's localStorage, close the popup
//   GET /relay.html   -> meant to be embedded as a hidden iframe on /admin.
//                        Relays that localStorage result to the admin page.
//
// Why the indirection: Decap's own bundle (checked directly) only accepts
// the login message when `event.origin === this.base_url` — i.e. it must
// come from a window whose origin is exactly this Worker's origin. A popup
// would normally provide that via `window.opener.postMessage(...)`, but
// GitHub's OAuth consent page sends Cross-Origin-Opener-Policy, which
// permanently nulls the popup's `window.opener` the moment it navigates
// there — before the popup ever reaches this Worker. So there is no window
// reference *and* no way to send the message from the right origin via the
// popup alone.
//
// The fix: admin/index.html embeds a hidden, persistent <iframe> pointed at
// /relay.html. Iframes aren't touched by COOP (it only isolates top-level
// popups), so the iframe's link to its parent (the admin tab) always works,
// and since the iframe genuinely lives on this Worker's origin, a message it
// sends satisfies Decap's origin check. The popup and that iframe are
// same-origin, so they can hand the token off via localStorage without ever
// needing window.opener.
//
// Secrets (never in this repo):
//   npx wrangler secret put GITHUB_OAUTH_CLIENT_ID
//   npx wrangler secret put GITHUB_OAUTH_CLIENT_SECRET

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const SCOPE = "public_repo"; // repo is public; this covers contents + PRs
const STATE_COOKIE = "dcvh_oauth_state";
const STORAGE_KEY = "dcvh_oauth_result";
const ADMIN_ORIGIN = "https://docovolunteerhub.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/auth") return handleAuth(url, env);
    if (url.pathname === "/callback") return handleCallback(request, url, env);
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
    return resultPage("error", { message: "Login state mismatch — please try again." }, clearCookie);
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
    return resultPage("error", { message: "Could not reach GitHub." }, clearCookie);
  }

  if (!tokenBody || !tokenBody.access_token) {
    return resultPage(
      "error",
      { message: tokenBody && tokenBody.error_description ? tokenBody.error_description : "No token returned." },
      clearCookie
    );
  }

  return resultPage("success", { token: tokenBody.access_token, provider: "github" }, clearCookie);
}

function readCookie(cookieHeader, name) {
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + "="));
  return match ? match.slice(name.length + 1) : null;
}

// Rendered on THIS origin (dcvh-cms-auth...workers.dev) in the popup. Writes
// the result to this origin's localStorage — shared with the hidden relay
// iframe embedded in /admin — then closes itself. No window.opener use at all.
function resultPage(status, payload, setCookie) {
  const humanNote = status === "success" ? "You're logged in — this window will close." : `Login failed: ${payload.message}`;
  const html = `<!doctype html>
<html>
<body>
  <p>${escapeHtml(humanNote)}</p>
  <p>If this window is still open after a few seconds, close it and try logging in again from the admin tab.</p>
  <script>
  (function () {
    try {
      localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify({
        status: ${JSON.stringify(status)},
        payload: ${JSON.stringify(payload)},
        ts: Date.now()
      }));
    } catch (e) {}
    setTimeout(function () { window.close(); }, 300);
  })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: status === "success" ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8", "Set-Cookie": setCookie },
  });
}

// Served for the hidden iframe embedded on /admin. Lives on this Worker's
// origin the whole time the admin page is open, so it's never touched by
// GitHub's COOP header, and messages it sends satisfy Decap's
// `event.origin === base_url` check.
function relayPage() {
  const html = `<!doctype html>
<html>
<body>
<script>
(function () {
  var KEY = ${JSON.stringify(STORAGE_KEY)};
  var ADMIN_ORIGIN = ${JSON.stringify(ADMIN_ORIGIN)};

  function relay(status, payload) {
    if (window.parent === window) return;
    var message = "authorization:github:" + status + ":" + JSON.stringify(payload);
    window.parent.postMessage(message, ADMIN_ORIGIN);
  }

  function consume() {
    var raw;
    try { raw = localStorage.getItem(KEY); } catch (e) { return; }
    if (!raw) return;
    try {
      var result = JSON.parse(raw);
      relay(result.status, result.payload);
    } catch (e) {}
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  // Pick up a result that arrived before this iframe finished loading.
  consume();
  // And anything that arrives afterward, from the popup (same origin).
  window.addEventListener("storage", function (e) {
    if (e.key === KEY && e.newValue) consume();
  });
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
