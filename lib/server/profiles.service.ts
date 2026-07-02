// ===================================================================
//  lib/server/profiles.service.ts — 用户业务服务
// ===================================================================
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq, inArray, desc, sql, and } from "drizzle-orm";

// ── 常量 ────────────────────────────────────────────────────────────────

const MAX_NICKNAME_LEN = 20;
const DEFAULT_NICKNAME = "匿名玩家";
// 简单敏感词过滤
const BLOCKED_WORDS = /admin|root|system|官方|管理员|测试|test/i;

// ── 类型 ────────────────────────────────────────────────────────────────

export interface ProfileRow {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  total_games: number;
  total_wins: number;
  best_score: number | null;
  created_at: string;
  updated_at: string;
}

interface ProfileBrief {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  total_games: number;
  total_wins: number;
}

// ── 辅助 ────────────────────────────────────────────────────────────────

function sanitizeNickname(name: string): string {
  return String(name || "").replace(/[<>]/g, "").trim().slice(0, MAX_NICKNAME_LEN);
}

function validateNickname(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) return { valid: false, error: "昵称不能为空" };
  if (trimmed.length < 1) return { valid: false, error: "昵称至少1个字符" };
  if (trimmed.length > MAX_NICKNAME_LEN) return { valid: false, error: `昵称最长${MAX_NICKNAME_LEN}个字符` };
  if (BLOCKED_WORDS.test(trimmed)) return { valid: false, error: "昵称包含敏感词" };
  return { valid: true };
}

// ══════════════════════════════════════════════════════════════════

export const profilesService = {
  // ── 查询单个用户 ──────────────────────────────────────────────────
  async getProfile(userId: string) {
    if (!userId) return { success: false, error: "缺少 user_id" };

    let [row] = await db.select().from(profiles).where(eq(profiles.user_id, userId)).limit(1);

    // 不存在则自动创建（兜底）
    if (!row) {
      [row] = await db.insert(profiles)
        .values({ user_id: userId, nickname: DEFAULT_NICKNAME })
        .returning();
    }

    return { success: true, data: row as unknown as ProfileRow };
  },

  // ── 批量查询用户 ──────────────────────────────────────────────────
  async getProfileBatch(userIds: string[]) {
    if (!userIds?.length) return { success: true, data: [] };

    const unique = [...new Set(userIds.filter(Boolean))];
    const rows = await db.select({
      user_id: profiles.user_id,
      nickname: profiles.nickname,
      avatar_url: profiles.avatar_url,
      total_games: profiles.total_games,
      total_wins: profiles.total_wins,
    }).from(profiles).where(inArray(profiles.user_id, unique));

    // 补全缺失的（首次访问的用户可能还没有 profile）
    const found = new Set(rows.map((r) => r.user_id));
    const missing = unique.filter((id) => !found.has(id));
    if (missing.length > 0) {
      await db.insert(profiles)
        .values(missing.map((id) => ({ user_id: id, nickname: DEFAULT_NICKNAME })))
        .onConflictDoNothing();
      // 重新查询
      const newRows = await db.select({
        user_id: profiles.user_id,
        nickname: profiles.nickname,
        avatar_url: profiles.avatar_url,
        total_games: profiles.total_games,
        total_wins: profiles.total_wins,
      }).from(profiles).where(inArray(profiles.user_id, missing));
      rows.push(...newRows);
    }

    return { success: true, data: rows as ProfileBrief[] };
  },

  // ── 修改昵称 ──────────────────────────────────────────────────────
  async updateNickname(userId: string, nickname: string) {
    if (!userId) return { success: false, error: "用户未登录" };

    const clean = sanitizeNickname(nickname);
    const validation = validateNickname(clean);
    if (!validation.valid) return { success: false, error: validation.error };

    // 确保 profile 存在
    await db.insert(profiles)
      .values({ user_id: userId, nickname: clean })
      .onConflictDoUpdate({
        target: profiles.user_id,
        set: { nickname: clean, updated_at: new Date() },
      });

    const [row] = await db.select().from(profiles).where(eq(profiles.user_id, userId)).limit(1);
    return { success: true, data: row as unknown as ProfileRow };
  },

  // ── 更新对战统计数据（仅服务端调用）──────────────────────────────
  async incrementGameStats(userId: string, isWin: boolean) {
    if (!userId) return { success: false, error: "缺少 user_id" };

    // 确保 profile 存在
    await db.insert(profiles)
      .values({ user_id: userId, nickname: DEFAULT_NICKNAME })
      .onConflictDoNothing();

    const updates: Record<string, unknown> = {
      total_games: sql`${profiles.total_games} + 1`,
      updated_at: new Date(),
    };
    if (isWin) {
      updates.total_wins = sql`${profiles.total_wins} + 1`;
    }

    await db.update(profiles).set(updates).where(eq(profiles.user_id, userId));

    const [row] = await db.select().from(profiles).where(eq(profiles.user_id, userId)).limit(1);
    return { success: true, data: row as unknown as ProfileRow };
  },

  // ── 同步最佳战绩 ──────────────────────────────────────────────────
  async syncBestScore(userId: string, wins: number) {
    if (!userId || wins < 0 || wins > 82) return { success: false, error: "参数无效" };

    await db.insert(profiles)
      .values({ user_id: userId, nickname: DEFAULT_NICKNAME, best_score: wins })
      .onConflictDoUpdate({
        target: profiles.user_id,
        set: {
          best_score: sql`GREATEST(COALESCE(${profiles.best_score}, 0), ${wins})`,
          updated_at: new Date(),
        },
      });

    return { success: true };
  },

  // ── 排行榜 ────────────────────────────────────────────────────────
  async getRankings(type: "wins" | "rate" = "wins", limit = 20) {
    const orderBy = type === "wins"
      ? [desc(profiles.total_wins), desc(profiles.total_games)]
      : [desc(sql`CASE WHEN ${profiles.total_games} > 0 THEN ${profiles.total_wins}::float / ${profiles.total_games} ELSE 0 END`)];

    const rows = await db.select({
      user_id: profiles.user_id,
      nickname: profiles.nickname,
      avatar_url: profiles.avatar_url,
      total_games: profiles.total_games,
      total_wins: profiles.total_wins,
    }).from(profiles)
      .where(sql`${profiles.total_games} > 0`)
      .orderBy(...orderBy)
      .limit(Math.min(limit, 100));

    return { success: true, data: rows };
  },
};
