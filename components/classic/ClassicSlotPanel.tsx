"use client";

// ===================================================================
//  components/classic/ClassicSlotPanel.tsx — 经典老虎机选人页
// ===================================================================
import { useState, useEffect, useMemo } from "react";
import { useGameState } from "@/hooks/useGameState";
import { useGameContext } from "@/components/game/GameProviders";
import { getTeamColors } from "@/lib/game-core";
import type { ClassicState } from "@/lib/frontend";
import type { Player, Position } from "@/lib/game-core";

interface Props { state: ClassicState; onComplete: (wins: number) => void; }

type FilterTab = "all" | "g" | "f" | "c";

const ALL_TEAMS = ["ATL","BKN","BOS","CHA","CHI","CLE","DAL","DEN","DET","GSW","HOU","IND","LAC","LAL","MEM","MIA","MIL","MIN","NOP","NYK","OKC","ORL","PHI","PHX","POR","SAC","SAS","TOR","UTA","WAS"];
const ALL_DECADES = ["1960s","1970s","1980s","1990s","2000s","2010s","2020s"];

function teamCN(a: string): string {
  const m: Record<string,string>={ATL:"老鹰",BKN:"篮网",BOS:"凯尔特人",CHA:"黄蜂",CHI:"公牛",CLE:"骑士",DAL:"独行侠",DEN:"掘金",DET:"活塞",GSW:"勇士",HOU:"火箭",IND:"步行者",LAC:"快船",LAL:"湖人",MEM:"灰熊",MIA:"热火",MIL:"雄鹿",MIN:"森林狼",NOP:"鹈鹕",NYK:"尼克斯",OKC:"雷霆",ORL:"魔术",PHI:"76人",PHX:"太阳",POR:"开拓者",SAC:"国王",SAS:"马刺",TOR:"猛龙",UTA:"爵士",WAS:"奇才"};
  return m[a]||a;
}

