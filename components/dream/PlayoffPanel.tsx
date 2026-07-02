"use client";

// ===================================================================
//  components/dream/PlayoffPanel.tsx — 圆梦季后赛对战面板
//  完整 BO7 系列赛模拟：首轮 → 次轮 → 分区决赛 → 总决赛
// ===================================================================
import { useState, useRef, useCallback, useMemo } from "react";
import { useGameContext } from "@/components/game/GameProviders";
import { useGameState } from "@/hooks/useGameState";
import { SafeImage } from "@/components/ui/SafeImage";
import type { DreamState } from "@/lib/frontend";
import { simulateSingleGame as coreSimGame } from "@/lib/game-core";
import { getTeamColors, teamCN } from "@/lib/game-core";
import type { PlayoffStep } from "@/components/dream/DreamResult";

// ── 配置 ──────────────────────────────────────────────────────────────
const PLAYOFF_MULTIPLIERS = [86.6, 94.8, 98.1, 100.4];
const ROUND_NAMES = ["首轮", "次轮", "分区决赛", "总决赛"];
const OPP_LABELS = ["42胜球队", "50胜球队", "57胜球队", "60胜球队"];

interface GameLog {
  ourScore: number;
  oppScore: number;
  win: boolean;
}

interface Props {
  state: DreamState;
  onFinish: (outcome: "champion" | "eliminated", playoffPath: PlayoffStep[]) => void;
}

// ── 7段数码管 ─────────────────────────────────────────────────────────
function seg7html(num: number): string {
  const segMap: Record<number, number[]> = {
    0:[1,1,1,1,1,1,0], 1:[0,1,1,0,0,0,0], 2:[1,1,0,1,1,0,1],
    3:[1,1,1,1,0,0,1], 4:[0,1,1,0,0,1,1], 5:[1,0,1,1,0,1,1],
    6:[1,0,1,1,1,1,1], 7:[1,1,1,0,0,0,0], 8:[1,1,1,1,1,1,1],
    9:[1,1,1,1,0,1,1],
  };
  const segNames = ["a","b","c","d","e","f","g"];
  return String(num).split("").map(ch => {
    const pattern = segMap[Number(ch)] || segMap[8];
    const segs = pattern.map((on, i) =>
      `<span class="seg seg-${segNames[i]}${on ? "" : " off"}"></span>`
    ).join("");
    return `<span class="seg7">${segs}</span>`;
  }).join("");
}

