// Run: node --test admin/
// No dependencies — Node's built-in test runner + assert, same "plain
// script, no deps" pattern as scripts/validate.mjs. Wired into
// .github/workflows/deploy.yml as a CI gate alongside the JSON validator.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { renderMarkdown, parseDoc, computeOrphanedRefs } from "./lib.js";

const here = dirname(fileURLToPath(import.meta.url));

test("renderMarkdown: headings", () => {
  assert.equal(renderMarkdown("# Title\n## Sub\n### SubSub"), "<h1>Title</h1><h2>Sub</h2><h3>SubSub</h3>");
});

test("renderMarkdown: a plain paragraph", () => {
  assert.equal(renderMarkdown("Hello world."), "<p>Hello world.</p>");
});

test("renderMarkdown: a wrapped line is merged into the same paragraph with a space", () => {
  assert.equal(renderMarkdown("one\ntwo"), "<p>one two</p>");
});

test("renderMarkdown: blank line separates two paragraphs", () => {
  assert.equal(renderMarkdown("one\n\ntwo"), "<p>one</p><p>two</p>");
});

test("renderMarkdown: bullet list", () => {
  assert.equal(renderMarkdown("- a\n- b"), "<ul><li>a</li><li>b</li></ul>");
});

test("renderMarkdown: numbered list", () => {
  assert.equal(renderMarkdown("1. a\n2. b"), "<ol><li>a</li><li>b</li></ol>");
});

test("renderMarkdown: a wrapped continuation line is appended, not dropped", () => {
  // Regression test for a real bug found by eye earlier: indented
  // continuation lines under a list item used to vanish silently.
  var out = renderMarkdown("1. first item wraps\n   onto a second line\n2. second item");
  assert.equal(out, "<ol><li>first item wraps onto a second line</li><li>second item</li></ol>");
});

test("renderMarkdown: inline bold, code, links, and HTML escaping", () => {
  assert.equal(
    renderMarkdown('**bold** `code` [text](url) <tag> & "quote"'),
    '<p><strong>bold</strong> <code>code</code> <a href="url" target="_blank" rel="noopener">text</a> &lt;tag&gt; &amp; &quot;quote&quot;</p>'
  );
});

test("parseDoc: splits intro / tabs / subtabs by heading level", () => {
  var md = [
    "# Title",
    "Intro line.",
    "",
    "## Tab One",
    "Body one.",
    "",
    "## Tab Two",
    "### Sub A",
    "Body A.",
    "### Sub B",
    "Body B.",
    "",
  ].join("\n");

  var doc = parseDoc(md);
  assert.equal(doc.introMd.trim(), "Intro line.");
  assert.equal(doc.tabs.length, 2);
  assert.equal(doc.tabs[0].label, "Tab One");
  assert.equal(doc.tabs[0].subtabs.length, 0);
  assert.equal(doc.tabs[1].label, "Tab Two");
  assert.equal(doc.tabs[1].subtabs.length, 2);
  assert.equal(doc.tabs[1].subtabs[0].label, "Sub A");
  assert.equal(doc.tabs[1].subtabs[1].label, "Sub B");
});

test("parseDoc: the real help.md has the expected tab structure", () => {
  // Guards against a future help.md edit accidentally shifting a heading
  // level (e.g. ## -> ### by mistake) and silently breaking the tabs.
  var md = readFileSync(join(here, "help.md"), "utf8");
  var doc = parseDoc(md);

  assert.deepEqual(
    doc.tabs.map(function (t) { return t.label; }),
    ["Structure", "Add content", "Publish", "Edit & retire"]
  );

  var addContent = doc.tabs[1];
  assert.deepEqual(
    addContent.subtabs.map(function (s) { return s.label; }),
    ["Organization", "Opportunity"]
  );
});

test("computeOrphanedRefs: everything matches", () => {
  assert.deepEqual(computeOrphanedRefs(["a", "b"], ["a", "b", "a"]), []);
});

test("computeOrphanedRefs: finds and dedupes mismatches, preserving first-seen order", () => {
  assert.deepEqual(computeOrphanedRefs(["a"], ["a", "typo", "typo", "b"]), ["typo", "b"]);
});

test("computeOrphanedRefs: blank values on either side are ignored", () => {
  assert.deepEqual(computeOrphanedRefs(["a", ""], ["", "a"]), []);
});

test("computeOrphanedRefs: no organizations yet means every non-blank ref is orphaned", () => {
  assert.deepEqual(computeOrphanedRefs([], ["a"]), ["a"]);
});

test("computeOrphanedRefs: whitespace-only values are treated as blank", () => {
  assert.deepEqual(computeOrphanedRefs(["a"], ["  ", "a"]), []);
});
