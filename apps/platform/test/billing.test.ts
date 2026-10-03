import { createHmac, randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { quoteVertical } from "@platform/domain";
import { expect } from "../../../test/expect.ts";
import { type AppConfig, buildApp } from "../src/app.ts";
import { DataPlane } from "../src/db/database.ts";

const answers = {
  current_work: "Two coordinators spend 20 hours per week emailing new clients.",
  success_metric: "Cut onboarding from 15 days to 5 days.",
  existing_systems: "none",
  constraints: "Do not replace the mailbox.",
  approver: "Nora Ahmed",
};

const webhookSecret = "whsec_test_secret";
const stripeKey = "sk_test_secret";

function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    scryptN: 1024,
    sessionTtlHours: 24,
    cookieSecure: false,
    aiModel: "configured-model",
    ...overrides,
  };
}

function cookieOf(headers: Record<string, unknown>): string {
  const raw = headers["set-cookie"];
  const value = Array.isArray(raw) ? String(raw[0]) : String(raw ?? "");
  return value.split(";")[0] ?? "";
}

function sign(rawBody: string, secret = webhookSecret): string {
  const timestamp = "1710000000";
  const digest = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

async function start(config?: Partial<AppConfig>) {
  const plane = new DataPlane({ mode: "memory" });
  const app = buildApp({ plane, config: testConfig(config) });
  return {
    plane,
    app,
    async close() {
      await app.close();
      plane.close();
    },
  };
}

async function acceptedProject(app: Awaited<ReturnType<typeof start>>["app"]) {
  const email = `owner-${randomUUID()}@example.com`;
  const registered = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, name: "Avery Owner", password: "correct-horse" },
  });
  expect(registered.statusCode).toBe(200);
  const cookie = cookieOf(registered.headers);
  const org = await app.inject({
    method: "POST",
    url: "/api/organizations",
    headers: { cookie },
    payload: { name: "Northwind Ops" },
  });
  const orgId = org.json().organization.id as string;
  const customer = await app.inject({
    method: "POST",
    url: `/api/organizations/${orgId}/customers`,
    headers: { cookie },
    payload: { name: "Nora Ahmed", company: "Northwind" },
  });
  const engagement = await app.inject({
    method: "POST",
    url: `/api/organizations/${orgId}/engagements`,
    headers: { cookie },
    payload: {
      customerId: customer.json().id,
      problem: "New clients wait three weeks because onboarding lives in an inbox.",
    },
  });
  const engagementId = engagement.json().id as string;
  const base = { method: "POST" as const, headers: { cookie } };
  await app.inject({
    ...base,
    url: `/api/organizations/${orgId}/engagements/${engagementId}/answers`,
    payload: answers,
  });
  await app.inject({
    ...base,
    url: `/api/organizations/${orgId}/engagements/${engagementId}/requirements`,
    payload: {},
  });
  const proposal = await app.inject({
    ...base,
    url: `/api/organizations/${orgId}/engagements/${engagementId}/solution`,
    payload: {},
  });
  expect(proposal.statusCode).toBe(200);
  const proposalId = proposal.json().proposal.id as string;
  const priceCents = proposal.json().proposal.priceCents as number;
  expect(priceCents).toBe(quoteVertical().priceCents);
  const accepted = await app.inject({
    ...base,
    url: `/api/organizations/${orgId}/proposals/${proposalId}/accept`,
    payload: {},
  });
  expect(accepted.statusCode).toBe(200);
  return {
    cookie,
    orgId,
    proposalId,
    priceCents,
    projectId: accepted.json().projectId as string,
  };
}

async function commercialStatus(
  app: Awaited<ReturnType<typeof start>>["app"],
  cookie: string,
  orgId: string,
  projectId: string,
): Promise<string> {
  const view = await app.inject({
    method: "GET",
    url: `/api/organizations/${orgId}/projects/${projectId}`,
    headers: { cookie },
  });
  expect(view.statusCode).toBe(200);
  return view.json().project.commercialStatus as string;
}

