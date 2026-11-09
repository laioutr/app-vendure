import { MAX_PAGE_SIZE } from '../const';

/**
 * Calls `fetchPage` once per hundred distinct ids, in parallel — the most one Shop API list call
 * answers. Duplicates are asked once.
 */
export const inPages = <TPage>(ids: readonly string[], fetchPage: (batch: string[]) => Promise<TPage>): Promise<TPage[]> => {
  const unique = [...new Set(ids)];
  return Promise.all(
    Array.from({ length: Math.ceil(unique.length / MAX_PAGE_SIZE) }, (_, index) =>
      fetchPage(unique.slice(index * MAX_PAGE_SIZE, (index + 1) * MAX_PAGE_SIZE))
    )
  );
};

/**
 * The entities `ids` names, taking those a handler already holds (`known`) and fetching only the
 * rest, in one go.
 */
export const knownOrFetched = async <TEntity extends { id: string }>(
  known: readonly TEntity[] | undefined,
  ids: readonly string[],
  fetch: (missing: string[]) => Promise<readonly TEntity[]>
): Promise<Map<string, TEntity>> => {
  const byId = new Map((known ?? []).map((entity) => [entity.id, entity]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) for (const entity of await fetch(missing)) byId.set(entity.id, entity);
  return byId;
};
