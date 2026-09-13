# Door County Volunteer Hub

A deliberately low-tech website that lists **current, verified volunteer
opportunities** for nonprofits in Door County, Wisconsin. All opportunity data
lives in one JSON file. No database, no build step, no framework.

See [PRD.md](PRD.md) for the full product/technical spec.

## How it works

- `data/opportunities.json` holds organizations and their opportunities.
- `app.js` fetches that file and renders the list in the browser, with filters.
- Only opportunities that are `status: "open"`, `verified: true`, and not past
  their `expiresDate` (when one is set) are shown.
- The "Express interest" form posts to a Cloudflare Worker
  ([`worker/`](worker)), which sends a branded notification to the team and a
  branded confirmation to the volunteer via Resend.
- Content can also be edited through a small admin panel at `/admin`
  ([Decap CMS](https://decapcms.org)) instead of hand-editing the JSON — see
  [Admin panel](#admin-panel) below.

```
index.html · about.html · privacy.html   static pages
app.js · styles.css                      one script, one basic stylesheet — no framework, no build
data/opportunities.json                  the only file you edit day-to-day (or use /admin)
data/opportunities.schema.json            reference schema
scripts/validate.mjs                      node, no dependencies
.github/workflows/deploy.yml              validates JSON, deploys to GitHub Pages
admin/                                    Decap CMS panel, served as part of the site
worker/                                   Cloudflare Worker: form -> branded emails (Resend)
cms-auth/                                 Cloudflare Worker: GitHub OAuth for /admin
```

## Editing opportunities

1. Edit `data/opportunities.json`.
2. Run `node scripts/validate.mjs` to check it.
3. Commit and push to `main`. GitHub Actions validates and redeploys.

### Adding an opportunity

Add an object to the `opportunities` array. `orgId` must match an entry in
`organizations` (add the org there first if it's new).

```json
{
  "id": "odbs-2026-fall-grounds",
  "orgId": "open-door-bird-sanctuary",
  "title": "Fall grounds cleanup crew",
  "description": "Rake, haul brush, prep enclosures for winter.",
  "categories": ["outdoors", "manual-labor"],
  "commitment": "one-time",
  "schedule": "Saturdays in October 2026, 9am-12pm",
  "location": "On-site, Sawyer",
  "minAge": 16,
  "status": "open",
  "verified": true,
  "verifiedDate": "2026-09-05",
  "postedDate": "2026-09-05",
  "expiresDate": "2026-10-31",
  "coordinator": "Sam"
}
```

Rules:
- `id` / `orgId`: lowercase, digits, hyphens only. Never reuse an `id`.
- `status`: `open` shows; `filled` / `paused` / `closed` / `draft` hide.
- `verified`: only `true` after a connector confirms the need with the org.
- `expiresDate`: **optional**. Set it for one-time or time-boxed opportunities and
  the listing auto-hides after that date. Omit it for ongoing roles.
- `categories`: keep to the list in `meta.categories` (the validator warns otherwise).

### Retiring an opportunity

Set `"status": "closed"` (or `"filled"`). Time-boxed entries also drop off on
their own once `expiresDate` passes. Keep old entries around for reference for a
while, then delete them.

## One-time setup

### 1. Connect the interest form (Cloudflare Worker + Resend)

The "Express interest" form posts JSON to a small Cloudflare Worker
([`worker/`](worker)), which sends two branded emails via
[Resend](https://resend.com): a notification to `team@docovolunteerhub.com`
(Reply-To: the volunteer) and a confirmation to the volunteer (Reply-To:
`team@`). Full setup steps, secrets, and testing commands are in
**[worker/README.md](worker/README.md)**. Nothing here is FormSubmit anymore.

### 2. Host on GitHub Pages

1. Push this repo to GitHub.
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main`. The `deploy.yml` workflow validates the JSON and publishes.
4. Default URL: `https://steven-the-qa.github.io/door-county-volunteer-hub/`.

### Custom domain

Live at **https://docovolunteerhub.com** (registered via Squarespace).

- Squarespace DNS: apex `@` has four `A` records → `185.199.108.153` /
  `.109.153` / `.110.153` / `.111.153`; `www` is a `CNAME` → `steven-the-qa.github.io`.
- Repo **Settings → Pages → Custom domain** = `docovolunteerhub.com`; the `CNAME`
  file in this repo matches it.
- "Enforce HTTPS" is on once GitHub finishes issuing the cert.
- All links and asset paths in this repo are relative, so nothing else changed.

## Admin panel

`docovolunteerhub.com/admin` is a [Decap CMS](https://decapcms.org) form UI
for `data/opportunities.json` — an alternative to hand-editing the JSON in an
editor. It logs in with GitHub (only repo collaborators can), and every save
opens a **pull request** for review rather than committing straight to
`main`. New opportunities default to `status: draft` and `verified: false`
so nothing goes live until a connector confirms it with the organization.

Setup (one-time, needs a GitHub OAuth App + a second small Worker) is in
**[cms-auth/README.md](cms-auth/README.md)**.

## Local preview

Any static file server works, e.g.:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly via `file://` will fail to load the JSON (browser
security) — use a local server.
