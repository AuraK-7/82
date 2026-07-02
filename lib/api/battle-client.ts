// ===================================================================
//  lib/api/battle-client.ts — 对战 API 客户端
// ===================================================================
import { apiRequest } from "./request";

const call = <T>(action: string, payload: Record<string, unknown> = {}) =>
  apiRequest<T>("/api/battle", { method: "POST", body: { action, payload }, retry: 0 });

export const battleClient = {
  createRoom: (nickname: string) => call("create", { nickname }),
  joinRoom: (roomCode: string, nickname: string) => call("join", { roomCode, nickname }),
  confirmRoster: (roomCode: string, roster: unknown[]) => call("confirmRoster", { roomCode, roster }),
  simulate: (roomCode: string, mode: "single" | "series" = "single") => call("simulate", { roomCode, mode }),
  getState: (roomCode: string) => call("getState", { roomCode }),
};

if (typeof window !== "undefined") {
  (window as unknown as Record<string, Record<string, unknown>>).BB82 = { ...((window as unknown as Record<string, Record<string, unknown>>).BB82 || {}), BattleApi: battleClient };
}
