# Door County Volunteer Hub — MVP PRD

_Last updated: 2026-09-09_

## 1. Summary

A simple, static website that lists **current, verified volunteer opportunities** for
partner nonprofits in Door County. Sam and Steven act as human "connectors" between
prospective volunteers and nonprofits. All opportunity data lives in a single
version-controlled JSON file. No database, no logins, no CMS.

## 2. Problem

From the project brief:

- Nonprofits make it hard to *start* volunteering — inquiries by form/email/phone often go unanswered.
- Websites rarely list up-to-date openings; there's often no obvious volunteer contact.
- You usually have to already know a volunteer to hear about opportunities.
- Chronic volunteer shortage, especially volunteers under retirement age.
- Few orgs have a "welcome wagon" person to receive new volunteers.

## 3. Goals / Non-goals

### Goals (MVP)
- One trustworthy place to see **what help is needed right now** across partner orgs.
- Lower the activation cost to "I want to help" → a name + email, nothing more.
- Guarantee a human follow-up (Sam) so no inquiry disappears.
- Keep operating cost ≈ $0 and maintenance ≈ "edit a text file."

### Non-goals (explicitly out of scope for MVP)
- Volunteer accounts, profiles, or login.
- Shift scheduling / calendar sign-up / hour tracking.
- Org self-service portal — orgs email us; connectors edit the JSON.
- In-app messaging — coordination happens over email.
- Payments, donations, background checks.
- Native mobile app.

## 4. Users

| Persona | Needs | How MVP serves them |
|---|---|---|
| **Prospective volunteer** | See real openings, express interest fast, get a reply | Browse/filter list, submit 2-field form, get confirmation + human follow-up |
| **Partner nonprofit** | Fill a specific need without running a recruiting process | Emails the shared inbox; connectors post & coordinate |
| **Connector (Sam / Steven)** | Keep listings current, route volunteers, track placements | Edit JSON via Git; receive form submissions in shared inbox |

## 5. MVP feature requirements → technical requirements

| # | Requirement (user story) | Acceptance criteria | Technical implementation |
|---|---|---|---|
| F1 | As a visitor I see a list of current opportunities grouped/attributed by org | Each card shows org name, title, short description, commitment type, location, "posted" date | Static page renders from `data/opportunities.json` via vanilla JS `fetch()` + template; no framework |
| F2 | As a visitor I only ever see **active, verified** opportunities | Entries hidden automatically when `status != "open"`, `verified != true`, or (if `expiresDate` is set) it is in the past | Client-side filter at render time using the browser's current date |
| F3 | As a visitor I can narrow the list | Filter by category, commitment (one-time / recurring), and org; filters combine | Client-side filtering over the in-memory array; state in URL query string (`?org=&category=&commitment=`) — no PII in URL |
| F4 | As a visitor I can express interest in a specific opportunity | Native `<dialog>` form asks First name, Last name, Email + hidden opportunity/org fields; inline success message shown | **FormSubmit (formsubmit.co)** AJAX **alias** endpoint — free, unlimited, no account. The inbox address is never in the site source; activation is done once via `curl` from a terminal, then the alias is pasted into `app.js`. `_honey` honeypot + client honeypot check. `fetch()` submit, no page navigation. No backend code |
| F5 | Submissions reach the connectors immediately | Each submission emails the connectors with which opportunity it was for | FormSubmit notification (`_template: table`) → project inbox. Second-recipient redundancy is a Gmail auto-forward rule (not a `_cc` field — that would put a second address in the page source). Swap for a dedicated shared mailbox before wider launch |
| F6 | As a visitor I understand what happens next | (a) On-page: inline confirmation replacing the form ("we've got it, Sam will email you within ~2 business days"). (b) Email: the volunteer gets an auto-reply naming the specific org | Inline status `<p role="status">` on `fetch` success; FormSubmit `_autoresponse` hidden field (free) whose value is built per-opportunity at render time. See copy in §5.1 |
| F7 | As a connector I can add/edit/expire an opportunity in minutes | Edit one JSON file, commit to `main`, site updates within a few minutes | Git repo + GitHub Actions → GitHub Pages auto-deploy on push (validates JSON first) |
| F8 | As a connector I can show a nonprofit "here's your listing" | Stable per-opportunity URL (anchor) and per-org section | `#<opportunityId>` anchors; `?org=<orgId>` deep link |
| F9 | The site works on a phone and is accessible | Responsive layout; passes basic a11y (labels, contrast, keyboard, semantic headings) | Semantic HTML with a documented set of class hooks. **Visual design is deferred** — `styles.css` is currently an empty placeholder (keeps only the honeypot-hiding rule) pending a design pass. HTML already has `<label>` on every field, one `<h1>` per page, skip link, and `role="status"` live regions |
| F10 | A visitor can find the "about / how this works" and privacy info | Static About page + Privacy page reachable from every page | Two more static HTML files or sections. About page = short "how this works" blurb + brief profiles of **Sam** and **Steven** (bio copy TBD — placeholder blocks to fill in manually later) |
| F11 | If JS fails or JSON can't load, the visitor isn't stranded | Neutral fallback message ("refresh / check back soon"); no address exposed here | `<noscript>` block + `catch` on the fetch that shows a plain retry message |

