/** Every load goes through a guard: a bad or missing file is "no data", not a crash. */
export async function fetchJson<T>(
  url: string,
  guard: (value: unknown) => value is T,
  fetchFn: typeof fetch = fetch,
): Promise<T | null> {
  try {
    const response = await fetchFn(url, { cache: 'no-cache' });
    if (!response.ok) {
      return null;
    }
    const value: unknown = await response.json();
    return guard(value) ? value : null;
  } catch {
    return null;
  }
}
