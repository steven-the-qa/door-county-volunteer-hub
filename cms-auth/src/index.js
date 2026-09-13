// GitHub OAuth handshake for Decap CMS's "github" backend.
//
// Routes:
//   GET /auth      -> redirect the CMS login popup to GitHub's authorize page
//   GET /callback  -> exchange the code for a token, hand it back to the
//                     popup via postMessage in the format Decap expects
//
// Secrets (never in this repo):
//   npx wrangler secret put GITHUB_OAUTH_CLIENT_ID
//   npx wrangler secret put GITHUB_OAUTH_CLIENT_SECRET

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const SCOPE = "public_repo"; // repo is public; this covers contents + PRs
const STATE_COOKIE = "dcvh_oauth_state";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/auth") return handleAuth(url, env);
    if (url.pathname === "/callback") return handleCallback(request, url, env);
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
    return messagePage("error", { message: "Login state mismatch — please try again." }, clearCookie);
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
    return messagePage("error", { message: "Could not reach GitHub." }, clearCookie);
  }

  if (!tokenBody || !tokenBody.access_token) {
    return messagePage(
      "error",
      { message: tokenBody && tokenBody.error_description ? tokenBody.error_description : "No token returned." },
      clearCookie
    );
  }

  return messagePage("success", { token: tokenBody.access_token, provider: "github" }, clearCookie);
}

function readCookie(cookieHeader, name) {
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + "="));
  return match ? match.slice(name.length + 1) : null;
}

// Sends Decap's expected "authorization:github:<status>:<json>" string to the
// opener (the /admin tab). Decap's listener reacts to this message directly —
// it doesn't require a prior handshake — but the *first* send can race with
// Decap still wiring up its own listener right after opening the popup, so
// this retries for a few seconds instead of firing once and giving up.
function messagePage(status, payload, setCookie) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  const humanNote = status === "success" ? "You're logged in — this window will close." : `Login failed: ${payload.message}`;

  const html = `<!doctype html>
<html>
<body>
  <p>${escapeHtml(humanNote)}</p>
  <p>If this window is still open after a few seconds, close it and try logging in again from the admin tab.</p>
  <script>
  (function () {
    var message = ${JSON.stringify(message)};
    var attempts = 0;
    function send() {
      attempts += 1;
      if (window.opener) {
        try { window.opener.postMessage(message, "*"); } catch (e) {}
      }
      if (attempts < 20) {
        setTimeout(send, 500);
      }
    }
    send();
  })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: status === "success" ? 200 : 400,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": setCookie,
    },
  });
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
