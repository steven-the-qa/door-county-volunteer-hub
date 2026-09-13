// Pure, DOM-free logic shared between admin/index.html and admin/lib.test.mjs.
//
// Loaded two ways, unmodified, no build step either way:
//   - the browser imports it as a real ES module (<script type="module">)
//   - Node's built-in test runner imports it directly (`node --test admin/`)
//
// Keep everything in here free of `document`/`window` — anything that needs
// to touch the real page (reading rendered <input> values, wiring up click
// handlers) stays in admin/index.html and calls into these functions instead
// of duplicating their logic.

// ---- Markdown -> HTML (used by the Help modal) ---------------------------
// Covers exactly what admin/help.md uses: #/##/### headings, blank-line
// paragraphs, "- " and "1. " lists (with a wrapped continuation line merged
// into the current item instead of dropped -- a real bug this caught once
// already), **bold**, `code`, and [text](url) links. Not general CommonMark
// on purpose — the source content is ours and stays within this subset.

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function inline(s) {
  s = escapeHtml(s);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s;
}

export function renderMarkdown(md) {
  var lines = md.replace(/\r\n/g, "\n").split("\n");
  var html = "";
  var i = 0;

  // Renders a - or 1. list starting at the current line. Any indented line
  // that follows an item but isn't itself a new item is treated as a
  // wrapped continuation of that item's text (appended, never dropped)
  // rather than a true nested list — help.md is written to avoid real
  // nesting so this never loses content.
  function renderList(itemRe) {
    var items = [];
    while (i < lines.length && lines[i].trim() !== "" && (itemRe.test(lines[i]) || /^\s+\S/.test(lines[i]))) {
      if (itemRe.test(lines[i])) {
        items.push(lines[i].replace(itemRe, ""));
      } else if (items.length) {
        items[items.length - 1] += " " + lines[i].trim();
      }
      i++;
    }
    return items;
  }

  while (i < lines.length) {
    var line = lines[i];
    if (/^### /.test(line)) { html += "<h3>" + inline(line.slice(4)) + "</h3>"; i++; continue; }
    if (/^## /.test(line)) { html += "<h2>" + inline(line.slice(3)) + "</h2>"; i++; continue; }
    if (/^# /.test(line)) { html += "<h1>" + inline(line.slice(2)) + "</h1>"; i++; continue; }

    if (/^-\s+/.test(line)) {
      var ulItems = renderList(/^-\s+/);
      html += "<ul>" + ulItems.map(function (t) { return "<li>" + inline(t) + "</li>"; }).join("") + "</ul>";
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      var olItems = renderList(/^\d+\.\s+/);
      html += "<ol>" + olItems.map(function (t) { return "<li>" + inline(t) + "</li>"; }).join("") + "</ol>";
      continue;
    }
    if (line.trim() === "") { i++; continue; }

    var para = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,3}\s|-\s|\d+\.\s)/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    html += "<p>" + inline(para.join(" ")) + "</p>";
  }
  return html;
}

// ---- help.md -> tabs/subtabs structure ------------------------------------
// Splits by heading level: the H1's own body text becomes the always-visible
// intro, each H2 becomes a tab, and any H3s inside a tab become subtabs.
// Kept this simple on purpose — help.md is written to fit exactly this shape
// (at most one level of subtabs), not general CommonMark nesting.

export function parseDoc(md) {
  var lines = md.replace(/\r\n/g, "\n").split("\n");
  var i = 0;
  if (/^# /.test(lines[0] || "")) i = 1;

  var introLines = [];
  while (i < lines.length && !/^## /.test(lines[i])) { introLines.push(lines[i]); i++; }

  var tabs = [];
  while (i < lines.length) {
    var tabLabel = lines[i].replace(/^## /, "").trim();
    i++;
    var bodyLines = [];
    var subtabs = [];
    while (i < lines.length && !/^## /.test(lines[i])) {
      if (/^### /.test(lines[i])) {
        var subLabel = lines[i].replace(/^### /, "").trim();
        i++;
        var subLines = [];
        while (i < lines.length && !/^## /.test(lines[i]) && !/^### /.test(lines[i])) {
          subLines.push(lines[i]);
          i++;
        }
        subtabs.push({ label: subLabel, md: subLines.join("\n") });
      } else {
        bodyLines.push(lines[i]);
        i++;
      }
    }
    tabs.push({ label: tabLabel, md: bodyLines.join("\n"), subtabs: subtabs });
  }
  return { introMd: introLines.join("\n"), tabs: tabs };
}

// ---- Organization-reference cross-check (used by the Save intercept) -----
// Pure comparison only: given the current Organization ID values and the
// current Organization (orgId) values found on the page, returns the
// Organization values that don't match any Organization ID — deduplicated,
// in first-seen order, blanks ignored. Finding those values in the real DOM
// is a separate, DOM-touching concern that stays in admin/index.html; this
// function doesn't know or care where its inputs came from.

export function computeOrphanedRefs(orgIds, refs) {
  var valid = {};
  orgIds.forEach(function (id) {
    var v = String(id).trim();
    if (v) valid[v] = true;
  });

  var bad = [];
  refs.forEach(function (ref) {
    var v = String(ref).trim();
    if (v && !valid[v] && bad.indexOf(v) === -1) bad.push(v);
  });
  return bad;
}
