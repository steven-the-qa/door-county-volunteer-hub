# Using this CMS

This edits `data/opportunities.json`, the one file that runs the whole
site. Everything below happens inside one entry called **"Organizations &
Opportunities."**

## Structure

- **Meta**. Collapsed by default. Last-updated date, category/commitment lists. Rarely touched.
- **Organizations**. Partner orgs.
- **Opportunities**. The postings.

## Add content

### Organization

1. Expand **Organizations**, click **Add Organizations**.
2. Set **ID** to a unique kebab-case slug, e.g. `door-county-land-trust`. Don't change it later; opportunities reference it.
3. Fill in **Name**, **Website**, **Location**, **Blurb**.
4. Leave **Partner status** at `prospective` until confirmed as `active`.
5. Also adding an opportunity for this org? Put it in the same entry so both land in one pull request.

### Opportunity

1. Expand **Opportunities**, click **Add Opportunities**.
2. Set **ID** to a unique kebab-case slug, e.g. `dclt-trail-crew`.
3. Set **Organization ID** to match an org's ID above exactly. A typo here isn't caught by the form. The automated check on the pull request catches it.
4. Fill in **Title**, **Description**, **Categories** (multi-select), **Commitment** (one-time / recurring / flexible).
5. Fill in **Schedule** and **Location** as plain text, e.g. "Saturdays, 9am–12pm."
6. Set **Minimum age** if there is one. Optional.
7. Leave **Status** and **Verified** at their defaults (`draft`, off) until you've confirmed the opening with the org. Nothing here goes live on its own.
8. Set **Posted date** to today, or a future date to queue it up — it stays hidden until that date. Leave **Expires date** blank for an ongoing role.
9. Set **Coordinator**: Sam or Steven, whoever's following up.

## Publish

Click **Save**. It doesn't publish. Every save opens a GitHub pull request
with the JSON diff. Nothing hits the live site yet.

To actually publish an opportunity:

1. Confirm the details with the org directly. Call or email.
2. Go back into the entry (or edit the pull request's branch on GitHub). Set **Verified** to true, **Status** to `open`.
3. Merge the pull request. Same JSON validation and deploy pipeline as any other change.

You can also review and merge from GitHub's own pull request view
instead, if that's easier.

## Edit & retire

Open the entry, find it in **Opportunities**, edit in place:

- Set **Status** to `filled`, `paused`, or `closed`. Drops off the live site once merged.
- Time-boxed listings auto-hide when **Expires date** passes. No edit needed.
