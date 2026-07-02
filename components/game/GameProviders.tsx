"use client";

// ===================================================================
//  components/game/GameProviders.tsx — 全局状态 Context
// ===================================================================
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";

// ── 屏幕管理 ────────────────────────────────────────────────────────────

export type ScreenId =
  | "screen-menu"
  | "screen-game"
  | "screen-custom"
  | "screen-result"
  | "screen-battle-lobby"
  | "screen-battle-play"
  | "screen-battle-result"
  | "screen-dream-select"
  | "screen-dream-result"
  | "screen-playoffs"
  | "screen-challenge-select"
  | "screen-leaderboard";

/** ScreenId ↔ URL slug 映射 */
const SCREEN_TO_URL: Record<ScreenId, string> = {
  "screen-menu": "menu",
  "screen-game": "classic",
  "screen-custom": "custom",
  "screen-result": "result",
  "screen-battle-lobby": "battle",
  "screen-battle-play": "battle-play",
  "screen-battle-result": "battle-result",
  "screen-dream-select": "dream",
  "screen-dream-result": "dream-result",
  "screen-playoffs": "challenge",
  "screen-challenge-select": "challenge-select",
  "screen-leaderboard": "leaderboard",
};

const URL_TO_SCREEN: Record<string, ScreenId> = {};
for (const [id, url] of Object.entries(SCREEN_TO_URL)) {
  URL_TO_SCREEN[url] = id as ScreenId;
}

/** URL slug → ScreenId */
export function urlToScreen(slug: string): ScreenId | null {
  return URL_TO_SCREEN[slug] || null;
}

/** ScreenId → URL slug */
export function screenToUrl(id: ScreenId): string {
  return SCREEN_TO_URL[id] || "menu";
}

// ── Context 类型 ─────────────────────────────────────────────────────────

interface GameContextValue {
  currentScreen: ScreenId;
  setCurrentScreen: (id: ScreenId) => void;
  /** 导航到指定屏幕 + 可选额外 URL 参数（如房间号） */
  navigate: (id: ScreenId, extraParams?: Record<string, string>) => void;
  /** 当前 URL 中的额外参数 */
  urlParams: Record<string, string>;
  userId: string | null;
  setUserId: (id: string | null) => void;
  isLoggedIn: boolean;
  loading: boolean;
  nickname: string;
  setNickname: (name: string) => Promise<boolean>;
  resetNickname: () => void;
  nicknameMaxLength: number;
  getUserIdAsync: () => Promise<string | null>;
}

const GameContext = createContext<GameContextValue>({
  currentScreen: "screen-menu",
  setCurrentScreen: () => {},
  navigate: () => {},
  urlParams: {},
  userId: null,
  setUserId: () => {},
  isLoggedIn: false,
  loading: true,
  nickname: "匿名球迷",
  setNickname: async () => false,
  resetNickname: () => {},
  nicknameMaxLength: 12,
  getUserIdAsync: async () => null,
});

export function useGameContext() {
  return useContext(GameContext);
}

// ── Provider ─────────────────────────────────────────────────────────────

export function GameProviders({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();

  // 从 URL 读取当前屏幕 slug
  const urlScreenSlug = searchParams.get("screen");
  const screenFromUrl: ScreenId = urlScreenSlug
    ? (URL_TO_SCREEN[urlScreenSlug] || "screen-menu")
    : "screen-menu";

  const [screen, setScreen] = useState<ScreenId>(screenFromUrl);
  const [uid, setUid] = useState<string | null>(null);

  // 认证 + 用户资料
  const auth = useAuth();
  const userProfile = useUserProfile(auth.userId);
  const { nickname, setNickname, resetNickname, MAX_LENGTH } = userProfile;

  // 同步 auth userId 到 Context
  const currentUserId = uid || auth.userId;

  // 🔑 同步外部 URL 变化（浏览器前进/后退、直接输入 URL）到 state
  useEffect(() => {
    if (screenFromUrl !== screen) {
      setScreen(screenFromUrl);
    }
  }, [screenFromUrl]); // 注意：screen 不在 deps 中，防止循环

  // 首次访问自动匿名登录（无缝衔接）
  useEffect(() => {
    if (!auth.loading && !currentUserId) {
      auth.signInAnonymously().then((id) => {
        if (id) setUid(id);
      });
    }
  }, [auth.loading, currentUserId, auth.signInAnonymously]);

  // ── 导航（纯客户端：只更新 state + 浏览器 URL，不触发 RSC 请求）───

  const navigate = useCallback(
    (id: ScreenId, extraParams?: Record<string, string>) => {
      setScreen(id);
      const params = new URLSearchParams();
      params.set("screen", SCREEN_TO_URL[id] || "menu");
      if (extraParams) {
        for (const [k, v] of Object.entries(extraParams)) {
          if (v) params.set(k, v);
        }
      }
      // 用 replaceState 静默更新 URL，不触发 router 导航 / RSC 请求
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", "/?" + params.toString());
      }
    },
    []
  );

  // setCurrentScreen 包装
  const changeScreen = useCallback(
    (id: ScreenId) => {
      navigate(id);
    },
    [navigate]
  );

  // ── URL 额外参数 ──────────────────────────────────────────────────

  const urlParams: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (key !== "screen") urlParams[key] = value;
  });

  /** 获取用户 ID（未登录时自动匿名登录） */
  const getUserIdAsync = useCallback(async (): Promise<string | null> => {
    if (currentUserId) return currentUserId;
    const id = await auth.signInAnonymously();
    if (id) setUid(id);
    return id;
  }, [currentUserId, auth]);

  const ctx: GameContextValue = {
    currentScreen: screen,
    setCurrentScreen: changeScreen,
    navigate,
    urlParams,
    userId: currentUserId,
    setUserId: setUid,
    isLoggedIn: auth.isLoggedIn,
    loading: auth.loading,
    nickname,
    setNickname,
    resetNickname,
    nicknameMaxLength: MAX_LENGTH,
    getUserIdAsync,
  };

  return (
    <ToastProvider>
      <GameContext.Provider value={ctx}>{children}</GameContext.Provider>
    </ToastProvider>
  );
}

// Re-export useToast for convenience
export { useToast } from "@/components/ui/Toast";
