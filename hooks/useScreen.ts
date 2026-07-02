"use client";

// ===================================================================
//  hooks/useScreen.ts — 屏幕切换管理 Hook
// ===================================================================
import { useState, useCallback, useEffect } from "react";

const SCREENS = ["screen-menu","screen-game","screen-custom","screen-result","screen-battle-lobby","screen-battle-play","screen-battle-result","screen-dream-select","screen-dream-result","screen-playoffs"] as const;
type ScreenId = (typeof SCREENS)[number];

let _current = "screen-menu" as ScreenId;
const _handlers: Set<(id: ScreenId, prev: ScreenId) => void> = new Set();

export function useScreen(initial?: ScreenId) {
  const [screen, setScreen] = useState<ScreenId>(initial || _current);

  const navigate = useCallback((id: ScreenId) => {
    const prev = _current; _current = id;
    setScreen(id);
    _handlers.forEach((h) => h(id, prev));
    // 同步到全局 showScreen（兼容 legacy）
    if (typeof window !== "undefined") {
      const w = window as unknown as Record<string, (id: string) => void>;
      if (w._origShowScreen) w._origShowScreen(id);
    }
  }, []);

  useEffect(() => {
    const h = (id: ScreenId) => setScreen(id);
    _handlers.add(h);
    return () => { _handlers.delete(h); };
  }, []);

  return { screen, navigate, isActive: (id: ScreenId) => screen === id };
}

/** 获取当前屏幕 ID（非 Hook 调用） */
export function getCurrentScreen(): ScreenId { return _current; }
