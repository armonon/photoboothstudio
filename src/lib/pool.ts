/**
 * Run `worker` over every item with at most `limit` promises in flight at once.
 * Workers should not throw — handle per-item errors inside the worker so one
 * failure doesn't abort the rest of the batch.
 */
export async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const lanes = Math.max(1, Math.min(limit, items.length));
  await Promise.all(
    Array.from({ length: lanes }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        await worker(items[index]);
      }
    }),
  );
}
