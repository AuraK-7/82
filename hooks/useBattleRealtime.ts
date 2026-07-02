"use client";

// ===================================================================
//  hooks/useBattleRealtime.ts — 对战实时通信（Supabase Realtime）
// ===================================================================
import { useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// Realtime 订阅的 Supabase 客户端（单例）
let _realtimeClient: ReturnType<typeof createClient> | null = null;

function getRealtimeClient() {
  if (!_realtimeClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      console.warn("[Realtime] Supabase 未配置，降级为轮询模式");
      return null;
    }
    _realtimeClient = createClient(url, key, {
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    });
  }
  return _realtimeClient;
}

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

interface UseBattleRealtimeOptions {
  roomCode: string;
  isHost: boolean;
  enabled?: boolean;
  onStateChange?: (state: RoomState) => void;
  onOpponentJoined?: () => void;
  onBothReady?: () => void;
  onGameOver?: (winnerId: string) => void;
}

/**
 * Supabase Realtime 对战同步 Hook
 * - WebSocket 订阅 battle_rooms 表的 UPDATE 事件
 * - 对手加入/准备/游戏结束 → 即时推送
 * - 连接失败自动降级为 5 秒轮询
 */
export function useBattleRealtime({
  roomCode,
  isHost,
  enabled = true,
  onStateChange,
  onOpponentJoined,
  onBothReady,
  onGameOver,
}: UseBattleRealtimeOptions) {
  const prevGuestRef = useRef<string | null>(null);
  const prevBothReadyRef = useRef(false);
  const prevDoneRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Supabase Realtime 订阅 ─────────────────────────────────────────

  useEffect(() => {
    if (!enabled || !roomCode) return;

    const client = getRealtimeClient();
    if (!client) {
      // 降级为轮询
      startPolling(roomCode);
      return;
    }

    const channel = client
      .channel(`battle-${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "battle_rooms",
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          const room = payload.new as Record<string, unknown>;
          if (!room) return;

          const state: RoomState = {
            status: (room.status as string) || null,
            guestId: (room.guest_id as string) || null,
            hostReady: (room.host_ready as boolean) || false,
            guestReady: (room.guest_ready as boolean) || false,
            hostProgress: (room.host_pick_progress as number) || 0,
            guestProgress: (room.guest_pick_progress as number) || 0,
            winnerId: (room.winner_id as string) || null,
            playoffState: room.playoff_state as RoomState["playoffState"] || null,
          };

          onStateChange?.(state);

          if (state.guestId && prevGuestRef.current !== state.guestId) {
            prevGuestRef.current = state.guestId;
            onOpponentJoined?.();
          }

          if (state.hostReady && state.guestReady && !prevBothReadyRef.current) {
            prevBothReadyRef.current = true;
            onBothReady?.();
          }

          if (state.playoffState?.done && !prevDoneRef.current) {
            prevDoneRef.current = true;
            if (state.winnerId) onGameOver?.(state.winnerId);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`[Realtime] 已订阅房间 ${roomCode}`);
        }
        if (status === "CHANNEL_ERROR") {
          console.warn("[Realtime] 订阅失败，降级为轮询");
          startPolling(roomCode);
        }
      });

    return () => {
      client.removeChannel(channel);
      stopPolling();
    };
  }, [enabled, roomCode]);

  // ── 轮询降级 ──────────────────────────────────────────────────────

  function startPolling(code: string) {
    stopPolling();
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/battle", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(typeof window !== "undefined" && (window as unknown as Record<string, string>).__csrf_token__
              ? { "X-CSRF-Token": (window as unknown as Record<string, string>).__csrf_token__ }
              : {}),
          },
          body: JSON.stringify({ action: "getState", payload: { roomCode: code } }),
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

        if (state.guestId && prevGuestRef.current !== state.guestId) {
          prevGuestRef.current = state.guestId;
          onOpponentJoined?.();
        }
        if (state.hostReady && state.guestReady && !prevBothReadyRef.current) {
          prevBothReadyRef.current = true;
          onBothReady?.();
        }
        if (state.playoffState?.done && !prevDoneRef.current) {
          prevDoneRef.current = true;
          if (state.winnerId) onGameOver?.(state.winnerId);
        }
      } catch { /* ignore */ }
    }, 5000);
  }

  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  const refresh = useCallback(() => {
    // Realtime 模式无需手动刷新
  }, []);

  return { refresh };
}
