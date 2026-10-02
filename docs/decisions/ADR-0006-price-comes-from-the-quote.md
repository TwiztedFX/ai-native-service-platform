# ADR-0006: Price comes from the quote

- Status: accepted
- Date: 2026-10-03

## Decision

`quoteVertical` is the only function that computes the customer price. `buildProposal` copies that quote. Maintenance is shown as a monthly figure with status `quoted_not_billed`. Acceptance sets `commercial_status` to `accepted_unbilled`.

## Alternatives

- Integrate Stripe now. No account or secret is available.
- Omit price until billing exists. The vertical would not prove the pricing requirement.
- Let narrative generation rewrite the price.

## Rationale

The formula is fulfillment cost plus risk and support, then margin. AI, infrastructure, and external API costs are zero in this vertical because those costs are not incurred. The formula is pinned by tests.

## Consequences

There is no invoice or payment event. Adding a provider later must consume this quote instead of introducing a parallel price.
