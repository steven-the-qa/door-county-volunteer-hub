# Using this CMS

This edits `data/opportunities.json`, the one file that runs the whole
site. Everything below happens inside one entry called **"Organizations &
Opportunities."**

## The structure

- **Meta** — collapsed by default. Housekeeping: last-updated date, the category/commitment lists. You won't need this often.
- **Organizations** — partner orgs.
- **Opportunities** — the postings.

## Adding a new organization

1. Expand **Organizations**, click **Add Organizations**.
2. Set **ID** to a unique kebab-case slug, e.g. `door-county-land-trust`. Don't change it later — opportunities will reference it.
3. Fill in **Name**, **Website**, **Location**, **Blurb**.
4. Leave **Partner status** at `prospective` until they're confirmed as `active`.
5. Adding an opportunity for this org too? Do it in the same entry so both land in one pull request.

## Adding a new opportunity

1. Expand **Opportunities**, click **Add Opportunities**.
2. Set **ID** to a unique kebab-case slug, e.g. `dclt-trail-crew`.
3. Set **Organization ID** to match an org's ID above exactly. A typo won't get caught here — the automated check on the pull request will catch it.
4. Fill in **Title**, **Description**, **Categories** (multi-select), **Commitment** (one-time / recurring / flexible).
5. Fill in **Schedule** and **Location** as plain text, e.g. "Saturdays, 9am–12pm."
6. Set **Minimum age** if there is one. Optional.
7. Leave **Status** and **Verified** at their defaults (`draft`, off) until you've actually confirmed the opening with the org. Nothing here goes live on its own.
8. Set **Posted date** to today. Leave **Expires date** blank for an ongoing role.
9. Set **Coordinator** to whoever's following up — Sam or Steven.

## Saving

Click **Save**. It doesn't publish. Every save opens a GitHub pull request
with the JSON diff instead of committing straight to the live site.

To actually publish an opportunity:

1. Confirm the details with the organization directly — a real call or email.
2. Go back into the entry (or edit the pull request's branch on GitHub) and set **Verified** to true, **Status** to `open`.
3. Merge the pull request. Same JSON validation and deploy pipeline as any other change.

You can also review and merge from GitHub's own pull request view if
that's easier than doing it in the CMS.

## Editing or retiring an opportunity

Open the entry, find it in **Opportunities**, edit in place:

- Set **Status** to `filled`, `paused`, or `closed`. It drops off the live site once merged.
- Time-boxed listings auto-hide when **Expires date** passes. No edit needed.

## One gotcha

Categories and commitment types are a fixed list, hardcoded into this
form's config, kept in sync by hand with the data file's own category
list. The CMS won't add a new category to the picker on its own — ask for
one and it's a quick update to sync both.
