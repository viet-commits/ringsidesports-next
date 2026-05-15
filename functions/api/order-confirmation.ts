/**
 * Cloudflare Pages Function — Order Confirmation Email
 *
 * POST /api/order-confirmation
 * Body: { orderId, customerEmail, items, total, shippingAddress, discount }
 *
 * Sends order confirmation email via Postmark.
 * Falls back to logging if POSTMARK_TOKEN is not set.
 *
 * Required env vars (set in Cloudflare Dashboard):
 *   POSTMARK_SERVER_TOKEN — Postmark API server token
 *
 * From: info@ringsidesports.com.au
 */

interface OrderItem {
  name: string;
  price: number; // AUD cents
  quantity: number;
}

interface OrderConfirmationBody {
  orderId: string;
  customerEmail: string;
  items: OrderItem[];
  total: number; // AUD cents
  shippingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  discountCode?: string;
  discountAmount?: number;
}

interface Env {
  POSTMARK_SERVER_TOKEN: string;
}

function formatAud(cents: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function buildEmailHtml(body: OrderConfirmationBody): string {
  const { orderId, items, total, shippingAddress, discountCode, discountAmount } = body;

  const itemsHtml = items
    .map(
      (item) => `
    <tr>
      <td style="padding:8px 12px; border-bottom:1px solid #eee;">${item.name} × ${item.quantity}</td>
      <td style="padding:8px 12px; border-bottom:1px solid #eee; text-align:right;">${formatAud(item.price * item.quantity)}</td>
    </tr>`
    )
    .join("");

  const discountHtml = discountAmount && discountAmount > 0
    ? `
    <tr>
      <td style="padding:8px 12px; text-align:right; color:#16a34a;">Discount${discountCode ? ` (${discountCode})` : ""}</td>
      <td style="padding:8px 12px; text-align:right; color:#16a34a;">−${formatAud(discountAmount)}</td>
    </tr>`
    : "";

  const addressHtml = shippingAddress
    ? `
    <div style="margin-top:16px; padding:12px; background:#f9fafb; border-radius:8px;">
      <strong>Shipping Address:</strong><br/>
      ${shippingAddress.line1 || ""}${shippingAddress.line2 ? "<br/>" + shippingAddress.line2 : ""}<br/>
      ${[shippingAddress.city, shippingAddress.state, shippingAddress.postalCode].filter(Boolean).join(" ")}<br/>
      ${shippingAddress.country || "Australia"}
    </div>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif; max-width:560px; margin:0 auto; color:#1a1a1a;">
  <div style="background:#1a1a1a; padding:24px; text-align:center;">
    <h1 style="color:#fbbf24; margin:0; font-size:22px;">Ringside Sports</h1>
  </div>
  <div style="padding:24px; background:#fff;">
    <h2 style="color:#1a1a1a; margin-top:0;">Order Confirmed — Thank You!</h2>
    <p style="color:#6b7280;">Your order has been received and is being processed.</p>
    <p style="color:#6b7280;"><strong>Order ID:</strong> ${orderId}</p>

    <table style="width:100%; margin-top:16px; border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left; padding:8px 12px; border-bottom:2px solid #1a1a1a;">Item</th>
          <th style="text-align:right; padding:8px 12px; border-bottom:2px solid #1a1a1a;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
        ${discountHtml}
        <tr>
          <td style="padding:12px; text-align:right; font-weight:bold; font-size:16px; border-top:2px solid #1a1a1a;">Total</td>
          <td style="padding:12px; text-align:right; font-weight:bold; font-size:16px; border-top:2px solid #1a1a1a;">${formatAud(total)}</td>
        </tr>
      </tbody>
    </table>

    ${addressHtml}

    <p style="margin-top:24px; color:#6b7280; font-size:14px;">
      All prices include GST. You will receive shipping confirmation once your order is dispatched.<br/>
      If you have any questions, reply to this email or contact us at <a href="mailto:info@ringsidesports.com.au">info@ringsidesports.com.au</a>.
    </p>
  </div>
  <div style="background:#f9fafb; padding:16px; text-align:center; font-size:12px; color:#9ca3af;">
    Ringside Sports · Melbourne, Australia · <a href="https://ringsidesports.com.au" style="color:#9ca3af;">ringsidesports.com.au</a>
  </div>
</body>
</html>`;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: OrderConfirmationBody;
  try {
    body = (await request.json()) as OrderConfirmationBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { customerEmail, orderId } = body;
  if (!customerEmail || !orderId) {
    return Response.json({ error: "Missing required fields: customerEmail, orderId" }, { status: 400 });
  }

  const token = env.POSTMARK_SERVER_TOKEN || "";

  if (!token) {
    // Fallback: log the confirmation
    console.log(`[ORDER CONFIRMATION] Would send to ${customerEmail}:`, {
      orderId,
      items: body.items,
      total: body.total,
      shippingAddress: body.shippingAddress,
    });
    return Response.json({
      success: true,
      mode: "logged",
      message: "Order confirmation logged (POSTMARK_SERVER_TOKEN not set). Add token in Cloudflare Dashboard to send emails.",
    });
  }

  try {
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": token,
      },
      body: JSON.stringify({
        From: "info@ringsidesports.com.au",
        To: customerEmail,
        Subject: `Order Confirmed — ${orderId} | Ringside Sports`,
        HtmlBody: buildEmailHtml(body),
        MessageStream: "outbound",
      }),
    });

    const result = await response.json() as { ErrorCode?: number; Message?: string; MessageID?: string };

    if (!response.ok) {
      console.error("[POSTMARK ERROR]", result);
      return Response.json(
        { error: "Failed to send email", detail: result.Message || "Unknown error" },
        { status: 502 }
      );
    }

    return Response.json({
      success: true,
      mode: "sent",
      messageId: result.MessageID,
    });
  } catch (err) {
    console.error("[POSTMARK EXCEPTION]", err);
    return Response.json(
      { error: "Failed to send confirmation email", detail: String(err) },
      { status: 500 }
    );
  }
};