function stripeFetch(sessionId: string): { fetchImpl: typeof fetch; bodies: string[] } {
  const bodies: string[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    bodies.push(String(init?.body ?? ""));
    return new Response(
      JSON.stringify({
        id: sessionId,
        url: `https://checkout.stripe.com/c/pay/${sessionId}`,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  return { fetchImpl, bodies };
}

function completedEvent(input: {
  organizationId: string;
  projectId: string;
  proposalId: string;
  sessionId: string;
  amount: number;
  type?: string;
}): string {
  return JSON.stringify({
    id: "evt_test_1",
    type: input.type ?? "checkout.session.completed",
    data: {
      object: {
        id: input.sessionId,
        object: "checkout.session",
        amount_total: input.amount,
        currency: "usd",
        metadata: {
          organization_id: input.organizationId,
          project_id: input.projectId,
          proposal_id: input.proposalId,
        },
      },
    },
  });
}

describe("billing", () => {
  it("keeps accepted_unbilled when Stripe is not configured", async () => {
    const ctx = await start();
    const project = await acceptedProject(ctx.app);
    const checkout = await ctx.app.inject({
      method: "POST",
      url: `/api/organizations/${project.orgId}/projects/${project.projectId}/checkout`,
      headers: { cookie: project.cookie },
      payload: { paid: true },
    });
    expect(checkout.statusCode).toBe(409);
    expect(checkout.json().error.code).toBe("PAYMENT_NOT_CONFIGURED");
    const webhook = await ctx.app.inject({
      method: "POST",
      url: "/api/billing/webhook",
      headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=abcd" },
      payload: "{}",
    });
    expect(webhook.statusCode).toBe(409);
    expect(webhook.json().error.code).toBe("PAYMENT_NOT_CONFIGURED");
    expect(await commercialStatus(ctx.app, project.cookie, project.orgId, project.projectId)).toBe(
      "accepted_unbilled",
    );
    await ctx.close();
  });

  it("rejects a bad webhook signature and leaves status unchanged", async () => {
    const stripe = stripeFetch("cs_test_bad_sig");
    const ctx = await start({
      stripeSecretKey: stripeKey,
      stripeWebhookSecret: webhookSecret,
      fetchImpl: stripe.fetchImpl,
    });
    const project = await acceptedProject(ctx.app);
    const checkout = await ctx.app.inject({
      method: "POST",
      url: `/api/organizations/${project.orgId}/projects/${project.projectId}/checkout`,
      headers: { cookie: project.cookie },
      payload: {},
    });
    expect(checkout.statusCode).toBe(200);
    expect(checkout.json().commercialStatus).toBe("checkout_open");
    const raw = completedEvent({
      organizationId: project.orgId,
      projectId: project.projectId,
      proposalId: project.proposalId,
      sessionId: "cs_test_bad_sig",
      amount: project.priceCents,
    });
    const missing = await ctx.app.inject({
      method: "POST",
      url: "/api/billing/webhook",
      headers: { "content-type": "application/json" },
      payload: raw,
    });
    expect(missing.statusCode).toBe(400);
    expect(missing.json().error.code).toBe("INVALID_SIGNATURE");
    const forged = await ctx.app.inject({
      method: "POST",
      url: "/api/billing/webhook",
      headers: {
        "content-type": "application/json",
        "stripe-signature": sign(raw, "wrong-secret"),
      },
      payload: raw,
    });
    expect(forged.statusCode).toBe(400);
    expect(forged.json().error.code).toBe("INVALID_SIGNATURE");
    expect(await commercialStatus(ctx.app, project.cookie, project.orgId, project.projectId)).toBe(
      "checkout_open",
    );
    await ctx.close();
  });

  it("does not mark paid when the verified amount differs from the proposal", async () => {
    const stripe = stripeFetch("cs_test_mismatch");
    const ctx = await start({
      stripeSecretKey: stripeKey,
      stripeWebhookSecret: webhookSecret,
      fetchImpl: stripe.fetchImpl,
    });
    const project = await acceptedProject(ctx.app);
    await ctx.app.inject({
      method: "POST",
      url: `/api/organizations/${project.orgId}/projects/${project.projectId}/checkout`,
      headers: { cookie: project.cookie },
      payload: { paid: true },
    });
    const raw = completedEvent({
      organizationId: project.orgId,
      projectId: project.projectId,
      proposalId: project.proposalId,
      sessionId: "cs_test_mismatch",
      amount: project.priceCents - 1,
    });
    const webhook = await ctx.app.inject({
      method: "POST",
      url: "/api/billing/webhook",
      headers: { "content-type": "application/json", "stripe-signature": sign(raw) },
      payload: raw,
    });
    expect(webhook.statusCode).toBe(200);
    expect(webhook.json()).toEqual({ applied: false, reason: "amount_mismatch" });
    expect(await commercialStatus(ctx.app, project.cookie, project.orgId, project.projectId)).toBe(
      "checkout_open",
    );
    await ctx.close();
  });

  it("marks paid only after a verified checkout.session.completed event", async () => {
    const stripe = stripeFetch("cs_test_paid");
    const ctx = await start({
      stripeSecretKey: stripeKey,
      stripeWebhookSecret: webhookSecret,
      fetchImpl: stripe.fetchImpl,
    });
    const project = await acceptedProject(ctx.app);
    const checkout = await ctx.app.inject({
      method: "POST",
      url: `/api/organizations/${project.orgId}/projects/${project.projectId}/checkout`,
      headers: { cookie: project.cookie },
      payload: { paid: true },
    });
    expect(checkout.statusCode).toBe(200);
    expect(checkout.json().checkoutSessionId).toBe("cs_test_paid");
    expect(checkout.json().commercialStatus).toBe("checkout_open");
    expect(stripe.bodies).toHaveLength(1);
    const form = new URLSearchParams(stripe.bodies[0]);
    expect(form.get("line_items[0][price_data][unit_amount]")).toBe(String(project.priceCents));
    expect(await commercialStatus(ctx.app, project.cookie, project.orgId, project.projectId)).toBe(
      "checkout_open",
    );
    const ignored = completedEvent({
      organizationId: project.orgId,
      projectId: project.projectId,
      proposalId: project.proposalId,
      sessionId: "cs_test_paid",
      amount: project.priceCents,
      type: "payment_intent.succeeded",
    });
    const ignoredResponse = await ctx.app.inject({
      method: "POST",
      url: "/api/billing/webhook",
      headers: { "content-type": "application/json", "stripe-signature": sign(ignored) },
      payload: ignored,
    });
    expect(ignoredResponse.statusCode).toBe(200);
    expect(ignoredResponse.json()).toEqual({ applied: false, reason: "ignored" });
    expect(await commercialStatus(ctx.app, project.cookie, project.orgId, project.projectId)).toBe(
      "checkout_open",
    );
    const raw = completedEvent({
      organizationId: project.orgId,
      projectId: project.projectId,
      proposalId: project.proposalId,
      sessionId: "cs_test_paid",
      amount: project.priceCents,
    });
    const webhook = await ctx.app.inject({
      method: "POST",
      url: "/api/billing/webhook",
      headers: { "content-type": "application/json", "stripe-signature": sign(raw) },
      payload: raw,
    });
    expect(webhook.statusCode).toBe(200);
    expect(webhook.json()).toEqual({ applied: true, reason: "paid" });
    expect(await commercialStatus(ctx.app, project.cookie, project.orgId, project.projectId)).toBe(
      "paid",
    );
    const types = (
      await ctx.app.inject({
        method: "GET",
        url: `/api/organizations/${project.orgId}/projects/${project.projectId}`,
        headers: { cookie: project.cookie },
      })
    ).json().events as Array<{ type: string }>;
    expect(types.some((event) => event.type === "PaymentReceived")).toBe(false);
    await ctx.close();
  });
});
