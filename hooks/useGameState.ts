"use client";

// ===================================================================
//  hooks/useGameState.ts — 状态机 React 适配层
// ===================================================================
import { useEffect, useState, useCallback, useRef } from "react";
import type { BaseGameState, GameEvent } from "@/lib/frontend";
import type { GameStateSnapshot } from "@/lib/frontend/types";

interface UseGameStateOptions { autoSync?: boolean; destroyOnUnmount?: boolean; }

/**
 * 状态机 React Hook
 * - 组件挂载时自动订阅状态事件
 * - 组件卸载时自动清理订阅 + 销毁状态机（防止内存泄漏）
 * - 提供 refresh() 强制重渲染
 */
export function useGameState<T extends BaseGameState>(state: T, opts: UseGameStateOptions = {}) {
  const [, force] = useState(0);
  const snapRef = useRef<GameStateSnapshot | null>(null);
  const rerender = useCallback(() => force((n) => n + 1), []);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    const events: GameEvent[] = [
      "state-change", "round-change", "roster-update", "skip-update",
      "spin-result", "pick-confirmed", "simulation-complete",
      "battle-game-result", "battle-series-over", "opponent-progress",
    ];

    for (const e of events) {
      unsubs.push(state.on(e, rerender));
    }

    if (opts.autoSync !== false) {
      snapRef.current = state.getSnapshot();
    }

    return () => {
      // 清理事件订阅
      for (const u of unsubs) {
        try { u(); } catch { /* ignore */ }
      }
      // 销毁状态机（默认行为，可通过 destroyOnUnmount: false 禁用）
      if (opts.destroyOnUnmount !== false) {
        try { state.destroy(); } catch { /* ignore */ }
      }
    };
  }, [state, rerender, opts.autoSync, opts.destroyOnUnmount]);

  return {
    state,
    snapshot: snapRef.current,
    refresh: rerender,
    getSnapshot: () => state.getSnapshot(),
  };
}
