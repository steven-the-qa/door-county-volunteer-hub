// Pure, DOM-free logic shared between app.js and lib.test.mjs.
//
// Loaded two ways, unmodified, no build step either way:
//   - the browser imports it as a real ES module (<script type="module">)
//   - Node's built-in test runner imports it directly (`node --test`)
//
// Same pattern as admin/lib.js — see that file's header for the fuller
// explanation of why this split exists.

// Decides whether an opportunity shows on the public site: open, verified,
// and (if an expiresDate is set at all) not yet past it. `today` is passed
// in rather than read from the clock in here, so this stays deterministic
// and testable regardless of what day it actually is.
export function isLive(op, today) {
  if (op.status !== "open") return false;
  if (op.verified !== true) return false;
  if (op.expiresDate && op.expiresDate < today) return false;
  return true;
}
