"use client";

// ===================================================================
//  components/menu/MainMenu.tsx — 主菜单组件
// ===================================================================
import { useState } from "react";
import { useGameContext } from "@/components/game/GameProviders";

export function MainMenu() {
  const { setCurrentScreen } = useGameContext();
  const [showHowto, setShowHowto] = useState(false);

  return (
    <div id="screen-menu" className="screen active">
      <header className="header">
        <img className="header-img" src="/header-logo.png" alt="82-0 完美赛季" />
      </header>
      <div className="menu-content">
        <div className="tagline">
          随机球队、随机年代、五次机会<br />
          挑选出五名球员组成阵容<br />
          谁能创造出82-0的完美阵容？
        </div>

        <div className="menu-buttons">
          <button
            className="btn btn-primary"
            onClick={() => setCurrentScreen("screen-game")}
            style={{ width: "100%", maxWidth: 280, justifyContent: "center" }}
          >
            ▶{"  "} 开始游戏
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setCurrentScreen("screen-custom")}
            style={{ width: "100%", maxWidth: 280, justifyContent: "center", borderColor: "var(--accent)", color: "var(--accent-light)" }}
          >
            💪 自选娱乐
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setCurrentScreen("screen-battle-lobby")}
            style={{ width: "100%", maxWidth: 280, justifyContent: "center", borderColor: "var(--danger)", color: "var(--danger)" }}
          >
            🏆 双人对战
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setCurrentScreen("screen-leaderboard")}
            style={{ width: "100%", maxWidth: 280, justifyContent: "center", borderColor: "var(--gold)", color: "var(--gold-light)" }}
          >
            🏆 排行榜
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setCurrentScreen("screen-dream-select")}
            style={{ width: "100%", maxWidth: 280, justifyContent: "center" }}
          >
            🌟 圆梦模式
          </button>
        </div>

        <div className="mode-cards">
          <span className="mode-btn challenge" onClick={() => setCurrentScreen("screen-challenge-select")}>
            🏆 挑战模式
          </span>
          <span className="mode-btn salary" onClick={() => setShowHowto(true)}>
            📖 玩法说明
          </span>
        </div>
      </div>

      {/* ── 玩法说明弹窗 ────────────────────────────────────── */}
      {showHowto && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowHowto(false)}>
          <div style={{ background: "rgba(22,33,62,0.98)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: "24px 20px", maxWidth: 380, width: "90%", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 12px 48px rgba(0,0,0,0.6)", backdropFilter: "blur(10px)" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowHowto(false)} style={{ position: "absolute", top: 12, right: 14, width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.08)", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            <h3 style={{ fontFamily: "'Oswald',sans-serif", color: "var(--gold-light)", fontSize: "1.2rem", margin: "0 0 12px" }}>📖 玩法说明</h3>
            <div style={{ fontSize: "0.8rem", lineHeight: 1.7, color: "var(--text-light)" }}>
              <p style={{ margin: "0 0 10px" }}><strong style={{ color: "var(--gold)" }}>经典随机：</strong>老虎机随机分配球队和年代，从 20 名球员中挑选 5 人组成阵容，模拟 82 场常规赛。</p>
              <p style={{ margin: "0 0 10px" }}><strong style={{ color: "var(--accent-light)" }}>自选娱乐：</strong>自由选择球队和年代，按评分排序浏览所有球员，手动组建 5 人阵容。</p>
              <p style={{ margin: "0 0 10px" }}><strong style={{ color: "var(--gold)" }}>圆梦模式：</strong>选择一位未曾夺冠的球星，带他组建阵容并冲击季后赛，帮 TA 圆冠军梦！</p>
              <p style={{ margin: "0 0 10px" }}><strong style={{ color: "var(--danger)" }}>双人对战：</strong>创建房间邀请好友，各自组建阵容进行 BO7 系列赛对决。</p>
              <p style={{ margin: "0 0 10px" }}><strong style={{ color: "var(--gold-light)" }}>挑战模式：</strong>工资帽限制 / 年代穿越答题 / 同队传奇 / 国际阵容不重复球队，4 种特殊规则挑战。</p>
              <p style={{ margin: 0 }}>每个位置选择 1 名球员（PG/SG/SF/PF/C），阵容评分为 5 人几何平均 ×1.1，82 场战绩 = 82 × (评分/110)^2.2。</p>
            </div>
            <button onClick={() => setShowHowto(false)} style={{ display: "block", margin: "16px auto 0", padding: "8px 24px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>知道了</button>
          </div>
        </div>
      )}

      {/* ── 挑战模式子菜单 ────────────────────────────────────── */}
      <ChallengeSubMenu />
    </div>
  );
}

// ── 挑战模式子菜单 ──────────────────────────────────────────────
function ChallengeSubMenu() {
  const { currentScreen, setCurrentScreen } = useGameContext();
  if (currentScreen !== "screen-challenge-select") return null;

  const modes = [
    { key: "salary", label: "💰 工资帽挑战", desc: "总薪资不超过 $100M，精打细算组阵容" },
    { key: "era-cross", label: "🏆 年代穿越", desc: "每个位置绑定一个年代，从选项中找球员" },
    { key: "same-team", label: "🦾 同队传奇", desc: "锁定一支球队，找到该队传奇球员" },
    { key: "no-repeat", label: "🌍 国际阵容", desc: "5 个位置不能选重复球队的球员" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1050, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={() => setCurrentScreen("screen-menu")}>
      <div style={{ background: "rgba(22,33,62,0.98)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: "24px 20px", maxWidth: 340, width: "90%", boxShadow: "0 12px 48px rgba(0,0,0,0.6)", backdropFilter: "blur(10px)" }}
        onClick={e => e.stopPropagation()}>
        <button onClick={() => setCurrentScreen("screen-menu")}
          style={{ position: "absolute", top: 12, right: 14, width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.08)", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        <h3 style={{ fontFamily: "'Oswald',sans-serif", color: "var(--gold-light)", fontSize: "1.2rem", margin: "0 0 16px" }}>🏆 挑战模式</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {modes.map(m => (
            <button key={m.key}
              onClick={() => { setCurrentScreen("screen-playoffs"); }}
              style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", cursor: "pointer", textAlign: "left", fontSize: "0.82rem", fontWeight: 600, transition: "all 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(243,156,18,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            >
              <div>{m.label}</div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 400, marginTop: 2 }}>{m.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
