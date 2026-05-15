/**
 * password-reset.ts — Phase 7: Password Reset Email Template
 *
 * Sent to migrated customers so they can set a new password.
 * The link points to the Ringside Sports storefront reset page.
 *
 * Delivery: Resend (primary), Postmark (fallback)
 */

export interface PasswordResetEmailData {
  /** Customer email address */
  to: string;
  /** Customer first name (or "there" as fallback) */
  firstName?: string;
  /** Password reset URL with token */
  resetUrl: string;
  /** Store name */
  storeName?: string;
}

export function renderPasswordResetHtml(data: PasswordResetEmailData): string {
  const firstName = data.firstName || "there";
  const storeName = data.storeName || "Ringside Sports";
  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Set Your Password — ${storeName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1a1a1a;padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;letter-spacing:-0.5px;">
                ${escapeHtml(storeName)}
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#1a1a1a;font-size:20px;font-weight:600;margin:0 0 12px;">
                Welcome back, ${escapeHtml(firstName)}!
              </h2>
              <p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 24px;">
                We've upgraded our website and need you to set a new password for your account.
                Click the button below to get started — it only takes a minute.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:16px 0 32px;">
                    <a href="${escapeHtml(data.resetUrl)}"
                       target="_blank"
                       style="display:inline-block;background-color:#dc2626;color:#ffffff;font-size:16px;font-weight:600;padding:14px 36px;border-radius:6px;text-decoration:none;text-align:center;">
                      Set Your Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#888;font-size:14px;line-height:1.5;margin:0 0 8px;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="color:#2563eb;font-size:14px;line-height:1.5;margin:0 0 24px;word-break:break-all;">
                <a href="${escapeHtml(data.resetUrl)}" target="_blank" style="color:#2563eb;">
                  ${escapeHtml(data.resetUrl)}
                </a>
              </p>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-top:1px solid #e5e5e5;padding-top:24px;">
                    <p style="color:#888;font-size:13px;line-height:1.5;margin:0;">
                      If you didn't request this email, you can safely ignore it.
                      This link will expire in 24 hours.
                    </p>
                    <p style="color:#888;font-size:13px;line-height:1.5;margin:16px 0 0;">
                      Need help? Reply to this email or contact us at
                      <a href="mailto:sales@ringsidesports.com.au" style="color:#2563eb;">
                        sales@ringsidesports.com.au
                      </a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f9f9f9;padding:24px 40px;text-align:center;">
              <p style="color:#aaa;font-size:12px;margin:0;">
                &copy; ${currentYear} ${escapeHtml(storeName)}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderPasswordResetText(data: PasswordResetEmailData): string {
  const firstName = data.firstName || "there";
  const storeName = data.storeName || "Ringside Sports";

  return `Welcome back, ${firstName}!

We've upgraded our website and need you to set a new password for your ${storeName} account.

To set your password, visit:
${data.resetUrl}

This link will expire in 24 hours.

If you didn't request this email, you can safely ignore it.

Need help? Contact us at sales@ringsidesports.com.au

— ${storeName}`;
}

// ── Email sender (Resend / Postmark fallback) ─────────────────────────────────

export async function sendPasswordResetEmail(
  data: PasswordResetEmailData,
): Promise<{ success: boolean; provider: string; error?: string }> {
  const html = renderPasswordResetHtml(data);
  const text = renderPasswordResetText(data);
  const storeName = data.storeName || "Ringside Sports";
  const from = `${storeName} <noreply@ringsidesports.com.au>`;

  // Try Resend first
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: data.to,
          subject: `Set Your ${storeName} Password`,
          html,
          text,
        }),
      });

      if (res.ok) {
        return { success: true, provider: "resend" };
      }

      const errorBody = await res.text();
      console.warn(`[password-reset] Resend failed: ${res.status} ${errorBody}`);
      // Fall through to Postmark
    } catch (err) {
      console.warn(`[password-reset] Resend error:`, err);
    }
  }

  // Fallback: Postmark
  const postmarkToken = process.env.POSTMARK_SERVER_TOKEN;
  if (postmarkToken) {
    try {
      const res = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          "X-Postmark-Server-Token": postmarkToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          From: from,
          To: data.to,
          Subject: `Set Your ${storeName} Password`,
          HtmlBody: html,
          TextBody: text,
          MessageStream: "outbound",
        }),
      });

      if (res.ok) {
        return { success: true, provider: "postmark" };
      }

      const errorBody = await res.text();
      console.warn(`[password-reset] Postmark failed: ${res.status} ${errorBody}`);
    } catch (err) {
      console.warn(`[password-reset] Postmark error:`, err);
    }
  }

  return {
    success: false,
    provider: "none",
    error: "No email provider configured (set RESEND_API_KEY or POSTMARK_SERVER_TOKEN)",
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
