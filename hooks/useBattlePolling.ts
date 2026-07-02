"use client";

// ===================================================================
//  hooks/useBattlePolling.ts — 对战实时轮询
// ===================================================================
import { useEffect, useRef, useCallback } from "react";

interface RoomState {
  status: string | null;
  guestId: string | null;
  hostReady: boolean;
  guestReady: boolean;
  hostProgress: number;
  guestProgress: number;
  winnerId: string | null;
  playoffState?: {
    games: Array<{ hostScore: number; guestScore: number; hostWin: boolean }>;
    hostWins: number;
    guestWins: number;
    done: boolean;
  } | null;
}

interface UseBattlePollingOptions {
  roomCode: string;
  userId: string | null;
  isHost: boolean;
  /** 轮询间隔（毫秒），默认 3000 */
  interval?: number;
  /** 是否启用轮询 */
  enabled?: boolean;
  /** 状态变更回调 */
  onStateChange?: (state: RoomState) => void;
  /** 对手加入回调 */
  onOpponentJoined?: () => void;
  /** 对战就绪回调 */
  onBothReady?: () => void;
  /** 游戏结束回调 */
  onGameOver?: (winnerId: string) => void;
}

/**
 * 对战实时轮询 Hook
 * - 客户端低频轮询 /api/battle?action=getState
 * - 检测对手加入 → 自动触发回调
 * - 双方就绪 → 自动开始对战
 */
export function useBattlePolling({
  roomCode,
  userId,
  isHost,
  interval = 3000,
  enabled = true,
  onStateChange,
  onOpponentJoined,
  onBothReady,
  onGameOver,
}: UseBattlePollingOptions) {
  const prevGuestRef = useRef<string | null>(null);
  const prevBothReadyRef = useRef(false);
  const prevDoneRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    if (!roomCode || !userId) return;

    try {
      const res = await fetch("/api/battle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(typeof window !== "undefined"
            ? { "X-CSRF-Token": (window as unknown as Record<string, string>).__csrf_token__ || "" }
            : {}),
        },
        body: JSON.stringify({
          action: "getState",
          payload: { roomCode },
        }),
      });

      if (!res.ok) return;
      const json = await res.json();
      if (!json.success || !json.data) return;

      const room = json.data;
      const state: RoomState = {
        status: room.status || null,
        guestId: room.guest_id || null,
        hostReady: room.host_ready || false,
        guestReady: room.guest_ready || false,
        hostProgress: room.host_pick_progress || 0,
        guestProgress: room.guest_pick_progress || 0,
        winnerId: room.winner_id || null,
        playoffState: room.playoff_state || null,
      };

      onStateChange?.(state);

      // 检测对手加入
      if (state.guestId && prevGuestRef.current !== state.guestId) {
        prevGuestRef.current = state.guestId;
        onOpponentJoined?.();
      }

      // 检测双方就绪
      if (state.hostReady && state.guestReady && !prevBothReadyRef.current) {
        prevBothReadyRef.current = true;
        onBothReady?.();
      }

      // 检测游戏结束
      if (state.playoffState?.done && !prevDoneRef.current) {
        prevDoneRef.current = true;
        if (state.winnerId) onGameOver?.(state.winnerId);
      }
    } catch {
      // 轮询失败静默处理，下次重试
    }
  }, [roomCode, userId, onStateChange, onOpponentJoined, onBothReady, onGameOver]);

  useEffect(() => {
    if (!enabled || !roomCode) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }

    // 首次立即轮询
    poll();

    // 定时轮询
    timerRef.current = setInterval(poll, interval);

    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [enabled, roomCode, interval, poll]);

  /** 手动触发一次轮询 */
  const refresh = useCallback(() => {
    poll();
  }, [poll]);

  return { refresh };
}
