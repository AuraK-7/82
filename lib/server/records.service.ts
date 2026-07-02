// ===================================================================
//  lib/server/records.service.ts — 排行榜业务服务
// ===================================================================
import { db } from "@/db";
import { gameRecords, battleHistory } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { SUBMIT_COOLDOWN } from "@/lib/game-core/constants";
import { profilesService } from "@/lib/server/profiles.service";
import { sanitizeText } from "@/lib/server/auth";

// ── 查询超时包装器（防止 DNS/网络阻塞导致请求挂起）──────────────────

const QUERY_TIMEOUT_MS = 8000; // 8 秒查询超时

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = QUERY_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("数据库查询超时，请稍后重试")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ── 类型 ─────────────────────────────────────────────────────────────

interface SubmitPayload {
  game_mode?: string;
  player_names: string[];
  decades: string[];
  teams: string[];
  wins: number;
  record: string;
  total_score?: number;
  username: string;
  roster_hash: string;
  client_fingerprint?: string;
  metadata?: Record<string, unknown>;
}

type GameMode = "classic" | "custom" | "dream" | "challenge" | "era-cross" | "same-team" | "no-repeat";

// ── 分享码生成 ───────────────────────────────────────────────────────

const CODE_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
function genShareCode(): string {
  let code = "";
  for (let i = 0; i < 12; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

// ── 输入消毒（复用 auth 模块的统一实现）──────────────────────────────

function sanitize(s: string, maxLen: number): string {
  return sanitizeText(s, maxLen);
}

/** 清洗 metadata — 仅保留纯字符串值，限制大小 */
function sanitizeMeta(meta: unknown): Record<string, unknown> {
  try {
    if (!meta || typeof meta !== "object") return {};
    const src = meta as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    let totalChars = 0;
    const MAX_TOTAL = 2000; // metadata 总大小上限 2KB
    for (const [k, v] of Object.entries(src)) {
      const key = sanitize(k, 40);
      if (!key) continue;
      const str = sanitize(String(v ?? ""), 200);
      out[key] = str;
      totalChars += key.length + str.length;
      if (totalChars > MAX_TOTAL) break;
    }
    return out;
  } catch { return {}; }
}

// ── 阵容哈希 ─────────────────────────────────────────────────────────

function rosterHash(names: string[]): string {
  const sorted = [...names].sort().join("|");
  let h = 5381;
  for (let i = 0; i < sorted.length; i++) { h = ((h << 5) + h) + sorted.charCodeAt(i); h |= 0; }
  return "rh_" + (h >>> 0).toString(36);
}

// ══════════════════════════════════════════════════════════════════

export const recordsService = {
  // ── 查询排行榜 ────────────────────────────────────────────────────
  async getRecords(
    type: "all" | "week" | "today" = "all",
    limit = 20,
    mode?: GameMode,
  ) {
    const conditions = [];
    if (mode) conditions.push(eq(gameRecords.game_mode, mode));
    if (type === "today") {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      conditions.push(sql`${gameRecords.created_at} >= ${start.toISOString()}`);
    } else if (type === "week") {
      const d = new Date(); const day = d.getDay();
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); d.setHours(0, 0, 0, 0);
      conditions.push(sql`${gameRecords.created_at} >= ${d.toISOString()}`);
    }

    let query = db.select().from(gameRecords).$dynamic();
    if (conditions.length > 0) query = query.where(and(...conditions));
    query = query.orderBy(desc(gameRecords.score), gameRecords.created_at).limit(Math.min(limit, 100));

    const rows = await withTimeout(query);

    // 批量查 profiles 获取最新昵称，覆盖 username
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
    if (userIds.length > 0) {
      const { data: profileList } = await profilesService.getProfileBatch(userIds);
      if (profileList && profileList.length > 0) {
        const nameMap = new Map(profileList.map((p) => [p.user_id, p.nickname]));
        for (const row of rows) {
          if (row.user_id && nameMap.has(row.user_id)) {
            row.username = nameMap.get(row.user_id) ?? row.username;
          }
        }
      }
    }

    // 脱敏：去除 user_id 和 client_fingerprint
    const safe = rows.map(({ user_id, client_fingerprint, ...rest }) => rest);

    return { success: true, data: safe };
  },

  // ── 提交战绩 ──────────────────────────────────────────────────────
  async submitRecord(userId: string | null, payload: SubmitPayload) {
    // 输入消毒
    const username = sanitize(payload.username, 20) || "匿名球迷";
    const wins = Number(payload.wins);
    if (!Number.isInteger(wins) || wins < 0 || wins > 82) {
      return { success: false, error: "胜场数无效" };
    }

    const pNames = (payload.player_names || []).map((n) => sanitize(n, 80)).filter(Boolean);
    if (pNames.length < 5) return { success: false, error: "阵容数据不完整" };

    const hash = payload.roster_hash || rosterHash(pNames);
    const recordStr = `${wins}-${82 - wins}`;
    const mode = sanitize(payload.game_mode || "classic", 20) as GameMode;

    // 构建 roster JSONB
    const rosterData = {
      player_names: pNames,
      decades: (payload.decades || []).map((d) => sanitize(d, 10)),
      teams: (payload.teams || []).map((t) => sanitize(t, 5)),
      roster_hash: hash,
    };

    // ── 防刷校验 ──────────────────────────────────────────────────
    // 同用户 5s 冷却
    if (userId) {
      const [recent] = await db.select({ created_at: gameRecords.created_at })
        .from(gameRecords).where(eq(gameRecords.user_id, userId))
        .orderBy(desc(gameRecords.created_at)).limit(1);
      if (recent?.created_at && Date.now() - new Date(recent.created_at).getTime() < SUBMIT_COOLDOWN.USER_MS) {
        return { success: false, error: "提交太频繁，请5秒后再试" };
      }
    }

    // metadata 消毒（限制大小，清洗嵌套字符串）
    const safeMeta = sanitizeMeta(payload.metadata);

    // 生成唯一分享码
    let shareCode = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      shareCode = genShareCode();
      const [dup] = await db.select({ id: gameRecords.id }).from(gameRecords).where(eq(gameRecords.share_code, shareCode)).limit(1);
      if (!dup) break;
    }

    const [row] = await db.insert(gameRecords).values({
      user_id: userId,
      username,
      game_mode: mode,
      score: wins,
      result: recordStr,
      roster: rosterData,
      metadata: safeMeta,
      share_code: shareCode,
      client_fingerprint: payload.client_fingerprint || null,
    }).returning();

    // 同步用户最佳战绩 + 昵称到 profiles（改名后查询时级联获取）
    if (userId) {
      await Promise.all([
        profilesService.syncBestScore(userId, wins),
        profilesService.getProfile(userId).then((res) => {
          // 如果提交的昵称与 profiles 中不同，更新 profiles
          if (res.success && res.data && sanitize(payload.username, 20) !== sanitize(res.data.nickname, 20)) {
            return profilesService.updateNickname(userId, username);
          }
        }).catch(() => { /* 非关键路径 */ }),
      ]);
    }

    return { success: true, data: row };
  },

  // ── 我的记录 ──────────────────────────────────────────────────────
  async getMyRecords(userId: string) {
    const rows = await db.select().from(gameRecords)
      .where(eq(gameRecords.user_id, userId))
      .orderBy(desc(gameRecords.created_at)).limit(50);
    return { success: true, data: rows };
  },

  // ── 圆梦模式排行（按球星分组统计夺冠次数）───────────────────────
  async getDreamRanking(limit = 20) {
    // 从 metadata->>'dream_player' 提取球星名，统计 game_mode='dream' 的夺冠次数
    const rows = await db.select({
      dream_player: sql<string>`${gameRecords.metadata}->>'dream_player'`.as("dream_player"),
      count: sql<number>`COUNT(*)::int`.as("count"),
      best_score: sql<number>`MAX(${gameRecords.score})::int`.as("best_score"),
    }).from(gameRecords)
      .where(and(
        eq(gameRecords.game_mode, "dream"),
        sql`${gameRecords.metadata}->>'dream_player' IS NOT NULL`
      ))
      .groupBy(sql`${gameRecords.metadata}->>'dream_player'`)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(Math.min(limit, 50));

    return { success: true, data: rows };
  },

  // ── 对战排行（PK 胜场统计）────────────────────────────────────────
  async getBattleRanking(limit = 20) {
    const rows = await db.select({
      player_id: battleHistory.player_id,
      wins: sql<number>`COUNT(*)::int`.as("wins"),
    }).from(battleHistory)
      .where(eq(battleHistory.is_win, true))
      .groupBy(battleHistory.player_id)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(Math.min(limit, 50));

    // 批量查昵称
    const userIds = rows.map(r => r.player_id).filter(Boolean);
    let nameMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await profilesService.getProfileBatch(userIds);
      if (profiles) profiles.forEach(p => nameMap.set(p.user_id, p.nickname));
    }

    const data = rows.map(r => ({
      username: nameMap.get(r.player_id) || "匿名玩家",
      wins: r.wins,
    }));

    return { success: true, data };
  },

  // ── 按分享码查询 ──────────────────────────────────────────────────
  async fetchByShareCode(code: string) {
    const [row] = await db.select().from(gameRecords).where(eq(gameRecords.share_code, code)).limit(1);
    return row ? { success: true, data: row } : { success: false, error: "未找到该阵容记录" };
  },
};
