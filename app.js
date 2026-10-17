/* Door County Volunteer Hub — renders opportunities from data/opportunities.json.
   No framework. Styling is Tailwind utility classes (see CLS below).
   Loaded as a module (<script type="module">) so this import is guaranteed
   to be ready before any code below runs. */

import { isLive as isLiveOn } from "./lib.js";

(function () {
  "use strict";

  // --- Config -------------------------------------------------------------
  // Cloudflare Worker (repo: /worker) that sends the two branded emails via Resend.
  var WORKER_ENDPOINT = "https://dcvh-form.docovolunteerhub.workers.dev";

  var DATA_URL = "data/opportunities.json";

  // Tailwind utility classes for elements this script creates or restyles.
  // Keep them as complete literal strings: Tailwind finds classes by scanning
  // this file, so never build a class name by concatenating pieces.
  var CLS = {
    card: "mb-3.5 border border-line bg-white p-4",
    title: "mt-0",
    org: "mt-0 mb-2.5 font-bold text-muted",
    desc: "mt-0 mb-3",
    dl: "mt-0 mb-3 text-sm",
    dt: "font-bold text-muted xs:float-left xs:clear-left xs:w-[110px]",
    dd: "mb-2 xs:mb-0.5 xs:pl-[120px]",
    tags: "mt-0 mb-3 list-none p-0",
    tag: "mr-1 inline-block border border-line bg-[#eeeeee] px-1.5 py-px text-xs",
    button: "cursor-pointer border border-pine-dark bg-pine px-3.5 py-[7px] text-sm font-bold text-white hover:bg-pine-hover",
    statusBase: "my-2.5 border px-2.5 py-2",
    statusOk: "border-pine bg-[#e6f0e8]",
    statusError: "border-[#b33] bg-[#fbe3e3]"
  };

  var COMMITMENT_LABEL = {
    "one-time": "One-time",
    "recurring": "Recurring",
    "flexible": "Flexible"
  };

  // --- Element handles ---------------------------------------------------
  var listEl = document.getElementById("opportunity-list");
  var countEl = document.getElementById("result-count");
  var emptyEl = document.getElementById("empty-state");
  var errorEl = document.getElementById("load-error");
  var demoBanner = document.getElementById("demo-banner");
  var orgSelect = document.getElementById("filter-org");
  var catSelect = document.getElementById("filter-category");
  var commitSelect = document.getElementById("filter-commitment");
  var resetBtn = document.getElementById("filter-reset");
  var filtersEl = document.getElementById("filters");
  var loadingEl = document.getElementById("page-loading");

  var dialog = document.getElementById("interest-dialog");
  var form = document.getElementById("interest-form");
  var dialogOpportunity = document.getElementById("dialog-opportunity");
  var dialogOrg = document.getElementById("dialog-org");
  var formStatus = document.getElementById("form-status");
  var submitBtn = document.getElementById("interest-submit");
  var cancelBtn = document.getElementById("interest-cancel");

  var state = { orgs: {}, opportunities: [] };
  var current = null; // { op, org } for the opportunity the dialog is open on

  // --- Helpers ---------------------------------------------------------
  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  // The actual open/verified/not-expired decision lives in lib.js (tested
  // in lib.test.mjs, run via `node --test`) — this just calls into it with
  // today's date, since that function takes "today" as a plain argument
  // instead of reading the clock itself, to stay testable.
  function isLive(op) {
    return isLiveOn(op, todayISO());
  }

  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === "class") node.className = props[k];
        else if (k === "text") node.textContent = props[k];
        else node.setAttribute(k, props[k]);
      });
    }
    (children || []).forEach(function (c) {
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }


  // --- URL <-> filter sync -------------------------------------------
  function readFiltersFromURL() {
    var p = new URLSearchParams(location.search);
    if (p.get("org")) orgSelect.value = p.get("org");
    if (p.get("category")) catSelect.value = p.get("category");
    if (p.get("commitment")) commitSelect.value = p.get("commitment");
  }

  function writeFiltersToURL() {
    var p = new URLSearchParams();
    if (orgSelect.value) p.set("org", orgSelect.value);
    if (catSelect.value) p.set("category", catSelect.value);
    if (commitSelect.value) p.set("commitment", commitSelect.value);
    var qs = p.toString();
    history.replaceState(null, "", qs ? "?" + qs : location.pathname);
  }

  // --- Rendering ------------------------------------------------------
  function buildCard(op) {
    var org = state.orgs[op.orgId] || { name: "Unknown organization" };

    var orgLine = org.website
      ? el("p", { class: CLS.org }, [el("a", { href: org.website, rel: "noopener", target: "_blank" }, [org.name])])
      : el("p", { class: CLS.org, text: org.name });

    var dl = el("dl", { class: CLS.dl }, []);
    function row(term, value) {
      if (!value && value !== 0) return;
      dl.appendChild(el("dt", { class: CLS.dt, text: term }));
      dl.appendChild(el("dd", { class: CLS.dd, text: String(value) }));
    }
    row("Commitment", COMMITMENT_LABEL[op.commitment] || op.commitment);
    row("When", op.schedule);
    row("Where", op.location || org.location);
    if (op.minAge) row("Minimum age", op.minAge);
    row("Posted", op.postedDate);

    var tags = el("ul", { class: CLS.tags }, (op.categories || []).map(function (c) {
      return el("li", { class: CLS.tag, text: c });
    }));

    var btn = el("button", { type: "button", class: CLS.button }, ["Express interest"]);
    btn.addEventListener("click", function () { openDialog(op, org); });

    var card = el("li", { class: CLS.card, id: op.id }, [
      el("h2", { class: CLS.title, text: op.title }),
      orgLine,
      el("p", { class: CLS.desc, text: op.description }),
      dl
    ]);
    if ((op.categories || []).length) card.appendChild(tags);
    card.appendChild(btn);
    return card;
  }

  function applyFilters() {
    var org = orgSelect.value;
    var cat = catSelect.value;
    var commit = commitSelect.value;

    var visible = state.opportunities.filter(function (op) {
      if (org && op.orgId !== org) return false;
      if (commit && op.commitment !== commit) return false;
      if (cat && (op.categories || []).indexOf(cat) === -1) return false;
      return true;
    });

    listEl.innerHTML = "";
    visible.forEach(function (op) { listEl.appendChild(buildCard(op)); });

    emptyEl.hidden = visible.length !== 0;
    var total = state.opportunities.length;
    if (visible.length === total) {
      countEl.textContent = total + (total === 1 ? " opportunity" : " opportunities");
    } else {
      countEl.textContent = "Showing " + visible.length + " of " + total;
    }

    writeFiltersToURL();
  }

  function populateFilters(data) {
    state.opportunities
      .map(function (op) { return op.orgId; })
      .filter(function (v, i, a) { return a.indexOf(v) === i; })
      .map(function (id) { return state.orgs[id]; })
      .filter(Boolean)
      .sort(function (a, b) { return a.name.localeCompare(b.name); })
      .forEach(function (o) {
        orgSelect.appendChild(el("option", { value: o.id, text: o.name }));
      });

    var cats = (data.meta && data.meta.categories) ? data.meta.categories.slice() : [];
    state.opportunities.forEach(function (op) {
      (op.categories || []).forEach(function (c) { if (cats.indexOf(c) === -1) cats.push(c); });
    });
    cats.sort().forEach(function (c) {
      catSelect.appendChild(el("option", { value: c, text: c }));
    });
  }

  // --- Interest dialog ----------------------------------------------
  function openDialog(op, org) {
    form.reset();
    formStatus.hidden = true;
    formStatus.className = CLS.statusBase + " border-line";
    submitBtn.disabled = false;
    submitBtn.hidden = false;
    submitBtn.textContent = "Send";
    cancelBtn.textContent = "Cancel";
    Array.prototype.forEach.call(form.querySelectorAll("input"), function (i) { i.disabled = false; });

    current = { op: op, org: org };
    dialogOpportunity.textContent = op.title;
    dialogOrg.textContent = org.name;

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    document.getElementById("f-first").focus();
  }

  function closeDialog() {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function showStatus(kind, message) {
    formStatus.hidden = false;
    formStatus.className = CLS.statusBase + " " + (kind === "error" ? CLS.statusError : CLS.statusOk);
    formStatus.textContent = message;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!current) return;
    if (form.company && form.company.value) return; // honeypot — bot

    var payload = {
      firstName: document.getElementById("f-first").value.trim(),
      lastName: document.getElementById("f-last").value.trim(),
      email: document.getElementById("f-email").value.trim(),
      opportunityTitle: current.op.title,
      opportunityId: current.op.id,
      orgName: current.org.name,
      company: form.company ? form.company.value : ""
    };

    submitBtn.disabled = true;
    showStatus("ok", "Sending…");

    fetch(WORKER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (b) {
          return { httpOk: r.ok, body: b };
        });
      })
      .then(function (res) {
        if (res.httpOk && res.body && res.body.ok) {
          showStatus("ok",
            "Thanks! Your interest is in. The Door County Volunteer Hub team will " +
            "email you within about two business days — check your inbox for a confirmation.");
          Array.prototype.forEach.call(form.querySelectorAll("input"), function (i) { i.disabled = true; });
          submitBtn.hidden = true;
          cancelBtn.textContent = "Close";
        } else {
          showStatus("error",
            "Something went wrong sending that. Please try again in a little while.");
          submitBtn.disabled = false;
        }
      })
      .catch(function () {
        showStatus("error",
          "Couldn't reach the server. Please try again in a little while.");
        submitBtn.disabled = false;
      });
  }

  // --- Boot ---------------------------------------------------------
  function init(data) {
    (data.organizations || []).forEach(function (o) { state.orgs[o.id] = o; });
    state.opportunities = (data.opportunities || []).filter(isLive)
      .sort(function (a, b) { return (b.postedDate || "").localeCompare(a.postedDate || ""); });

    if (data.meta && data.meta.demoData) demoBanner.hidden = false;

    populateFilters(data);
    readFiltersFromURL();
    applyFilters();
    filtersEl.hidden = false;
    loadingEl.hidden = true;

    [orgSelect, catSelect, commitSelect].forEach(function (s) {
      s.addEventListener("change", applyFilters);
    });
    resetBtn.addEventListener("click", function () {
      orgSelect.value = ""; catSelect.value = ""; commitSelect.value = "";
      applyFilters();
    });

    form.addEventListener("submit", handleSubmit);
    cancelBtn.addEventListener("click", closeDialog);
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) closeDialog(); // click on backdrop
    });
  }

  function showLoadError() {
    loadingEl.hidden = true;
    listEl.hidden = true;
    countEl.hidden = true;
    filtersEl.hidden = true;
    errorEl.hidden = false;
  }

  // Download/parse failures and bugs in our own rendering code are logged
  // separately, so the console says which one happened. Visitors see the
  // same "couldn't load" box either way.
  fetch(DATA_URL, { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(
      function (data) {
        try {
          init(data);
        } catch (err) {
          console.error("Opportunities loaded, but rendering them failed:", err);
          showLoadError();
        }
      },
      function (err) {
        console.error("Failed to download or parse " + DATA_URL + ":", err);
        showLoadError();
      }
    );
})();
