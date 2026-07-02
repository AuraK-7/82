"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api/request";
import { getTeamColors } from "@/lib/game-core";
import { useGameContext } from "@/components/game/GameProviders";

type LeaderboardMode = "classic" | "dream" | "battle";
type Period = "today" | "week" | "all";

interface ClassicEntry {
  id: string; username: string; score: number; result: string; game_mode: string;
  roster: { player_names: string[]; decades: string[]; teams: string[]; roster_hash: string };
  share_code: string; created_at: string;
}
interface DreamEntry { dream_player: string; count: number; best_score: number; }
interface BattleEntry { username: string; wins: number; }

const MODES: { key: LeaderboardMode; label: string }[] = [
  { key: "classic", label: "经典" },
  { key: "dream",   label: "圆梦" },
  { key: "battle",  label: "对战" },
];
const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "今日" },
  { key: "week",  label: "本周" },
  { key: "all",   label: "历史" },
];

function teamCN(a: string): string {
  const m: Record<string,string>={ATL:"老鹰",BKN:"篮网",BOS:"凯尔特人",CHA:"黄蜂",CHI:"公牛",CLE:"骑士",DAL:"独行侠",DEN:"掘金",DET:"活塞",GSW:"勇士",HOU:"火箭",IND:"步行者",LAC:"快船",LAL:"湖人",MEM:"灰熊",MIA:"热火",MIL:"雄鹿",MIN:"森林狼",NOP:"鹈鹕",NYK:"尼克斯",OKC:"雷霆",ORL:"魔术",PHI:"76人",PHX:"太阳",POR:"开拓者",SAC:"国王",SAS:"马刺",TOR:"猛龙",UTA:"爵士",WAS:"奇才"};
  return m[a]||a;
}
function shortName(n: string) { return n.includes("-") ? n.split("-").pop()! : n; }
function formatTime(iso: string): string {
  if (!iso) return "";
  const d = Date.now() - new Date(iso).getTime();
  if (d < 60000) return "刚刚";
  if (d < 3600000) return `${Math.floor(d / 60000)} 分钟前`;
  if (d < 86400000) return `${Math.floor(d / 3600000)} 小时前`;
  return `${new Date(iso).getMonth() + 1}/${new Date(iso).getDate()}`;
}

const POS_ORDER = ["PG","SG","SF","C","PF"];

