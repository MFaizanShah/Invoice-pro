// Supabase returns at most 1,000 rows per request. This pages through a query
// so reports stay correct as the invoice count grows. The query must be ordered.
export async function fetchAll<T = any>(build: () => any, pageSize = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < pageSize) return out;
  }
}
