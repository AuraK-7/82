// ===================================================================
//  lib/utils/storage.ts — 本地存储封装
// ===================================================================

const PREFIX = "bb82_";

/**
 * 读取 localStorage 值（自动 JSON 反序列化，异常兜底）
 */
export function storageGet<T = unknown>(key: string, fallback?: T): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback ?? null;
    return JSON.parse(raw) as T;
  } catch {
    return fallback ?? null;
  }
}

/**
 * 写入 localStorage（自动 JSON 序列化）
 */
export function storageSet(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * 删除 localStorage 键
 */
export function storageRemove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // 静默失败
  }
}

/**
 * 获取原始字符串值（不进行 JSON 解析）
 */
export function storageGetRaw(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

/**
 * 写入原始字符串值
 */
export function storageSetRaw(key: string, value: string): boolean {
  try {
    localStorage.setItem(PREFIX + key, value);
    return true;
  } catch {
    return false;
  }
}
