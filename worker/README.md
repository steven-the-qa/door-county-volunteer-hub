# dcvh-form worker

Cloudflare Worker that handles the volunteer interest form. On POST it sends two
branded emails through [Resend](https://resend.com):

1. **Notification** → `team@docovolunteerhub.com`, `Reply-To:` the volunteer
2. **Confirmation** → the volunteer, `Reply-To: team@docovolunteerhub.com`

The site (`../`) stays on GitHub Pages. This is a separate deploy — GitHub Pages
can't run code.

## One-time setup

### 1. Resend

1. Create an account at [resend.com](https://resend.com) (free — 3,000 emails/mo).
2. **Domains → Add Domain** → `docovolunteerhub.com`. Add the DNS records it shows
   (DKIM `CNAME`s + an SPF/MX on a `send.` subdomain) to Squarespace DNS. Wait for
   **Verified**. These sit on `send.docovolunteerhub.com`, so they don't touch the
   Google Workspace MX/SPF at the root.
3. **API Keys → Create** (sending permission). Copy the key.

### 2. Cloudflare

```bash
cd worker
npm install
npx wrangler login          # opens browser, free account
npx wrangler secret put RESEND_API_KEY   # paste the Resend key
npx wrangler deploy
```

Deploy prints the URL, e.g. `https://dcvh-form.<subdomain>.workers.dev`.

### 3. Point the site at it

In `../app.js` set `WORKER_ENDPOINT` to that URL, commit, push.

## Test without the site

```bash
curl -X POST https://dcvh-form.<subdomain>.workers.dev \
  -H "Origin: https://docovolunteerhub.com" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"Volunteer","email":"you@example.com","opportunityTitle":"Raptor Team volunteer","opportunityId":"odbs-raptor-team","orgName":"Open Door Bird Sanctuary"}'
```

Expect `{"ok":true,"confirmationSent":true}` and two emails.

## Logs

```bash
npx wrangler tail
```

## Notes

- Allowed origins are hard-coded in `src/index.js` (`ALLOWED_ORIGINS`). Add
  `http://localhost:<port>` there temporarily if testing the form locally.
- Spam controls: origin allowlist + a `company` honeypot field. Add Cloudflare
  Turnstile later if volume warrants.
- No secrets live in this folder — the Resend key is a Wrangler secret stored by
  Cloudflare.
