// ===================================================================
//  drizzle.config.ts — Drizzle Kit 配置
// ===================================================================
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // 仅生成迁移，不直接修改数据库
  // 使用 db:push 或 db:migrate 来执行
  verbose: true,
  strict: true,
});
