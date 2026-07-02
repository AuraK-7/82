"use client";

// ===================================================================
//  hooks/useAuth.ts — 认证 Hook
// ===================================================================
import { useState, useEffect, useCallback } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

interface AuthState {
  userId: string | null;
  email: string | null;
  isAnonymous: boolean;
  loading: boolean;
}

/**
 * 用户认证 Hook
 * 自动处理会话持久化、状态同步
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    userId: null,
    email: null,
    isAnonymous: true,
    loading: true,
  });

  const supabase = getSupabaseBrowser();

  // 初始化：获取当前会话
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        const user = data?.session?.user ?? null;
        setState({
          userId: user?.id ?? null,
          email: user?.email ?? null,
          isAnonymous: !user,
          loading: false,
        });
      } catch {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false }));
        }
      }
    }

    init();

    // 监听认证状态变化
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setState({
        userId: user?.id ?? null,
        email: user?.email ?? null,
        isAnonymous: !user,
        loading: false,
      });
    });

    return () => {
      cancelled = true;
      listener?.subscription.unsubscribe();
    };
  }, [supabase]);

  /** 匿名登录 */
  const signInAnonymously = useCallback(async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error("[Auth] Anonymous sign in failed:", error.message);
        return null;
      }
      return data?.user?.id ?? null;
    } catch (err) {
      console.error("[Auth] Anonymous sign in error:", err);
      return null;
    }
  }, [supabase]);

  /** 获取用户 ID（未登录时自动匿名登录） */
  const getUserId = useCallback(async (): Promise<string | null> => {
    if (state.userId) return state.userId;
    return await signInAnonymously();
  }, [state.userId, signInAnonymously]);

  return {
    ...state,
    signInAnonymously,
    getUserId,
    isLoggedIn: !!state.userId,
  };
}
