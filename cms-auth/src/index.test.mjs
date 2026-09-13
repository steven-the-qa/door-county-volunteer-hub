// Run: node --test (from repo root)
// No dependencies — Node's built-in test runner, same pattern as lib.test.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readCookie } from "./index.js";

test("readCookie: finds a cookie among several", () => {
  assert.equal(readCookie("a=1; oauth_state=abc123; b=2", "oauth_state"), "abc123");
});

test("readCookie: finds the only cookie", () => {
  assert.equal(readCookie("oauth_state=abc123", "oauth_state"), "abc123");
});

test("readCookie: missing cookie -> null", () => {
  assert.equal(readCookie("a=1; b=2", "oauth_state"), null);
});

test("readCookie: empty cookie header -> null", () => {
  assert.equal(readCookie("", "oauth_state"), null);
});

test("readCookie: does not match a name that is a suffix of another cookie's name", () => {
  assert.equal(readCookie("other_oauth_state=abc123", "oauth_state"), null);
});

test("readCookie: tolerates irregular spacing around separators", () => {
  assert.equal(readCookie("a=1;   oauth_state=abc123;b=2", "oauth_state"), "abc123");
});