### 5.1 Auto-response copy (F6)

FormSubmit `_autoresponse` sends one plain-text email. The form for each opportunity
is generated from the JSON, so inject the org name into a per-opportunity
`_autoresponse` value:

> Thanks for your interest in volunteering with **{org name}** through the Door County
> Volunteer Hub. We've received your message.
>
> Sam will email you within about 2 business days to connect you with the right person
> at {org name}. If you don't hear back by then, just reply to this email.
>
> — Sam & Steven, Door County Volunteer Hub

Keep it plain text. Set `_subject` to something like
`"We got your volunteer inquiry — Door County Volunteer Hub"`.

### On React Email (re: F4/F6)

React Email is a **free**, MIT-licensed library for *composing* HTML emails as React
components. It does **not** receive form submissions or send mail on its own, so it
isn't a substitute for the F4 form endpoint. Sending still requires:

1. an email provider — e.g. **Resend** (same team; free tier 3,000 emails/mo, 100/day), and
2. a small serverless function (Netlify / Cloudflare) to hold the API key, since the key can't be exposed in the browser.

That reintroduces the backend the "low-tech" goal is trying to avoid. **MVP
recommendation:** skip it. The MVP volunteer confirmation is FormSubmit's plain-text
`_autoresponse` (§5.1) — free, no code. Only reach for React Email + Resend (behind one
serverless function) if we later decide the confirmation email needs real branding/design.

## 6. Data model

Single file: `data/opportunities.json`. Organizations and opportunities are kept
separate (one org → many opportunities) — this is the org-to-opportunity mapping.

```json
{
  "meta": {
    "lastUpdated": "2026-09-09",
    "demoData": true
  },
  "organizations": [
    {
      "id": "open-door-bird-sanctuary",
      "name": "Open Door Bird Sanctuary",
      "website": "https://opendoorbirdsanctuary.org",
      "location": "Sawyer / Sturgeon Bay, WI",
      "blurb": "Raptor sanctuary and nature center.",
      "partnerStatus": "active"
    }
  ],
  "opportunities": [
    {
      "id": "odbs-2026-fall-grounds",
      "orgId": "open-door-bird-sanctuary",
      "title": "Fall grounds cleanup crew",
      "description": "Rake, haul brush, and prep enclosures for winter.",
      "categories": ["outdoors", "manual-labor"],
      "commitment": "one-time",
      "schedule": "Saturdays in October 2026, 9am–12pm",
      "location": "On-site, Sawyer",
      "minAge": 16,
      "status": "open",
      "verified": true,
      "verifiedDate": "2026-09-05",
      "postedDate": "2026-09-05",
      "expiresDate": "2026-10-31",
      "coordinator": "Sam"
    }
  ]
}
```

### Field rules
- `id` — kebab-case, unique, never reused.
- `status` — `open` | `filled` | `paused` | `closed`. Only `open` renders.
- `verified` / `verifiedDate` — set only after a connector confirms the need with the org directly.
- `commitment` — `one-time` | `recurring` | `flexible`.
- `categories` — free list from a small controlled vocabulary kept at top of the file in a comment or a `meta.categories` array.
- `expiresDate` — optional. If set, the entry auto-hides after this date (use it for one-time or time-boxed opportunities). Omit it for ongoing roles and retire them by hand (`status`).

### Validation (lightweight)
- `data/opportunities.schema.json` (reference) + `scripts/validate.mjs` — a dependency-free Node script run by the deploy workflow. Fails the deploy on: invalid JSON, unknown `orgId`, duplicate `id`, missing required fields, bad enum values, or bad date format. Warns (does not fail) on an `open`+`verified` entry whose `expiresDate` is already past.

## 7. Architecture

```
Browser ──GET──> GitHub Pages (CDN)
                   ├── index.html / about.html / privacy.html
                   ├── app.js         (fetch + render + filter)
                   ├── styles.css
                   ├── data/opportunities.json
                   └── data/opportunities.schema.json

Form submit ──fetch/POST──> FormSubmit (ajax alias) ──email──> project inbox
                                                   └─ _autoresponse ──> volunteer
                                    (Gmail rule) project inbox ──forward──> 2nd address

Editing:  Connector ──git push main──> GitHub Actions (validate JSON) ──> deploy to Pages
```

- **No server, no build step required.** A build step (static pre-render from JSON for SEO) is optional and can be added later without changing the data model.
- **Hosting (MVP):** GitHub Pages, published by a GitHub Actions workflow (`.github/workflows/deploy.yml`) that first runs `node scripts/validate.mjs` and only deploys if the data file is valid. Pages source = GitHub Actions.
- **Custom domain:** `docovolunteerhub.com` (registered via Squarespace; apex `A` records → GitHub Pages IPs, `www` CNAME → `steven-the-qa.github.io`, `CNAME` file in repo). No code changes — all links and asset paths are relative.
- **Repo:** single public GitHub repo (`steven-the-qa/door-county-volunteer-hub`). Opportunity edits via direct commit to `main` or PR.

## 8. Content / operations workflow

