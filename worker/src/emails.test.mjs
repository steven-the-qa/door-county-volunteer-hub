// Run: node --test (from repo root)
// No dependencies — Node's built-in test runner, same pattern as lib.test.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { teamNotificationEmail, volunteerConfirmationEmail } from "./emails.js";

test("teamNotificationEmail: includes the submitted details", () => {
  const html = teamNotificationEmail({
    fullName: "Jane Doe",
    email: "jane@example.com",
    opportunityTitle: "Raptor Team volunteer",
    opportunityId: "odbs-raptor-team",
    orgName: "Open Door Bird Sanctuary",
  });

  assert.match(html, /Jane Doe/);
  assert.match(html, /jane@example\.com/);
  assert.match(html, /Raptor Team volunteer/);
  assert.match(html, /odbs-raptor-team/);
  assert.match(html, /Open Door Bird Sanctuary/);
  assert.match(html, /mailto:jane@example\.com/);
});

test("teamNotificationEmail: escapes HTML in submitted fields", () => {
  const html = teamNotificationEmail({
    fullName: '<script>alert("x")</script>',
    email: "jane@example.com",
    opportunityTitle: "Title",
    opportunityId: "id",
    orgName: "Org",
  });

  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("teamNotificationEmail: is a full HTML document", () => {
  const html = teamNotificationEmail({
    fullName: "Jane Doe",
    email: "jane@example.com",
    opportunityTitle: "Title",
    opportunityId: "id",
    orgName: "Org",
  });

  assert.match(html, /^<!doctype html>/);
  assert.match(html, /Door County Volunteer Hub/);
});

test("volunteerConfirmationEmail: includes the volunteer's details", () => {
  const html = volunteerConfirmationEmail({
    firstName: "Jane",
    opportunityTitle: "Raptor Team volunteer",
    orgName: "Open Door Bird Sanctuary",
  });

  assert.match(html, /Hi Jane,/);
  assert.match(html, /Raptor Team volunteer/);
  assert.match(html, /Open Door Bird Sanctuary/);
});

test("volunteerConfirmationEmail: escapes HTML in submitted fields", () => {
  const html = volunteerConfirmationEmail({
    firstName: '<b>Jane</b>',
    opportunityTitle: "Title",
    orgName: "Org",
  });

  assert.doesNotMatch(html, /<b>Jane<\/b>/);
  assert.match(html, /&lt;b&gt;Jane&lt;\/b&gt;/);
});
