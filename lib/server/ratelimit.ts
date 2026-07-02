// ===================================================================
//  lib/server/ratelimit.ts — 轻量限流中间件
// ===================================================================

// ── 配置 ────────────────────────────────────────────────────────────────

interface RateLimitRule {
  /** 时间窗口（毫秒） */
  windowMs: number;
  /** 窗口内最大请求数 */
  max: number;
}

interface RateLimitConfig {
  /** 写操作限流（创建/加入/提交/修改） */
  write: RateLimitRule;
  /** 读操作限流（查询/排行榜/资料） */
  read: RateLimitRule;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  write: { windowMs: 60_000, max: 10 },   // 单用户 10次/分钟
  read:  { windowMs: 60_000, max: 60 },   // 单用户 60次/分钟
};

// ── LRU 存储 ──────────────────────────────────────────────────────────

interface WindowEntry {
  timestamps: number[];
}

// 限制最大条目数防止内存溢出
const MAX_ENTRIES = 50_000;

class MemoryRateLimiter {
  private store = new Map<string, WindowEntry>();
  private config: RateLimitConfig;

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 检查是否超限（不更新计数器）
   * @returns { limited: true } 表示超限，{ limited: false, remaining, reset } 表示可以继续
   */
  check(
    key: string,
    type: "write" | "read" = "write"
  ): { limited: true; retryAfter: number } | { limited: false; remaining: number; reset: number } {
    const rule = this.config[type];
    const now = Date.now();
    const windowStart = now - rule.windowMs;

    let entry = this.store.get(key);
    if (!entry) {
      return { limited: false, remaining: rule.max, reset: Math.ceil(rule.windowMs / 1000) };
    }

    // 清理过期记录
    const valid = entry.timestamps.filter((t) => t > windowStart);
    entry.timestamps = valid;

    if (valid.length === 0) {
      this.store.delete(key);
      return { limited: false, remaining: rule.max, reset: Math.ceil(rule.windowMs / 1000) };
    }

    if (valid.length >= rule.max) {
      const oldest = valid[0];
      const retryAfter = Math.ceil((oldest + rule.windowMs - now) / 1000);
      return { limited: true, retryAfter: Math.max(1, retryAfter) };
    }

    const remaining = rule.max - valid.length;
    const oldestValid = valid[0];
    const reset = Math.ceil((oldestValid + rule.windowMs - now) / 1000);
    return { limited: false, remaining, reset };
  }

  /**
   * 消耗一次请求配额
   * @returns 本次消耗后的状态
   */
  consume(
    key: string,
    type: "write" | "read" = "write"
  ): { limited: true; retryAfter: number } | { limited: false; remaining: number; reset: number } {
    const rule = this.config[type];
    const now = Date.now();
    const windowStart = now - rule.windowMs;

    let entry = this.store.get(key);

    if (!entry) {
      // LRU 淘汰：超过最大条目数时删除最旧的 10%
      if (this.store.size >= MAX_ENTRIES) {
        this.evict();
      }
      this.store.set(key, { timestamps: [now] });
      return { limited: false, remaining: rule.max - 1, reset: Math.ceil(rule.windowMs / 1000) };
    }

    // 清理过期并添加当前请求
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);
    entry.timestamps.push(now);

    if (entry.timestamps.length > rule.max) {
      const oldest = entry.timestamps[0];
      const retryAfter = Math.ceil((oldest + rule.windowMs - now) / 1000);
      return { limited: true, retryAfter: Math.max(1, retryAfter) };
    }

    const remaining = rule.max - entry.timestamps.length;
    const oldestValid = entry.timestamps[0];
    const reset = Math.ceil((oldestValid + rule.windowMs - now) / 1000);
    return { limited: false, remaining: Math.max(0, remaining), reset };
  }

  /** 重置指定 key 的计数 */
  reset(key: string): void {
    this.store.delete(key);
  }

  /** LRU 淘汰：删除 10% 最旧条目 */
  private evict(): void {
    const entries = Array.from(this.store.entries());
    entries.sort((a, b) => {
      const aOldest = a[1].timestamps[0] || 0;
      const bOldest = b[1].timestamps[0] || 0;
      return aOldest - bOldest;
    });
    const removeCount = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < removeCount && i < entries.length; i++) {
      this.store.delete(entries[i][0]);
    }
  }

  /** 获取当前存储条目数（监控用） */
  get size(): number {
    return this.store.size;
  }
}

// ── 单例 ──────────────────────────────────────────────────────────────

const globalLimiter = new MemoryRateLimiter();

/** 获取限流器实例 */
export function getRateLimiter(): MemoryRateLimiter {
  return globalLimiter;
}

// ── 辅助函数 ──────────────────────────────────────────────────────────

import { type NextRequest } from "next/server";

/**
 * 从请求中提取限流 key
 * 优先级：用户 ID（鉴权后） > IP 地址
 */
export function getRateLimitKey(req: Request | NextRequest, userId?: string | null): string {
  if (userId) return `user:${userId}`;

  // 从请求头提取 IP
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
  return `ip:${ip}`;
}

/**
 * 从请求头提取 IP（不依赖 userId）
 */
export function getClientIp(req: Request | NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
}

// ── Redis 适配器接口（预留） ─────────────────────────────────────────

/**
 * 限流器接口 —— 后续可切换为 Upstash Redis 实现
 *
 * interface IRateLimiter {
 *   check(key: string, type: "write" | "read"): Promise<RateLimitResult>;
 *   consume(key: string, type: "write" | "read"): Promise<RateLimitResult>;
 * }
 *
 * Upstash 示例：
 * import { Ratelimit } from "@upstash/ratelimit";
 * import { Redis } from "@upstash/redis";
 *
 * const redis = new Redis({ url: ..., token: ... });
 * const ratelimit = new Ratelimit({
 *   redis,
 *   limiter: Ratelimit.slidingWindow(10, "60 s"),
 * });
 */
