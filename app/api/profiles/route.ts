// ===================================================================
//  app/api/profiles/route.ts — 用户资料
// ===================================================================
import { NextResponse } from "next/server";
import { profilesService } from "@/lib/server/profiles.service";
import { requireAuth, sanitizeText, validateNickname, type ApiResponse } from "@/lib/server/auth";

// ══════════════════════════════════════════════════════════════════
//  GET — 查询 profile / 批量查询 / 排行榜
// ══════════════════════════════════════════════════════════════════

async function _get(req: Request): Promise<Response> {
  try {
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");
  const userIds = url.searchParams.get("user_ids");

  // 排行榜模式（无需登录）
  const rankType = url.searchParams.get("type");
  if (rankType && !userId && !userIds) {
    const type = rankType === "rate" ? "rate" : "wins";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 100);
    const result = await profilesService.getRankings(type, limit);
    return NextResponse.json(result satisfies ApiResponse);
  }

  // 单用户查询
  if (userId) {
    const cleanId = sanitizeText(userId, 64);
    if (!cleanId) {
      return NextResponse.json(
        { success: false, error: "user_id 无效" } satisfies ApiResponse,
        { status: 400 }
      );
    }
    const result = await profilesService.getProfile(cleanId);
    if (!result.success) {
      return NextResponse.json(result satisfies ApiResponse, { status: 400 });
    }
    return NextResponse.json(result satisfies ApiResponse);
  }

  // 批量查询
  if (userIds) {
    const ids = userIds.split(",").map((s) => sanitizeText(s, 64)).filter(Boolean);
    if (ids.length === 0 || ids.length > 50) {
      return NextResponse.json(
        { success: false, error: "user_ids 无效或超过50个上限" } satisfies ApiResponse,
        { status: 400 }
      );
    }
    const result = await profilesService.getProfileBatch(ids);
    return NextResponse.json(result satisfies ApiResponse);
  }

  return NextResponse.json(
    { success: false, error: "缺少查询参数" } satisfies ApiResponse,
    { status: 400 }
  );
  } catch (err) {
    console.error("[profiles GET]", err);
    return NextResponse.json(
      { success: false, error: "服务器内部错误" } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

// ══════════════════════════════════════════════════════════════════
//  PATCH — 修改昵称（仅自己的 profile）
// ══════════════════════════════════════════════════════════════════

async function _patch(req: Request): Promise<Response> {
  try {
  // JWT 鉴权：userId 从 token 提取，绝不信任 body
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const userId = auth.userId;

  // 解析请求体
  let body: { nickname?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "请求体格式错误" } satisfies ApiResponse,
      { status: 400 }
    );
  }

  // 参数校验
  if (!body.nickname || typeof body.nickname !== "string") {
    return NextResponse.json(
      { success: false, error: "缺少 nickname 字段" } satisfies ApiResponse,
      { status: 400 }
    );
  }

  const validation = validateNickname(body.nickname);
  if (!validation.valid) {
    return NextResponse.json(
      { success: false, error: validation.error } satisfies ApiResponse,
      { status: 400 }
    );
  }

  // 执行修改（服务端做二次校验）
  const result = await profilesService.updateNickname(userId, body.nickname);
  if (!result.success) {
    return NextResponse.json(result satisfies ApiResponse, { status: 400 });
  }
  return NextResponse.json(result satisfies ApiResponse);
  } catch (err) {
    console.error("[profiles PATCH]", err);
    return NextResponse.json(
      { success: false, error: "服务器内部错误" } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

export const GET = _get;
export const PATCH = _patch;
