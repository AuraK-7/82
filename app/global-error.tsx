"use client";

// ===================================================================
//  app/global-error.tsx — 全局错误兜底（Next.js App Router）
// ===================================================================
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="zh">
      <body
        style={{
          margin: 0,
          background: "#110427",
          color: "#ecf0f1",
          fontFamily: "Inter, -apple-system, sans-serif",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "20px",
          gap: "16px",
        }}
      >
        <div style={{ fontSize: "4rem" }}>🏀</div>
        <h1
          style={{
            fontSize: "1.5rem",
            color: "#f39c12",
            fontFamily: "Oswald, sans-serif",
          }}
        >
          82-0 完美赛季大挑战
        </h1>
        <p style={{ color: "#95a5a6", maxWidth: "400px", fontSize: "0.9rem" }}>
          页面加载遇到问题，请尝试刷新。
        </p>
        {error.digest && (
          <p
            style={{
              color: "#64748b",
              fontSize: "0.7rem",
              fontFamily: "monospace",
            }}
          >
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            background: "linear-gradient(135deg, #f39c12, #f1c40f)",
            color: "#1a1a2e",
            border: "none",
            borderRadius: "8px",
            padding: "12px 28px",
            fontFamily: "Oswald, sans-serif",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
            marginTop: "8px",
          }}
        >
          🔃 刷新页面
        </button>
      </body>
    </html>
  );
}
