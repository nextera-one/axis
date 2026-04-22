/**
 * Request/response lifecycle helpers for Node HTTP servers.
 * Protocol-agnostic but AXIS ingress needs them to detect client
 * disconnects before sending a response body.
 */
export interface RequestLifecycleLike {
  complete?: boolean;
  destroyed?: boolean;
  aborted?: boolean;
  readableAborted?: boolean;
  socket?: { destroyed?: boolean } | null;
}

export interface ResponseLifecycleLike {
  writableEnded?: boolean;
}

/**
 * Detect whether the incoming request was aborted.
 * Uses `req.destroyed` / `req.socket.destroyed` (Node 16+).
 * The former `req.aborted` flag is deprecated and removed in recent Node versions.
 */
export function wasRequestAborted(req: RequestLifecycleLike): boolean {
  if (req.aborted === true || req.readableAborted === true) {
    return true;
  }

  if (req.destroyed === true) {
    return true;
  }

  if (req.socket?.destroyed === true && req.complete !== true) {
    return true;
  }

  return false;
}

export function wasResponseClosedEarly(res: ResponseLifecycleLike): boolean {
  return res.writableEnded !== true;
}
