/* Door County Volunteer Hub — renders opportunities from data/opportunities.json.
   No framework. Styling is Tailwind utility classes (see CLS below).
   Loaded as a module (<script type="module">) so this import is guaranteed
   to be ready before any code below runs.

   Used by two pages; each part only runs if its elements are on the page:
   - index.html:         #carousel — the newest listings, plus "See more"
   - opportunities.html: #opportunity-list — every listing, with filters
   Both pages share the loading screen and the "Express interest" dialog. */

import { isLive as isLiveOn } from "./lib.js";

(function () {
  "use strict";

  // --- Config -------------------------------------------------------------
  // Cloudflare Worker (repo: /worker) that sends the two branded emails via Resend.
  var WORKER_ENDPOINT = "https://dcvh-form.docovolunteerhub.workers.dev";

  var DATA_URL = "data/opportunities.json";

  // How many listings the homepage carousel shows before "See more".
  var CAROUSEL_LIMIT = 6;

  // Tailwind utility classes for elements this script creates or restyles.
  // Keep them as complete literal strings: Tailwind finds classes by scanning
  // this file, so never build a class name by concatenating pieces.
  var CLS = {
    card: "flex flex-col gap-3.5 rounded-[14px] border border-line bg-white p-5 sm:p-7",
    carouselCard: "flex flex-col gap-3.5 rounded-[14px] border border-line bg-white p-5 sm:flex-[0_0_min(460px,85%)] sm:snap-start sm:p-7",
    org: "m-0 text-[15px] font-bold text-accent",
    orgLink: "text-accent",
    title: "m-0 text-2xl/tight font-bold text-ink sm:text-[25px]/[1.2]",
    desc: "m-0 text-body",
    dl: "m-0 grid grid-cols-1 text-[15px] sm:grid-cols-[120px_1fr] sm:gap-x-3 sm:gap-y-1",
    dt: "mt-2.5 font-bold text-muted first:mt-0 sm:mt-0",
    dd: "m-0",
    tags: "m-0 flex list-none flex-wrap gap-1.5 p-0",
    tag: "rounded-md bg-tint px-2.5 py-0.5 text-sm text-ink",
    actions: "pt-1.5",
    button: "min-h-12 w-full cursor-pointer rounded-btn bg-accent px-5.5 font-bold text-white hover:bg-accent-dark sm:w-auto",
    statusBase: "my-3 rounded-lg border px-3 py-2",
    statusIdle: "border-line",
    statusOk: "border-accent bg-tint",
    statusError: "border-[#b33] bg-[#fbe3e3]"
  };

  var COMMITMENT_LABEL = {
    "one-time": "One-time",
    "recurring": "Recurring",
    "flexible": "Flexible"
  };

  // --- Element handles (any may be missing, depending on the page) -------
  var loadingEl = document.getElementById("page-loading");
  var countEl = document.getElementById("result-count");
  var emptyEl = document.getElementById("empty-state");
  var errorEl = document.getElementById("load-error");
  var demoBanner = document.getElementById("demo-banner");

  // index.html
  var carouselEl = document.getElementById("carousel");
  var seeMoreEl = document.getElementById("see-more");
  var arrowsEl = document.getElementById("carousel-arrows");
  var prevBtn = document.getElementById("carousel-prev");
  var nextBtn = document.getElementById("carousel-next");

  // opportunities.html
  var listEl = document.getElementById("opportunity-list");
  var filtersEl = document.getElementById("filters");
  var orgSelect = document.getElementById("filter-org");
  var catSelect = document.getElementById("filter-category");
  var commitSelect = document.getElementById("filter-commitment");
  var resetBtn = document.getElementById("filter-reset");

  // Interest dialog (both pages)
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

  function countText(n) {
    return n + (n === 1 ? " verified opportunity" : " verified opportunities");
  }

  // --- Cards -------------------------------------------------------------
  // tag: "li" in the full list, "article" in the carousel.
  function buildCard(op, tag, cardClass) {
    var org = state.orgs[op.orgId] || { name: "Unknown organization" };

    var orgLine = org.website
      ? el("p", { class: CLS.org }, [el("a", { class: CLS.orgLink, href: org.website, rel: "noopener", target: "_blank" }, [org.name])])
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

    var btn = el("button", { type: "button", class: CLS.button }, ["Express interest"]);
    btn.addEventListener("click", function () { openDialog(op, org); });

    var card = el(tag, { class: cardClass, id: op.id }, [
      orgLine,
      el("h3", { class: CLS.title, text: op.title }),
      el("p", { class: CLS.desc, text: op.description }),
      dl
    ]);
    if ((op.categories || []).length) {
      card.appendChild(el("ul", { class: CLS.tags, "aria-label": "Categories" }, op.categories.map(function (c) {
        return el("li", { class: CLS.tag, text: c });
      })));
    }
    card.appendChild(el("div", { class: CLS.actions }, [btn]));
    return card;
  }

  // --- Homepage carousel -----------------------------------------------
  function renderCarousel() {
    var shown = state.opportunities.slice(0, CAROUSEL_LIMIT);
    shown.forEach(function (op) {
      carouselEl.insertBefore(buildCard(op, "article", CLS.carouselCard), seeMoreEl);
    });
    // Inserting cards in front of "See more" makes the browser keep that
    // snapped item in view, which leaves the row scrolled. Start at the first card.
    carouselEl.scrollTo({ left: 0, behavior: "instant" });
    if (countEl) countEl.textContent = countText(state.opportunities.length);

    if (!shown.length) {
      carouselEl.hidden = true;
      if (arrowsEl) arrowsEl.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
    }

    function scrollBy(dir) {
      carouselEl.scrollBy({ left: dir * carouselEl.clientWidth * 0.8, behavior: "smooth" });
    }
    if (prevBtn) prevBtn.addEventListener("click", function () { scrollBy(-1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { scrollBy(1); });
  }

  // --- Full list with filters (opportunities.html) -----------------------
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
    visible.forEach(function (op) { listEl.appendChild(buildCard(op, "li", CLS.card)); });

    emptyEl.hidden = visible.length !== 0;
    var total = state.opportunities.length;
    countEl.textContent = visible.length === total
      ? countText(total)
      : "Showing " + visible.length + " of " + total;

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

  function renderList(data) {
    populateFilters(data);
    readFiltersFromURL();
    applyFilters();
    filtersEl.hidden = false;

    [orgSelect, catSelect, commitSelect].forEach(function (s) {
      s.addEventListener("change", applyFilters);
    });
    resetBtn.addEventListener("click", function () {
      orgSelect.value = ""; catSelect.value = ""; commitSelect.value = "";
      applyFilters();
    });
  }

  // --- Interest dialog ----------------------------------------------
  function openDialog(op, org) {
    form.reset();
    formStatus.hidden = true;
    formStatus.className = CLS.statusBase + " " + CLS.statusIdle;
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

    if (demoBanner && data.meta && data.meta.demoData) demoBanner.hidden = false;

    if (carouselEl) renderCarousel();
    if (listEl) renderList(data);

    if (dialog) {
      form.addEventListener("submit", handleSubmit);
      cancelBtn.addEventListener("click", closeDialog);
      dialog.addEventListener("click", function (e) {
        if (e.target === dialog) closeDialog(); // click on backdrop
      });
    }

    if (loadingEl) loadingEl.hidden = true;
  }

  function showLoadError() {
    if (loadingEl) loadingEl.hidden = true;
    [carouselEl, arrowsEl, listEl, countEl, filtersEl].forEach(function (node) {
      if (node) node.hidden = true;
    });
    if (errorEl) errorEl.hidden = false;
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
