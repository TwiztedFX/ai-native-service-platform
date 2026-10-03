import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../errors.ts";

export function billingConfigured(
  secretKey: string | undefined,
  webhookSecret: string | undefined,
): boolean {
  return Boolean(secretKey?.trim() && webhookSecret?.trim());
}

export function verifyStripeSignature(
  rawBody: string | undefined,
  header: string | string[] | undefined,
  webhookSecret: string,
): boolean {
  if (!rawBody || typeof header !== "string" || !webhookSecret) return false;
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "t") timestamp = value;
    if (key === "v1" && value) signatures.push(value);
  }
  if (!/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  const expected = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return signatures.some((signature) => {
    const actual = Buffer.from(signature, "utf8");
    if (actual.length !== expectedBuffer.length) return false;
    return timingSafeEqual(actual, expectedBuffer);
  });
}

export interface CheckoutSessionRequest {
  priceCents: number;
  currency: string;
  organizationId: string;
  projectId: string;
  proposalId: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(
  fetchImpl: typeof fetch,
  secretKey: string,
  input: CheckoutSessionRequest,
): Promise<{ id: string; url: string | null }> {
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", input.successUrl);
  params.set("cancel_url", input.cancelUrl);
  params.set("client_reference_id", input.projectId);
  params.set("metadata[organization_id]", input.organizationId);
  params.set("metadata[project_id]", input.projectId);
  params.set("metadata[proposal_id]", input.proposalId);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", input.currency.toLowerCase());
  params.set("line_items[0][price_data][unit_amount]", String(input.priceCents));
  params.set("line_items[0][price_data][product_data][name]", "Operational runbook");
  let response: Response;
  try {
    response = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${secretKey}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
  } catch {
    throw new AppError(502, "CHECKOUT_FAILED", "Stripe did not open a checkout session.");
  }
  if (!response.ok) {
    throw new AppError(502, "CHECKOUT_FAILED", "Stripe did not open a checkout session.");
  }
  const payload = (await response.json()) as { id?: unknown; url?: unknown };
  if (typeof payload.id !== "string" || payload.id.length === 0) {
    throw new AppError(502, "CHECKOUT_FAILED", "Stripe did not return a checkout session.");
  }
  return { id: payload.id, url: typeof payload.url === "string" ? payload.url : null };
}
