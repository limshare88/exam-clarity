/** Reads EVERY row of a query by paging (the database returns at most 1000 rows per request).
 * `page` must apply a stable order, then `.range(from, to)`. Used so that no uploaded paper
 * ever drops out of a list just because newer uploads pushed it past a row cap. */
const PAGE_SIZE = 1000;

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await page(from, from + PAGE_SIZE - 1);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}
