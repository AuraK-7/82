// ===================================================================
//  lib/supabase/server.ts — 服务端 Supabase 客户端
// ===================================================================
import { createClient } from "@supabase/supabase-js";

// anon 客户端（用于 JWT 验证）
let _anonClient: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!_anonClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      console.error("[Supabase] NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY 未设置");
      throw new Error("Supabase 配置缺失，请检查环境变量");
    }
    _anonClient = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return _anonClient;
}

// service_role 客户端（用于服务端数据操作，绕过 RLS）
let _adminClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (!_adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL 环境变量未设置");
    }
    if (!key) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY 环境变量未设置");
    }
    _adminClient = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return _adminClient;
}

/**
 * 检查 Supabase 是否可用（不抛出异常）
 * 用于健康检查等场景
 */
export async function checkSupabaseHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return { ok: false, error: "Supabase 环境变量未配置" };
    }
    const client = createClient(url, key, { auth: { persistSession: false } });
    // 尝试一个轻量查询验证连通性
    const { error } = await client.auth.getSession();
    // getSession 即使没有 session 也不会报错，只有网络错误才报
    if (error && error.status && error.status >= 500) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "未知错误" };
  }
}
