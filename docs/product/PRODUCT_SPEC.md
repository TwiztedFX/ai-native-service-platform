# Product specification

## Vision

A customer should be able to describe a business problem and receive a solution that is priced, approved, delivered, checked, and measured. The unit of sale is the outcome, not a pile of hours.

## What this version does

The selected vertical is operational runbook production. It was chosen because it can be completed without payment credentials, production access, or a regulated industry workflow, and because the deliverable can be checked deterministically.

1. A person creates an account and an organization.
2. They record a customer and a problem statement.
3. Discovery asks five required questions and refuses vague answers. The success metric must contain a number.
4. Extracted hints from the problem statement are labeled `extracted`. They do not silently satisfy a question. An answer prefixed with `assume:` is stored as an assumption. Nothing else is invented.
5. A solution is composed only from the capability registry.
6. Price is calculated from fulfillment cost, risk, support, and margin. Monthly maintenance is quoted and marked `quoted_not_billed`.
7. The proposal is rendered from that solution and quote. There is no second price.
8. An organization member accepts the proposal. That creates a project and a task graph. Commercial status is `accepted_unbilled` because no payment provider is connected.
9. The documentation agent writes the runbook, checklist, and metric baseline. The verifier agent checks them. One failure reopens authoring. A second failure opens a human review. Passing verification publishes the package.
10. The outcome baseline is taken from the customer's own words. The after-value stays empty until someone records it.
11. A blueprint is stored at stage `candidate`. Promotion is rejected.

## What this version does not do

It does not interview with a live model, collect payment, deploy customer software, white-label a brand, or learn a new vertical from completed work. Those are later phases in `docs/roadmap/ROADMAP.md`.

## Roles

- `owner` and `operator` can discover, compose, run fulfillment, and decide human reviews.
- `customer` can answer discovery, accept a proposal, read the package, and record an outcome. A customer cannot run fulfillment.