export function ClassicSlotPanel({ state, onComplete }: Props) {
  const { refresh } = useGameState(state);
  const { setCurrentScreen } = useGameContext();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [teamText, setTeamText] = useState("???");
  const [decadeText, setDecadeText] = useState("???");
  const [teamAnim, setTeamAnim] = useState(false);
  const [decadeAnim, setDecadeAnim] = useState(false);
  const spinning = teamAnim || decadeAnim; // 任一动画进行中都算 spinning
  const [pendingPick, setPendingPick] = useState<{ player: Player; positions: Position[] } | null>(null);
  const [moveFrom, setMoveFrom] = useState<Position | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  // 只在老虎机/换队/换年代时递增，防止选人后列表重排
  const [shuffleKey, setShuffleKey] = useState(0);

  // 读取"不再提醒"偏好（SSR 兼容）
  const [skipExitConfirm] = useState(() => {
    try { return typeof window !== "undefined" && localStorage.getItem("bb82_skip_exit_confirm") === "1"; }
    catch { return false; }
  });

  const r = state;
  const roster = r.roster;
  const spun = r.slotMachine.spun;
  const canSkipTeam = r.slotMachine.skipTeamCount > 0;
  const canSkipDecade = r.slotMachine.skipDecadeCount > 0;
  const pickedNames = useMemo(() => new Set(roster.getPickedNames()), [roster]);

  // ── 老虎机动画（两队同时转）──────────────────────────────────────
  const doSpin = () => {
    if (spinning || spun) return;
    setTeamAnim(true); setDecadeAnim(true);
    let count = 0;
    const iv = setInterval(() => {
      setTeamText(teamCN(ALL_TEAMS[Math.floor(Math.random() * ALL_TEAMS.length)]));
      setDecadeText(ALL_DECADES[Math.floor(Math.random() * ALL_DECADES.length)]);
      count++;
      if (count >= 16) {
        clearInterval(iv);
        r.spin();
        const combo = r.slotMachine.state;
        setTeamText(teamCN(combo.currentTeam || "???"));
        setDecadeText(combo.currentDecade || "???");
        setTeamAnim(false); setDecadeAnim(false);
        setShuffleKey((k) => k + 1);
        refresh();
      }
    }, 70);
  };

  // ── 换队（仅球队动画）───────────────────────────────────────────
  const doSkipTeam = () => {
    if (!spun || spinning || !canSkipTeam) return;
    setTeamAnim(true);
    let count = 0;
    const iv = setInterval(() => {
      setTeamText(teamCN(ALL_TEAMS[Math.floor(Math.random() * ALL_TEAMS.length)]));
      count++;
      if (count >= 12) {
        clearInterval(iv);
        r.skipTeam();
        setTeamText(teamCN(r.currentTeam || "???"));
        setTeamAnim(false);
        setShuffleKey((k) => k + 1);
        refresh();
      }
    }, 70);
  };

  // ── 换年代（仅年代动画）─────────────────────────────────────────
  const doSkipDecade = () => {
    if (!spun || spinning || !canSkipDecade) return;
    setDecadeAnim(true);
    let count = 0;
    const iv = setInterval(() => {
      setDecadeText(ALL_DECADES[Math.floor(Math.random() * ALL_DECADES.length)]);
      count++;
      if (count >= 12) {
        clearInterval(iv);
        r.skipDecade();
        setDecadeText(r.slotMachine.state.currentDecade || "???");
        setDecadeAnim(false);
        setShuffleKey((k) => k + 1);
        refresh();
      }
    }, 70);
  };

  // ── 球员列表 ──────────────────────────────────────────────────────
  // 每轮老虎机转动后一次性获取 top 20 + 打乱；已选球员仅在展示层隐藏
  const basePool = useMemo(() => {
    if (!spun) return [];
    const pool = r.slotMachine.getTopPlayers(20, []);
    return [...pool].sort(() => Math.random() - 0.5);
  }, [spun, shuffleKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const catMap: Record<string, Position[]> = { g: ["PG","SG"], f: ["SF","PF"], c: ["C"] };
  const display = useMemo(() => {
    const filtered = filter === "all"
      ? basePool
      : basePool.filter((p: Player) => p.positions.some((pos) => (catMap[filter]||[]).includes(pos)));
    return filtered.filter((p: Player) => !pickedNames.has(p.name));
  }, [basePool, filter, pickedNames]);

  const onPickPlayer = (player: Player) => {
    const empty = player.positions.filter((p) => !roster.at(p));
    if (empty.length === 0) return;
    setPendingPick({ player, positions: empty });
  };

  // ── 选满5人自动结算─────────────────────
  useEffect(() => {
    if (r.round >= 5) {
      try {
        const sim = r.simulate();
        // 延迟一帧确保 React 状态已更新
        setTimeout(() => onComplete(sim.wins), 0);
      } catch (err) {
        console.error("[Classic] simulate failed:", err);
        onComplete(0); // 兜底
      }
    }
  }, [r.round]);

  const onSlotClick = (pos: Position) => {
    if (pendingPick && pendingPick.positions.includes(pos)) {
      r.confirmPick(pendingPick.player, pos);
      setPendingPick(null);
      if (r.round < 5) {
        setTeamText("???"); setDecadeText("???");
        r.startRound();
      }
      refresh();
    } else if (moveFrom) {
      roster.movePlayer(moveFrom, pos);
      setMoveFrom(null);
      refresh();
    }
  };

  const onFilledClick = (pos: Position) => {
    const p = roster.at(pos);
    if (!p) return;
    if (pendingPick) { setPendingPick(null); return; }
    const empty = p.positions.filter((x) => x !== pos && !roster.at(x));
    if (empty.length > 0) { setMoveFrom(pos); refresh(); }
  };

  // ── 自动开始第一轮 ──────────────────────────────────────────────
  useEffect(() => {
    if (r.round === 0 && !spun) r.startRound();
  }, []); // 仅挂载时执行一次

  const renderSlot = (pos: Position) => {
    const p = roster.at(pos);
    const filled = !!p;
    let cls = `pos-slot${filled ? " filled" : ""}`;
    // 待选球员可打该位置时高亮
    if (!filled && pendingPick?.positions.includes(pos)) cls += " highlight clickable";
    // 移动模式下：空位且移动球员可打该位置时高亮
    if (!filled && moveFrom) {
      const mover = roster.at(moveFrom);
      if (mover && mover.positions.includes(pos)) cls += " highlight clickable";
    }
    if (filled && moveFrom === pos) cls += " move-source clickable";
    if (p) {
      const [primary, secondary] = getTeamColors(p.team);
      return (
        <div className={cls} style={{
          background: `linear-gradient(135deg, ${primary}, ${secondary})`,
          borderColor: primary,
          boxShadow: `0 0 14px ${primary}66`,
        }} onClick={() => onFilledClick(pos)}>
          <span className="slot-player-name">{p.name.split("-").pop()}</span>
          <span className="slot-team-decade">{teamCN(p.team)} · {p.decade}</span>
        </div>
      );
    }
    return (
      <div className={cls} onClick={() => onSlotClick(pos)}>
        <span className="pos-label">{pos}</span>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="sticky-top">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px" }}>
          <button className="back-nav" onClick={() => {
            if (roster.filledCount() > 0 && !skipExitConfirm) { setShowExitConfirm(true); }
            else { r.reset(); setCurrentScreen("screen-menu"); }
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" strokeWidth="2.5"/></svg>
          </button>
          <div className="header-text" style={{ flex: 1, textAlign: "center", fontSize: 18 }}>82-0 完美赛季大挑战</div>
          <div style={{ width: 40, textAlign: "right" }}>
            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{roster.filledCount()}/5</span>
          </div>
        </div>
        <div className="roster-bar">
          <div className="pos-slots">
            <div className="pos-slots-row">{renderSlot("PG")}{renderSlot("SG")}</div>
            <div className="pos-slots-row">{renderSlot("SF")}{renderSlot("C")}{renderSlot("PF")}</div>
          </div>
        </div>
      </div>
      <div style={{ textAlign: "center", padding: "4px 0" }}>
        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
          {pendingPick
            ? `点击上方闪烁的方框放置 ${pendingPick.player.name.split("-").pop()} (${pendingPick.positions.join("/")})`
            : moveFrom ? "点击闪烁的方框移动球员" : spun ? "点击球员加入阵容" : "点击🎰随机开始选人"}
        </span>
      </div>
      <div className="slot-section">
        <div className="round-label">{spun ? `第 ${r.round + 1} / 5 轮` : "准备"}</div>
        <div className="slot-machine" style={{ display: "flex", justifyContent: "center", gap: 24, padding: "12px 0" }}>
          <div className="slot-column"><span className="slot-column-label">球队</span>
            <div className={`slot-reel team-reel${teamAnim ? " spinning" : ""}`}><span className="reel-text">{teamText}</span></div>
          </div>
          <div className="slot-column"><span className="slot-column-label">年代</span>
            <div className={`slot-reel${decadeAnim ? " spinning" : ""}`}><span className="reel-text">{decadeText}</span></div>
          </div>
        </div>
        <div className="slot-controls">
          <button className="btn btn-gold" disabled={spinning || spun} onClick={doSpin}>
            {spun ? "✓ 已锁定" : spinning ? "🎰 随机中..." : "🎰 随机"}
          </button>
        </div>
        <div className="slot-controls-row" style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
          <button className="btn btn-secondary btn-xs" disabled={!spun || spinning || !canSkipTeam} onClick={doSkipTeam}>
            🔄 换队 ({r.slotMachine.skipTeamCount}次)
          </button>
          <button className="btn btn-secondary btn-xs" disabled={!spun || spinning || !canSkipDecade} onClick={doSkipDecade}>
            📅 换年代 ({r.slotMachine.skipDecadeCount}次)
          </button>
        </div>
      </div>
      {// 任何动画进行中时隐藏列表，动画结束后一次性显示
      spun && !teamAnim && !decadeAnim && (
        <div id="playerSection" style={{ display: "block", flex: 1, overflowY: "auto" }}>
          <div className="filter-tabs" style={{ display: "flex", gap: 4, justifyContent: "center", marginBottom: 8 }}>
            {(["all","g","f","c"] as FilterTab[]).map((t) => (
              <span key={t} className={`filter-tab${filter===t?" active":""}`} onClick={()=>setFilter(t)} style={{ cursor:"pointer",padding:"4px 12px",borderRadius:6,fontSize:"0.7rem",background:filter===t?"var(--gold)":"rgba(255,255,255,0.08)",color:filter===t?"#1a1a2e":"var(--text-muted)" }}>
                {t==="all"?"全部":t==="g"?"后卫":t==="f"?"前锋":"中锋"}</span>
            ))}
          </div>
          <div className="player-grid">
            {display.length===0 ? (
              <div className="no-players"><div className="icon">😅</div><p>该位置没有可用球员</p></div>
            ) : display.map((p: Player) => {
              const isPicked = pickedNames.has(p.name);
              const isPending = pendingPick?.player.name === p.name;
              const emptyPos = isPicked ? [] : p.positions.filter((pos) => !roster.at(pos));
              const canPick = emptyPos.length > 0;
              return (
                <div
                  key={p.name}
                  className="player-card"
                  onClick={() => !isPicked && onPickPlayer(p)}
                  style={{
                    cursor: canPick ? "pointer" : "default",
                    opacity: isPicked ? 0.35 : 1,
                    borderColor: isPending ? "var(--gold)" : "transparent",
                    background: isPending ? "rgba(245,158,11,0.12)" : undefined,
                  }}
                >
                  <div className="player-name">{p.name}</div>
                  <div className="player-positions">
                    {p.positions.map((x) => (
                      <span key={x} className="pos-badge" style={{
                        background: canPick ? undefined : "rgba(255,255,255,0.06)",
                        color: canPick ? undefined : "var(--text-muted)",
                      }}>{x}</span>
                    ))}
                  </div>
                  <div className="player-team">{teamCN(p.team)} · {p.decade}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 退出确认弹窗 */}
      {showExitConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 2000,
          background: "rgba(0,0,0,0.65)", display: "flex",
          alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowExitConfirm(false)}>
          <div style={{
            background: "rgba(22,33,62,0.98)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 14, padding: "24px 20px", maxWidth: 300, width: "90%",
            textAlign: "center", backdropFilter: "blur(10px)",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>⚠️</div>
            <div style={{ color: "#fff", fontWeight: 600, marginBottom: 4 }}>确定退出吗？</div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginBottom: 16 }}>
              已选择 {roster.filledCount()}/5 名球员，退出后不会保存当前阵容
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", marginBottom: 16, cursor: "pointer", fontSize: "0.7rem", color: "var(--text-muted)" }}>
              <input type="checkbox" checked={dontAskAgain} onChange={(e) => setDontAskAgain(e.target.checked)}
                style={{ accentColor: "var(--gold)" }} />
              不再提醒
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => setShowExitConfirm(false)}
                style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)",
                  background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem" }}>
                继续游戏
              </button>
              <button onClick={() => {
                if (dontAskAgain) { try { localStorage.setItem("bb82_skip_exit_confirm", "1"); } catch {} }
                setShowExitConfirm(false); r.reset(); setCurrentScreen("screen-menu");
              }}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none",
                  background: "var(--danger)", color: "#fff", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>
                确认退出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
