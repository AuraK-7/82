"use client";

// ===================================================================
//  hooks/useUserProfile.ts — 用户资料 Hook
// ===================================================================
import { useState, useCallback, useEffect } from "react";

// ── 类型 ────────────────────────────────────────────────────────────────

interface UserProfile {
  userId: string | null;
  nickname: string;
  avatarUrl: string | null;
  totalGames: number;
  totalWins: number;
  bestScore: number | null;
  loading: boolean;
  error: string | null;
}

const DEFAULT_NICKNAME = "匿名球迷";
const MAX_LENGTH = 12;

/**
 * 用户资料 Hook
 * - 首次加载：从服务端拉取完整 profile
 * - 无 userId 时：使用默认昵称（未登录状态）
 * - 修改昵称：通过 API PATCH 同步到服务端
 */
export function useUserProfile(userId: string | null) {
  const [profile, setProfile] = useState<UserProfile>({
    userId: null,
    nickname: DEFAULT_NICKNAME,
    avatarUrl: null,
    totalGames: 0,
    totalWins: 0,
    bestScore: null,
    loading: !!userId,
    error: null,
  });

  // 有 userId 时拉取服务端 profile
  useEffect(() => {
    if (!userId) {
      setProfile((p) => ({
        ...p,
        userId: null,
        nickname: DEFAULT_NICKNAME,
        loading: false,
        error: null,
      }));
      return;
    }

    let cancelled = false;

    async function fetchProfile() {
      try {
        const res = await fetch(`/api/profiles?user_id=${encodeURIComponent(userId!)}`);
        if (!res.ok) {
          if (!cancelled) setProfile((p) => ({ ...p, loading: false, error: `HTTP ${res.status}` }));
          return;
        }
        const json = await res.json();
        if (cancelled) return;

        if (json.success && json.data) {
          const d = json.data;
          setProfile({
            userId: d.user_id,
            nickname: d.nickname || DEFAULT_NICKNAME,
            avatarUrl: d.avatar_url || null,
            totalGames: d.total_games || 0,
            totalWins: d.total_wins || 0,
            bestScore: d.best_score ?? null,
            loading: false,
            error: null,
          });
        } else {
          setProfile((p) => ({ ...p, loading: false, error: json.error || "加载失败" }));
        }
      } catch (err) {
        if (!cancelled) {
          setProfile((p) => ({ ...p, loading: false, error: "网络错误" }));
        }
      }
    }

    fetchProfile();
    return () => { cancelled = true; };
  }, [userId]);

  // ── 修改昵称（通过服务端 API，JWT 鉴权）─────────────────────────────

  const setNickname = useCallback(
    async (name: string): Promise<boolean> => {
      const trimmed = name.trim();
      if (!trimmed || trimmed.length > MAX_LENGTH) return false;

      if (!userId) {
        // 未登录：仅本地更新
        setProfile((p) => ({ ...p, nickname: trimmed.slice(0, MAX_LENGTH) }));
        return true;
      }

      // 乐观更新
      const previous = profile.nickname;
      setProfile((p) => ({ ...p, nickname: trimmed.slice(0, MAX_LENGTH) }));

      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };

        // 获取 JWT token（匿名登录已生成 session）
        try {
          const { getSupabaseBrowser } = await import("@/lib/supabase/client");
          const sb = getSupabaseBrowser();
          const { data } = await sb.auth.getSession();
          if (data?.session?.access_token) {
            headers["Authorization"] = `Bearer ${data.session.access_token}`;
          }
        } catch { /* 获取 token 失败，服务端会返回 401 */ }

        const res = await fetch("/api/profiles", {
          method: "PATCH",
          headers,
          body: JSON.stringify({ nickname: trimmed }),
        });

        const json = await res.json();
        if (!json.success) {
          // 回滚
          setProfile((p) => ({ ...p, nickname: previous }));
          return false;
        }
        return true;
      } catch {
        // 网络失败保留乐观更新
        return true;
      }
    },
    [userId, profile.nickname]
  );

  // ── 重置昵称 ──────────────────────────────────────────────────────

  const resetNickname = useCallback(async () => {
    if (userId) {
      await setNickname(DEFAULT_NICKNAME);
    } else {
      setProfile((p) => ({ ...p, nickname: DEFAULT_NICKNAME }));
    }
  }, [userId, setNickname]);

  // ── 更新本地统计数据（对战结束后由外部调用）───────────────────────

  const incrementGameLocally = useCallback((isWin: boolean) => {
    setProfile((p) => ({
      ...p,
      totalGames: p.totalGames + 1,
      totalWins: isWin ? p.totalWins + 1 : p.totalWins,
    }));
  }, []);

  return {
    ...profile,
    setNickname,
    resetNickname,
    incrementGameLocally,
    MAX_LENGTH,
    isLoggedIn: !!userId,
  };
}
