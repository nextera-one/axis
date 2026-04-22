/**
 * PageResult — canonical paginated response envelope used by
 * every AXIS paged read handler.
 *
 * Historically lived in backend `common/utils/repo_helpers.ts`; promoted
 * here so handlers across projects share the same wire shape.
 */
export interface PageResult<T> {
  data: T[];
  count: number;
}
