// ===================================================================
//  lib/server/auth.ts — 服务端 JWT 鉴权
// ===================================================================
import { getSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// ── 类型 ────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── JWT 鉴权（所有 API 统一入口）───────────────────────────────────────

/**
 * 从请求中提取并验证 JWT，返回 userId
 * 仅信任 Supabase 签发的有效 token
 * 绝不接受客户端 body/query 中传入的 userId
 */
export async function authenticateRequest(req: Request): Promise<string | null> {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;

    const token = authHeader.slice(7);
    if (!token || token.length < 20) return null; // 拒绝明显无效的 token

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user?.id) {
      // 记录可疑请求
      if (token) {
        console.warn("[Auth] Invalid JWT token rejected");
      }
      return null;
    }

    return data.user.id;
  } catch {
    return null;
  }
}

/**
 * 要求登录的鉴权包装器
 * 未登录返回 401，登录成功返回 userId
 */
export async function requireAuth(req: Request): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: Response }
> {
  const userId = await authenticateRequest(req);
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "请先登录" } satisfies ApiResponse,
        { status: 401 }
      ),
    };
  }
  return { ok: true, userId };
}

// ── 输入消毒 ────────────────────────────────────────────────────────────

/** 安全截断字符串，移除 HTML 标签 */
export function sanitizeText(input: unknown, maxLen: number): string {
  return String(input || "")
    .replace(/[<>]/g, "")       // 移除 HTML 标签
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "") // 移除控制字符
    .trim()
    .slice(0, maxLen);
}

/** 验证 roomCode 格式（6位大写字母数字，排除易混淆字符） */
export function validateRoomCode(code: string): boolean {
  return /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(code);
}

/** 验证 slot 格式 */
export function validateSlot(slot: string): boolean {
  return ["PG", "SG", "SF", "PF", "C"].includes(slot);
}

/** 验证昵称（最长20字符，非空，无HTML） */
export function validateNickname(name: string): { valid: boolean; error?: string } {
  const trimmed = sanitizeText(name, 20);
  if (!trimmed) return { valid: false, error: "昵称不能为空" };
  if (trimmed.length > 20) return { valid: false, error: "昵称最长20个字符" };
  return { valid: true };
}
