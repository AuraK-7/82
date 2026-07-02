// ===================================================================
//  lib/server/cache.ts — 二级缓存（内存 + 可选 Edge）
// ===================================================================

interface CacheEntry<T> { data: T; expiry: number; }

const store = new Map<string, CacheEntry<unknown>>();

function now(): number { return Date.now(); }

export function cacheGet<T>(key: string): T | null {
  const e = store.get(key);
  if (!e || e.expiry < now()) { store.delete(key); return null; }
  return e.data as T;
}

export function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, expiry: now() + ttlMs });
}

export function cacheDelete(key: string): void { store.delete(key); }

export function cacheClear(): void { store.clear(); }

/** 自动缓存的高阶函数 */
export function withCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit) return Promise.resolve(hit);
  return fn().then((data) => { cacheSet(key, data, ttlMs); return data; });
}

// LRU 清理：超过 1000 条时清除过期 + 最旧
setInterval(() => {
  if (store.size > 1000) {
    const entries = [...store.entries()].sort((a, b) => a[1].expiry - b[1].expiry);
    for (const [k] of entries.slice(0, Math.floor(store.size / 2))) store.delete(k);
  }
}, 60000);
