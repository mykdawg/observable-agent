export type GateOutcome<TRequest> =
  | { readonly outcome: 'allow' }
  | { readonly outcome: 'deny'; readonly reason: string }
  | { readonly outcome: 'modify'; readonly request: TRequest };

export type GateHandler<TRequest> = (
  request: TRequest,
) => GateOutcome<TRequest> | void | Promise<GateOutcome<TRequest> | void>;

export type GateDecision<TRequest> =
  | { readonly outcome: 'allow'; readonly request: TRequest }
  | { readonly outcome: 'deny'; readonly reason: string };

export interface Gate<TRequest> {
  readonly use: (handler: GateHandler<TRequest>) => void;
  readonly run: (request: TRequest) => Promise<GateDecision<TRequest>>;
}

export function createGate<TRequest>(): Gate<TRequest> {
  const handlers: GateHandler<TRequest>[] = [];

  const use = (handler: GateHandler<TRequest>): void => {
    handlers.push(handler);
  };

  const run = async (
    initialRequest: TRequest,
  ): Promise<GateDecision<TRequest>> => {
    let request = initialRequest;

    for (const handler of handlers) {
      const result = await handler(request);

      if (!result || result.outcome === 'allow') {
        continue;
      }
      if (result.outcome === 'deny') {
        return { outcome: 'deny', reason: result.reason };
      }

      // A handler that modifies the request rewrites what every subsequent
      // handler (and the eventual caller, if allowed) sees — not the original.
      request = result.request;
    }

    return { outcome: 'allow', request };
  };

  return { use, run };
}
