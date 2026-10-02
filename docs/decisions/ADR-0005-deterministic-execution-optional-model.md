# ADR-0005: Deterministic execution and an optional model

- Status: accepted
- Date: 2026-10-03

## Decision

Discovery, solution composition, pricing, fulfillment, and verification are deterministic code. An OpenAI-compatible client may add a narrative summary when `AI_API_KEY` is set. Restricted privacy skips the network call.

## Alternatives

- Block the product until an API key exists.
- Let a model invent requirements and prices.
- Hide a canned model response behind an "AI" label.

## Rationale

No model key is configured in the development environment. The core loop still has to be true. Deterministic agents with permissions and tests meet that bar. The provider interface is real and tested with an injected `fetch`.

## Consequences

Do not describe the runbook engine as a live LLM. The health endpoint reports whether a key is configured. Narrative text is stored separately and is not an input to the quote.
