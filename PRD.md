# PRD: observable-agent

Status: **draft — living document**. This is the reference we return to as the project evolves. Update it when a decision below changes; don't let it drift out of sync with what's actually built.

## 1. Vision

An AI agent that is, by construction, an *observable object*: as it runs, it emits a stream of typed signals describing what it's doing and why — deciding, calling a model, calling a tool, erring out — so that external systems (loggers, observability platforms, code-analysis tools, evaluation harnesses, guardrails, human-approval gates) can watch it, and in some cases, act on what they see.

The agent itself should stay small and legible. The interesting, durable part of this project is the signal contract — what gets emitted, when, and in what shape — not a large agent framework.

## 2. Problem

Most agent frameworks bolt observability on from the outside (callbacks, middleware, log scraping) after the agent's internals were designed without it in mind. The result is usually one of:
- Signals that are an afterthought and leak implementation detail instead of describing *intent*.
- A hard dependency on a specific observability vendor's SDK.
- Full prompt/completion capture by default, with privacy as an opt-out rather than a default.

We want the opposite: observability as the core design constraint, a small dependency-light emitting core, and privacy-conscious defaults from day one.

## 3. Goals

- Ship a minimal, understandable agent core (perceive → decide → act loop) that we build and fully understand — not adopted wholesale from an existing framework.
- Define a small, versioned signal vocabulary that external systems can subscribe to.
- Make the agent's signal emission the primary interface, not an add-on — any consumer should be able to observe an agent run without touching its internals.
- Keep the core dependency-light and portable (fits the project's "favor small, avoid waste" value).
- Default to privacy-safe signal payloads; require explicit opt-in for raw prompt/completion capture.
- Leave a clear seam for compatibility adapters (OpenInference/OTel, CloudEvents) without forcing that dependency on every consumer.

## 4. Non-goals (for now)

- Not building a general-purpose agent framework to compete with LangChain.js, Mastra, or the Vercel AI SDK.
- Not implementing multi-agent orchestration, planning graphs, or long-term memory in v0.1.
- Not shipping first-party exporters to specific observability vendors in v0.1 — adapters come after the core vocabulary is stable.
- Not achieving full OpenInference/OTel GenAI spec compliance in v0.1 (that spec is itself still unstable as of mid-2026 — see §8).

## 5. Decisions made so far

| Decision | Choice | Rationale |
|---|---|---|
| Agent engine | Build a minimal core ourselves; call LLM APIs (Anthropic/OpenAI SDKs) directly | Every signal-emission point is code we wrote and understand. Adopting an existing framework's agent runtime would mean instrumenting someone else's abstractions (chains/graphs), working against both simplicity and the goal of learning how this actually works. |
| Signal vocabulary | Small custom set, informed by OpenInference's span-kind categories (Chain, LLM, Tool, Agent, Guardrail, Evaluator) | Avoids reinventing categories from zero, avoids a hard dependency on an external, evolving spec. A compatibility adapter can map our vocabulary onto OpenInference/OTel later without redesigning the core. |
| Transport | Typed event core (`EventTarget`-based, not Node's `EventEmitter`) | `EventTarget` is a web standard available in Node 18+, browsers, and edge runtimes, so the core stays portable across runtimes without a Node-only dependency. External sensors subscribe with `addEventListener`. An "adapter" is just another listener that re-emits in a different format. |
| Content capture | Opt-in only — metadata by default (timings, token counts, model/tool names, argument *shapes*), not raw prompt/completion text | Follows directly from the project's stated values: privacy, dignity, and agency are non-negotiable, and surveillance is explicitly refused. Sensors shouldn't be able to silently exfiltrate PII or secrets in prompts. Raw content capture is available via an explicit flag plus a redaction hook. |

## 6. Open question requiring your input: observation vs. intervention

You described the goal as signals "observed **and acted upon** by external systems." That phrase covers two very different capabilities, and the current transport decision (§5) only cleanly supports one of them:

- **Notification signals** (past tense — `llm:end`, `tool:end`, `agent:error`): something already happened, fire-and-forget, any number of listeners can react. `EventTarget` handles this natively and is what §5 assumes.
- **Interceptable signals** (present/future tense — `tool:beforeCall`, `agent:beforeAction`): something is *about to* happen, and a listener needs to be able to veto, modify, or pause it before the agent proceeds — e.g. a guardrail blocking a tool call, or a human-approval gate. This is a materially harder mechanism: it needs an awaitable chain of handlers with a way to signal "deny" or "modify," which plain `EventTarget` doesn't provide out of the box.

Given the project's stance that "humans stay in the loop — AI assists, never decides," I'd expect interception (at minimum, a human-approval gate before consequential tool calls) to be a real requirement eventually, not a nice-to-have.

**Recommendation:** keep v0.1 purely observational (notification signals only, simplest possible mechanism), and design interception as a deliberate, separate addition in v0.2 — a small set of named "gate points" (e.g. before a tool call executes) that support an async handler chain with allow/deny/modify semantics, layered on top of the same core rather than replacing it. I'd rather ship the simple version first and confirm the exact gate points you need than guess at the mechanism now.

**Needs your call:** does v0.1 need at least one interceptable gate point (e.g. human-approval-before-tool-call) to be useful to you, or is pure observation sufficient to start?

**Update:** a standalone prototype of the interception mechanism now exists (`src/gate.ts`, see [`docs/gate-interception.md`](./docs/gate-interception.md)) so the shape of allow/deny/modify is concrete. It is *not* wired into an Agent (no Agent core exists yet) and does not settle the question above — it's a spike to inform the decision, and it surfaced a few follow-on questions of its own (fail-open vs. fail-closed on handler error, whether gate decisions share the notification-signal envelope) that are listed in that doc.

## 7. Core concepts

- **Agent** — the observable object. Runs a loop: receive input → decide (LLM call) → act (tool call, if any) → repeat or return. Emits signals at each transition.
- **Signal** — a single typed event describing something the agent did or is doing. Has a stable `type` (e.g. `agent:start`), a `schemaVersion`, a timestamp, a correlation id (so all signals from one agent run can be grouped), and a payload.
- **Sensor** — anything subscribed to an agent's signals: a console logger, a test harness, an evaluation platform, a guardrail, a human-approval UI, a metrics exporter.
- **Adapter** — an optional package that subscribes as a sensor and re-emits signals in another wire format (OpenInference/OTel spans, CloudEvents envelopes). Not part of the core; added later.

## 8. Signal taxonomy (draft — v0.1 candidate)

All signals share an envelope:

```ts
interface Signal<TPayload = unknown> {
  type: string;          // "agent:start", "llm:end", etc.
  schemaVersion: string; // e.g. "0.1.0" — bump when a payload shape changes
  runId: string;         // correlates all signals from one agent invocation
  timestamp: string;     // ISO 8601
  payload: TPayload;
}
```

Candidate v0.1 signal types, grouped by OpenInference-inspired category:

| Category | Signal type | Fired when | Payload (metadata only, no raw content by default) |
|---|---|---|---|
| Agent | `agent:start` | An agent run begins | input shape/size, agent id/name |
| Agent | `agent:end` | An agent run completes | duration, outcome (success/error), step count |
| Agent | `agent:error` | An unhandled error occurs | error type/message, step where it occurred |
| LLM | `llm:start` | Before a model call | model name, provider, message count |
| LLM | `llm:end` | After a model call returns | duration, token usage (prompt/completion/total), finish reason |
| Tool | `tool:start` | Before a tool executes | tool name, argument *shape* (keys/types, not raw values, by default) |
| Tool | `tool:end` | After a tool returns | duration, result shape, success/failure |
| Tool | `tool:error` | A tool throws | tool name, error type/message |

This table is a starting point, not final — expect it to change as the agent core takes shape. Each addition/change to this table should bump `schemaVersion` and get its own `.md` file per the project's per-feature documentation rule.

## 9. Privacy & data-handling defaults

- Default payloads carry **metadata, not content**: durations, counts, names, shapes — never raw prompt text, completion text, or tool argument/result values unless explicitly enabled.
- Raw content capture is an explicit opt-in (a config flag on the agent, e.g. `captureContent: true`), and passes through a pluggable redaction hook before being attached to a signal, so secrets/PII can be scrubbed even when content capture is on.
- No signal is sent anywhere by default — the core only emits in-process events. Any outbound transmission (to a logging service, an observability vendor, a remote sensor) happens only because a sensor/adapter was explicitly configured by the developer using the library. No adapter should phone home on its own.

## 10. Prior art referenced

- **[OpenInference](https://arize-ai.github.io/openinference/spec/)** (Arize) — semantic conventions for AI observability built on OpenTelemetry; span kinds Chain/Retriever/Reranker/LLM/Embedding/Agent/Tool/Guardrail/Evaluator/Prompt. Source of our category names in §8. Broadly adopted (Phoenix, and auto-instrumentation across LangChain, LlamaIndex, Mastra, CrewAI).
- **[OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/)** — the OTel project's own equivalent (`invoke_agent`/`chat`/`execute_tool` spans). Explicitly still in "Development" status (not Stable) as of July 2026, and the spec repo was reorganized as recently as June 2026 — a reason to not couple tightly to it yet.
- **[CloudEvents](https://cloudevents.io/)** (CNCF) — vendor-neutral event envelope spec with built-in W3C trace-context propagation, transport-agnostic (HTTP, Kafka, etc.). A plausible target format for a future adapter if signals need to leave the process in an interoperable envelope.
- **VoltAgent** and similar "observability-first" TypeScript agent frameworks — closest existing concept to this project, but they bundle a full agent framework; we're deliberately scoping smaller (§4).

## 11. MVP scope (v0.1)

In scope:
- `Agent` class implementing the perceive → decide → act loop for a single agent, single run at a time.
- Direct LLM calls (no framework abstraction) via a pluggable model-call function.
- Tool registration and invocation.
- The signal types in §8, emitted via an `EventTarget`-based core, metadata-only by default.
- A minimal example sensor (console logger) to prove the mechanism, and an in-memory sensor for use in tests.

Out of scope (deferred, see §4 and §6):
- Interception/gating signals (pending your answer in §6).
- Multi-agent orchestration, memory, planning graphs.
- OTel/OpenInference/CloudEvents adapters.
- Cost/token-usage aggregation or carbon-estimate reporting (worth revisiting given the project's environmental values, but not v0.1).

## 12. Risks & open questions

- **§6 above** — observation-only vs. interception — needs your decision before tool-call and human-approval signals can be designed.
- Signal taxonomy will change as the agent core is actually built; §8 is a hypothesis, not a contract. Expect `schemaVersion` bumps early and often.
- "Metadata only by default" still needs a concrete definition of "shape" for tool arguments/results (e.g., key names and types, but not values) — needs a first real tool example to validate against.
- Runtime target: this PRD assumes Node.js first, with `EventTarget` chosen specifically to keep a browser/edge runtime open as a future target. Confirm Node-only is fine for v0.1 unless you want browser support sooner.
- Per the project's issue-first workflow, each table row in §8 and each capability in §11 should become its own tracked issue, with its own unit test, documentation, and `.md` file, before merging.

## 13. Success criteria

- A developer can construct an `Agent`, register a tool and a model function, attach a console sensor, run the agent, and see a coherent, correctly-ordered stream of signals for a run — with zero raw prompt content leaking unless explicitly enabled.
- The signal vocabulary and envelope are stable enough that someone could write an OpenInference or CloudEvents adapter without modifying the agent core itself.
