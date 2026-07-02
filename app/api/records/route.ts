// ===================================================================
//  app/api/records/route.ts — 排行榜域统一入口
// ===================================================================
import { NextResponse } from "next/server";
import { recordsService } from "@/lib/server/records.service";
import { requireAuth, sanitizeText, type ApiResponse } from "@/lib/server/auth";
import { withRateLimit } from "@/lib/server/ratelimit-wrapper";
import { withCsrfProtection } from "@/lib/server/csrf";
async function _get(req: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const type = sanitizeText(searchParams.get("type") || "all", 20);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10) || 20, 100);
    const mode = sanitizeText(searchParams.get("mode") || "", 20) || undefined;
    const userId = sanitizeText(searchParams.get("user_id") || "", 64) || undefined;

    // 个人记录查询
    if (userId) {
      const result = await recordsService.getMyRecords(userId);
      return NextResponse.json(result satisfies ApiResponse);
    }

    // 圆梦排行
    if (type === "dream_ranking") {
      const result = await recordsService.getDreamRanking(limit);
      return NextResponse.json(result satisfies ApiResponse);
    }

    // 对战排行
    if (type === "battle_ranking") {
      const result = await recordsService.getBattleRanking(limit);
      return NextResponse.json(result satisfies ApiResponse);
    }

    if (!["all", "week", "today"].includes(type)) {
      return NextResponse.json(
        { success: false, error: "type 无效（all/week/today/dream_ranking/battle_ranking）" } satisfies ApiResponse,
        { status: 400 }
      );
    }

    const result = await recordsService.getRecords(
      type as "all" | "week" | "today",
      limit,
      mode as "classic" | "custom" | "dream" | "challenge" | undefined,
    );
    return NextResponse.json(result satisfies ApiResponse);
  } catch (err) {
    console.error("[records GET]", err);
    return NextResponse.json(
      { success: false, error: "服务器内部错误" } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
async function _post(req: Request): Promise<Response> {
  try {
    // JWT 鉴权
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const userId = auth.userId;

    // 解析请求
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "请求解析失败" } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // 参数校验
    if (!body.player_names || body.wins == null) {
      return NextResponse.json(
        { success: false, error: "缺少必填字段（player_names, wins）" } satisfies ApiResponse,
        { status: 400 }
      );
    }

    const result = await recordsService.submitRecord(userId, body as never);
    const status = result.success ? 200 : 400;
    return NextResponse.json(result satisfies ApiResponse, { status });
  } catch (err) {
    console.error("[records POST]", err);
    return NextResponse.json(
      { success: false, error: "服务器内部错误" } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

// 导出（GET: 读限流 (无CSRF), POST: CSRF保护 + 写限流）
export const GET = _get; // 排行榜查询不限流
export const POST = withCsrfProtection(withRateLimit(_post, { type: "write" })); // 提交记录防刷
