"use client";

// ===================================================================
//  components/challenge/ChallengePanel.tsx — 三种挑战模式统一面板
//  年代穿越 / 同队传奇 / 国际阵容
// ===================================================================
import { useState } from "react";
import { useGameContext } from "@/components/game/GameProviders";
import { ChallengeState } from "@/lib/frontend";
import type { Player, Position } from "@/lib/game-core";

const POS_ORDER: Position[] = ["PG", "SG", "SF", "PF", "C"];

interface Props { state: ChallengeState; onComplete: (wins: number) => void; }

export function ChallengePanel({ state, onComplete }: Props) {
  const { setCurrentScreen } = useGameContext();
  const [step, setStep] = useState<"setup" | "playing" | "done">("setup");
  const [round, setRound] = useState(0);
  const [options, setOptions] = useState<Player[]>([]);
  const [picks, setPicks] = useState<(Player | null)[]>([null, null, null, null, null]);
  const [mistakes, setMistakes] = useState(0);
  const [, force] = useState(0);

  const t = state.type;
  const isEra = t === "era-cross";
  const isTeam = t === "same-team";
  const isNoRepeat = t === "no-repeat";

  // ── 设置阶段 ──────────────────────────────────────────────────────
  const handleSetup = () => {
    if (isEra) { state.randomEras(); }
    if (isTeam) { const teams = state.getAvailableTeams(); state.setLockedTeam(teams[Math.floor(Math.random() * teams.length)]); }
    setStep("playing");
    loadRound(0);
  };

  const loadRound = (r: number) => {
    const pos = POS_ORDER[r];
    const opts = state.generateOptions(pos);
    setOptions(opts);
    setRound(r);
  };

  const handleSelect = (player: Player) => {
    const pos = POS_ORDER[round];
    const result = state.submitAnswer(pos, player);
    const newPicks = [...picks];
    newPicks[round] = result.finalPlayer;
    setPicks(newPicks);
    setMistakes(state.mistakes);

    if (state.isFinished()) {
      setStep("done");
      const res = state.getResult();
      // 计算最终胜场（惩罚扣减在 runSimulation hook 中处理）
      onComplete(0); // placeholder - actual result computed by caller
    } else {
      setTimeout(() => loadRound(round + 1), 500);
    }
  };

  const hintText = isEra ? `找出属于 ${state.targetEras[POS_ORDER[round]]} 年代的球员！`
    : isTeam ? `找出 ${state.lockedTeam || ""} 的球员！`
    : `不能选已用球队的球员！已用: ${(state as unknown as Record<string, string[]>)._usedTeams?.join(", ") || "无"}`;

  if (step === "setup") {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
        <h2 style={{ fontFamily: "Oswald", color: "var(--gold-light)" }}>{state.config.name}</h2>
        <p style={{ color: "var(--text-muted)", maxWidth: 400 }}>
          {isEra ? "每个位置绑定一个年代，从8个选项中找出该年代球员！" : isTeam ? "从8个选项中找出同一支球队的球员！" : "5个位置不能选重复球队的球员！"}
        </p>
        <p style={{ color: "var(--danger)", fontSize: "0.85rem" }}>每错一题扣 {state.penalty} 胜</p>
        <div>
          {isEra && <div style={{ marginBottom: 8 }}>{POS_ORDER.map((pos) => <span key={pos} style={{ margin: "0 4px", fontSize: "0.7rem", color: "var(--text-muted)" }}>{pos}:{state.targetEras[pos] || "?"}</span>)}</div>}
          {isTeam && <div style={{ marginBottom: 8, color: "var(--gold)" }}>锁定球队: {state.lockedTeam || "?"}</div>}
        </div>
        <button className="btn btn-gold" onClick={handleSetup} style={{ width: 220, justifyContent: "center" }}>开始挑战</button>
        <button className="btn btn-secondary" onClick={() => setCurrentScreen("screen-menu")} style={{ width: 220, justifyContent: "center", marginTop: 8 }}>🏠 返回主页</button>
      </div>
    );
  }

  if (step === "done") {
    const res = state.getResult();
    const penaltyTotal = res.penaltyWins;
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <h2 style={{ fontFamily: "Oswald", color: "var(--gold-light)" }}>挑战完成</h2>
        <p style={{ color: "var(--text-muted)" }}>失误 {res.mistakes} 次，扣除 {penaltyTotal} 胜</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
          {res.roster.map((p, i) => (
            <div key={i} style={{ padding: "6px 10px", background: "rgba(255,255,255,0.06)", borderRadius: 8, fontSize: "0.75rem" }}>
              {p.name.split("-").pop()} ⭐{p.rating || "?"}
            </div>
          ))}
        </div>
        <button className="btn btn-gold" onClick={() => { state.reset(); setStep("setup"); setPicks([null,null,null,null,null]); }} style={{ width: 220, justifyContent: "center" }}>🔄 再来一局</button>
        <button className="btn btn-secondary" onClick={() => setCurrentScreen("screen-menu")} style={{ width: 220, justifyContent: "center", marginTop: 8 }}>🏠 返回主页</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: 500, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ color: "var(--gold)", fontWeight: 700 }}>{state.config.name} · 第 {round + 1}/5 轮 — {POS_ORDER[round]}</span>
        <span style={{ color: "var(--danger)", fontSize: "0.8rem" }}>失误: {mistakes} 次 (-{state.penalty}胜/次)</span>
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginBottom: 12 }}>{hintText}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {options.map((p, i) => (
          <div key={i} className="player-card challenge-card" onClick={() => handleSelect(p)}
            style={{ cursor: "pointer", padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="player-name" style={{ fontSize: "0.85rem" }}>{p.name}</div>
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
              {p.positions.map((x) => <span key={x} className="pos-badge">{x}</span>)} · {p.team} {p.decade}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
