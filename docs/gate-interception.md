# Interceptable gate points (`Gate`)

Status: **prototype / stub**. This is a standalone mechanism (`src/gate.ts`), not yet wired into an Agent — the Agent core doesn't exist yet. It exists to make the interception concept from `PRD.md` §6 concrete, so we can evaluate the shape before deciding whether v0.1 needs it.

## What problem this solves

Most of an agent's signals are **notifications**: `llm:end`, `tool:end` — something already happened, any number of sensors can react, and nothing they do changes the outcome. But some points in an agent's execution need a sensor to be able to step in *before* something happens — a human-approval UI that can block a destructive tool call, a guardrail that can redact a secret out of an argument before it's sent anywhere. That's a **gate**: a point in execution that pauses for handlers to allow, deny, or modify what's about to happen.

## Shape

```ts
import { createGate, type GateHandler } from './gate.js';

interface ToolCallRequest {
  toolName: string;
  args: Record<string, unknown>;
}

const beforeToolCall = createGate<ToolCallRequest>();

const requireApprovalForDeletes: GateHandler<ToolCallRequest> = (request) => {
  if (request.toolName === 'delete_file') {
    return { outcome: 'deny', reason: 'requires human approval' };
  }
  // returning nothing means "allow, unchanged"
};

beforeToolCall.use(requireApprovalForDeletes);

const decision = await beforeToolCall.run({ toolName: 'delete_file', args: {} });
// decision: { outcome: 'deny', reason: 'requires human approval' }
```

- **`use(handler)`** registers a handler. Handlers run in registration order.
- **`run(request)`** executes the chain and returns a `GateDecision`: either `{ outcome: 'allow', request }` (the possibly-modified request) or `{ outcome: 'deny', reason }`.
- A handler that returns nothing implicitly allows and passes the request through unchanged.
- A handler that returns `{ outcome: 'modify', request }` rewrites what every later handler (and the caller, if ultimately allowed) sees.
- The **first denial short-circuits** — later handlers don't run. See the "short-circuits on the first denial" test in `src/gate.test.ts` for the exact behavior.

## What this is not (yet)

- Not wired into the real `Signal`/`EventTarget` transport decided in `PRD.md` §5 — this is a plain async function chain, deliberately decoupled so the mechanism could be understood on its own.
- No timeout, retry, or persistence semantics — a slow or hanging handler currently just blocks `run()`.
- No connection yet to the `runId`/`schemaVersion` envelope used by notification signals in `PRD.md` §8 — when this is wired into a real Agent, gate requests will likely need the same correlation id so a "deny" can be tied back to the run it blocked.

## Open questions this stub raises for PRD §6

- Should gate decisions carry the same envelope (`runId`, `schemaVersion`) as notification signals, or a separate, simpler shape?
- What happens if a handler throws instead of returning a decision — deny by default (fail closed) or allow (fail open)? Fail-closed seems like the safer default given the project's human-rights stance, but it's not decided.
- Do we need more than one outcome per handler (e.g. `modify` *and* attach a warning), or is allow/deny/modify enough for the cases we actually have (human approval, guardrail redaction)?
