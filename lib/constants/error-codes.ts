// ===================================================================
//  lib/constants/error-codes.ts — 全局统一错误码
// ===================================================================

export const ERROR = {
  // 通用
  UNKNOWN:         { code: "E000", message: "未知错误" },
  PARAM_INVALID:   { code: "E001", message: "参数错误" },
  UNAUTHORIZED:    { code: "E002", message: "请先登录" },
  FORBIDDEN:       { code: "E003", message: "权限不足" },
  NOT_FOUND:       { code: "E004", message: "资源不存在" },
  INTERNAL:        { code: "E005", message: "服务器内部错误" },
  // 业务
  STATE_INVALID:   { code: "E010", message: "状态不合法" },
  COOLDOWN_USER:   { code: "E011", message: "提交太频繁，请稍后再试" },
  COOLDOWN_ROSTER: { code: "E012", message: "相同阵容已提交" },
  COOLDOWN_NAME:   { code: "E013", message: "该昵称已提交" },
  ROOM_FULL:       { code: "E020", message: "房间已满员" },
  ROOM_NOT_FOUND:  { code: "E021", message: "房间不存在或已结束" },
  ROOM_NOT_HOST:   { code: "E022", message: "仅房主可执行此操作" },
  ROSTER_INVALID:  { code: "E030", message: "阵容数据不完整" },
  SIM_ALREADY_DONE:{ code: "E031", message: "系列赛已结束" },
} as const;

export type ErrorCode = keyof typeof ERROR;

export interface ErrorResult { code: string; message: string; }

export function err(key: ErrorCode, overrideMsg?: string): ErrorResult {
  const e = ERROR[key];
  return { code: e.code, message: overrideMsg || e.message };
}
