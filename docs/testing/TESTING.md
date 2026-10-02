# Testing

```bash
npm test
npm run typecheck
npm run lint
```

## What the tests cover

- Open questions block requirements. "None" for systems does not invent integrations. Explicit `assume:` answers are labeled assumptions.
- The price formula and the proposal copy that quote.
- The verifier fails a runbook that drops the success metric.
- Documentation, verifier, and optimization permissions are distinct.
- Model routing stays deterministic without a key and for restricted data.
- The provider client keeps customer text in the user message and ignores tool calls.
- The HTTP loop creates an account, organization, proposal, project, verified package, baseline, and candidate blueprint.
- A second run does not deliver twice.
- One omitted metric is repaired. Repeated omission escalates and does not publish.
- A zero budget escalates. A task left `running` is recovered.
- Another organization cannot read the engagement. A poisoned row with a foreign organization id is hidden. A customer role cannot run fulfillment.
- Narrative text does not change the price. Fault injection is disabled on the normal app.

AI calls in tests use an injected `fetch`. No test needs a live key.

On 2026-10-03 the workspace was also exercised in a browser against `http://127.0.0.1:8787`: create an account, create an organization, submit an onboarding problem, answer discovery, build requirements, compose a $461.97 proposal, accept it, run fulfillment, and see a delivered package with a 20-hour baseline and a candidate blueprint.

## Not covered yet

Browser automation notes belong with the commit that ran them. There is no hosted end-to-end environment and no payment test.
