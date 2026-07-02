// ===================================================================
//  lib/game-core/data/index.ts — 数据层统一入口
// ===================================================================
import type { Player, Decade } from "../types";
import { ALL_DECADES } from "../constants";

export { TEAM_COLORS, getTeamColors } from "./team-colors";
export { TEAM_CN, teamCN } from "./team-names";
export { POSTER_BG_SRC } from "./poster-bg";

// ── 球员数据懒加载缓存 ──────────────────────────────────────────────────

type PlayersByEraTeam = Record<string, Record<string, Player[]>>;
type PlayerArray = Player[];

interface LoadedPlayerData {
  NBA_PLAYERS: PlayerArray;
  NBA_PLAYERS_BY_ERA_TEAM: PlayersByEraTeam;
}

let _playersCache: LoadedPlayerData | null = null;

let _loadPromise: Promise<LoadedPlayerData> | null = null;

/**
 * 异步加载球员数据（仅首次加载时网络/磁盘读取，之后命中内存缓存）
 * 球员数据 ~2.7MB，独立 chunk，仅在需要的页面加载
 */
export async function loadPlayerData(): Promise<LoadedPlayerData> {
  if (_playersCache) return _playersCache;
  if (_loadPromise) return _loadPromise;

  _loadPromise = import("./players").then((mod) => {
    _playersCache = {
      NBA_PLAYERS: mod.NBA_PLAYERS,
      NBA_PLAYERS_BY_ERA_TEAM: mod.NBA_PLAYERS_BY_ERA_TEAM,
    };
    return _playersCache;
  }).catch((err) => {
    _loadPromise = null; // 允许重试
    throw err;
  });

  return _loadPromise;
}

/**
 * 同步获取已缓存的球员数据（如果尚未加载则抛出错误）
 * 仅在确认数据已加载后使用
 */
function getCachedData() {
  if (!_playersCache) {
    throw new Error(
      "球员数据尚未加载。请先调用 await loadPlayerData() 后再访问。"
    );
  }
  return _playersCache;
}

// ── 异步 API（推荐使用） ─────────────────────────────────────────────────

/** 获取指定年代+球队的球员列表 */
export async function getPlayers(decade: string, team: string): Promise<Player[]> {
  const data = await loadPlayerData();
  return data.NBA_PLAYERS_BY_ERA_TEAM[decade]?.[team] || [];
}

/** 获取指定年代所有球队 */
export async function getTeams(decade: string): Promise<string[]> {
  const data = await loadPlayerData();
  return Object.keys(data.NBA_PLAYERS_BY_ERA_TEAM[decade] || {});
}

/** 获取所有可用球队（去重） */
export async function getTeamsList(): Promise<string[]> {
  const data = await loadPlayerData();
  const teamSet = new Set<string>();
  for (const decade of Object.values(data.NBA_PLAYERS_BY_ERA_TEAM)) {
    for (const team of Object.keys(decade)) {
      teamSet.add(team);
    }
  }
  return [...teamSet].sort();
}

/** 获取所有有该球队的年代 */
export async function getDecadesForTeam(team: string): Promise<string[]> {
  const data = await loadPlayerData();
  return ALL_DECADES.filter(
    (d) => data.NBA_PLAYERS_BY_ERA_TEAM[d]?.[team]
  );
}

/** 获取所有有球员的球队（按年代筛选） */
export async function getTeamsForDecade(decade: string): Promise<string[]> {
  const data = await loadPlayerData();
  return Object.keys(data.NBA_PLAYERS_BY_ERA_TEAM[decade] || {}).sort();
}

/** 构建 SlotMachine 需要的 PlayerDataSource（异步） */
export async function buildPlayerDataSource(): Promise<Record<string, Record<string, Player[]>>> {
  const data = await loadPlayerData();
  return data.NBA_PLAYERS_BY_ERA_TEAM;
}

// ── 同步 API（仅数据已加载后可用） ─────────────────────

/** 获取指定年代+球队的球员列表（同步，需预加载） */
export function getPlayersSync(decade: string, team: string): Player[] {
  const data = getCachedData();
  return data.NBA_PLAYERS_BY_ERA_TEAM[decade]?.[team] || [];
}

/** 获取所有可用球队（同步，需预加载） */
export function getTeamsListSync(): string[] {
  const data = getCachedData();
  const teamSet = new Set<string>();
  for (const decade of Object.values(data.NBA_PLAYERS_BY_ERA_TEAM)) {
    for (const team of Object.keys(decade)) {
      teamSet.add(team);
    }
  }
  return [...teamSet].sort();
}

/** 构建 PlayerDataSource（同步，需预加载） */
export function buildPlayerDataSourceSync(): Record<string, Record<string, Player[]>> {
  const data = getCachedData();
  return data.NBA_PLAYERS_BY_ERA_TEAM;
}

// ── 命名导出（同步，需预加载） ────────────────────────────

/** @deprecated 使用 loadPlayerData() 异步加载，或确保已加载后使用同步版本 */
export { getCachedData as _getCachedData };
