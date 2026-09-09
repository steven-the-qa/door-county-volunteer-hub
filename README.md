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
app.js                                   one script (no framework, no build)
styles.css                               EMPTY placeholder — visual design pending;
                                         class hooks are documented at the top of the file
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

The inbox address is **not** in the site source. Activate FormSubmit from a
terminal instead:

1. Run (once), replacing `<inbox-address>` with the project inbox:
   ```bash
   curl -X POST https://formsubmit.co/ajax/<inbox-address> -d "activate=1"
   ```
2. FormSubmit emails that inbox an activation link **and** a permanent random
   alias. Click the activation link.
3. In `app.js`, set:
   ```js
   var FORMSUBMIT_ENDPOINT = "https://formsubmit.co/ajax/<your-alias>";
   ```
   The alias keeps the address out of the page source. Commit and push.

Until the alias is set, the form shows an "isn't available yet" message instead
of submitting. The form sends a table-formatted email and a plain-text
auto-response to the volunteer.

**Redundancy:** FormSubmit stores nothing, so the email is the only record. In
Gmail: (a) filter mail from `formsubmit.co` → never spam, label + star; (b) if a
second person needs every lead, add a Gmail auto-forward from the project inbox
to their address (keeps the second address off the site too).

The address also appears once on the Privacy page as a contact for
privacy/deletion requests — that is deliberate.

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
