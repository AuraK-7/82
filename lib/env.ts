// ===================================================================
//  lib/env.ts — 环境变量运行时校验
// ===================================================================

const REQUIRED_SERVER_VARS = ["DATABASE_URL"] as const;
const REQUIRED_CLIENT_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

interface EnvValidationResult {
  ok: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * 校验服务端环境变量（在 API Routes / Server Components 中调用）
 */
export function validateServerEnv(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const key of REQUIRED_SERVER_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  // 检查 Supabase 变量（服务端也需要）
  for (const key of REQUIRED_CLIENT_VARS) {
    if (!process.env[key]) {
      warnings.push(`${key} 未设置，Supabase 客户端将无法初始化`);
    }
  }

  // 检查 DATABASE_URL 格式
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && !dbUrl.startsWith("postgresql://")) {
    warnings.push("DATABASE_URL 格式异常，应以 postgresql:// 开头");
  }

  return {
    ok: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * 校验客户端环境变量
 */
export function validateClientEnv(): EnvValidationResult {
  const missing: string[] = [];

  for (const key of REQUIRED_CLIENT_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    warnings: [],
  };
}

/**
 * 获取环境变量（带校验，缺失时抛出明确错误）
 */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[Env] 缺少必需的环境变量: ${key}\n` +
      `请在 .env.local 中设置此变量。参考 .env.example 获取完整列表。`
    );
  }
  return value;
}

/**
 * 获取客户端安全的环境变量
 */
export function getClientEnv(key: `NEXT_PUBLIC_${string}`): string {
  const value = process.env[key];
  if (!value) {
    console.warn(`[Env] 客户端环境变量 ${key} 未设置`);
    return "";
  }
  return value;
}
