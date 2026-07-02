"use client";

// ===================================================================
//  hooks/useNickname.ts — 昵称管理 Hook
// ===================================================================
import { useState, useCallback, useEffect } from "react";
import { storageGet, storageSet } from "@/lib/utils/storage";

const NICKNAME_KEY = "nickname";
const DEFAULT_NICKNAME = "匿名球迷";
const MAX_LENGTH = 12;

/**
 * 昵称管理 Hook
 * 存储方案：localStorage (bb82_nickname)
 * 默认值：匿名球迷
 * 校验：最长 12 字符，过滤空白
 */
export function useNickname() {
  const [nickname, setNicknameState] = useState<string>(DEFAULT_NICKNAME);

  // 初始化：从 localStorage 读取
  useEffect(() => {
    const saved = storageGet<string>(NICKNAME_KEY);
    if (saved && saved.trim()) {
      setNicknameState(saved.trim().slice(0, MAX_LENGTH));
    }
  }, []);

  /** 设置昵称（自动持久化 + 校验） */
  const setNickname = useCallback((name: string): boolean => {
    const trimmed = name.trim();
    if (!trimmed) return false;

    const valid = trimmed.slice(0, MAX_LENGTH);
    const ok = storageSet(NICKNAME_KEY, valid);
    if (ok) {
      setNicknameState(valid);
    }
    return ok;
  }, []);

  /** 重置为默认昵称 */
  const resetNickname = useCallback(() => {
    storageSet(NICKNAME_KEY, DEFAULT_NICKNAME);
    setNicknameState(DEFAULT_NICKNAME);
  }, []);

  return {
    nickname,
    setNickname,
    resetNickname,
    MAX_LENGTH,
  };
}
