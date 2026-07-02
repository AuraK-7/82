// ===================================================================
//  lib/game-core/types.ts — 核心类型定义
//  纯数据结构，前后端通用
// ===================================================================

/** 五项基础数据 */
export interface PlayerStats {
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
}

/** 球员位置槽位 */
export type Position = "PG" | "SG" | "SF" | "PF" | "C";

/** 年代标识 */
export type Decade =
  | "1960s" | "1970s" | "1980s" | "1990s"
  | "2000s" | "2010s" | "2020s";

/** 球员核心数据（不含UI字段） */
export interface Player {
  name: string;
  pos: string;
  positions: Position[];
  team: string;
  decade: Decade | string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  rating?: number;
}

/** 带评分的球员 */
export interface RatedPlayer extends Player {
  rating: number;
}

/** 阵容槽位映射 */
export type RosterSlots = Partial<Record<Position, Player | null>>;

/** 阵容总评 */
export interface TeamRating {
  overall: number;
  playerRatings: number[];
}

/** 单场比赛结果 */
export interface SingleGameResult {
  hostScore: number;
  guestScore: number;
  hostWin: boolean;
}

/** BO7 系列赛结果 */
export interface SeriesResult {
  games: SingleGameResult[];
  hostWins: number;
  guestWins: number;
  hostWin: boolean;
}

/** 82 场常规赛结果 */
export interface SeasonResult {
  wins: number;
  losses: number;
  teamOvr: number;
  grade: string;
  tier: string;
  color: string;
}

/** 段位 */
export interface GradeBand {
  min: number;
  grade: string;
  label: string;
  color: string;
}

/** 年代基准 */
export interface EraBenchmark {
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
}

/** 位置权重 */
export type PositionWeights = Record<Position, EraBenchmark>;

/** 统计键 */
export type StatKey = "pts" | "reb" | "ast" | "stl" | "blk";
