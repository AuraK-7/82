// ===================================================================
//  lib/server/csrf.ts — CSRF 防护
//  服务端生成 token → 注入页面 → 前端自动携带 → 服务端校验
// ===================================================================
import crypto from "crypto";

const { createHash, randomBytes } = crypto;

// ── Token 生成与验证 ──────────────────────────────────────────────────

/** 生成 CSRF token（32 字节随机值 + 哈希） */
export function generateCsrfToken(): string {
  const raw = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 16);
  return `${raw}.${hash}`;
}

/** 验证 CSRF token 有效性 */
export function validateCsrfToken(token: string): boolean {
  if (!token || typeof token !== "string") return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [raw, hash] = parts;
  if (!raw || !hash || raw.length < 32) return false;

  const expected = createHash("sha256").update(raw).digest("hex").slice(0, 16);
  return hash === expected;
}

/** 从请求头提取 CSRF token */
export function extractCsrfToken(req: Request): string | null {
  return (
    req.headers.get("x-csrf-token") ||
    req.headers.get("x-xsrf-token")
  );
}

// ── API 包装器 ───────────────────────────────────────────────────────

import { NextResponse } from "next/server";

/**
 * 为 POST/PATCH handler 添加 CSRF 校验
 * 允许内部调用绕过（通过 x-internal-call 头标记）
 */
export function withCsrfProtection(
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    // 仅校验写操作
    const method = req.method.toUpperCase();
    if (method !== "POST" && method !== "PATCH" && method !== "PUT" && method !== "DELETE") {
      return handler(req);
    }

    // 内部调用跳过（服务端到服务端）
    if (req.headers.get("x-internal-call") === "1") {
      return handler(req);
    }

    // 验证 CSRF token
    const token = extractCsrfToken(req);
    if (!token || !validateCsrfToken(token)) {
      return NextResponse.json(
        { success: false, error: "CSRF 校验失败，请刷新页面后重试" },
        { status: 403 }
      );
    }

    return handler(req);
  };
}
