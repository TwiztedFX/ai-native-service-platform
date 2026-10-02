import { capabilitiesForVertical } from "./capabilities.ts";

export interface PricingPolicy {
  riskRate: number;
  supportRate: number;
  maintenanceRate: number;
  marginRate: number;
  currency: "USD";
  model: "fixed_project";
}

export const defaultPricingPolicy: PricingPolicy = {
  riskRate: 0.1,
  supportRate: 0.08,
  maintenanceRate: 0.12,
  marginRate: 0.35,
  currency: "USD",
  model: "fixed_project",
};

export interface CostInput {
  aiCents: number;
  infrastructureCents: number;
  externalApiCents: number;
  fulfillmentCents: number;
}

export interface PriceQuote {
  aiCents: number;
  infrastructureCents: number;
  externalApiCents: number;
  fulfillmentCents: number;
  directCents: number;
  riskCents: number;
  supportCents: number;
  maintenanceMonthlyCents: number;
  deliveryBaseCents: number;
  priceCents: number;
  currency: "USD";
  model: "fixed_project";
  marginRate: number;
  recurringStatus: "quoted_not_billed";
}

export function fulfillmentCostCents(): number {
  return capabilitiesForVertical().reduce((sum, capability) => sum + capability.costCents, 0);
}

export function quotePrice(
  costs: CostInput,
  policy: PricingPolicy = defaultPricingPolicy,
): PriceQuote {
  for (const amount of [
    costs.aiCents,
    costs.infrastructureCents,
    costs.externalApiCents,
    costs.fulfillmentCents,
  ]) {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error("Costs must be non-negative integers in cents.");
    }
  }
  const directCents =
    costs.aiCents + costs.infrastructureCents + costs.externalApiCents + costs.fulfillmentCents;
  const riskCents = Math.round(directCents * policy.riskRate);
  const supportCents = Math.round(directCents * policy.supportRate);
  const maintenanceMonthlyCents = Math.round(directCents * policy.maintenanceRate);
  const deliveryBaseCents = directCents + riskCents + supportCents;
  const priceCents = Math.round(deliveryBaseCents * (1 + policy.marginRate));
  return {
    ...costs,
    directCents,
    riskCents,
    supportCents,
    maintenanceMonthlyCents,
    deliveryBaseCents,
    priceCents,
    currency: policy.currency,
    model: policy.model,
    marginRate: policy.marginRate,
    recurringStatus: "quoted_not_billed",
  };
}

export function quoteVertical(policy: PricingPolicy = defaultPricingPolicy): PriceQuote {
  return quotePrice(
    {
      aiCents: 0,
      infrastructureCents: 0,
      externalApiCents: 0,
      fulfillmentCents: fulfillmentCostCents(),
    },
    policy,
  );
}
