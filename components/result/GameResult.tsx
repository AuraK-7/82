"use client";

// ===================================================================
//  components/result/GameResult.tsx — 常规赛结算页
// ===================================================================
import { useState, useEffect, useRef } from "react";
import { GamePoster, type PosterPlayer } from "@/components/poster/GamePoster";
import { getTeamColors, teamCN, getRosterHash } from "@/lib/game-core";
import type { Position, RosterSlots, Player } from "@/lib/game-core";
import { apiPost } from "@/lib/api/request";
import { useGameContext } from "@/components/game/GameProviders";

type SubmitStatus = "idle" | "uploading" | "success" | "error";

const RETRY_KEY = "bb82_retry_queue";

function queueForRetry(payload: unknown) {
  try {
    const q = JSON.parse(localStorage.getItem(RETRY_KEY) || "[]");
    q.push(payload);
    localStorage.setItem(RETRY_KEY, JSON.stringify(q.slice(-10))); // 最多保留 10 条
  } catch { /* ignore */ }
}

async function flushRetryQueue() {
  try {
    const raw = localStorage.getItem(RETRY_KEY);
    if (!raw) return;
    const q = JSON.parse(raw);
    if (!q.length) return;
    localStorage.removeItem(RETRY_KEY);
    for (const p of q) {
      try { await apiPost("/api/records", p, 15000); } catch { /* 继续重试下一条 */ }
    }
  } catch { /* ignore */ }
}

interface ResultProps {
  wins: number;
  grade: string;
  tier: string;
  color: string;
  teamOvr: number;
  /** 阵容槽位（显示在结算页，key=位置 value=球员） */
  roster?: RosterSlots;
  /** 游戏模式（用于上传战绩） */
  gameMode?: "classic" | "custom" | "dream" | "battle";
  /** 圆梦球星名（仅 dream 模式，用于按球星排行） */
  dreamPlayerName?: string;
  onBackToMenu: () => void;
  onPlayAgain: () => void;
  onLeaderboard: () => void;
  /** 海报球员数据（可选，有数据时显示生成海报按钮） */
  posterPlayers?: PosterPlayer[];
  /** 额外操作按钮（如季后赛入口） */
  extraActions?: React.ReactNode;
}

function buildSubmitPayload(roster: RosterSlots, wins: number, teamOvr: number, gameMode: string, nickname: string, dreamPlayerName?: string) {
  const entries = Object.entries(roster).filter(([, p]) => p) as [string, Player][];
  const playerNames = entries.map(([, p]) => p.name);
  const decades = entries.map(([, p]) => p.decade);
  const teams = entries.map(([, p]) => p.team);
  const record = `${wins}-${82 - wins}`;
  const rosterHash = getRosterHash(roster);
  const meta: Record<string, string> = {};
  if (dreamPlayerName) meta.dream_player = dreamPlayerName;
  return {
    player_names: playerNames, decades, teams, wins, record,
    total_score: Math.round(teamOvr * 10) / 10,
    username: nickname,
    roster_hash: rosterHash,
    game_mode: gameMode,
    metadata: Object.keys(meta).length > 0 ? meta : undefined,
  };
}

