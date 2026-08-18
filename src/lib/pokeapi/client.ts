import { cached } from "./cache";

export const POKEAPI_BASE = "https://pokeapi.co/api/v2";

export class PokeApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly url?: string,
  ) {
    super(message);
    this.name = "PokeApiError";
  }
}

const MAX_RETRIES = 3;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Rå fetch mod PokéAPI med retry på 5xx/netværksfejl. */
async function fetchJson<T>(url: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        // Vi cacher selv – undgå at Next dobbelt-cacher store payloads.
        cache: "no-store",
      });

      if (res.status === 404) {
        throw new PokeApiError(`Not found: ${url}`, 404, url);
      }
      if (!res.ok) {
        throw new PokeApiError(
          `PokéAPI svarede ${res.status} for ${url}`,
          res.status,
          url,
        );
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof PokeApiError && err.status === 404) throw err;
      lastError = err;
      if (attempt < MAX_RETRIES - 1) await sleep(250 * 2 ** attempt);
    }
  }

  throw new PokeApiError(
    `PokéAPI-kald fejlede efter ${MAX_RETRIES} forsøg: ${url} (${String(lastError)})`,
    undefined,
    url,
  );
}

/** Cachet GET mod et PokéAPI-endpoint, fx "pokedex/kanto". */
export function getResource<T>(endpoint: string): Promise<T> {
  const clean = endpoint.replace(/^\/+|\/+$/g, "");
  return cached<T>(`pokeapi:${clean}`, () =>
    fetchJson<T>(`${POKEAPI_BASE}/${clean}`),
  );
}

/** Hent en absolut PokéAPI-URL (som dem der ligger i NamedAPIResource.url). */
export function getByUrl<T>(url: string): Promise<T> {
  const endpoint = url.replace(`${POKEAPI_BASE}/`, "").replace(/\/+$/, "");
  return getResource<T>(endpoint);
}

/** Kør async-tasks med begrænset parallelitet (venlig mod PokéAPI). */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}
