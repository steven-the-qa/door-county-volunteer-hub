#!/usr/bin/env node
// Dependency-free validator for data/opportunities.json.
// Run: node scripts/validate.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "data", "opportunities.json");

const errors = [];
const err = (msg) => errors.push(msg);

const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isSlug = (v) => typeof v === "string" && /^[a-z0-9-]+$/.test(v);

let data;
try {
  data = JSON.parse(readFileSync(file, "utf8"));
} catch (e) {
  console.error(`✗ data/opportunities.json is not valid JSON: ${e.message}`);
  process.exit(1);
}

// meta
if (!data.meta || typeof data.meta !== "object") err("meta: missing or not an object");
else {
  if (!isDate(data.meta.lastUpdated)) err("meta.lastUpdated: must be YYYY-MM-DD");
}

const VALID_CATEGORIES = Array.isArray(data.meta?.categories) ? new Set(data.meta.categories) : null;

// organizations
const orgIds = new Set();
if (!Array.isArray(data.organizations)) err("organizations: must be an array");
else {
  data.organizations.forEach((o, i) => {
    const at = `organizations[${i}]`;
    if (!isSlug(o.id)) err(`${at}.id: must be a kebab-case slug`);
    else if (orgIds.has(o.id)) err(`${at}.id: duplicate "${o.id}"`);
    else orgIds.add(o.id);
    if (typeof o.name !== "string" || !o.name.trim()) err(`${at}.name: required`);
    if (o.partnerStatus && !["active", "prospective", "paused", "former"].includes(o.partnerStatus))
      err(`${at}.partnerStatus: invalid "${o.partnerStatus}"`);
  });
}

// opportunities
const oppIds = new Set();
const REQUIRED = ["id", "orgId", "title", "description", "commitment", "status", "verified", "postedDate", "expiresDate"];
if (!Array.isArray(data.opportunities)) err("opportunities: must be an array");
else {
  data.opportunities.forEach((op, i) => {
    const at = `opportunities[${i}]${op.id ? ` (${op.id})` : ""}`;
    for (const k of REQUIRED) if (!(k in op)) err(`${at}.${k}: required`);

    if (!isSlug(op.id)) err(`${at}.id: must be a kebab-case slug`);
    else if (oppIds.has(op.id)) err(`${at}.id: duplicate "${op.id}"`);
    else oppIds.add(op.id);

    if (op.orgId && !orgIds.has(op.orgId)) err(`${at}.orgId: no organization with id "${op.orgId}"`);
    if (op.commitment && !["one-time", "recurring", "flexible"].includes(op.commitment))
      err(`${at}.commitment: invalid "${op.commitment}"`);
    if (op.status && !["open", "filled", "paused", "closed", "draft"].includes(op.status))
      err(`${at}.status: invalid "${op.status}"`);
    if ("verified" in op && typeof op.verified !== "boolean") err(`${at}.verified: must be true/false`);
    if (op.postedDate && !isDate(op.postedDate)) err(`${at}.postedDate: must be YYYY-MM-DD`);
    if (op.expiresDate && !isDate(op.expiresDate)) err(`${at}.expiresDate: must be YYYY-MM-DD`);
    if (op.verifiedDate && !isDate(op.verifiedDate)) err(`${at}.verifiedDate: must be YYYY-MM-DD`);
    if ("minAge" in op && (!Number.isInteger(op.minAge) || op.minAge < 0))
      err(`${at}.minAge: must be a non-negative integer`);

    if (Array.isArray(op.categories) && VALID_CATEGORIES) {
      for (const c of op.categories)
        if (!VALID_CATEGORIES.has(c)) err(`${at}.categories: "${c}" is not in meta.categories`);
    }

    // Warn-level: an opportunity that will never show.
    if (op.status === "open" && op.verified === true && isDate(op.expiresDate)) {
      const today = new Date().toISOString().slice(0, 10);
      if (op.expiresDate < today) console.warn(`⚠ ${at}: expiresDate ${op.expiresDate} is in the past — it will be hidden.`);
    }
  });
}

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s) in data/opportunities.json:\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const openCount = data.opportunities.filter((o) => o.status === "open" && o.verified).length;
console.log(`✓ data/opportunities.json is valid — ${data.organizations.length} orgs, ${data.opportunities.length} opportunities (${openCount} open & verified).`);
