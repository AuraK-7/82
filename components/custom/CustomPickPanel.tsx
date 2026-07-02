"use client";

import { useState, useMemo, useEffect } from "react";
import { useGameContext } from "@/components/game/GameProviders";
import { getTeamColors, teamCN, playerRating } from "@/lib/game-core";
import type { CustomState } from "@/lib/frontend";
import type { Player, Position } from "@/lib/game-core";

const POS_ALL = ["PG","SG","SF","C","PF"] as Position[];

interface Props { state: CustomState; allPlayers: Player[]; onSimulate: () => void; }

export function CustomPickPanel({ state, allPlayers, onSimulate }: Props) {
  const { setCurrentScreen, currentScreen } = useGameContext();
  const [, force] = useState(0);
  const refresh = () => force(k => k + 1);

  // 离开自选页面时清理数据
  useEffect(() => {
    if (currentScreen !== "screen-custom") {
      state.reset();
      setTeamFilter("all");
      setDecadeFilter("all");
      setPendingPick(null);
      setMoveFrom(null);
    }
  }, [currentScreen]); // eslint-disable-line react-hooks/exhaustive-deps

  const [teamFilter, setTeamFilter] = useState("all");
  const [decadeFilter, setDecadeFilter] = useState("all");
  const [pendingPick, setPendingPick] = useState<{ player: Player; positions: Position[] } | null>(null);
  const [moveFrom, setMoveFrom] = useState<Position | null>(null);
  const [hintFlash, setHintFlash] = useState("");

  const roster = state.roster;
  const filledCount = POS_ALL.filter(p => !!roster.at(p)).length;
  const hasSelection = teamFilter !== "all" && decadeFilter !== "all";

  const setTeam = (t: string) => { setTeamFilter(t); state.setTeamFilter(t); };
  const setDecade = (d: string) => { setDecadeFilter(d); state.setDecadeFilter(d); };

  // ── 球员列表 ──────────────────────────────────────────────
  const players = useMemo(() => {
    if (!hasSelection) return [];
    try {
      return allPlayers
        .filter(p => p.team === teamFilter && p.decade === decadeFilter && !roster.getPickedNames().includes(p.name))
        .sort((a, b) => (b.rating ?? playerRating(b)) - (a.rating ?? playerRating(a)));
    } catch { return []; }
  }, [hasSelection, teamFilter, decadeFilter, allPlayers, roster.slots]);

  // ── 实时评分 ──────────────────────────────────────────────
  const preview = useMemo(() => {
    const picks = POS_ALL.map(p => roster.at(p)).filter(Boolean) as Player[];
    if (picks.length === 0) return null;
    const ratings = picks.map(p => p.rating ?? playerRating(p));
    const geo = Math.pow(ratings.reduce((a, b) => a * b, 1), 1 / ratings.length);
    const ovr = Math.round(geo * 1.1 * 10) / 10;
    const wins = Math.round(82 * Math.pow(Math.min(ovr / 110, 1), 2.2));
    return { teamOvr: ovr, wins };
  }, [roster.slots]);

  // ── 动态过滤有效球队/年代 ──────────────────────────────
  const availableTeams = useMemo(() => {
    const teams = new Set<string>();
    allPlayers.forEach(p => { if (!decadeFilter || decadeFilter === "all" || p.decade === decadeFilter) teams.add(p.team); });
    return [...teams].sort();
  }, [allPlayers, decadeFilter]);

  const availableDecades = useMemo(() => {
    const decades = new Set<string>();
    allPlayers.forEach(p => { if (!teamFilter || teamFilter === "all" || p.team === teamFilter) decades.add(p.decade); });
    return [...decades].sort();
  }, [allPlayers, teamFilter]);

  const ratingColor = (r: number) => r >= 90 ? "#f59e0b" : r >= 80 ? "#a855f7" : r >= 70 ? "#22c55e" : r >= 60 ? "#3b82f6" : "var(--text-muted)";

  // ── 球员点击 → 进入待选状态 ──────────────────────────────
  const handlePick = (p: Player) => {
    setMoveFrom(null);
    const empty = p.positions.filter(pos => !roster.at(pos));
    if (empty.length === 0) {
      setHintFlash(`⚠ ${p.name.split("-").pop()} 的所有位置已被占用`);
      setTimeout(() => setHintFlash(""), 2000);
      return;
    }
    setPendingPick({ player: p, positions: empty });
  };

  // ── 槽位点击 ──────────────────────────────────────────────
  const handleSlotClick = (pos: Position) => {
    const p = roster.at(pos);
    if (p && pendingPick) { setPendingPick(null); return; }
    if (p && !moveFrom) {
      const empty = p.positions.filter(x => x !== pos && !roster.at(x));
      if (empty.length > 0) { setMoveFrom(pos); refresh(); }
      return;
    }
    if (p && moveFrom && moveFrom !== pos) {
      const mover = roster.at(moveFrom);
      if (mover) { roster.removePlayer(moveFrom); roster.addPlayer(mover, pos); }
      setMoveFrom(null); refresh(); return;
    }
    if (p && moveFrom === pos) { setMoveFrom(null); refresh(); return; }
    // 空位
    if (pendingPick && pendingPick.positions.includes(pos)) {
      roster.addPlayer(pendingPick.player, pos);
      setPendingPick(null); refresh(); return;
    }
    if (moveFrom) {
      const mover = roster.at(moveFrom);
      if (mover && mover.positions.includes(pos)) {
        roster.removePlayer(moveFrom); roster.addPlayer(mover, pos);
        setMoveFrom(null); refresh();
      }
    }
  };

  // ── 删除按钮 ──────────────────────────────────────────────
  const handleRemove = (pos: Position, e: React.MouseEvent) => {
    e.stopPropagation();
    roster.removePlayer(pos);
    if (moveFrom === pos) setMoveFrom(null);
    setPendingPick(null);
    refresh();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* ═══ sticky-top ═══════════════════════════════════════ */}
      <div className="sticky-top">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px" }}>
          <button className="back-nav" onClick={() => { state.reset(); setCurrentScreen("screen-menu"); }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" strokeWidth="2.5"/></svg>
          </button>
          <div style={{ flex: 1, textAlign: "center", fontSize: 12, fontFamily: "'Oswald', sans-serif", fontWeight: 600, color: "var(--text-light)", letterSpacing: 1 }}>
            💪 冲击82胜
            {preview && <span style={{ fontSize: "0.6rem", color: "var(--gold-light)", marginLeft: 8, fontWeight: 500, fontFamily: "'Inter', sans-serif", letterSpacing: 0 }}>
              评分 {preview.teamOvr} · 预计 {preview.wins}-{82 - preview.wins}
            </span>}
          </div>
          <div style={{ width: 40, textAlign: "right" }}>
            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{filledCount}/5</span>
          </div>
        </div>
        {/* 阵容栏 */}
        <div className="roster-bar">
          <div className="pos-slots">
            <div className="pos-slots-row">
              {(["PG","SG"] as Position[]).map(pos => slot(pos, roster, handleSlotClick, handleRemove, pendingPick, moveFrom))}
            </div>
            <div className="pos-slots-row">
              {(["SF","C","PF"] as Position[]).map(pos => slot(pos, roster, handleSlotClick, handleRemove, pendingPick, moveFrom))}
            </div>
          </div>
          {moveFrom && <div style={{ textAlign: "center", fontSize: "0.65rem", color: "var(--gold-light)", padding: "2px 0 0" }}>🔄 点击目标位置完成移动 · 再次点击取消</div>}
        </div>
      </div>

      {/* ═══ 提示 ═════════════════════════════════════════════ */}
      <div style={{ textAlign: "center", padding: "4px 0" }}>
        <span style={{ fontSize: "0.7rem", color: hintFlash ? "var(--gold)" : "var(--text-muted)" }}>
          {hintFlash ? hintFlash : filledCount >= 5 ? "✅ 阵容完整！" : pendingPick ? `点击上方闪烁方框放置 ${pendingPick.player.name.split("-").pop()} (${pendingPick.positions.join("/")})` : moveFrom ? "点击空位移动球员 · 再次点击取消" : hasSelection ? "点击球员加入阵容" : "👆 选择球队和年代"}
        </span>
      </div>

      {/* ═══ 选满 → 结算 ════════════════════════════════════ */}
      {filledCount >= 5 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            {preview ? (
              <>
                <div style={{ fontSize: "3.5rem", fontWeight: 900, color: "var(--gold-light)", lineHeight: 1, fontFamily: "'Oswald', sans-serif" }}>
                  {preview.wins}<span style={{ fontSize: "1.5rem", color: "var(--text-muted)" }}>-{82 - preview.wins}</span>
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 4 }}>
                  阵容评分 <span style={{ color: "var(--gold-light)", fontWeight: 700 }}>{preview.teamOvr}</span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: "1.2rem", color: "#fff", fontWeight: 700 }}>阵容已完整</div>
            )}
          </div>
          <button onClick={onSimulate} className="btn btn-gold"
            style={{ width: 220, justifyContent: "center", fontSize: "1.1rem", fontWeight: 700, padding: "14px 0", boxShadow: "0 4px 20px rgba(245,158,11,0.35)" }}>
            🏆 结算
          </button>
        </div>
      ) : (
        <>
          {/* ═══ slot-section ════════════════════════════════ */}
          <div className="slot-section" style={{ paddingBottom: 8 }}>
            <div className="round-label" style={{ marginBottom: 10 }}>
              {hasSelection ? `${teamCN(teamFilter)} · ${decadeFilter}` : "选择球队和年代"}
            </div>
            <div className="slot-machine" style={{ justifyContent: "center" }}>
              <div className="slot-column">
                <span className="slot-column-label">球队</span>
                <select className="custom-select" value={teamFilter} onChange={e => setTeam(e.target.value)} style={sSelect}>
                  <option value="all">选择球队</option>
                  {availableTeams.map(t => <option key={t} value={t}>{teamCN(t)}</option>)}
                </select>
              </div>
              <div className="slot-column">
                <span className="slot-column-label">年代</span>
                <select className="custom-select" value={decadeFilter} onChange={e => setDecade(e.target.value)} style={sSelect}>
                  <option value="all">选择年代</option>
                  {availableDecades.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ═══ 球员列表 ═══════════════════════════════════ */}
          <div id="playerSection" style={{ display: "block", flex: 1, overflowY: "auto", padding: "0 8px" }}>
            {!hasSelection ? (
              <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)", fontSize: "0.85rem" }}>👆 请先选择球队和年代</div>
            ) : players.length === 0 ? (
              <div className="no-players"><div className="icon">😅</div><p>该条件下没有可用球员</p></div>
            ) : (
              <div className="player-grid">
                {players.map(p => {
                  const rating = p.rating ?? playerRating(p);
                  const isPicked = POS_ALL.some(pos => roster.at(pos)?.name === p.name);
                  const isPending = pendingPick?.player.name === p.name;
                  return (
                    <div key={p.name + p.team + p.decade} className={`player-card${isPicked ? " disabled" : ""}${isPending ? " selected" : ""}`}
                      onClick={() => !isPicked && handlePick(p)}
                      style={{ cursor: isPicked ? "default" : "pointer", opacity: isPicked ? 0.35 : 1, borderColor: isPending ? "var(--gold)" : "transparent", background: isPending ? "rgba(245,158,11,0.12)" : undefined }}>
                      <div className="player-name" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      <div className="player-positions" style={{ gap: 6, marginLeft: "auto", flexShrink: 0 }}>
                        <span className="stat-pill" style={{ fontSize: "0.62rem" }}>{p.pts?.toFixed(1)} <span style={{ opacity: 0.5 }}>PTS</span></span>
                        <span className="stat-pill" style={{ fontSize: "0.62rem" }}>{p.reb?.toFixed(1)} <span style={{ opacity: 0.5 }}>REB</span></span>
                        <span className="stat-pill" style={{ fontSize: "0.62rem" }}>{p.ast?.toFixed(1)} <span style={{ opacity: 0.5 }}>AST</span></span>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: "0.85rem", minWidth: 32, textAlign: "right", color: ratingColor(rating), marginLeft: 8 }}>{rating}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function slot(
  pos: Position, roster: { at(p: Position): Player | null },
  onClick: (p: Position) => void, onRemove: (p: Position, e: React.MouseEvent) => void,
  pendingPick: { positions: Position[] } | null, moveFrom: Position | null,
) {
  const p = roster.at(pos);
  const isPending = !p && pendingPick?.positions.includes(pos);
  const isMoving = p && moveFrom === pos;
  const mover = moveFrom ? roster.at(moveFrom) : null;
  const canMoveHere = !p && mover && mover.positions.includes(pos);
  if (p) {
    const [pri, sec] = getTeamColors(p.team);
    return (
      <div key={pos} className={`pos-slot filled${isMoving ? " move-source clickable" : ""}`}
        onClick={() => onClick(pos)}
        style={{ position: "relative", cursor: "pointer", background: `linear-gradient(135deg, ${pri}, ${sec})`, borderColor: isMoving ? "var(--gold-light)" : pri, boxShadow: isMoving ? `0 0 18px var(--gold-light)` : `0 0 14px ${pri}66`, transform: isMoving ? "scale(1.08)" : undefined, transition: "all 0.2s" }}>
        <span className="slot-player-name">{p.name.split("-").pop()}</span>
        <span className="slot-team-decade">{teamCN(p.team)} · {p.decade}</span>
        {isMoving && <span onClick={e => onRemove(pos, e)} style={{ position: "absolute", top: -7, right: -7, width: 20, height: 20, borderRadius: "50%", background: "var(--danger)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 700, lineHeight: 1, boxShadow: "0 2px 6px rgba(0,0,0,0.5)", zIndex: 5 }} title="移除球员">✕</span>}
      </div>
    );
  }
  return <div key={pos} className={`pos-slot${isPending || canMoveHere ? " highlight clickable" : ""}`} onClick={() => onClick(pos)} style={{ cursor: "pointer" }}><span className="pos-label">{pos}</span></div>;
}

const sSelect: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 8, width: 170, cursor: "pointer",
  border: "2px solid var(--gold)", background: "linear-gradient(180deg, #0a0a1a, #1a1a3e)",
  color: "var(--gold-light)", fontSize: "0.85rem", outline: "none",
  fontWeight: 600, textAlign: "center",
};
