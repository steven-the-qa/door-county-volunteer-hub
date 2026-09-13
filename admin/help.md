# Using this CMS

This edits `data/opportunities.json` — the one file that drives the whole
site. Everything below happens inside one entry called **"Organizations &
Opportunities."**

## The structure

- **Meta** — collapsed by default. Housekeeping (last-updated date, category/commitment vocabulary lists). You'll rarely touch this.
- **Organizations** — the list of partner orgs.
- **Opportunities** — the list of postings.

## Adding a new organization

1. Expand **Organizations**, click **Add Organizations**.
2. Set **ID** to a unique kebab-case slug, e.g. `door-county-land-trust` — once an opportunity references it, never change it.
3. Fill in **Name**, **Website**, **Location**, and **Blurb**.
4. Leave **Partner status** at `prospective` (the default) until they're confirmed as `active`.
5. If you're also adding an opportunity for this org, do both in the same entry so they land in one pull request.

## Adding a new opportunity

1. Expand **Opportunities**, click **Add Opportunities**.
2. Set **ID** to a unique kebab-case slug, e.g. `dclt-trail-crew`.
3. Set **Organization ID** to exactly match an org's ID above — a typo here isn't caught by the CMS itself, the automated check on the pull request catches it instead.
4. Fill in **Title**, **Description**, **Categories** (multi-select), and **Commitment** (one-time / recurring / flexible).
5. Fill in **Schedule** and **Location** as free text, e.g. "Saturdays, 9am–12pm."
6. Set **Minimum age** if there is one — it's optional.
7. Leave **Status** and **Verified** at their defaults (`draft`, off) until you've actually confirmed the opening with the org — nothing you add here goes live automatically. That's the safety net.
8. Set **Posted date** to today. Leave **Expires date** blank for an ongoing role.
9. Set **Coordinator** to whoever's following up (Sam or Steven).

## Saving — this is the part that's different from most CMSs

Click **Save**. It does **not** publish. Every save opens a real **GitHub
pull request** with the JSON diff instead of committing straight to the
live site.

To actually publish an opportunity:

1. Confirm the details with the organization directly — a real call or email. This is the whole point of the review step.
2. Go back into the entry (or edit the pull request's branch directly on GitHub) and set **Verified** to true and **Status** to `open`.
3. Merge the pull request. That runs the same JSON validation and deploy pipeline as any other change — broken data still can't reach the live site.

You can also review and merge from GitHub's normal pull request view if
that's easier than doing it inside the CMS.

## Editing or retiring an existing opportunity

Open the entry, find it in the **Opportunities** list, edit in place:

- Set **Status** to `filled`, `paused`, or `closed` — it drops off the live site as soon as the change is merged.
- Time-boxed listings also auto-hide once their **Expires date** passes, no edit needed.

## One gotcha

Categories and commitment types are a fixed list hardcoded into this
form's configuration, kept in sync by hand with the data file's own
category list. The CMS can't add a brand-new category to the picker by
itself — ask for a new one to be added and it'll take one small update to
get both in sync.
