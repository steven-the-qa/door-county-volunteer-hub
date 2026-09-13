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

// Builds the exact postMessage handshake Decap's GitHub backend expects:
// the popup waits for the opener to ping it, then replies once with the
// "authorization:github:<status>:<json>" string.
function messagePage(status, payload, setCookie) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  const humanNote = status === "success" ? "You're logged in — this window will close." : `Login failed: ${payload.message}`;

  const html = `<!doctype html>
<html>
<body>
  <p>${escapeHtml(humanNote)}</p>
  <p>If this window doesn't close on its own, you can close it and return to the admin tab.</p>
  <script>
  (function () {
    var message = ${JSON.stringify(message)};
    function receiveMessage(e) {
      if (!window.opener) return;
      window.opener.postMessage(message, e.origin);
      window.removeEventListener("message", receiveMessage, false);
    }
    window.addEventListener("message", receiveMessage, false);
    if (window.opener) window.opener.postMessage("authorizing:github", "*");
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
