// ===================================================================
//  db/migrate.ts — 数据库迁移执行脚本
// ===================================================================
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function runMigrations() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL 环境变量未设置");
    process.exit(1);
  }

  console.log("🔄 开始执行数据库迁移...");
  console.log(`📂 迁移文件目录: db/migrations/`);

  const client = postgres(dbUrl, {
    max: 1,
    connect_timeout: 10,
  });

  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "db/migrations" });
    console.log("✅ 数据库迁移执行完成");
  } catch (err) {
    console.error("❌ 数据库迁移失败:", err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
