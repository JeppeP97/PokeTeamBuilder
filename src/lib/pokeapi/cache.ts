import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

/**
 * To-lags cache for PokéAPI-svar.
 *
 *  1. In-memory Map  – lever så længe serverless-instansen er varm.
 *  2. Disk (JSON)    – overlever hot reloads lokalt og deles mellem
 *                      invocations på samme Vercel-instans (/tmp).
 *
 * PokéAPI-data er reelt statisk (Gen 3 ændrer sig ikke), så TTL er lang.
 */

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 dage

const CACHE_DIR =
  process.env.POKEAPI_CACHE_DIR ??
  (process.env.VERCEL
    ? path.join(os.tmpdir(), "pokeapi-cache")
    : path.join(process.cwd(), ".cache", "pokeapi"));

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const memory = new Map<string, CacheEntry<unknown>>();

/** Disk-skrivning kan fejle (read-only FS) – så slår vi den fra permanent. */
let diskEnabled = true;

function keyToFile(key: string): string {
  const hash = crypto.createHash("sha1").update(key).digest("hex");
  const safe = key.replace(/[^a-z0-9]+/gi, "-").slice(0, 60);
  return path.join(CACHE_DIR, `${safe}-${hash.slice(0, 8)}.json`);
}

async function readDisk<T>(key: string): Promise<CacheEntry<T> | null> {
  if (!diskEnabled) return null;
  try {
    const raw = await fs.readFile(keyToFile(key), "utf8");
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

async function writeDisk<T>(key: string, entry: CacheEntry<T>): Promise<void> {
  if (!diskEnabled) return;
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(keyToFile(key), JSON.stringify(entry), "utf8");
  } catch {
    diskEnabled = false;
  }
}

/**
 * Henter `key` fra cache, eller kalder `producer` og cacher resultatet.
 * Samtidige kald med samme key deles (ingen thundering herd).
 */
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(
  key: string,
  producer: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const now = Date.now();

  const hit = memory.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expiresAt > now) return hit.value;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const task = (async () => {
    const onDisk = await readDisk<T>(key);
    if (onDisk && onDisk.expiresAt > Date.now()) {
      memory.set(key, onDisk);
      return onDisk.value;
    }

    const value = await producer();
    const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttlMs };
    memory.set(key, entry);
    await writeDisk(key, entry);
    return value;
  })();

  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}

export function clearMemoryCache(): void {
  memory.clear();
}

export function cacheStats() {
  return { memoryEntries: memory.size, diskEnabled, cacheDir: CACHE_DIR };
}
