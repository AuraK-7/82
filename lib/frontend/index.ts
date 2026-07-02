// ===================================================================
//  lib/frontend/index.ts — 前端业务状态层统一导出
// ===================================================================

// 基础模块
export { RosterManager } from "./roster-manager";
export { SlotMachine } from "./slot-machine";
export type { PlayerDataSource } from "./slot-machine";

// 状态机
export { BaseGameState } from "./states/base-game-state";
export { ClassicState } from "./states/classic.state";
export { CustomState } from "./states/custom.state";
export { DreamState } from "./states/dream.state";
export { BattleState } from "./states/battle.state";
export { ChallengeState } from "./states/challenge.state";
export type { ChallengeType } from "./states/challenge.state";

// 类型
export type {
  GameEvent, EventCallback, SlotMachineState, RosterManagerState, GameMode, GameStateSnapshot, DreamPlayer, BattleFrontendState,
} from "./types";