1. Nonprofit emails the shared inbox with a need (or a connector solicits it via cold outreach).
2. Connector confirms specifics with the org (dates, contact, age limits) → marks `verified`.
3. Connector adds the opportunity object to `opportunities.json`, commits/PRs.
4. CI validates; host deploys; listing is live in minutes.
5. Volunteer submits interest form → shared inbox.
6. Sam emails the volunteer within ~2 business days and introduces them to the org contact.
7. Sam logs the placement in a simple tracking sheet (Google Sheet) — outside the app.
8. Weekly: connectors review listings, flip `status` to `filled`/`closed`, or let `expiresDate` retire them.

## 9. Privacy & data handling

- Collect the minimum: first name, last name, email, and which opportunity.
- PII is relayed through FormSubmit (which does not store submissions) and lands only in the shared inbox + cc. Not in the repo, not in the JSON, not in analytics, not in URLs.
- Privacy page should name FormSubmit as the form processor and link its policy.
- Privacy page states: what we collect, why (to introduce you to the nonprofit), who sees it (Sam, Steven, and the specific nonprofit), and retention (e.g. delete provider records 6 months after placement).
- Consent line on the form: "By submitting, you agree we can share your name and email with the nonprofit for this opportunity."
- Cookie/consent banner: none needed if analytics is cookieless (Cloudflare Web Analytics / Plausible) or omitted.

## 10. Analytics (optional, MVP-lean)

- Cloudflare Web Analytics or none. Track only: page views, filter usage, form-submit count.
- Real success metric is tracked by hand (Section 11).

## 11. Success metrics

| Metric | Source | MVP target (first 90 days) |
|---|---|---|
| Partner orgs live | JSON | 3–6 (from: Open Door Pride, Open Door Bird Sanctuary, Door County Land Trust, Lakeshore CAP, DC Mutual Aid, DC Bookmobile) |
| Active opportunities listed | JSON | ≥ 5 at any time |
| Interest submissions | Form provider | ≥ 20 |
| Confirmed placements | Sam's tracking sheet | ≥ 8 |
| Median time: submission → volunteer contacted | Tracking sheet | ≤ 2 business days |
| Listing staleness (open entries past `expiresDate`) | CI/report | 0 |

## 12. Milestones

| Milestone | Contents |
|---|---|
| **M0 — Scaffold** ✅ | Repo, `opportunities.json` + schema + validator, README, PRD |
| **M1 — Site** ✅ logic / ⬜ design | `index.html` + `app.js` render cards from JSON, filters + URL sync, JSON-load fallback, `<noscript>`. Visual design (`styles.css`) deferred to a separate design pass |
| **M2 — Form** ✅ built / ⬜ activate | Form built (dialog, `_honey`, `_cc`, `_template`, per-opportunity `_autoresponse` + `_subject`, inline confirmation). Remaining manual steps: submit once to activate FormSubmit, paste the alias into `app.js`, set the Gmail label/star filter |
| **M3 — Ship** ✅ built / ⬜ enable | About + Privacy pages done; `deploy.yml` validates + publishes to Pages. Remaining: push to GitHub, set Pages source to "GitHub Actions" |
| **M4 — Onboard** ⬜ | Replace the TEST orgs/opportunities with confirmed, verified real ones from 3+ orgs; soft launch; then marketing (Pulse/Knock ads, Mutual Aid, flyers, social) |

## 13. Risks / open questions

- **Form provider limits** — FormSubmit is free with unlimited submissions and no account. No usage cap to worry about for MVP.
- **No stored submission log** — FormSubmit is a pure email relay and does not archive submissions. If Gmail drops or spam-files one, there's no record. Mitigate: a Gmail auto-forward from the project inbox to a second address + a filter that labels/stars incoming submissions so they can't get buried. (Not `_cc` — that would put a second address in the page source.)
- **Form vendor longevity** — FormSubmit is a small free service with no SLA or support. If it changes terms or goes down, the form silently stops working. Endpoint swap is a ~10-minute change (just an action URL + field names). Do a monthly test submission to confirm it still delivers.
- **Domain & shared inbox** — interim inbox is `cosmicbobsleigh@gmail.com`. Before wider launch, register a domain and stand up a dedicated shared mailbox (Google Workspace ~$6/mo, or a shared Gmail) so both connectors have equal access and the address survives a personal-account change.
- **"Verified" trust** — the product's value depends on listings being real and current; the weekly review is a hard commitment, not optional.
- **Org buy-in** — MVP assumes orgs will at least email needs to the inbox. If they won't, connectors must source opportunities by outreach (already the plan for Steven).
- **SEO** — client-rendered JSON is weak for search indexing. Acceptable for MVP (traffic comes from ads/flyers/social); add static pre-rendering in a later iteration if organic search matters.

## 14. Future (post-MVP, not now)

- Static pre-render of opportunity pages for SEO/shareable link previews.
- Email digest ("new opportunities this week") via a mailing list.
- Lightweight org-facing form to submit a need (still writes to a review queue, not straight to the site).
- Simple placement tracker built into the repo instead of a separate sheet.
- "Welcome wagon" playbook per org.
