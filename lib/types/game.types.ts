// ===================================================================
//  lib/types/game.types.ts — 前端专属类型扩展
//  核心类型统一引用 @/lib/game-core，此处保留特有类型
// ===================================================================
import type { Position, Player as CorePlayer } from "@/lib/game-core";

/** 球员原始数据（来自 NBA_DATA_RAW） */
export interface PlayerRaw {
  cname: string; player: string; pos: string; positions: string[];
  era: string; team: string; ppg: number; rpg: number; apg: number; spg: number; bpg: number;
}

/** 运行时球员（核心类型 + UI 扩展字段） */
export interface Player extends CorePlayer {
  cname?: string;
  assignedPos?: Position;
  isDreamCaptain?: boolean;
  diff?: number;
}

/** 阵容位置槽位（别名，等同于 game-core Position） */
export type PositionSlot = Position;

/** 阵容槽位映射 */
export type RosterSlots = Record<PositionSlot, Player | null>;

/** 游戏模式（含特有模式） */
export type GameMode = "classic" | "fun" | "custom" | "salary" | "era-cross" | "same-team" | "no-repeat" | "dream" | "battle";

/** 全局游戏状态 */
export interface GameState {
  mode?: GameMode; round: number; roster: Player[]; slots: RosterSlots;
  usedDecades: string[]; usedCombos: string[];
  skipTeam: number; skipDecade: number;
  currentTeam: string | null; currentDecade: string | null; spun: boolean;
  skipPending: "team" | "decade" | null;
  dreamPlayer?: Player; dreamPlayerLocked?: boolean;
  _modeName?: string; _mistakes?: number; _penaltyWins?: number;
  _posterGrade?: string; _posterTier?: string; _posterTierColor?: string;
  _playoffResult?: string;
}
