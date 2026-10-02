# Agent architecture

Agents in this version are named executors with permissions, tools, budgets, and attempt limits. They are not separate model personas. The permission check is `assertAllowed` in `packages/domain/src/agents.ts`. A prompt cannot change it.

| Agent | Runs when | May | May not |
| --- | --- | --- | --- |
| discovery | Requirements are finalized | Record discovery | Accept a proposal or write artifacts |
| solution_architect | A solution is composed | Read the registry | Write artifacts |
| pricing | A quote is calculated | Apply the pricing policy | Accept a proposal |
| proposal | A proposal is rendered | Copy the quote into the document | Set a different price or accept it |
| documentation | Author tasks run | Write runbook, checklist, and metrics | Write the verification report |
| verifier | The package is checked | Write the verification report | Write the authored artifacts |
| delivery | Verification passed | Publish the manifest and baseline | Promote a blueprint |
| optimization | Delivery succeeds | Write a candidate blueprint | Promote it |

Human review is an approval task with executor `human`. It is not an agent.

Planned agents that do not exist yet: research, frontend, backend, integration, data, security operations, deployment, monitoring, and support. They are omitted until a vertical needs them.

Builder and verifier separation is structural. `BUILDER_AGENT` is `documentation`. `VERIFIER_AGENT` is `verifier`. The verifier fails the package if those ids are the same.

Memory is split by store, not by a vector database:

- Working memory is the task inputs loaded for one execution.
- Project memory is the immutable `spec_json` copied onto the project at acceptance.
- Customer memory is the customer and engagement rows.
- Organizational knowledge is the capability registry and pricing policy in code.
- Capability knowledge is the blueprint candidate produced after delivery.

There is no shared scratchpad that mixes those stores.
