// ===================================================================
//  app/api/health/route.ts — 健康检查
// ===================================================================
import { NextResponse } from "next/server";
import { checkDbHealth } from "@/db";
import { checkSupabaseHealth } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const components: Record<string, { status: string; error?: string }> = {};

  // 检查数据库（5 秒超时）
  try {
    const dbResult = await Promise.race([
      checkDbHealth(),
      new Promise<{ ok: boolean; error: string }>((resolve) =>
        setTimeout(() => resolve({ ok: false, error: "数据库健康检查超时" }), 5000)
      ),
    ]);
    components.database = {
      status: dbResult.ok ? "ok" : "degraded",
      ...(dbResult.error ? { error: dbResult.error } : {}),
    };
  } catch (err) {
    components.database = {
      status: "degraded",
      error: err instanceof Error ? err.message : "未知错误",
    };
  }

  // 检查 Supabase（5 秒超时）
  try {
    const supabaseResult = await Promise.race([
      checkSupabaseHealth(),
      new Promise<{ ok: boolean; error: string }>((resolve) =>
        setTimeout(() => resolve({ ok: false, error: "Supabase 健康检查超时" }), 5000)
      ),
    ]);
    components.supabase = {
      status: supabaseResult.ok ? "ok" : "degraded",
      ...(supabaseResult.error ? { error: supabaseResult.error } : {}),
    };
  } catch (err) {
    components.supabase = {
      status: "degraded",
      error: err instanceof Error ? err.message : "未知错误",
    };
  }

  // 计算整体状态
  const allOk = Object.values(components).every((c) => c.status === "ok");
  const allDegraded = Object.values(components).every((c) => c.status === "degraded");

  return NextResponse.json(
    {
      status: allOk ? "ok" : allDegraded ? "degraded" : "degraded",
      timestamp: new Date().toISOString(),
      app: "82-0 完美赛季大挑战",
      version: "2.0.0",
      region: process.env.VERCEL_REGION || "unknown",
      components,
    },
    { status: allOk ? 200 : 200 } // 始终返回 200，通过 status 字段区分
  );
}
