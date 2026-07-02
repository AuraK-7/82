// ===================================================================
//  lib/api/middleware.ts — API 通用中间件
// ===================================================================
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/server/auth";
import type { ApiResponse } from "@/lib/server/auth";

// ── 类型 ────────────────────────────────────────────────────────────────

type Handler = (req: Request, userId: string | null, body: Record<string, unknown>) => Promise<Response>;

// ── 错误码 ──────────────────────────────────────────────────────────────

const ERROR_CODES = {
  INTERNAL: "INTERNAL_ERROR",
  PARAM_INVALID: "PARAM_INVALID",
  UNAUTHORIZED: "UNAUTHORIZED",
} as const;

// ══════════════════════════════════════════════════════════════════

/** 鉴权：提取用户 ID，未登录返回 null（不拦截） */
export async function withAuth(req: Request): Promise<string | null> {
  return await authenticateRequest(req);
}

/** 要求登录，否则返回 401 */
export function requireAuth(userId: string | null): userId is string {
  return !!userId;
}

/** 请求体 JSON 解析 + 必填字段校验 */
export async function withValidate<T extends Record<string, unknown>>(
  req: Request,
  required: string[]
): Promise<{ ok: true; body: T } | { ok: false; res: Response }> {
  let body: T;
  try {
    body = await req.json();
  } catch {
    return {
      ok: false,
      res: NextResponse.json(
        { success: false, error: "请求体格式错误" } satisfies ApiResponse,
        { status: 400 }
      ),
    };
  }
  for (const key of required) {
    if (body[key] == null) {
      return {
        ok: false,
        res: NextResponse.json(
          { success: false, error: `缺少必填字段: ${key}` } satisfies ApiResponse,
          { status: 400 }
        ),
      };
    }
  }
  return { ok: true, body };
}

/** 错误捕获包装器 */
export function withErrorHandler(fn: Handler): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      return await fn(req, null, {});
    } catch (e) {
      console.error("[API]", e);
      return NextResponse.json(
        { success: false, error: "服务器内部错误" } satisfies ApiResponse,
        { status: 500 }
      );
    }
  };
}

/** 统一成功响应 */
export function ok<T>(data?: T): Response {
  return NextResponse.json({ success: true, data } satisfies ApiResponse);
}

/** 统一错误响应 */
export function fail(message: string, status = 400): Response {
  return NextResponse.json(
    { success: false, error: message } satisfies ApiResponse,
    { status }
  );
}
