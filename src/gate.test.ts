import { describe, expect, it } from 'vitest';

import { createGate, type GateHandler } from './gate.js';

interface ToolCallRequest {
  readonly toolName: string;
  readonly args: Record<string, unknown>;
}

describe('createGate', () => {
  it('allows a request through when no handlers are registered', async () => {
    const gate = createGate<ToolCallRequest>();

    const decision = await gate.run({ toolName: 'read_file', args: {} });

    expect(decision).toEqual({
      outcome: 'allow',
      request: { toolName: 'read_file', args: {} },
    });
  });

  it('lets a handler deny a request, e.g. requiring human approval for a destructive tool call', async () => {
    const gate = createGate<ToolCallRequest>();
    const requireApprovalForDeletes: GateHandler<ToolCallRequest> = (
      request,
    ) => {
      if (request.toolName === 'delete_file') {
        return { outcome: 'deny', reason: 'requires human approval' };
      }
    };
    gate.use(requireApprovalForDeletes);

    const decision = await gate.run({
      toolName: 'delete_file',
      args: { path: '/etc/passwd' },
    });

    expect(decision).toEqual({
      outcome: 'deny',
      reason: 'requires human approval',
    });
  });

  it('lets a handler modify the request before it reaches later handlers and the caller', async () => {
    const gate = createGate<ToolCallRequest>();
    const redactSecrets: GateHandler<ToolCallRequest> = (request) => {
      if ('apiKey' in request.args) {
        return {
          outcome: 'modify',
          request: { ...request, args: { ...request.args, apiKey: '[redacted]' } },
        };
      }
    };
    const seenByLastHandler: ToolCallRequest[] = [];
    const recordFinalRequest: GateHandler<ToolCallRequest> = (request) => {
      seenByLastHandler.push(request);
    };
    gate.use(redactSecrets);
    gate.use(recordFinalRequest);

    const decision = await gate.run({
      toolName: 'call_api',
      args: { apiKey: 'sk-super-secret' },
    });

    expect(decision).toEqual({
      outcome: 'allow',
      request: { toolName: 'call_api', args: { apiKey: '[redacted]' } },
    });
    expect(seenByLastHandler).toEqual([
      { toolName: 'call_api', args: { apiKey: '[redacted]' } },
    ]);
  });

  it('short-circuits on the first denial and does not run later handlers', async () => {
    const gate = createGate<ToolCallRequest>();
    let laterHandlerRan = false;
    gate.use(() => ({ outcome: 'deny', reason: 'blocked by policy' }));
    gate.use(() => {
      laterHandlerRan = true;
    });

    const decision = await gate.run({ toolName: 'delete_file', args: {} });

    expect(decision).toEqual({ outcome: 'deny', reason: 'blocked by policy' });
    expect(laterHandlerRan).toBe(false);
  });
});
