// ===================================================================
//  lib/api/request.ts — 统一请求层
// ===================================================================
import { getSupabaseBrowser } from "@/lib/supabase/client";

interface ApiResponse<T = unknown> { success: boolean; data?: T; error?: string; }

let _toastHandler: ((msg: string, type?: "error" | "success" | "info") => void) | null = null;

/** 注册全局 Toast（由 UI 层注入） */
export function setToastHandler(fn: typeof _toastHandler) { _toastHandler = fn; }

function toast(msg: string, type: "error" | "success" | "info" = "error") {
  if (_toastHandler) _toastHandler(msg, type);
  else if (type === "error") console.error("[API]", msg);
}

/** 获取 CSRF token（由服务端注入到 window.__csrf_token__） */
function getCsrfToken(): string | null {
  try {
    return (window as unknown as Record<string, string>).__csrf_token__ || null;
  } catch { return null; }
}

async function getToken(): Promise<string | null> {
  try {
    const sb = getSupabaseBrowser();
    const { data } = await sb.auth.getSession();
    return data?.session?.access_token || null;
  } catch { return null; }
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  timeout?: number;
  retry?: number;
}

export async function apiRequest<T = unknown>(url: string, opts: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { method = "POST", body, timeout = 10000, retry = 0 } = opts;
  let lastError = "";

  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const token = await getToken();

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // 写入操作附加 CSRF token
      if (method === "POST") {
        const csrf = getCsrfToken();
        if (csrf) headers["X-CSRF-Token"] = csrf;
      }

      const res = await fetch(url, {
        method, headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const json: ApiResponse<T> = await res.json();
      if (!json.success && json.error) {
        lastError = json.error;
        if (attempt < retry) continue;
        toast(json.error);
      }
      return json;
    } catch (err: unknown) {
      lastError = err instanceof Error ? (err.name === "AbortError" ? "请求超时" : err.message) : "网络错误";
      if (attempt < retry) continue;
    }
  }
  toast(lastError);
  return { success: false, error: lastError };
}

/** 便捷 GET */
export function apiGet<T = unknown>(url: string, timeout?: number) {
  return apiRequest<T>(url, { method: "GET", timeout });
}

/** 便捷 POST */
export function apiPost<T = unknown>(url: string, body: Record<string, unknown>, timeout?: number) {
  return apiRequest<T>(url, { method: "POST", body, timeout });
}
