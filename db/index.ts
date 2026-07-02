// ===================================================================
//  db/index.ts — Drizzle 客户端 + Supabase 连接池
// ===================================================================
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  _pg: ReturnType<typeof postgres> | undefined;
};

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _initError: Error | null = null;
let _migrationPromise: Promise<void> | null = null;

/**
 * 自动执行数据库迁移（幂等，首次连接时运行一次）
 */
async function runMigrations(db: ReturnType<typeof drizzle<typeof schema>>) {
  if (_migrationPromise) return _migrationPromise;

  _migrationPromise = (async () => {
    try {
      console.log("[DB] 开始执行数据库迁移...");
      await migrate(db, { migrationsFolder: "db/migrations" });
      console.log("[DB] 数据库迁移完成");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "未知迁移错误";
      console.error("[DB] 迁移执行失败（表可能已存在或连接异常）:", msg);
      // 清除失败 promise，允许下次请求重试
      _migrationPromise = null;
    }
  })();

  return _migrationPromise;
}

function initDb() {
  if (_db) return _db;
  if (_initError) throw _initError;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    const msg =
      "[DB] DATABASE_URL 未设置。API 路由将无法使用数据库。请在 .env.local 中配置此变量。";
    console.error(msg);
    _initError = new Error(msg);
    throw _initError;
  }

  if (!dbUrl.startsWith("postgresql://") && !dbUrl.startsWith("postgres://")) {
    const msg = "[DB] DATABASE_URL 格式无效，应以 postgresql:// 开头";
    console.error(msg);
    _initError = new Error(msg);
    throw _initError;
  }

  try {
    if (!globalForDb._pg) {
      // 检测是否为 Supabase 交易池连接（端口 6543），需要 prepare: false
      const isPooler = dbUrl.includes(":6543") || dbUrl.includes("pooler.supabase.com");
      globalForDb._pg = postgres(dbUrl, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 5, // 5 秒连接超时
        ...(isPooler ? { prepare: false } : {}), // 交易池模式禁用 prepared statements
      });
    }

    _db = drizzle(globalForDb._pg, { schema });
    console.log("[DB] 数据库连接已建立");

    // 自动执行迁移（异步，不阻塞连接建立）
    // 首次查询会等待迁移完成
    runMigrations(_db);

    return _db;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知数据库连接错误";
    console.error("[DB] 数据库连接失败:", msg);
    _initError = new Error(`数据库连接失败: ${msg}`);
    throw _initError;
  }
}

/**
 * 数据库客户端（懒初始化）
 * 首次调用 query/select/insert 等方法时才建立连接
 * 未配置 DATABASE_URL 时抛出明确错误（由调用方 catch 处理）
 */
function getDb() {
  return initDb();
}

/** 查询入口方法名 */
const QUERY_METHODS = new Set(["select", "insert", "update", "delete", "query", "execute"]);

/**
 * 递归包装对象，拦截 .then() 确保迁移先完成。
 * drizzle 的链式调用 (.select().from().where()) 每一步返回新对象，
 * 所以必须递归包装整个链上的每个对象。
 */
function withMigrationGate<T extends object>(obj: T): T {
  if (!_migrationPromise) return obj;

  return new Proxy(obj, {
    get(target, prop, receiver) {
      const value = Reflect.get(target as object, prop, receiver);

      // 拦截 then()：先等迁移完成，再执行真正的查询
      if (prop === "then" && typeof value === "function") {
        return (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
          return _migrationPromise!.then(
            () => (value as Function).call(target, onFulfilled, onRejected),
            (migErr: unknown) => {
              console.error("[DB] 迁移未完成，查询可能失败:", migErr);
              return (value as Function).call(target, onFulfilled, onRejected);
            }
          );
        };
      }

      // 函数：调用后递归包装返回值（维持链式包装）
      if (typeof value === "function") {
        return (...args: unknown[]) => {
          const result = (value as Function).apply(target, args);
          if (result && typeof result === "object") {
            return withMigrationGate(result as object);
          }
          return result;
        };
      }

      return value;
    },
  }) as T;
}

// 使用 getter 模式导出，每次访问时惰性初始化
export const db = new Proxy({} as unknown as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    try {
      const real = getDb();
      const value = Reflect.get(real as object, prop, receiver);

      if (typeof value === "function") {
        const bound = value.bind(real);
        // 查询入口：包装返回的查询构建器，拦截其 .then()
        if (QUERY_METHODS.has(String(prop))) {
          return (...args: unknown[]) => {
            const result = bound(...args);
            if (result && typeof result === "object") {
              return withMigrationGate(result as object);
            }
            return result;
          };
        }
        return bound;
      }
      return value;
    } catch (err) {
      // 将初始化错误转换为被拒绝的 Promise（适配 async 调用场景）
      const msg = err instanceof Error ? err.message : "数据库不可用";
      if (QUERY_METHODS.has(String(prop))) {
        return () => {
          throw new Error(msg);
        };
      }
      throw err;
    }
  },
});

export { schema };

/**
 * 检查数据库是否可用（不抛出异常）
 * 用于健康检查等场景
 */
export async function checkDbHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return { ok: false, error: "DATABASE_URL 未配置" };
    }
    if (!dbUrl.startsWith("postgresql://") && !dbUrl.startsWith("postgres://")) {
      return { ok: false, error: "DATABASE_URL 格式无效" };
    }
    // 尝试执行轻量查询验证连通性
    const isPooler = dbUrl.includes(":6543") || dbUrl.includes("pooler.supabase.com");
    const client = postgres(dbUrl, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 5,
      ...(isPooler ? { prepare: false } : {}),
    });
    try {
      await client`SELECT 1`;
      return { ok: true };
    } finally {
      await client.end();
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "数据库连接失败" };
  }
}
