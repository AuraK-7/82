"use client";

// ===================================================================
//  components/dream/DreamResult.tsx — 圆梦模式结局页
//  夺冠 / 淘汰 / 无缘季后赛 三种状态
// ===================================================================
import { SafeImage } from "@/components/ui/SafeImage";

export interface PlayoffStep { round: number; ourWins: number; oppWins: number; won: boolean; oppLeaderName: string; }
export type PlayoffPath = PlayoffStep[];

interface DreamResultProps {
  outcome: "champion" | "eliminated" | "missed-playoffs";
  playerName: string; playerIcon: string;
  regRecord: string;
  playoffPath?: PlayoffStep[];
  eliminatedRound?: string;
  onPlayAgain: () => void;
  onBackToMenu: () => void;
}

const ROUND_NAMES = ["首轮", "次轮", "分区决赛", "总决赛"];

function PlayerIcon({ icon, name }: { icon: string; name: string }) {
  return (
    <SafeImage
      className="dp-img"
      src={icon}
      alt={name}
      width={40}
      style={{ verticalAlign: "middle", marginRight: 8 }}
    />
  );
}

export function DreamResult({ outcome, playerName, playerIcon, regRecord, playoffPath, eliminatedRound, onPlayAgain, onBackToMenu }: DreamResultProps) {
  return (
    <div id="screen-dream-result" className="screen" style={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "calc(100vh - 80px)" }}>
      <button className="back-nav" onClick={onBackToMenu} style={{ position: "absolute", top: 12, left: 12, zIndex: 10 }} title="返回主菜单">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div className="dream-ending">
        {outcome === "champion" && (
          <>
            <div className="trophy" style={{ fontSize: "4rem", marginBottom: 12 }}>🏆</div>
            <div className="ending-title" style={{ fontSize: "1.8rem", color: "var(--gold-light)" }}>🎉 圆梦成功！</div>
            <div className="ending-player">
              <PlayerIcon icon={playerIcon} name={playerName} />
              {playerName} 终于夺冠了！
            </div>
            <div className="ending-sub" style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: 8 }}>
              常规赛 {regRecord}<br />
              经过一个完美的赛季，{playerName} 终于捧起了奥布莱恩杯！<br />
              多年的等待，在这一刻圆梦！
            </div>
          </>
        )}

        {outcome === "eliminated" && (
          <>
            <div style={{ fontSize: "4rem", marginBottom: 12 }}>💔</div>
            <div className="ending-title" style={{ fontSize: "1.8rem" }}>遗憾止步</div>
            <div className="ending-player">
              <PlayerIcon icon={playerIcon} name={playerName} />
              {playerName}
            </div>
            <div className="ending-sub" style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: 8 }}>
              常规赛 {regRecord}<br />
              {playerName}的冠军梦还在继续...<br />
              止步{eliminatedRound || ""}，下赛季再战！
            </div>
          </>
        )}

        {outcome === "missed-playoffs" && (
          <>
            <div style={{ fontSize: "4rem", marginBottom: 12 }}>😢</div>
            <div className="ending-title" style={{ fontSize: "1.8rem" }}>无缘季后赛</div>
            <div className="ending-player">
              <PlayerIcon icon={playerIcon} name={playerName} />
              {playerName}
            </div>
            <div className="ending-sub" style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: 8 }}>
              常规赛仅取得 {regRecord}，<br />
              遗憾未能进入季后赛，{playerName} 的冠军梦明年再续...
            </div>
          </>
        )}

        {playoffPath && playoffPath.length > 0 && (
          <div className="ending-playoff-path" style={{ marginTop: 12 }}>
            {playoffPath.map((h, i) => (
              h.won && h.round === 3
                ? <div key={i} className="step done">🏆 {ROUND_NAMES[h.round]} 对阵{h.oppLeaderName} {h.ourWins}-{h.oppWins} 夺冠！</div>
                : h.won
                  ? <div key={i} className="step done">🏀 {ROUND_NAMES[h.round]} 对阵{h.oppLeaderName} {h.ourWins}-{h.oppWins} 晋级</div>
                  : <div key={i} className="step fail">{ROUND_NAMES[h.round]} 对阵{h.oppLeaderName} {h.ourWins}-{h.oppWins} 出局</div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", marginTop: 20 }}>
          <button className="btn btn-gold" onClick={onPlayAgain} style={{ width: 220, justifyContent: "center" }}>
            🌟 再来一局
          </button>
          <button className="btn btn-secondary" onClick={onBackToMenu} style={{ width: 220, justifyContent: "center" }}>
            🏠 返回主页
          </button>
        </div>
      </div>
    </div>
  );
}
