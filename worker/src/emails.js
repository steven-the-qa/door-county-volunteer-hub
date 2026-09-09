// Branded HTML email templates. Inline styles only — email clients strip <style>.

const GREEN = "#2e5339";
const TEXT = "#222222";
const MUTED = "#555555";
const BORDER = "#cccccc";
const PAGE_BG = "#f2f2f2";
const FONT = "Verdana, Geneva, Arial, sans-serif";

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function shell(innerHtml) {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:${PAGE_BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE_BG};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${BORDER};">
        <tr><td style="background:${GREEN};padding:16px 24px;">
          <span style="font-family:${FONT};font-size:16px;font-weight:bold;color:#ffffff;">Door County Volunteer Hub</span>
        </td></tr>
        <tr><td style="padding:24px;font-family:${FONT};font-size:14px;line-height:1.6;color:${TEXT};">
          ${innerHtml}
        </td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid ${BORDER};font-family:${FONT};font-size:12px;color:${MUTED};">
          Door County Volunteer Hub &middot; <a href="https://docovolunteerhub.com" style="color:${GREEN};">docovolunteerhub.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function row(label, valueHtml) {
  return `<tr>
    <td style="padding:6px 14px 6px 0;vertical-align:top;font-weight:bold;color:${MUTED};white-space:nowrap;">${label}</td>
    <td style="padding:6px 0;vertical-align:top;">${valueHtml}</td>
  </tr>`;
}

export function teamNotificationEmail({ fullName, email, opportunityTitle, opportunityId, orgName }) {
  return shell(`
    <p style="margin:0 0 14px;font-size:16px;font-weight:bold;">New volunteer interest</p>
    <p style="margin:0 0 18px;">Someone submitted the interest form. Next step: connect them with the organization.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 20px;">
      ${row("Name", esc(fullName))}
      ${row("Email", `<a href="mailto:${esc(email)}" style="color:${GREEN};">${esc(email)}</a>`)}
      ${row("Opportunity", esc(opportunityTitle))}
      ${row("Organization", esc(orgName))}
      ${row("Opportunity&nbsp;ID", `<span style="color:${MUTED};">${esc(opportunityId)}</span>`)}
    </table>
    <p style="margin:0;color:${MUTED};font-size:13px;">Reply to this email to write to ${esc(fullName)} directly.</p>
  `);
}

export function volunteerConfirmationEmail({ firstName, opportunityTitle, orgName }) {
  return shell(`
    <p style="margin:0 0 16px;">Hi ${esc(firstName)},</p>
    <p style="margin:0 0 16px;">Thanks for your interest in <strong>${esc(opportunityTitle)}</strong> with <strong>${esc(orgName)}</strong>. We've received your message.</p>
    <p style="margin:0 0 16px;">Someone from the Door County Volunteer Hub team will email you within about two business days to connect you with the right person at ${esc(orgName)}.</p>
    <p style="margin:0;">Questions in the meantime? Just reply to this email.</p>
  `);
}
