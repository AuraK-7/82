// ===================================================================
//  lib/utils/share.ts — 分享能力
// ===================================================================
import { copyToClipboard } from "./clipboard";

interface SharePayload {
  title?: string;
  text?: string;
  url?: string;
  wins?: number;
  record?: string;
  shareCode?: string;
  username?: string;
}

/**
 * 分享记录
 * 优先调用 navigator.share（移动端），不支持时降级为复制链接
 * @returns 分享是否成功
 */
export async function shareRecord(payload: SharePayload): Promise<boolean> {
  const title = payload.title || "82-0完美赛季大挑战";
  const text =
    payload.text ||
    `${payload.username || "匿名球迷"} 创造了 ${payload.record || "82-0"} 的完美阵容！`;
  const url =
    payload.url ||
    (payload.shareCode
      ? `${location.origin}?share=${payload.shareCode}`
      : location.href);

  // 优先使用 Web Share API
  if (navigator.share && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch (err) {
      // 用户取消分享不算错误，但尝试降级
      if ((err as Error)?.name === "AbortError") return false;
    }
  }

  // 降级：复制链接
  const shareUrl = url;
  const success = await copyToClipboard(shareUrl);
  return success;
}

/**
 * 生成分享链接
 */
export function buildShareUrl(shareCode: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}?share=${shareCode}`;
}
