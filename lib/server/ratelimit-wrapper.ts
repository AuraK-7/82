// ===================================================================
//  lib/server/ratelimit-wrapper.ts — API 限流包装器
// ===================================================================
import { NextResponse } from "next/server";
import { getRateLimiter, getRateLimitKey, getClientIp } from "./ratelimit";

interface WithRateLimitOptions {
  /** 操作类型：write=写操作（严格），read=读操作（宽松） */
  type?: "write" | "read";
  /** 是否使用 IP 维度额外限流（默认 true） */
  ipRateLimit?: boolean;
  /** 是否跳过限流（用于健康检查等接口） */
  skip?: boolean;
}

/**
 * 为 API handler 添加限流保护
 *
 * 用法:
 *   export const POST = withRateLimit(async (req) => { ... }, { type: "write" });
 */
export function withRateLimit(
  handler: (req: Request) => Promise<Response>,
  opts: WithRateLimitOptions = {}
): (req: Request) => Promise<Response> {
  const { type = "read", ipRateLimit = true, skip = false } = opts;

  return async (req: Request): Promise<Response> => {
    if (skip) return handler(req);

    const limiter = getRateLimiter();
    const userId = req.headers.get("x-user-id"); // 由鉴权中间件设置（可选）
    const userKey = getRateLimitKey(req, userId);
    const ipKey = getClientIp(req);

    // 用户维度限流
    const userResult = limiter.consume(userKey, type);
    if (userResult.limited) {
      return NextResponse.json(
        {
          success: false,
          error: `请求过于频繁，请在 ${userResult.retryAfter} 秒后重试`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(userResult.retryAfter),
            "X-RateLimit-Limit": type === "write" ? "10" : "60",
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // IP 维度限流（额外保护层）
    if (ipRateLimit && ipKey !== userId) {
      const ipResult = limiter.consume(`ip:${ipKey}`, type);
      if (ipResult.limited) {
        return NextResponse.json(
          {
            success: false,
            error: `请求过于频繁，请在 ${ipResult.retryAfter} 秒后重试`,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(ipResult.retryAfter),
              "X-RateLimit-Limit": type === "write" ? "30" : "200",
              "X-RateLimit-Remaining": "0",
            },
          }
        );
      }
    }

    // 正常处理
    const response = await handler(req);

    // 附加限流头
    if (response instanceof NextResponse && !userResult.limited) {
      response.headers.set(
        "X-RateLimit-Remaining",
        String(userResult.remaining)
      );
    }

    return response;
  };
}
