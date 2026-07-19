/**
 * Search validator — normalizes and validates search requests before dispatch.
 */
import type { SearchRequest } from '../types';
import { isNonEmpty } from '../utils';

export function validateSearchRequest(req: SearchRequest): {
  ok: boolean;
  reason?: string;
  normalized?: SearchRequest;
} {
  if (!isNonEmpty(req.query)) {
    return { ok: false, reason: 'Empty query' };
  }
  if (req.query.length > 500) {
    return { ok: false, reason: 'Query too long' };
  }
  return {
    ok: true,
    normalized: {
      ...req,
      query: req.query.trim(),
      maxResults: Math.min(Math.max(req.maxResults ?? 5, 1), 10),
    },
  };
}
