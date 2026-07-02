// ===================================================================
//  lib/frontend/types.ts — 前端专属类型扩展
//  补充 UI 状态、事件类型，核心数据复用 @/game-core
// ===================================================================
import type { Player, Position, RosterSlots, Decade, SingleGameResult } from "@/lib/game-core";

// ── 事件系统 ─────────────────────────────────────────────────────────

export type GameEvent =
  | "state-change"
  | "round-change"
  | "roster-update"
  | "skip-update"
  | "spin-result"
  | "pick-confirmed"
  | "simulation-complete"
  | "battle-game-result"
  | "battle-series-over"
  | "opponent-progress";

export type EventCallback = (payload: unknown) => void;

// ── 老虎机状态 ───────────────────────────────────────────────────────

export interface SlotMachineState {
  currentTeam: string | null;
  currentDecade: Decade | null;
  skipTeam: number;
  skipDecade: number;
  usedCombos: string[];
  spun: boolean;
  availablePlayers: Player[];
}

// ── 阵容管理器状态 ───────────────────────────────────────────────────

export interface RosterManagerState {
  slots: RosterSlots;
  usedDecades: string[];
  pickedNames: string[];
}

// ── 模式枚举 ─────────────────────────────────────────────────────────

export type GameMode = "classic" | "fun" | "custom" | "salary" | "era-cross" | "same-team" | "no-repeat" | "dream" | "battle";

// ── 通用游戏状态快照 ─────────────────────────────────────────────────

export interface GameStateSnapshot {
  mode: GameMode;
  round: number;
  maxRounds: number;
  slots: RosterSlots;
  roster: Player[];
  usedDecades: string[];
  usedCombos: string[];
  skipTeam: number;
  skipDecade: number;
  currentTeam: string | null;
  currentDecade: Decade | null;
  spun: boolean;
}

// ── 圆梦专属 ─────────────────────────────────────────────────────────

export interface DreamPlayer extends Player {
  cname: string;
  icon: string;
  diff: number;
  isDreamCaptain?: boolean;
}

// ── 双人对战前端状态 ─────────────────────────────────────────────────

export interface BattleFrontendState {
  roomCode: string | null;
  isHost: boolean;
  status: "waiting" | "picking" | "playing" | "finished" | null;
  opponentName: string;
  opponentProgress: number;
  opponentReady: boolean;
  myProgress: number;
  myReady: boolean;
  playoffGames: SingleGameResult[];
  hostWins: number;
  guestWins: number;
}
