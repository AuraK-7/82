"use client";

// ===================================================================
//  components/ui/Toast.tsx — Toast 通知组件
// ===================================================================
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// ── 类型 ────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  removing: boolean;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

// ── Context ─────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({
  show: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
});

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

// ── 配置 ────────────────────────────────────────────────────────────────

const TOAST_DURATION = 3000; // 自动消失时长 ms
const TOAST_MAX = 5; // 最大堆叠数

// ── 组件 ────────────────────────────────────────────────────────────────

let _nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    // 先加 removing 类触发退出动画
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, removing: true } : t))
    );
    // 动画结束后移除
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const show = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = ++_nextId;
      const toast: ToastItem = { id, message, type, removing: false };

      setToasts((prev) => {
        const next = [...prev, toast];
        // 超过最大数则移除最旧的
        if (next.length > TOAST_MAX) {
          const oldest = next[0];
          oldest.removing = true;
          setTimeout(() => remove(oldest.id), 300);
        }
        return next;
      });

      // 自动消失
      if (TOAST_DURATION > 0) {
        setTimeout(() => remove(id), TOAST_DURATION);
      }
    },
    [remove]
  );

  const contextValue: ToastContextValue = {
    show,
    success: useCallback((msg: string) => show(msg, "success"), [show]),
    error: useCallback((msg: string) => show(msg, "error"), [show]),
    info: useCallback((msg: string) => show(msg, "info"), [show]),
  };

  const typeStyles: Record<ToastType, { bg: string; border: string; icon: string }> = {
    success: {
      bg: "rgba(39,174,96,0.15)",
      border: "rgba(39,174,96,0.4)",
      icon: "✅",
    },
    error: {
      bg: "rgba(231,76,60,0.15)",
      border: "rgba(231,76,60,0.4)",
      icon: "❌",
    },
    info: {
      bg: "rgba(52,152,219,0.15)",
      border: "rgba(52,152,219,0.4)",
      icon: "ℹ️",
    },
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast 容器 */}
      <div
        style={{
          position: "fixed",
          top: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => {
          const s = typeStyles[t.type];
          return (
            <div
              key={t.id}
              onClick={() => remove(t.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                borderRadius: "10px",
                background: s.bg,
                border: `1px solid ${s.border}`,
                color: "#fff",
                fontSize: "0.85rem",
                fontWeight: 500,
                pointerEvents: "auto",
                cursor: "pointer",
                whiteSpace: "nowrap",
                maxWidth: "80vw",
                overflow: "hidden",
                textOverflow: "ellipsis",
                backdropFilter: "blur(8px)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                opacity: t.removing ? 0 : 1,
                transform: t.removing
                  ? "translateY(-10px) scale(0.95)"
                  : "translateY(0) scale(1)",
                transition: "all 0.3s ease",
              }}
            >
              <span style={{ fontSize: "1rem" }}>{s.icon}</span>
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
