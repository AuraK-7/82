// ===================================================================
//  lib/types/api.types.ts — API 层通用类型定义
// ===================================================================

// ── 通用响应 ─────────────────────────────────────────────────────────

/** 统一 API 响应格式 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── 对战域 ───────────────────────────────────────────────────────────

/** 对战 API 操作类型 */
export type BattleApiAction =
  | "create"
  | "join"
  | "confirmRoster"
  | "simulate"
  | "getState";

/** 对战 API 统一请求体 */
export interface BattleApiRequest {
  action: BattleApiAction;
  payload: Record<string, unknown>;
}

/** 创建房间请求 */
export interface CreateRoomPayload {
  hostId: string;
  hostNickname: string;
}

/** 加入房间请求 */
export interface JoinRoomPayload {
  roomCode: string;
  guestId: string;
  guestNickname: string;
}

/** 提交阵容请求 */
export interface ConfirmRosterPayload {
  roomCode: string;
  playerId: string;
  roster: import("./battle.types").RosterEntry[];
}

/** 模拟比赛请求 */
export interface SimulatePayload {
  roomCode: string;
  playerId: string; // 仅房主可调用
}

/** 查询房间状态请求 */
export interface GetStatePayload {
  roomCode: string;
}

// ── 排行榜域 ─────────────────────────────────────────────────────────

/** 排行榜查询维度 */
export type RecordsPeriod = "all" | "today" | "week";

/** 排行榜查询参数 */
export interface RecordsQueryParams {
  period: RecordsPeriod;
  limit: number;
}

/** 提交战绩请求 */
export interface SubmitRecordPayload {
  player_names: string[];
  decades: string[];
  teams: string[];
  wins: number;
  record: string; // "82-0"
  total_score: number;
  username: string;
  roster_hash: string;
  client_fingerprint?: string;
}

// ── 分页 ─────────────────────────────────────────────────────────────

/** 分页参数 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
