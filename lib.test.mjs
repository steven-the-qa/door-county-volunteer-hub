// Run: node --test
// No dependencies — Node's built-in test runner, same pattern as
// scripts/validate.mjs and admin/lib.test.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { isLive } from "./lib.js";

const TODAY = "2026-09-09";

function op(overrides) {
  return Object.assign(
    { status: "open", verified: true, expiresDate: undefined },
    overrides
  );
}

test("isLive: open + verified, no expiresDate -> live", () => {
  assert.equal(isLive(op({}), TODAY), true);
});

test("isLive: status other than open -> not live", () => {
  for (const status of ["draft", "filled", "paused", "closed"]) {
    assert.equal(isLive(op({ status }), TODAY), false, status);
  }
});

test("isLive: verified false -> not live, even if status is open", () => {
  assert.equal(isLive(op({ verified: false }), TODAY), false);
});

test("isLive: expiresDate in the future -> still live", () => {
  assert.equal(isLive(op({ expiresDate: "2026-09-10" }), TODAY), true);
});

test("isLive: expiresDate is today -> still live (only strictly-past excludes)", () => {
  assert.equal(isLive(op({ expiresDate: "2026-09-09" }), TODAY), true);
});

test("isLive: expiresDate in the past -> not live", () => {
  assert.equal(isLive(op({ expiresDate: "2026-09-08" }), TODAY), false);
});

test("isLive: an ongoing role with no expiresDate never auto-expires", () => {
  assert.equal(isLive(op({ expiresDate: undefined }), TODAY), true);
});

test("isLive: postedDate in the future -> not yet visible", () => {
  assert.equal(isLive(op({ postedDate: "2026-09-10" }), TODAY), false);
});

test("isLive: postedDate is today -> visible", () => {
  assert.equal(isLive(op({ postedDate: "2026-09-09" }), TODAY), true);
});

test("isLive: postedDate in the past -> visible", () => {
  assert.equal(isLive(op({ postedDate: "2026-09-08" }), TODAY), true);
});

test("isLive: no postedDate at all -> visible", () => {
  assert.equal(isLive(op({ postedDate: undefined }), TODAY), true);
});
