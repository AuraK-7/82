// ===================================================================
//  lib/server/battle.service.ts — 对战业务服务（房间全生命周期）
// ===================================================================
import { db } from "@/db";
import { battleRooms, battleHistory, battlePickLog } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { calcTeamRatingFromSlots, simulateSingleGame, simulateSeries, playerRating, getPlayers, getTeams, getTeamsList, loadPlayerData } from "@/lib/game-core";
import { profilesService } from "@/lib/server/profiles.service";
import type { BattleGameResult, RosterEntry } from "@/lib/types/battle.types";
import type { Position as PositionSlot, Player } from "@/lib/game-core";

// ── 房间号生成（排除 0/O/1/I/L）───────────────────────────────────────

const ROOM_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LEN = 6;
const BO7_WINS = 4;
const COMMON_POOL_TIMEOUT_MS = 15_000; // 15 秒选人倒计时
const COMMON_POOL_TOTAL_ROUNDS = 5;
const COMMON_POOL_MAX_SKIPS = { team: 1, decade: 1 }; // 每方各 1 次

function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LEN; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

// ── 阵容校验 ──────────────────────────────────────────────────────────

const POS_ORDER: PositionSlot[] = ["PG", "SG", "SF", "C", "PF"];

interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateRoster(roster: RosterEntry[]): ValidationResult {
  if (!Array.isArray(roster) || roster.length !== 5) {
    return { valid: false, error: "阵容必须包含 5 名球员" };
  }

  const slots = new Set<string>();
  const names = new Set<string>();

  for (const entry of roster) {
    if (!entry.slot || !POS_ORDER.includes(entry.slot)) {
      return { valid: false, error: `无效的位置: ${entry.slot}` };
    }
    if (slots.has(entry.slot)) {
      return { valid: false, error: `重复的位置: ${entry.slot}` };
    }
    if (!entry.name || !entry.team || !entry.decade) {
      return { valid: false, error: "球员信息不完整" };
    }
    if (names.has(entry.name)) {
      return { valid: false, error: `重复的球员: ${entry.name}` };
    }
    slots.add(entry.slot);
    names.add(entry.name);
  }

  return { valid: true };
}

// ── 服务端重新计算评分（不信任前端传入的 rating）──────────────────────

function recomputeRosterRatings(roster: RosterEntry[]): RosterEntry[] {
  return roster.map((entry) => {
    const rating = playerRating({
      name: entry.name,
      pos: entry.pos,
      positions: entry.positions as PositionSlot[],
      team: entry.team,
      decade: entry.decade,
      pts: entry.pts,
      reb: entry.reb,
      ast: entry.ast,
      stl: entry.stl,
      blk: entry.blk,
    });
    return { ...entry, rating };
  });
}

// ── 公共池类型与工具 ──────────────────────────────────────────────────

interface CommonPoolEntry {
  team: string;
  decade: string;
  players: {
    name: string;
    pos: string;
    positions: string[];
    pts: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
  }[];
}

/** 为指定球队+年代构建一个公共池条目 */
async function buildPoolEntry(team: string, decade: string): Promise<CommonPoolEntry> {
  const rawPlayers = await getPlayers(decade, team);
  const players = rawPlayers.map((p) => ({
    name: p.name,
    pos: p.pos,
    positions: p.positions,
    pts: p.pts,
    reb: p.reb,
    ast: p.ast,
    stl: p.stl,
    blk: p.blk,
  }));
  return { team, decade, players };
}

/** 生成一个随机球队+年代的公共球员池 */
async function generatePool(): Promise<CommonPoolEntry[]> {
  const allTeams = await getTeamsList();
  const team = allTeams[Math.floor(Math.random() * allTeams.length)];

  const availableDecades: string[] = [];
  for (const d of ["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"]) {
    if ((await getPlayers(d, team)).length > 0) {
      availableDecades.push(d);
    }
  }

  if (availableDecades.length === 0) {
    return [await buildPoolEntry("GSW", "2010s")];
  }

  const decade = availableDecades[Math.floor(Math.random() * availableDecades.length)];
  return [await buildPoolEntry(team, decade)];
}

// ══════════════════════════════════════════════════════════════════
//  公开 API
// ══════════════════════════════════════════════════════════════════

