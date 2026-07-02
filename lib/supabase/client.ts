// ===================================================================
//  lib/supabase/client.ts — 客户端 Supabase 客户端（单例缓存）
// ===================================================================
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let _browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (_browserClient) return _browserClient;

  _browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return _browserClient;
}

/** 别名：供 useAuth hook 使用 */
export const getSupabaseBrowser = createClient;