export function LeaderboardPanel({ onClose }: { onClose: () => void }) {
  const { setCurrentScreen } = useGameContext();
  const [mode, setMode] = useState<LeaderboardMode>("classic");
  const [period, setPeriod] = useState<Period>("today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classicRecords, setClassicRecords] = useState<ClassicEntry[]>([]);
  const [dreamRanking, setDreamRanking] = useState<DreamEntry[]>([]);
  const [battleRanking, setBattleRanking] = useState<BattleEntry[]>([]);
  const [detail, setDetail] = useState<ClassicEntry | null>(null);

  // ── 经典：按时间取 ──────────────────────────────────────────
  useEffect(() => {
    if (mode !== "classic") return;
    setLoading(true); setError(null);
    apiGet<ClassicEntry[]>(`/api/records?type=${period}&mode=classic&limit=20`)
      .then(r => { if (r.success) setClassicRecords(r.data || []); else setError(r.error || "加载失败"); })
      .catch(() => setError("网络错误")).finally(() => setLoading(false));
  }, [mode, period]);

  // ── 圆梦排行 ────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "dream") return;
    setLoading(true); setError(null);
    apiGet<DreamEntry[]>("/api/records?type=dream_ranking&limit=20")
      .then(r => { if (r.success) setDreamRanking(r.data || []); else setError(r.error || "加载失败"); })
      .catch(() => setError("网络错误")).finally(() => setLoading(false));
  }, [mode]);

  // ── 对战排行 ────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "battle") return;
    setLoading(true); setError(null);
    apiGet<BattleEntry[]>("/api/records?type=battle_ranking&limit=20")
      .then(r => { if (r.success) setBattleRanking(r.data || []); else setError(r.error || "加载失败"); })
      .catch(() => setError("网络错误")).finally(() => setLoading(false));
  }, [mode]);

  const classicTop3 = period === "today" ? classicRecords.slice(0, 3) : [];
  const podium = classicTop3.length >= 3 ? [classicTop3[1], classicTop3[0], classicTop3[2]] : [];
  const classicRest = period === "today" ? classicRecords.slice(3) : classicRecords;

  const medal = (i: number) => i <= 3 ? ["🥇","🥈","🥉"][i - 1] : null;

  return (
    <div className="modal-overlay lb-overlay" style={{ display: "flex", zIndex: 900 }} onClick={onClose}>
      <div className="lb-modal" onClick={e => e.stopPropagation()}>
        {/* ── Header：标题 + 模式切换 + 关闭 ───────────────────── */}
        <div className="lb-header" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h2 className="lb-title" style={{ marginBottom: 0 }}>🏆 排行榜</h2>
          <div style={{ display: "flex", gap: 2, marginLeft: "auto", marginRight: 6, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 2 }}>
            {MODES.map(m => (
              <button key={m.key} onClick={() => setMode(m.key)}
                style={{
                  padding: "3px 10px", borderRadius: 6, border: "none",
                  cursor: "pointer", fontSize: "0.7rem", fontWeight: 600,
                  background: mode === m.key ? "rgba(243,156,18,0.2)" : "transparent",
                  color: mode === m.key ? "var(--gold-light)" : "var(--text-muted)",
                  transition: "all 0.15s",
                }}
              >{m.label}</button>
            ))}
          </div>
          <button className="lb-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* ── 时间 Tab（经典模式） ──────────────────────────────── */}
        <div className="lb-tabs" style={{ marginBottom: 6 }}>
          {PERIODS.map(p => (
            <button key={p.key} className={`lb-tab${period === p.key ? " active" : ""}`}
              onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>

        {/* ── Body ─────────────────────────────────────────────── */}
        <div className="lb-body">
          {loading ? (
            <div className="lb-loading"><div className="lb-spinner" /><p>加载中...</p></div>
          ) : error ? (
            <div className="lb-empty">😵 {error}</div>
          ) : (
            <>
              {/* ═══ 经典 ══════════════════════════════════════════ */}
              {mode === "classic" && classicRecords.length === 0 ? (
                <div className="lb-empty">🏀 暂无记录</div>
              ) : mode === "classic" ? (
                <>
                  {period === "today" && podium.length === 3 && (
                    <div className="lb-podium">
                      {podium.map((r, i) => {
                        const rank = i === 0 ? 2 : i === 1 ? 1 : 3;
                        return (
                          <div key={r.id} className="lb-podium-spot" onClick={() => setDetail(r)}
                            style={{ minHeight: rank === 1 ? 110 : rank === 2 ? 92 : 78, cursor: "pointer" }}>
                            <div className="lb-podium-medal">{medal(rank)}</div>
                            <div className="lb-podium-name">{r.username || "匿名球迷"}</div>
                            <div className="lb-podium-wins">{r.score} 胜</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="lb-list">
                    {classicRest.map((r, i) => {
                      const rank = period === "today" ? i + 4 : i + 1;
                      const m = medal(rank);
                      return (
                        <div key={r.id} className="lb-row" onClick={() => setDetail(r)} style={{ cursor: "pointer" }}>
                          <div className="lb-row-left">
                            <span className={`lb-rank${rank <= 3 && period === "today" ? ` lb-rank-${rank}` : " lb-rank-num"}`}>
                              {m || rank}
                            </span>
                            <div className="lb-row-info">
                              <div className="lb-username">{r.username || "匿名球迷"}</div>
                              <div className="lb-time">{formatTime(r.created_at)}</div>
                            </div>
                          </div>
                          <div className="lb-row-right"><span className="lb-wins">{r.score} 胜</span></div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}

              {/* ═══ 圆梦 ══════════════════════════════════════════ */}
              {mode === "dream" && dreamRanking.length === 0 ? (
                <div className="lb-empty">🌟 暂无圆梦记录</div>
              ) : mode === "dream" ? (
                <div className="lb-list">
                  {dreamRanking.map((r, i) => (
                    <div key={r.dream_player} className="lb-row">
                      <div className="lb-row-left">
                        <span className={`lb-rank${i < 3 ? ` lb-rank-${i + 1}` : " lb-rank-num"}`}>{medal(i + 1) || i + 1}</span>
                        <div className="lb-row-info">
                          <div className="lb-username">{r.dream_player || "未知球星"}</div>
                          <div className="lb-time">最佳 {r.best_score} 胜</div>
                        </div>
                      </div>
                      <div className="lb-row-right"><span className="lb-wins">🏆×{r.count}</span></div>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* ═══ 对战 ══════════════════════════════════════════ */}
              {mode === "battle" && battleRanking.length === 0 ? (
                <div className="lb-empty">⚔️ 暂无对战记录</div>
              ) : mode === "battle" ? (
                <div className="lb-list">
                  {battleRanking.map((r, i) => (
                    <div key={r.username + i} className="lb-row">
                      <div className="lb-row-left">
                        <span className={`lb-rank${i < 3 ? ` lb-rank-${i + 1}` : " lb-rank-num"}`}>{medal(i + 1) || i + 1}</span>
                        <div className="lb-row-info"><div className="lb-username">{r.username || "匿名玩家"}</div></div>
                      </div>
                      <div className="lb-row-right"><span className="lb-wins">⚔️×{r.wins}</span></div>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* ── 阵容详情弹窗 ──────────────────────────────────────── */}
      {detail && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setDetail(null)}>
          <div style={{ background: "rgba(22,33,62,0.98)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: "24px 20px 18px", maxWidth: 370, width: "92%", boxShadow: "0 12px 48px rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", position: "relative" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setDetail(null)} style={{ position: "absolute", top: 12, right: 14, width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.08)", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>

            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: 1, marginBottom: 4 }}>{detail.username || "匿名球迷"} · 经典模式</div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8 }}>
                <span style={{ fontSize: "2.2rem", fontWeight: 900, color: "var(--gold-light)", lineHeight: 1, fontFamily: "'Oswald',sans-serif" }}>{detail.score} 胜</span>
                <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-muted)" }}>{detail.result}</span>
              </div>
              <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginTop: 4 }}>{formatTime(detail.created_at)}</div>
            </div>

            {/* 阵容：上行 PG·SG·SF / 下行 C·PF */}
            <div style={{ maxWidth: 320, margin: "0 auto" }}>
              <div className="pos-slots" style={{ maxWidth: 320, margin: "0 auto", padding: 0 }}>
                <div className="pos-slots-row" style={{ marginBottom: 6 }}>
                  {(["PG","SG","SF"] as const).map(pos => renderSlot(pos, detail))}
                </div>
                <div className="pos-slots-row">
                  {(["C","PF"] as const).map(pos => renderSlot(pos, detail))}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 18 }}>
              <button onClick={() => setDetail(null)} style={{ padding: "8px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>关闭</button>
              <button onClick={() => { onClose(); setTimeout(() => {
                if (mode === "dream") setCurrentScreen("screen-dream-select");
                else if (mode === "battle") setCurrentScreen("screen-battle-lobby");
                else setCurrentScreen("screen-game");
              }, 100); }} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#f59e0b,#e67e22)", color: "#1a1a2e", cursor: "pointer", fontSize: "0.8rem", fontWeight: 700, boxShadow: "0 4px 16px rgba(245,158,11,0.3)" }}>
                {mode === "dream" ? "🌟 帮 TA 圆冠军梦！" : mode === "battle" ? "⚔️ 来一场皇城 PK！" : "🔥 冲击 82 胜！"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderSlot(pos: string, detail: ClassicEntry) {
  const idx = POS_ORDER.indexOf(pos);
  const name = detail.roster?.player_names?.[idx] || "";
  const team = detail.roster?.teams?.[idx] || "";
  const decade = detail.roster?.decades?.[idx] || "";
  if (!name) return <div key={pos} className="pos-slot" style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.1)" }}><span className="pos-label">{pos}</span></div>;
  const [primary, secondary] = team ? getTeamColors(team) : ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.05)"];
  return (
    <div key={pos} className="pos-slot filled" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})`, borderColor: primary, boxShadow: `0 0 14px ${primary}66` }}>
      <span className="slot-player-name">{shortName(name)}</span>
      <span className="slot-team-decade">{teamCN(team)} · {decade}</span>
    </div>
  );
}
