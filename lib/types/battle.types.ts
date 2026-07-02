// ===================================================================
//  lib/types/battle.types.ts — 双人对战领域类型定义
// ===================================================================

import type { Player, PositionSlot } from "./game.types";

/** 房间状态 */
export type RoomStatus = "waiting" | "picking" | "playing" | "finished";

/** 跳过次数 */
export interface SkipCount {
  team: number;
  decade: number;
}

/** 单场比赛结果 */
export interface BattleGameResult {
  hostScore: number;
  guestScore: number;
  hostWin: boolean;
}

/** 季后赛状态 */
export interface PlayoffState {
  games: BattleGameResult[];
  hostWins: number;
  guestWins: number;
  hostRating: number;
  guestRating: number;
  done: boolean;
}

/** 阵容条目（存储在数据库中） */
export interface RosterEntry {
  slot: PositionSlot;
  name: string;
  pos: string;
  positions: string[];
  team: string;
  decade: string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  rating: number;
}

/** 房间数据 */
export interface BattleRoom {
  id: string;
  room_code: string;
  host_id: string;
  guest_id: string | null;
  status: RoomStatus;
  host_pick_progress: number;
  guest_pick_progress: number;
  host_ready: boolean;
  guest_ready: boolean;
  host_roster: RosterEntry[] | null;
  guest_roster: RosterEntry[] | null;
  host_skips: SkipCount;
  guest_skips: SkipCount;
  host_nickname: string;
  guest_nickname: string;
  playoff_state: PlayoffState | null;
  winner_id: string | null;
  created_at: string;
  updated_at: string;
}

/** 历史战绩 */
export interface BattleHistoryRecord {
  id: string;
  player_id: string;
  opponent_id: string | null;
  opponent_name: string | null;
  is_win: boolean;
  series_score: string;
  my_roster: RosterEntry[];
  opponent_roster: RosterEntry[] | null;
  game_details: BattleGameResult[] | null;
  room_code: string | null;
  created_at: string;
}

/** 玩家视角的对战结果 */
export interface PlayerPerspective {
  myWins: number;
  oppWins: number;
  iWon: boolean;
}

/** 选人阶段本地状态 */
export interface PickState {
  active: boolean;
  progress: number;
  skips: SkipCount;
  confirmed: boolean;
}

/** 房间本地状态 */
export interface RoomLocalState {
  roomCode: string | null;
  isHost: boolean;
  status: RoomStatus | null;
  opponentName: string;
  opponentId: string | null;
}