export function GameResult({
  wins, grade, tier, color, teamOvr,
  roster, gameMode, dreamPlayerName, onBackToMenu, onPlayAgain, onLeaderboard,
  posterPlayers, extraActions,
}: ResultProps) {
  const losses = 82 - wins;
  const isPerfect = wins >= 80;
  const [showPoster, setShowPoster] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState("");
  const { nickname } = useGameContext();

  // 有实际阵容数据 + 有模式时才上传（防止空对象触发）
  const skipSubmit = !roster || !gameMode || !Object.values(roster).some(Boolean);

  // ── 自动上传 ──────────────────────────────────────────────────────
  const uploadingRef = useRef(false);

  useEffect(() => {
    if (skipSubmit || uploadingRef.current) return;
    uploadingRef.current = true;
    setSubmitStatus("uploading");

    const payload = buildSubmitPayload(roster!, wins, teamOvr, gameMode || "classic", nickname, dreamPlayerName);

    apiPost("/api/records", payload as unknown as Record<string, unknown>, 15000)
      .then((res) => {
        if (res.success) { setSubmitStatus("success"); return; }
        // 失败 → 入离线队列
        setSubmitStatus("error");
        setSubmitError(res.error || "上传失败，稍后自动重试");
        queueForRetry(payload);
      })
      .catch(() => {
        setSubmitStatus("error");
        setSubmitError("网络错误，稍后自动重试");
        queueForRetry(payload);
      });
  }, [skipSubmit, wins, teamOvr, gameMode, nickname]); // eslint-disable-line react-hooks/exhaustive-deps

  // 组件挂载时重试离线队列
  useEffect(() => { flushRetryQueue(); }, []);

  const record = `${wins}-${losses}`;

  const renderRosterSlot = (pos: Position, idx: number) => {
    const p = roster?.[pos];
    if (!p) return <div key={idx} className="pos-slot" style={{ background: "rgba(255,255,255,0.06)", border: "1px dashed rgba(255,255,255,0.15)", cursor: "default" }}><span className="pos-label">{pos}</span></div>;
    const [primary, secondary] = getTeamColors(p.team);
    return (
      <div key={idx} className="pos-slot filled" style={{
        background: `linear-gradient(135deg, ${primary}, ${secondary})`,
        borderColor: primary, boxShadow: `0 0 12px ${primary}66`,
      }}>
        <span className="slot-player-name">{p.name.split("-").pop()}</span>
        <span className="slot-team-decade">{teamCN(p.team)} · {p.decade}</span>
      </div>
    );
  };

  return (
    <>
      {showPoster && posterPlayers && posterPlayers.length === 5 && (
        <GamePoster
          players={posterPlayers}
          record={record}
          grade={grade}
          tier={tier}
          onClose={() => setShowPoster(false)}
        />
      )}

      <div className="sim-results">
          <button className="back-nav" onClick={onBackToMenu} style={{ position: "absolute", top: 12, left: 12, zIndex: 10 }} title="返回主菜单">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 2, color: "var(--text-muted)", marginBottom: 4 }}>
              预测战绩
            </p>
            <p className="final-record" id="finalRecord" style={{ fontSize: "clamp(3.5rem,10vw,5.5rem)" }}>
              {wins}-{losses}
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8 }}>
              <span id="resultGrade" style={{ fontSize: "1.8rem", fontWeight: 900, color }}>{grade}</span>
              <span id="resultTier" style={{ fontSize: "0.95rem", fontWeight: 700, color, textTransform: "uppercase" }}>{tier}</span>
            </div>
            {teamOvr > 0 && (
              <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 4 }}>
                阵容评分：{teamOvr}
              </p>
            )}
          </div>

          {roster && Object.values(roster).some(Boolean) && (
            <div className="roster-final" style={{ marginTop: 24 }}>
              <div className="roster-bar" style={{ marginTop: 0 }}>
                <div className="pos-slots">
                  <div className="pos-slots-row">
                    {(["PG","SG","SF"] as Position[]).map((pos, i) => renderRosterSlot(pos, i))}
                  </div>
                  <div className="pos-slots-row">
                    {(["C","PF"] as Position[]).map((pos, i) => renderRosterSlot(pos, i + 3))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="history-section" id="historySection" style={{ display: "none" }}>
            <h4>📜 历史战绩</h4>
            <div id="historyList" />
          </div>

          <div className="result-actions">
            {/* 自动上传提示 */}
            {!skipSubmit && (
              <div className="uploaded-hint" style={{
                textAlign: "center", fontSize: "0.75rem", marginBottom: 4,
                color: submitStatus === "success" ? "var(--success)" :
                       submitStatus === "error" ? "var(--danger)" : "var(--text-muted)",
              }}>
                {submitStatus === "uploading" && "⏳ 上传中..."}
                {submitStatus === "success" && "✅ 战绩已上传"}
                {submitStatus === "error" && `❌ ${submitError || "上传失败"}`}
              </div>
            )}
            <button className="btn btn-gold" onClick={onLeaderboard} style={{ width: 220, justifyContent: "center" }}>
              📊 查看排行
            </button>
            <button className="btn btn-secondary" onClick={onPlayAgain} style={{ width: 220, justifyContent: "center", borderColor: "var(--success)", color: "var(--success)" }}>
              🔄 再来一局
            </button>
            {posterPlayers && posterPlayers.length === 5 && (
              <button className="btn btn-primary" onClick={() => setShowPoster(true)}
                style={{ width: 220, justifyContent: "center", background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}>
                📷 生成海报
              </button>
            )}
            {extraActions}
            <button className="btn btn-secondary" onClick={onBackToMenu} style={{ width: 220, justifyContent: "center" }}>
              🏠 返回主菜单
            </button>
          </div>

          {isPerfect && <div style={{ textAlign: "center", marginTop: 12, color: "var(--gold-light)" }}>🎉 完美赛季！</div>}
        </div>
    </>
  );
}
