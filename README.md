# Door County Volunteer Hub

A deliberately low-tech website that lists **current, verified volunteer
opportunities** for nonprofits in Door County, Wisconsin. All opportunity data
lives in one JSON file. No database, no build step, no framework.

See [PRD.md](PRD.md) for the full product/technical spec.

## How it works

- `data/opportunities.json` holds organizations and their opportunities.
- `app.js` fetches that file and renders the list in the browser, with filters.
- Only opportunities that are `status: "open"`, `verified: true`, and not past
  their `expiresDate` are shown.
- The "Express interest" form posts to [FormSubmit](https://formsubmit.co)
  (free, no account), which emails the connectors and auto-replies to the volunteer.

```
index.html · about.html · privacy.html   static pages
styles.css · app.js                      one stylesheet, one script
data/opportunities.json                  the only file you edit day-to-day
data/opportunities.schema.json            reference schema
scripts/validate.mjs                      node, no dependencies
.github/workflows/deploy.yml              validates JSON, deploys to GitHub Pages
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
- `expiresDate`: required. The listing auto-hides after this date.
- `categories`: keep to the list in `meta.categories` (the validator warns otherwise).

### Retiring an opportunity

Set `"status": "closed"` (or `"filled"`), or just let `expiresDate` pass.
Keep the entry for a while for reference; delete old ones periodically.

## One-time setup

### 1. Connect the interest form (FormSubmit)

1. Deploy the site (below) so the form is live.
2. Submit the form once with a real email. FormSubmit sends an activation email
   to `cosmicbobsleigh@gmail.com` — click the link.
3. That email contains a **random alias** endpoint. In `app.js`, set:
   ```js
   var FORMSUBMIT_ENDPOINT = "https://formsubmit.co/ajax/<your-alias>";
   ```
   Using the alias (not the raw address) keeps the inbox out of the page source.
4. Commit and push.

The form already sends `_cc` to `boutchersj@gmail.com`, a table-formatted email,
and a plain-text auto-response to the volunteer. Until the alias is set, the form
shows a "not connected yet — email us" message instead of submitting.

In Gmail, add a filter: from `formsubmit.co` (or containing the `_subject` text)
→ never send to spam, apply a label, and star it. Nothing is stored on
FormSubmit's side, so the email is the only record.

### 2. Host on GitHub Pages

1. Push this repo to GitHub.
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main`. The `deploy.yml` workflow validates the JSON and publishes.
4. Site URL: `https://<user>.github.io/door-county-volunteer-hub/`.

A custom domain can be added later under Settings → Pages without other changes
(all links and asset paths in this repo are relative).

## Local preview

Any static file server works, e.g.:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly via `file://` will fail to load the JSON (browser
security) — use a local server.