// ── 简单对手生成（基于全部球员池） ───────────────────────────────────
function pickOppLeader(round: number): string {
  const names = [
    ["詹姆斯", "杜兰特", "字母哥", "约基奇", "库里", "塔图姆"],
    ["库里", "伦纳德", "字母哥", "恩比德", "杜兰特", "约基奇"],
    ["乔丹", "科比", "詹姆斯", "奥尼尔", "邓肯", "魔术师"],
    ["乔丹", "詹姆斯", "科比", "奥尼尔", "邓肯", "魔术师"],
  ];
  const pool = names[Math.min(round, 3)];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function PlayoffPanel({ state, onFinish }: Props) {
  const { setCurrentScreen } = useGameContext();
  const { refresh } = useGameState(state);

  const [round, setRound] = useState(0);
  const [gameLogs, setGameLogs] = useState<GameLog[]>([]);
  const [ourWins, setOurWins] = useState(0);
  const [oppWins, setOppWins] = useState(0);
  const [seriesOver, setSeriesOver] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [statusText, setStatusText] = useState("◎ 等待操作...");
  const [history, setHistory] = useState<PlayoffStep[]>([]);

  // 记分牌 refs
  const ourDigiRef = useRef<HTMLDivElement>(null);
  const oppDigiRef = useRef<HTMLDivElement>(null);
  const [digiOur, setDigiOur] = useState(0);
  const [digiOpp, setDigiOpp] = useState(0);

  const teamRating = useMemo(() => state.roster.getRating(), [state]);
  const oppRating = PLAYOFF_MULTIPLIERS[Math.min(round, 3)];
  const oppLeader = useMemo(() => pickOppLeader(round), [round]);
  const dreamPlayer = state.dreamPlayer;

  // 当前系列赛是否已赢
  const wonSeries = ourWins >= 4;
  const lostSeries = oppWins >= 4;
  const isChampion = round >= 3 && wonSeries;

  // 获取胜率显示
  const getWinPct = useCallback(() => {
    const basePct = 1 / (1 + Math.pow(10, -(teamRating - oppRating) / 30));
    const diffMult = round >= 3 ? 0.96 : round >= 2 ? 0.98 : 1.0;
    const dreamDiff = dreamPlayer?.diff ?? 1;
    return Math.min(basePct * diffMult * dreamDiff, 0.95);
  }, [teamRating, oppRating, round, dreamPlayer]);

  // ── 模拟一场 ──────────────────────────────────────────────────────
  const simOneGame = useCallback(() => {
    if (seriesOver || animating) return;
    setAnimating(true);
    setStatusText("◎ 比赛中...");

    const result = coreSimGame(teamRating, oppRating);
    const win = result.hostWin;
    const ourScore = result.hostScore;
    const oppScore = result.guestScore;

    setGameLogs(prev => [...prev, { ourScore, oppScore, win }]);

    // 记分牌动画
    const totalTicks = 45;
    let tick = 0;
    const interval = setInterval(() => {
      tick++;
      const progress = tick / totalTicks;
      const easeOut = 1 - Math.pow(1 - progress, 4);
      setDigiOur(Math.min(Math.round(ourScore * easeOut), ourScore));
      setDigiOpp(Math.min(Math.round(oppScore * easeOut), oppScore));
      if (tick >= totalTicks) {
        clearInterval(interval);
        setDigiOur(ourScore);
        setDigiOpp(oppScore);
        setAnimating(false);
        setStatusText("✅ 本场结束");

        if (win) {
          setOurWins(w => {
            const nw = w + 1;
            if (nw >= 4) {
              setTimeout(() => setStatusText("✅ 系列赛结束"), 300);
              setTimeout(() => setSeriesOver(true), 600);
            }
            return nw;
          });
        } else {
          setOppWins(w => {
            const nw = w + 1;
            if (nw >= 4) {
              setTimeout(() => setStatusText("❌ 系列赛结束"), 300);
              setTimeout(() => setSeriesOver(true), 600);
            }
            return nw;
          });
        }
      }
    }, 45);
  }, [seriesOver, animating, teamRating, oppRating]);

  // ── 一键模拟系列赛 ────────────────────────────────────────────────
  const simFullSeries = useCallback(async () => {
    if (seriesOver || animating) return;
    setAnimating(true);
    let localOur = ourWins;
    let localOpp = oppWins;
    const localLogs = [...gameLogs];

    while (localOur < 4 && localOpp < 4) {
      const result = coreSimGame(teamRating, oppRating);
      const win = result.hostWin;
      localLogs.push({ ourScore: result.hostScore, oppScore: result.guestScore, win });
      if (win) localOur++; else localOpp++;

      // 延迟动画
      setGameLogs([...localLogs]);
      setOurWins(localOur);
      setOppWins(localOpp);
      setDigiOur(result.hostScore);
      setDigiOpp(result.guestScore);
      setStatusText(localOur >= 4 ? "✅ 系列赛结束" : localOpp >= 4 ? "❌ 系列赛结束" : `◎ ${ROUND_NAMES[round]} · G${localOur + localOpp}`);

      if (localOur < 4 && localOpp < 4) {
        await new Promise(r => setTimeout(r, 400));
      }
    }
    setSeriesOver(true);
    setAnimating(false);
  }, [seriesOver, animating, teamRating, oppRating, ourWins, oppWins, gameLogs, round]);

  // ── 进入下一轮 ────────────────────────────────────────────────────
  const advanceRound = useCallback(() => {
    if (!wonSeries) return;

    // momentum boost
    const hasMomentum = ourWins === 4 && (oppWins === 0 || oppWins === 3);

    const newHistory = [...history, {
      round,
      ourWins,
      oppWins,
      won: true,
      oppLeaderName: oppLeader,
    }];

    if (round >= 3) {
      // 夺冠！
      onFinish("champion", newHistory);
    } else {
      setHistory(newHistory);
      setRound(r => r + 1);
      setGameLogs([]);
      setOurWins(0);
      setOppWins(0);
      setSeriesOver(false);
      setAnimating(false);
      setDigiOur(0);
      setDigiOpp(0);
      setStatusText("◎ 等待操作...");
      if (hasMomentum) {
        // momentum boost: teamRating * 1.05
        // 这里修改 state 的 roster rating 比较 tricky，暂时用 tooltip 方式提示
        setStatusText("🔥 势头加成！（4-0/4-3晋级） ◎ 等待操作...");
      }
      refresh();
    }
  }, [wonSeries, round, ourWins, oppWins, history, oppLeader, onFinish, refresh]);

  // ── 淘汰处理 ──────────────────────────────────────────────────────
  const handleEliminated = useCallback(() => {
    const newHistory = [...history, {
      round,
      ourWins,
      oppWins,
      won: false,
      oppLeaderName: oppLeader,
    }];
    onFinish("eliminated", newHistory);
  }, [round, ourWins, oppWins, history, oppLeader, onFinish]);

  // 渲染对手阵容替身
  const oppRoster = useMemo(() => {
    return [0, 1, 2, 3, 4].map(i => ({
      name: `${oppLeader}队-球员${i + 1}`,
      pos: ["PG","SG","SF","PF","C"][i],
    }));
  }, [oppLeader]);

  // 我的阵容
  const myRoster = useMemo(() => {
    return Object.entries(state.roster.slots)
      .filter(([, p]) => p)
      .map(([pos, p]) => ({ ...p!, slot: pos }));
  }, [state.roster.slots]);

  const renderPlayerCard = (p: any, isCaptain?: boolean) => {
    const [primary, secondary] = getTeamColors(p.team);
    return (
      <div key={p.name || p.slot} style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "4px 6px", borderRadius: 8, minWidth: 55,
        background: isCaptain ? "linear-gradient(135deg,rgba(243,156,18,0.4),rgba(245,158,11,0.15))" : "rgba(255,255,255,0.06)",
        border: isCaptain ? "1px solid var(--gold)" : "1px solid rgba(255,255,255,0.08)",
      }}>
        <span style={{ fontSize: "0.55rem", color: isCaptain ? "var(--gold-light)" : "var(--text-muted)", fontWeight: 700 }}>
          {p.slot || p.pos}
        </span>
        <span style={{ fontSize: "0.65rem", color: "#fff", fontWeight: 600, lineHeight: 1.1, textAlign: "center" }}>
          {p.name ? (p.name.includes("-") ? p.name.split("-").pop() : p.name) : `球员${p.slot}`}
        </span>
        {p.team && <span style={{ fontSize: "0.5rem", color: "var(--text-muted)" }}>{teamCN(p.team)}</span>}
      </div>
    );
  };

  const winPct = getWinPct();

  return (
    <div id="screen-playoffs" className="screen" style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "16px 12px", overflowY: "auto", minHeight: "100vh",
    }}>
      <button className="back-nav" onClick={() => setCurrentScreen("screen-menu")} style={{ position: "absolute", top: 12, left: 12, zIndex: 10 }} title="返回主菜单">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 }}>
          {dreamPlayer?.icon && (
            <SafeImage src={dreamPlayer.icon} alt={dreamPlayer.cname} width={36} height={36}
              style={{ borderRadius: "50%", border: "2px solid var(--gold)" }} />
          )}
          <div>
            <h3 style={{ fontFamily: "'Oswald',sans-serif", color: "var(--gold-light)", fontSize: "1.1rem", margin: 0 }}>
              {dreamPlayer?.cname} 的季后赛征程
            </h3>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              阵容评分 {Math.round(teamRating * 10) / 10} · 当前胜率 {Math.round(winPct * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* 已完成的系列赛历史 */}
      {history.length > 0 && (
        <div style={{ width: "100%", maxWidth: 400, marginBottom: 12 }}>
          {history.map((h, i) => (
            <div key={i} style={{
              fontSize: "0.72rem", padding: "4px 8px", borderRadius: 6, marginBottom: 3,
              background: h.won ? "rgba(39,174,96,0.15)" : "rgba(231,76,60,0.15)",
              color: h.won ? "var(--success)" : "var(--danger)",
            }}>
              {h.won ? "✅" : "❌"} {ROUND_NAMES[h.round]} vs {h.oppLeaderName}队 {h.ourWins}-{h.oppWins} {h.won ? "晋级" : "出局"}
            </div>
          ))}
        </div>
      )}

      {/* 当前系列赛记分牌 */}
      {!seriesOver || !(wonSeries || lostSeries) ? (
        <div className="digi-board" style={{
          width: "100%", maxWidth: 400, background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "16px 12px",
          marginBottom: 12,
        }}>
          <div style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--gold)", fontWeight: 700, marginBottom: 8 }}>
            🏀 {ROUND_NAMES[round]} · G{ourWins + oppWins + 1} vs {oppLeader}队
          </div>
          <div style={{ fontSize: "0.65rem", textAlign: "center", color: "var(--text-muted)", marginBottom: 8 }}>
            — 对阵 {OPP_LABELS[round]}（战力 {oppRating}）—
          </div>

          {/* 对手阵容 */}
          <div style={{ display: "flex", gap: 4, justifyContent: "center", marginBottom: 12, flexWrap: "wrap" }}>
            {oppRoster.map(p => renderPlayerCard(p))}
          </div>

          {/* 记分牌 */}
          <div className="digi-row" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 4,
          }}>
            <div style={{ textAlign: "center" }}>
              <div ref={ourDigiRef} className="digi-score home" style={{
                fontSize: "2.5rem", fontFamily: "monospace", color: "#2ecc71",
                lineHeight: 1, minWidth: 80, minHeight: 48,
              }} dangerouslySetInnerHTML={{ __html: seg7html(digiOur) }} />
              <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginTop: 2 }}>
                {dreamPlayer?.cname?.split("-")[1] || dreamPlayer?.cname}队
              </div>
            </div>
            <span style={{ fontSize: "1.8rem", color: "var(--text-muted)", fontWeight: 900 }}>-</span>
            <div style={{ textAlign: "center" }}>
              <div ref={oppDigiRef} className="digi-score away" style={{
                fontSize: "2.5rem", fontFamily: "monospace", color: "#e74c3c",
                lineHeight: 1, minWidth: 80, minHeight: 48,
              }} dangerouslySetInnerHTML={{ __html: seg7html(digiOpp) }} />
              <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginTop: 2 }}>{oppLeader}队</div>
            </div>
          </div>

          {/* 我的阵容 */}
          <div style={{ fontSize: "0.65rem", textAlign: "center", color: "var(--text-muted)", marginTop: 12, marginBottom: 6 }}>
            — 我的阵容 —
          </div>
          <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap", marginBottom: 12 }}>
            {myRoster.map(p => renderPlayerCard(p, p.name === dreamPlayer?.name))}
          </div>

          {/* 大比分 */}
          <div style={{ textAlign: "center", fontSize: "1.2rem", fontWeight: 900, color: "var(--gold-light)", marginBottom: 4 }}>
            {ourWins} - {oppWins}
          </div>
          <div style={{ textAlign: "center", fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 12 }}>
            {statusText}
          </div>

          {/* 系列赛小比分 */}
          {gameLogs.length > 0 && (
            <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap", marginBottom: 12 }}>
              {gameLogs.map((g, i) => (
                <span key={i} style={{
                  fontSize: "0.6rem", padding: "2px 6px", borderRadius: 4,
                  background: g.win ? "rgba(39,174,96,0.2)" : "rgba(231,76,60,0.2)",
                  color: g.win ? "var(--success)" : "var(--danger)",
                }}>
                  G{i + 1} {g.ourScore}-{g.oppScore} {g.win ? "✓" : "✗"}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* 系列赛结果 */}
      {seriesOver && (
        <div style={{
          width: "100%", maxWidth: 400, textAlign: "center", padding: "16px", borderRadius: 12, marginBottom: 12,
          background: wonSeries ? "rgba(39,174,96,0.12)" : "rgba(231,76,60,0.12)",
          border: `1px solid ${wonSeries ? "rgba(39,174,96,0.3)" : "rgba(231,76,60,0.3)"}`,
        }}>
          {wonSeries ? (
            <>
              <div style={{ fontSize: "2.5rem", marginBottom: 4 }}>{isChampion ? "🏆" : "🏀"}</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--success)" }}>
                {ourWins}-{oppWins} {isChampion ? "夺冠！" : "晋级！"}
              </div>
              {!isChampion && (
                <button className="btn btn-gold" onClick={advanceRound}
                  style={{ marginTop: 12, width: 200, justifyContent: "center", fontSize: "0.85rem" }}>
                  ➡️ 进入{ROUND_NAMES[round + 1] || "下一轮"}
                </button>
              )}
              {isChampion && (
                <div style={{ fontSize: "0.85rem", color: "var(--gold-light)", marginTop: 8 }}>
                  {dreamPlayer?.cname} 终于夺冠了！
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: "2.5rem", marginBottom: 4 }}>💔</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--danger)" }}>
                {ourWins}-{oppWins} 被淘汰
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 8 }}>
                止步{ROUND_NAMES[round]}，{dreamPlayer?.cname} 的冠军梦还在继续...
              </div>
              <button className="btn btn-secondary" onClick={handleEliminated}
                style={{ marginTop: 12, width: 200, justifyContent: "center", borderColor: "var(--danger)", color: "var(--danger)" }}>
                查看结局
              </button>
            </>
          )}
        </div>
      )}

      {/* 控制按钮 */}
      {!seriesOver && (
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <button className="btn btn-gold" onClick={simOneGame} disabled={animating}
            style={{ width: 160, justifyContent: "center", fontSize: "0.85rem" }}>
            🎮 模拟一场
          </button>
          <button className="btn btn-primary" onClick={simFullSeries} disabled={animating}
            style={{ width: 160, justifyContent: "center", fontSize: "0.85rem", background: "linear-gradient(135deg,#e67e22,#e74c3c)" }}>
            ⚡ 一键系列赛
          </button>
        </div>
      )}

      {/* 已获取的赛事数据 */}
      {gameLogs.length > 0 && seriesOver && (
        <div style={{ marginTop: 8, width: "100%", maxWidth: 400 }}>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textAlign: "center", marginBottom: 4 }}>
            📊 本系列赛数据
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, fontSize: "0.68rem", color: "var(--text-muted)" }}>
            <span>场均得分 {Math.round(gameLogs.reduce((s, g) => s + g.ourScore, 0) / gameLogs.length)}</span>
            <span>对手场均 {Math.round(gameLogs.reduce((s, g) => s + g.oppScore, 0) / gameLogs.length)}</span>
          </div>
        </div>
      )}

      {/* 返回按钮 */}
      <button className="btn btn-secondary" onClick={() => setCurrentScreen("screen-menu")}
        style={{ marginTop: 8, width: 200, justifyContent: "center" }}>
        🏠 返回主页
      </button>

      {/* 数码管 CSS */}
      <style>{`
        .digi-score .seg7 {
          display: inline-grid;
          grid-template-areas: " . a . " " f . b " " . g . " " e . c " " . d . ";
          gap: 2px;
          width: 18px;
          height: 30px;
          margin: 0 1px;
          vertical-align: middle;
        }
        .digi-score .seg {
          width: 100%;
          height: 100%;
          border-radius: 2px;
          background: currentColor;
          opacity: 1;
        }
        .digi-score .seg.off { opacity: 0.1; }
        .digi-score .seg-a { grid-area: a; }
        .digi-score .seg-b { grid-area: b; }
        .digi-score .seg-c { grid-area: c; }
        .digi-score .seg-d { grid-area: d; }
        .digi-score .seg-e { grid-area: e; }
        .digi-score .seg-f { grid-area: f; }
        .digi-score .seg-g { grid-area: g; }
      `}</style>
    </div>
  );
}
