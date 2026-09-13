# dcvh-cms-auth

GitHub OAuth proxy so the admin panel at [`/admin`](../admin) can log in with
GitHub and commit through [Decap CMS](https://decapcms.org). The panel itself
is two static files (`admin/index.html`, `admin/config.yml`) served by GitHub
Pages along with the rest of the site — this Worker is the one piece of real
backend it needs, because GitHub's OAuth token exchange requires a client
secret that can't live in a static page.

## How the pieces fit together

```
You visit docovolunteerhub.com/admin
  -> Decap CMS loads, shows "Login with GitHub"
  -> a hidden iframe on the page loads this Worker's /relay.html and starts polling
  -> popup opens to this Worker's /auth
  -> Worker redirects the popup to GitHub's own login/consent screen
  -> GitHub redirects back to this Worker's /callback with a code
  -> Worker exchanges the code for a token (using the client secret) and
     stashes the result in KV, then the popup closes itself
  -> the iframe's next poll picks up the result and hands it to Decap
  -> Decap now talks to the GitHub API directly, as you, to read/write files
```

The Worker never sees or stores your content edits, only the login handoff
(and only for a couple of minutes, then it expires) — every edit goes
through your own GitHub account and permissions.

This is more moving parts than a typical popup-OAuth flow because the
simpler versions don't actually work here: GitHub's OAuth page breaks
`window.opener`, and browser storage partitioning breaks sharing
`localStorage` between the popup and an iframe embedded on another site.
Both are explained in detail in the comment at the top of `src/index.js` if
you're curious or need to change this later.

## One-time setup

### 1. Create a GitHub OAuth App

GitHub → your avatar → **Settings → Developer settings → OAuth Apps → New
OAuth App**:

- **Application name**: Door County Volunteer Hub Admin
- **Homepage URL**: `https://docovolunteerhub.com`
- **Authorization callback URL**: `https://dcvh-cms-auth.docovolunteerhub.workers.dev/callback`

Save it, then **Generate a new client secret**. Copy both the **Client ID**
and the **Client Secret** — you'll paste them into Cloudflare next.

### 2. Create the KV namespace

Holds the login result for a couple of minutes between the popup finishing
and the admin page picking it up.

```bash
cd cms-auth
npm install
npx wrangler login
npx wrangler kv namespace create OAUTH_RESULTS
```

That prints an `id`. Open `wrangler.toml` and replace
`REPLACE_WITH_KV_NAMESPACE_ID` with it.

### 3. Deploy the Worker

```bash
npx wrangler deploy
npx wrangler secret put GITHUB_OAUTH_CLIENT_ID
npx wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
```

Confirm the deployed URL is exactly
`https://dcvh-cms-auth.docovolunteerhub.workers.dev` — it must match both the
GitHub OAuth App's callback URL and `admin/config.yml`'s `auth_endpoint` /
`base_url`. If Cloudflare gives you a different subdomain, update both of
those to match and redeploy.

### 4. Give teammates access

Decap's GitHub backend uses your actual GitHub permissions — whoever logs in
needs **write access to this repo**. Add them at repo **Settings →
Collaborators and teams → Add people**. There's no separate password system;
GitHub is the only gate.

## Using it

1. Go to `https://docovolunteerhub.com/admin`.
2. **Login with GitHub**, authorize the app once.
3. Open **Organizations & Opportunities**, edit the Meta / Organizations /
   Opportunities lists.
4. New opportunities default to **Status: draft** and **Verified: off** — they
   will not appear on the live site as-is.
5. Save. This does **not** commit to `main` — Decap is in **editorial
   workflow** mode, so it opens a real GitHub pull request instead.
6. Go review that PR on GitHub (or from the CMS's own workflow board). You'll
   see the full diff. **Confirm the opportunity with the organization before
   merging.** When it's confirmed, either flip Verified/Status in the CMS and
   re-save, or edit the PR's branch directly, then merge.
7. Merging runs the same `validate.mjs` + deploy pipeline as any other push —
   bad JSON still can't reach the live site.

## Local testing

```bash
cd cms-auth
cp .dev.vars.example .dev.vars   # fill in the two values
npx wrangler dev
```

`.dev.vars` is gitignored.

## Notes

- Scope requested is `public_repo` (this repo is public) — narrower than
  full `repo`.
- CSRF is covered by a short-lived, `HttpOnly` state cookie checked against
  the `state` query param on `/callback`.
- No secrets live in this folder — both OAuth values are Wrangler secrets
  stored by Cloudflare.