export const battleService = {
  // ── 创建房间 ──────────────────────────────────────────────────────
  async createRoom(userId: string, nickname: string, pickMode: "independent" | "common" = "independent") {
    if (!userId) return { success: false, error: "用户未登录" };

    // 生成唯一房间号（最多重试 5 次）
    let roomCode = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      roomCode = generateRoomCode();
      const existing = await db
        .select({ id: battleRooms.id })
        .from(battleRooms)
        .where(eq(battleRooms.room_code, roomCode))
        .limit(1);
      if (existing.length === 0) break;
    }

    const [room] = await db
      .insert(battleRooms)
      .values({
        room_code: roomCode,
        host_id: userId,
        host_nickname: nickname || "匿名球迷",
        status: "waiting",
        pick_mode: pickMode,
        host_pick_progress: 0,
        guest_pick_progress: 0,
        host_ready: false,
        guest_ready: false,
        host_skips: { team: 1, decade: 1 },
        guest_skips: { team: 1, decade: 1 },
      })
      .returning();

    return { success: true, data: room };
  },

  // ── 加入房间 ──────────────────────────────────────────────────────
  async joinRoom(userId: string, roomCode: string, nickname: string) {
    if (!userId) return { success: false, error: "用户未登录" };

    const [room] = await db
      .select()
      .from(battleRooms)
      .where(and(eq(battleRooms.room_code, roomCode.toUpperCase()), isNull(battleRooms.guest_id), eq(battleRooms.status, "waiting")))
      .limit(1);

    if (!room) return { success: false, error: "房间不存在、已满员或已开始" };
    if (room.host_id === userId) return { success: false, error: "不能加入自己创建的房间" };

    // 公共池模式：初始化选人状态
    const isCommonMode = room.pick_mode === "common";
    const updateSet: Record<string, unknown> = {
      guest_id: userId,
      guest_nickname: nickname || "匿名球迷",
      status: "picking",
    };

    if (isCommonMode) {
      const pool = await generatePool();
      updateSet.common_pool = pool;
      updateSet.current_pick_round = 1;
      updateSet.current_picker = room.host_id; // 房主先选
      updateSet.pick_deadline = new Date(Date.now() + COMMON_POOL_TIMEOUT_MS);
    }

    const [updated] = await db
      .update(battleRooms)
      .set(updateSet)
      .where(eq(battleRooms.id, room.id))
      .returning();

    return { success: true, data: updated };
  },

  // ── 提交阵容 ──────────────────────────────────────────────────────
  async confirmRoster(userId: string, roomCode: string, roster: RosterEntry[]) {
    if (!userId) return { success: false, error: "用户未登录" };

    // 1. 查找房间
    const [room] = await db
      .select()
      .from(battleRooms)
      .where(eq(battleRooms.room_code, roomCode.toUpperCase()))
      .limit(1);

    if (!room) return { success: false, error: "房间不存在" };
    if (room.status !== "picking") return { success: false, error: "房间状态不正确" };

    // 2. 身份校验
    const isHost = room.host_id === userId;
    const isGuest = room.guest_id === userId;
    if (!isHost && !isGuest) return { success: false, error: "你不是该房间的成员" };

    // 3. 阵容校验
    const validation = validateRoster(roster);
    if (!validation.valid) return { success: false, error: validation.error };

    // 4. 服务端重新计算评分（防作弊）
    const ratedRoster = recomputeRosterRatings(roster);

    // 5. 防重复提交
    if (isHost && room.host_ready) return { success: false, error: "你已经提交过阵容" };
    if (isGuest && room.guest_ready) return { success: false, error: "你已经提交过阵容" };

    // 6. 更新阵容
    const updateData: Record<string, unknown> = {};
    if (isHost) {
      updateData.host_roster = ratedRoster;
      updateData.host_ready = true;
      updateData.host_pick_progress = 5;
    } else {
      updateData.guest_roster = ratedRoster;
      updateData.guest_ready = true;
      updateData.guest_pick_progress = 5;
    }

    const [updated] = await db
      .update(battleRooms)
      .set(updateData)
      .where(eq(battleRooms.id, room.id))
      .returning();

    if (!updated) return { success: false, error: "更新失败" };

    // 7. 双方都就绪 → 计算评分 → 自动进入 playing
    if (updated.host_ready && updated.guest_ready && updated.host_roster && updated.guest_roster) {
      const hostSlots: Record<string, typeof ratedRoster[number] | null> = { PG: null, SG: null, SF: null, PF: null, C: null };
      const guestSlots: Record<string, typeof ratedRoster[number] | null> = { PG: null, SG: null, SF: null, PF: null, C: null };

      (updated.host_roster as RosterEntry[]).forEach((e) => { hostSlots[e.slot] = e; });
      (updated.guest_roster as RosterEntry[]).forEach((e) => { guestSlots[e.slot] = e; });

      // calcTeamRatingFromSlots imported at top
      const hostRating = calcTeamRatingFromSlots(hostSlots as never);
      const guestRating = calcTeamRatingFromSlots(guestSlots as never);

      const [playing] = await db
        .update(battleRooms)
        .set({
          status: "playing",
          playoff_state: {
            games: [],
            hostWins: 0,
            guestWins: 0,
            hostRating,
            guestRating,
            done: false,
          },
        })
        .where(eq(battleRooms.id, room.id))
        .returning();

      return { success: true, data: playing };
    }

    return { success: true, data: updated };
  },

  // ── 模拟比赛 ──────────────────────────────────────────────────────
  async simulateBattle(
    userId: string,
    roomCode: string,
    mode: "single" | "series" = "single"
  ) {
    if (!userId) return { success: false, error: "用户未登录" };

    const [room] = await db
      .select()
      .from(battleRooms)
      .where(eq(battleRooms.room_code, roomCode.toUpperCase()))
      .limit(1);

    if (!room) return { success: false, error: "房间不存在" };
    if (room.status !== "playing") return { success: false, error: "房间不在对战中" };
    if (room.host_id !== userId) return { success: false, error: "仅房主可以模拟比赛" };

    const ps = room.playoff_state as {
      games: BattleGameResult[];
      hostWins: number;
      guestWins: number;
      hostRating: number;
      guestRating: number;
      done: boolean;
    } | null;

    if (!ps) return { success: false, error: "对战状态异常" };
    if (ps.done) return { success: false, error: "系列赛已结束" };
    if (ps.hostWins >= BO7_WINS || ps.guestWins >= BO7_WINS) {
      return { success: false, error: "系列赛已结束" };
    }

    // 幂等保护：使用 updated_at 作为乐观锁
    let result: BattleGameResult;
    let newHostWins = ps.hostWins;
    let newGuestWins = ps.guestWins;
    const newGames = [...ps.games];

    if (mode === "single") {
      result = simulateSingleGame(ps.hostRating, ps.guestRating);
      newGames.push(result);
      if (result.hostWin) newHostWins++; else newGuestWins++;
    } else {
      const series = simulateSeries(
        ps.hostRating, ps.guestRating,
        ps.hostWins, ps.guestWins, ps.games
      );
      newGames.push(...series.games.slice(ps.games.length));
      newHostWins = series.hostWins;
      newGuestWins = series.guestWins;
    }

    const seriesDone = newHostWins >= BO7_WINS || newGuestWins >= BO7_WINS;
    const winnerId = seriesDone
      ? (newHostWins >= BO7_WINS ? room.host_id : room.guest_id)
      : null;

    const updateData: Record<string, unknown> = {
      playoff_state: {
        games: newGames,
        hostWins: newHostWins,
        guestWins: newGuestWins,
        hostRating: ps.hostRating,
        guestRating: ps.guestRating,
        done: seriesDone,
      },
    };

    if (seriesDone) {
      updateData.status = "finished";
      updateData.winner_id = winnerId;
    }

    const [updated] = await db
      .update(battleRooms)
      .set(updateData)
      .where(eq(battleRooms.id, room.id))
      .returning();

    if (!updated) return { success: false, error: "更新失败" };

    // 系列赛结束 → 自动写入历史战绩
    if (seriesDone && room.host_id && room.guest_id) {
      const hostWon = newHostWins >= BO7_WINS;
      const seriesScore = `${newHostWins}-${newGuestWins}`;

      await db.insert(battleHistory).values([
        {
          player_id: room.host_id,
          opponent_id: room.guest_id,
          opponent_name: (room.guest_nickname as string) || "匿名球迷",
          is_win: hostWon,
          series_score: seriesScore,
          my_roster: room.host_roster as RosterEntry[],
          opponent_roster: room.guest_roster as RosterEntry[],
          game_details: newGames,
          room_code: room.room_code,
        },
        {
          player_id: room.guest_id,
          opponent_id: room.host_id,
          opponent_name: (room.host_nickname as string) || "匿名球迷",
          is_win: !hostWon,
          series_score: `${newGuestWins}-${newHostWins}`,
          my_roster: room.guest_roster as RosterEntry[],
          opponent_roster: room.host_roster as RosterEntry[],
          game_details: newGames,
          room_code: room.room_code,
        },
      ]);

      // 自动更新双方对战统计数据
      await profilesService.incrementGameStats(room.host_id!, hostWon);
      await profilesService.incrementGameStats(room.guest_id!, !hostWon);
    }

    return { success: true, data: updated };
  },

  // ── 查询房间状态 ──────────────────────────────────────────────────
  async getRoomState(userId: string, roomCode: string) {
    if (!userId) return { success: false, error: "用户未登录" };

    const [room] = await db
      .select()
      .from(battleRooms)
      .where(eq(battleRooms.room_code, roomCode.toUpperCase()))
      .limit(1);

    if (!room) return { success: false, error: "房间不存在" };
    if (room.host_id !== userId && room.guest_id !== userId) {
      return { success: false, error: "你不是该房间的成员" };
    }

    return { success: true, data: room };
  },

  // ── 更新选人进度 ──────────────────────────────────────────────────
  async updatePickProgress(userId: string, roomCode: string, progress: number) {
    if (!userId) return { success: false, error: "用户未登录" };

    const [room] = await db
      .select({ id: battleRooms.id, host_id: battleRooms.host_id, guest_id: battleRooms.guest_id, status: battleRooms.status })
      .from(battleRooms)
      .where(eq(battleRooms.room_code, roomCode.toUpperCase()))
      .limit(1);

    if (!room) return { success: false, error: "房间不存在" };
    if (room.status !== "picking") return { success: false, error: "不在选人阶段" };

    const isHost = room.host_id === userId;
    if (!isHost && room.guest_id !== userId) return { success: false, error: "你不是该房间的成员" };

    const field = isHost ? "host_pick_progress" : "guest_pick_progress";
    const [updated] = await db
      .update(battleRooms)
      .set({ [field]: progress })
      .where(eq(battleRooms.id, room.id))
      .returning();

    return { success: true, data: updated };
  },

  // ── 更新跳过次数 ──────────────────────────────────────────────────
  async updateSkips(userId: string, roomCode: string, skips: { team: number; decade: number }) {
    if (!userId) return { success: false, error: "用户未登录" };

    const [room] = await db
      .select({ id: battleRooms.id, host_id: battleRooms.host_id, guest_id: battleRooms.guest_id })
      .from(battleRooms)
      .where(eq(battleRooms.room_code, roomCode.toUpperCase()))
      .limit(1);

    if (!room) return { success: false, error: "房间不存在" };

    const isHost = room.host_id === userId;
    if (!isHost && room.guest_id !== userId) return { success: false, error: "你不是该房间的成员" };

    const field = isHost ? "host_skips" : "guest_skips";
    const [updated] = await db
      .update(battleRooms)
      .set({ [field]: skips })
      .where(eq(battleRooms.id, room.id))
      .returning();

    return { success: true, data: updated };
  },

  // ══════════════════════════════════════════════════════════════════
  //  公共池抢选
  // ══════════════════════════════════════════════════════════════════

  /** 从公共池中选择球员 */
  async pickFromCommonPool(
    userId: string,
    roomCode: string,
    playerName: string,
    slot: string
  ) {
    if (!userId) return { success: false, error: "用户未登录" };

    const [room] = await db
      .select()
      .from(battleRooms)
      .where(eq(battleRooms.room_code, roomCode.toUpperCase()))
      .limit(1);

    if (!room) return { success: false, error: "房间不存在" };
    if (room.status !== "picking") return { success: false, error: "不在选人阶段" };
    if (room.pick_mode !== "common") return { success: false, error: "非公共池模式" };

    // 校验选人权
    if (room.current_picker !== userId) {
      return { success: false, error: "不是你的选人回合" };
    }

    // 校验位置合法性
    if (!POS_ORDER.includes(slot as PositionSlot)) {
      return { success: false, error: `无效的位置: ${slot}` };
    }

    // 检查超时
    const deadline = room.pick_deadline ? new Date(room.pick_deadline as unknown as string).getTime() : 0;
    if (Date.now() > deadline) {
      // 超时自动选 → 由 checkPickTimeout 处理
      return { success: false, error: "选人已超时" };
    }

    // 校验球员在公共池中
    const pool = room.common_pool as CommonPoolEntry[] | null;
    if (!pool || pool.length === 0) {
      return { success: false, error: "公共池为空" };
    }

    const poolPlayers: Player[] = [];
    for (const entry of pool) {
      for (const p of entry.players) {
        poolPlayers.push(p as unknown as Player);
      }
    }

    const targetPlayer = poolPlayers.find((p) => p.name === playerName);
    if (!targetPlayer) return { success: false, error: "该球员不在公共池中" };

    // 检查是否已被选
    const isHost = room.host_id === userId;
    const myRoster = (isHost ? room.host_roster : room.guest_roster) as RosterEntry[] | null;
    const oppRoster = (isHost ? room.guest_roster : room.host_roster) as RosterEntry[] | null;
    const allPicked = new Set([
      ...(myRoster || []).map((e) => e.name),
      ...(oppRoster || []).map((e) => e.name),
    ]);
    if (allPicked.has(playerName)) {
      return { success: false, error: "该球员已被选择" };
    }

    // 检查位置是否已被占用
    if ((myRoster || []).some((e) => e.slot === slot)) {
      return { success: false, error: `位置 ${slot} 已被占用` };
    }

    // 添加球员到阵容
    const newEntry: RosterEntry = {
      slot: slot as PositionSlot,
      name: targetPlayer.name,
      pos: targetPlayer.pos,
      positions: targetPlayer.positions,
      team: targetPlayer.team,
      decade: targetPlayer.decade,
      pts: targetPlayer.pts,
      reb: targetPlayer.reb,
      ast: targetPlayer.ast,
      stl: targetPlayer.stl,
      blk: targetPlayer.blk,
      rating: targetPlayer.rating ?? playerRating(targetPlayer),
    };

    const updatedRoster = [...(myRoster || []), newEntry];
    const progress = updatedRoster.length;

    // 记录选人日志
    await db.insert(battlePickLog).values({
      room_code: room.room_code,
      round: (room.current_pick_round as number) || 1,
      picker_id: userId,
      player_name: playerName,
      slot,
    });

    // 判断本轮是否结束（双方各选 1 人）
    const oppProgress = (oppRoster || []).length;
    const roundDone = progress > oppProgress; // 本方选完意味着本轮本方已选，检查是否轮到对手

    // 旋转选人权
    const otherUserId = isHost ? room.guest_id : room.host_id;
    let nextRound = (room.current_pick_round as number) || 1;
    let nextPicker: string | null = otherUserId;

    if (progress === COMMON_POOL_TOTAL_ROUNDS && oppProgress === COMMON_POOL_TOTAL_ROUNDS) {
      // 双方都选满 5 人 → 可以确认阵容
      nextPicker = null;
    } else if (progress > oppProgress) {
      // 本方多选 → 轮到对手
      nextPicker = otherUserId;
    } else {
      // 本轮结束，进入下一轮
      nextRound = Math.min(nextRound + 1, COMMON_POOL_TOTAL_ROUNDS);
      nextPicker = room.host_id; // 新房主先选
      // 生成本轮新公共池
      const newPool = generatePool();
      const updateData: Record<string, unknown> = {
        common_pool: newPool,
        current_pick_round: nextRound,
        current_picker: nextPicker,
        pick_deadline: new Date(Date.now() + COMMON_POOL_TIMEOUT_MS),
      };
      if (isHost) updateData.host_roster = updatedRoster;
      else updateData.guest_roster = updatedRoster;
      updateData[isHost ? "host_pick_progress" : "guest_pick_progress"] = progress;

      const [updated] = await db
        .update(battleRooms)
        .set(updateData)
        .where(eq(battleRooms.id, room.id))
        .returning();

      return { success: true, data: updated };
    }

    // 未进入下一轮：仅更新阵容和选人权
    const updateData: Record<string, unknown> = {
      current_picker: nextPicker,
      pick_deadline: nextPicker
        ? new Date(Date.now() + COMMON_POOL_TIMEOUT_MS)
        : null,
    };
    if (isHost) updateData.host_roster = updatedRoster;
    else updateData.guest_roster = updatedRoster;
    updateData[isHost ? "host_pick_progress" : "guest_pick_progress"] = progress;

    const [updated] = await db
      .update(battleRooms)
      .set(updateData)
      .where(eq(battleRooms.id, room.id))
      .returning();

    return { success: true, data: updated };
  },

  /** 跳过球队或年代（公共池模式） */
  async skipCommonPool(
    userId: string,
    roomCode: string,
    skipType: "team" | "decade"
  ) {
    if (!userId) return { success: false, error: "用户未登录" };

    const [room] = await db
      .select()
      .from(battleRooms)
      .where(eq(battleRooms.room_code, roomCode.toUpperCase()))
      .limit(1);

    if (!room) return { success: false, error: "房间不存在" };
    if (room.status !== "picking") return { success: false, error: "不在选人阶段" };
    if (room.pick_mode !== "common") return { success: false, error: "非公共池模式" };

    // 只有当前选人方可以跳过
    if (room.current_picker !== userId) {
      return { success: false, error: "不是你的选人回合" };
    }

    const isHost = room.host_id === userId;
    const skips = (isHost ? room.host_skips : room.guest_skips) as { team: number; decade: number };

    if (skipType === "team" && skips.team <= 0) {
      return { success: false, error: "球队跳过次数已用完" };
    }
    if (skipType === "decade" && skips.decade <= 0) {
      return { success: false, error: "年代跳过次数已用完" };
    }

    // 消耗跳过次数
    const newSkips = { ...skips };
    newSkips[skipType]--;

    // 生成新公共池（同年代换队 / 同队换年代）
    const currentPool = room.common_pool as CommonPoolEntry[] | null;
    const currentTeam = currentPool?.[0]?.team || "";
    const currentDecade = currentPool?.[0]?.decade || "";

    let newPool: CommonPoolEntry[];
    if (skipType === "team") {
      // 同年代换一队
      const teams = (await getTeams(currentDecade)).filter((t) => t !== currentTeam);
      const newTeam = teams[Math.floor(Math.random() * teams.length)] || currentTeam;
      newPool = [await buildPoolEntry(newTeam, currentDecade)];
    } else {
      // 同队换年代
      const decadesTmp: string[] = [];
      for (const d of ["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"]) {
        if (d !== currentDecade && (await getPlayers(d, currentTeam)).length > 0) {
          decadesTmp.push(d);
        }
      }
      const newDecade = decadesTmp[Math.floor(Math.random() * decadesTmp.length)] || currentDecade;
      newPool = [await buildPoolEntry(currentTeam, newDecade)];
    }

    const skipsField = isHost ? "host_skips" : "guest_skips";
    const [updated] = await db
      .update(battleRooms)
      .set({
        common_pool: newPool,
        [skipsField]: newSkips,
        pick_deadline: new Date(Date.now() + COMMON_POOL_TIMEOUT_MS),
      })
      .where(eq(battleRooms.id, room.id))
      .returning();

    return { success: true, data: updated };
  },

  /** 检查选人超时 → 自动选评分最高的球员 */
  async checkPickTimeout(userId: string, roomCode: string) {
    if (!userId) return { success: false, error: "用户未登录" };

    const [room] = await db
      .select()
      .from(battleRooms)
      .where(eq(battleRooms.room_code, roomCode.toUpperCase()))
      .limit(1);

    if (!room) return { success: false, error: "房间不存在" };
    if (room.status !== "picking") return { success: false, error: "不在选人阶段" };
    if (room.pick_mode !== "common") return { success: false, error: "非公共池模式" };

    const deadline = room.pick_deadline ? new Date(room.pick_deadline as unknown as string).getTime() : 0;
    if (Date.now() <= deadline) {
      return { success: false, error: "选人尚未超时" };
    }

    const currentPicker = room.current_picker as string;
    const isHost = currentPicker === room.host_id;

    // 获取可选球员
    const pool = room.common_pool as CommonPoolEntry[] | null;
    if (!pool || pool.length === 0) {
      return { success: false, error: "公共池为空" };
    }

    const allPicked = new Set([
      ...((room.host_roster as RosterEntry[]) || []).map((e) => e.name),
      ...((room.guest_roster as RosterEntry[]) || []).map((e) => e.name),
    ]);

    const available: Player[] = [];
    for (const entry of pool) {
      for (const p of entry.players) {
        if (!allPicked.has(p.name)) {
          available.push(p as unknown as Player);
        }
      }
    }

    if (available.length === 0) {
      return { success: false, error: "无可选球员" };
    }

    // 选评分最高的
    const best = available.reduce((a, b) => {
      const ra = a.rating ?? playerRating(a);
      const rb = b.rating ?? playerRating(b);
      return ra > rb ? a : b;
    });

    // 找空槽位
    const myRoster = (isHost ? room.host_roster : room.guest_roster) as RosterEntry[] | null;
    const filledSlots = new Set((myRoster || []).map((e) => e.slot));
    const emptySlot = POS_ORDER.find((s) => !filledSlots.has(s)) || "SF";

    // 委托 pickFromCommonPool 自动选人
    return await this.pickFromCommonPool(currentPicker, roomCode, best.name, emptySlot);
  },
};
