"use client";

// ===================================================================
//  components/ErrorBoundary.tsx — 全局错误边界
// ===================================================================
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error.message);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            background: "#110427",
            color: "#ecf0f1",
            fontFamily: "Inter, sans-serif",
            padding: "20px",
            textAlign: "center",
            gap: "16px",
          }}
        >
          <div style={{ fontSize: "4rem" }}>🏀</div>
          <h2 style={{ color: "#f39c12", fontFamily: "Oswald, sans-serif", fontSize: "1.5rem" }}>
            出了点问题
          </h2>
          <p style={{ color: "#95a5a6", fontSize: "0.9rem", maxWidth: "400px" }}>
            游戏加载过程中遇到了一个错误，请刷新页面重试。
          </p>
          {this.state.error && (
            <details style={{ color: "#95a5a6", fontSize: "0.75rem", maxWidth: "500px", textAlign: "left" }}>
              <summary>错误详情</summary>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: "8px" }}>
                {this.state.error.message}
              </pre>
            </details>
          )}
          <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
            <button
              onClick={this.handleRetry}
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
              }}
            >
              🔄 重试
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                border: "2px solid rgba(255,255,255,0.2)",
                borderRadius: "8px",
                padding: "12px 28px",
                fontFamily: "Oswald, sans-serif",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              🔃 刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
