import { randomUUID } from "node:crypto";
import { assertRole, type TenantContext } from "../auth/identity.ts";
import type { DataPlane } from "../db/database.ts";
import { one, run, transaction } from "../db/sql.ts";
import { AppError, now } from "../errors.ts";
import { createCheckoutSession } from "./stripe.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface OpenCheckoutInput {
  fetchImpl: typeof fetch;
  secretKey: string;
  successUrl: string;
  cancelUrl: string;
}

interface ProjectPaymentRow {
  id: string;
  proposal_id: string;
  commercial_status: string;
  price_cents: number;
  currency: string;
  payment_id: string | null;
  checkout_session_id: string | null;
  checkout_url: string | null;
  payment_status: string | null;
}

export async function openCheckout(
  ctx: TenantContext,
  projectId: string,
  input: OpenCheckoutInput,
): Promise<{ checkoutSessionId: string; url: string | null; commercialStatus: "checkout_open" }> {
  assertRole(ctx.role, ["owner", "operator", "customer"]);
  const project = loadProject(ctx, projectId);
  if (project.commercial_status === "paid") {
    throw new AppError(409, "PAYMENT_ALREADY_RECORDED", "This project is already paid.");
  }
  if (
    project.commercial_status === "checkout_open" &&
    project.checkout_session_id &&
    project.payment_status === "open"
  ) {
    return {
      checkoutSessionId: project.checkout_session_id,
      url: project.checkout_url,
      commercialStatus: "checkout_open",
    };
  }
  if (project.commercial_status !== "accepted_unbilled") {
    throw new AppError(409, "CHECKOUT_UNAVAILABLE", "Checkout is not open for this project.");
  }
  const session = await createCheckoutSession(input.fetchImpl, input.secretKey, {
    priceCents: project.price_cents,
    currency: project.currency,
    organizationId: ctx.organizationId,
    projectId: project.id,
    proposalId: project.proposal_id,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
  });
  const stamp = now();
  transaction(ctx.tenant, () => {
    run(
      ctx.tenant,
      `INSERT INTO payments (
         id, organization_id, project_id, proposal_id, checkout_session_id, checkout_url,
         amount_cents, currency, status, provider_event_id, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', NULL, ?, ?)`,
      [
        randomUUID(),
        ctx.organizationId,
        project.id,
        project.proposal_id,
        session.id,
        session.url,
        project.price_cents,
        project.currency,
        stamp,
        stamp,
      ],
    );
    const changes = run(
      ctx.tenant,
      `UPDATE projects SET commercial_status = 'checkout_open'
       WHERE id = ? AND organization_id = ? AND commercial_status = 'accepted_unbilled'`,
      [project.id, ctx.organizationId],
    );
    if (changes !== 1) {
      throw new AppError(409, "CHECKOUT_UNAVAILABLE", "Checkout is not open for this project.");
    }
  });
  return { checkoutSessionId: session.id, url: session.url, commercialStatus: "checkout_open" };
}

export interface WebhookResult {
  applied: boolean;
  reason: "paid" | "ignored" | "amount_mismatch" | "already_paid";
}

export function applyVerifiedWebhook(plane: DataPlane, body: unknown): WebhookResult {
  const event = readEvent(body);
  if (!event || event.type !== "checkout.session.completed") {
    return { applied: false, reason: "ignored" };
  }
  const session = event.data?.object;
  const organizationId = session?.metadata?.organization_id;
  const projectId = session?.metadata?.project_id;
  const proposalId = session?.metadata?.proposal_id;
  const sessionId = session?.id;
  if (
    typeof organizationId !== "string" ||
    !UUID.test(organizationId) ||
    typeof projectId !== "string" ||
    !UUID.test(projectId) ||
    typeof proposalId !== "string" ||
    !UUID.test(proposalId) ||
    typeof sessionId !== "string" ||
    sessionId.length === 0
  ) {
    return { applied: false, reason: "ignored" };
  }
  const tenant = plane.tenant(organizationId);
  const row = one<{
    price_cents: number;
    currency: string;
    commercial_status: string;
    payment_id: string;
    payment_status: string;
  }>(
    tenant,
    `SELECT proposals.price_cents, proposals.currency, projects.commercial_status,
            payments.id AS payment_id, payments.status AS payment_status
     FROM payments
     JOIN projects ON projects.id = payments.project_id AND projects.organization_id = payments.organization_id
     JOIN proposals ON proposals.id = payments.proposal_id AND proposals.organization_id = payments.organization_id
     WHERE payments.checkout_session_id = ?
       AND payments.organization_id = ?
       AND payments.project_id = ?
       AND payments.proposal_id = ?
       AND projects.id = ?
       AND proposals.id = ?`,
    [sessionId, organizationId, projectId, proposalId, projectId, proposalId],
  );
  if (!row) return { applied: false, reason: "ignored" };
  if (row.commercial_status === "paid" || row.payment_status === "paid") {
    return { applied: false, reason: "already_paid" };
  }
  const amount = session?.amount_total;
  const currency = typeof session?.currency === "string" ? session.currency : "";
  if (
    typeof amount !== "number" ||
    !Number.isInteger(amount) ||
    amount !== row.price_cents ||
    currency.toUpperCase() !== row.currency.toUpperCase()
  ) {
    return { applied: false, reason: "amount_mismatch" };
  }
  const eventId = typeof event.id === "string" ? event.id : null;
  transaction(tenant, () => {
    const changes = run(
      tenant,
      `UPDATE projects SET commercial_status = 'paid'
       WHERE id = ? AND organization_id = ? AND commercial_status = 'checkout_open'`,
      [projectId, organizationId],
    );
    if (changes !== 1) {
      throw new AppError(409, "PAYMENT_NOT_APPLIED", "Payment status did not change.");
    }
    const paymentChanges = run(
      tenant,
      `UPDATE payments SET status = 'paid', provider_event_id = ?, updated_at = ?
       WHERE id = ? AND organization_id = ? AND status = 'open'`,
      [eventId, now(), row.payment_id, organizationId],
    );
    if (paymentChanges !== 1) {
      throw new AppError(409, "PAYMENT_NOT_APPLIED", "Payment status did not change.");
    }
  });
  return { applied: true, reason: "paid" };
}

function loadProject(ctx: TenantContext, projectId: string): ProjectPaymentRow {
  const project = one<ProjectPaymentRow>(
    ctx.tenant,
    `SELECT projects.id, projects.proposal_id, projects.commercial_status,
            proposals.price_cents, proposals.currency,
            payments.id AS payment_id, payments.checkout_session_id, payments.checkout_url,
            payments.status AS payment_status
     FROM projects
     JOIN proposals ON proposals.id = projects.proposal_id AND proposals.organization_id = projects.organization_id
     LEFT JOIN payments ON payments.project_id = projects.id AND payments.organization_id = projects.organization_id
     WHERE projects.id = ? AND projects.organization_id = ?`,
    [projectId, ctx.organizationId],
  );
  if (!project) throw new AppError(404, "NOT_FOUND", "Project not found.");
  return project;
}

interface StripeEvent {
  id?: unknown;
  type?: unknown;
  data?: {
    object?: {
      id?: unknown;
      amount_total?: unknown;
      currency?: unknown;
      metadata?: {
        organization_id?: unknown;
        project_id?: unknown;
        proposal_id?: unknown;
      };
    };
  };
}

function readEvent(body: unknown): StripeEvent | null {
  if (!body || typeof body !== "object") return null;
  return body as StripeEvent;
}
