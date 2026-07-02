// ===================================================================
//  lib/utils/clipboard.ts — 剪贴板工具
// ===================================================================

/**
 * 复制文本到剪贴板
 * 优先使用 Clipboard API，不支持时降级为 textarea 方案
 * @returns 是否复制成功
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // 优先使用现代 Clipboard API
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Clipboard API 失败，降级到 textarea 方案
  }

  // 降级方案：创建临时 textarea
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    return true;
  } catch {
    return false;
  }
}
