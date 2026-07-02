"use client";

// ===================================================================
//  components/battle/CommonPickPanel.tsx — 公共池抢选面板
// ===================================================================
import { useState, useCallback, useEffect } from "react";
import type { CommonPoolEntry, CommonPoolPlayer } from "@/lib/frontend/states/battle.state";
import type { Position } from "@/lib/game-core";
import { POS_ORDER } from "@/lib/game-core";
import { playerRating } from "@/lib/game-core";
import type { Player } from "@/lib/game-core";

// ── 类型 ────────────────────────────────────────────────────────────────

export type PickMode = "independent" | "common";

export interface CommonPickViewState {
  pickMode: PickMode;
  currentRound: number;
  currentPicker: string | null;
  pool: CommonPoolEntry[];
  deadline: number | null;
  isMyTurn: boolean;
  mySkips: { team: number; decade: number };
  myRoster: Partial<Record<Position, Player | null>>;
  oppRoster: Partial<Record<Position, Player | null>>;
  roomCode: string;
  isHost: boolean;
  status: string | null;
}

interface Props {
  state: CommonPickViewState;
  userId: string | null;
  onPick: (playerName: string, slot: Position) => void;
  onSkip: (type: "team" | "decade") => void;
  onConfirm: () => void;
  onCancel: () => void;
}

// ── 辅助 ────────────────────────────────────────────────────────────────

const POS_CATEGORIES = [
  { key: "all", label: "全部" },
  { key: "g", label: "后卫" },
  { key: "f", label: "前锋" },
  { key: "c", label: "中锋" },
] as const;

const POS_FILTER_MAP: Record<string, Position[]> = {
  g: ["PG", "SG"],
  f: ["SF", "PF"],
  c: ["C"],
};

function getPlayerRating(p: CommonPoolPlayer): number {
  return playerRating({
    name: p.name,
    pos: p.pos,
    positions: p.positions as Position[],
    team: "",
    decade: "",
    pts: p.pts,
    reb: p.reb,
    ast: p.ast,
    stl: p.stl,
    blk: p.blk,
  });
}

// ── 组件 ────────────────────────────────────────────────────────────────

export function CommonPickPanel({
  state,
  userId,
  onPick,
  onSkip,
  onConfirm,
  onCancel,
}: Props) {
  const [selectedSlot, setSelectedSlot] = useState<Position | null>(null);
  const [filterTab, setFilterTab] = useState<string>("all");
  const [countdown, setCountdown] = useState(0);

  const { pool, isMyTurn, myRoster, oppRoster, deadline, mySkips, currentRound } = state;

  // 获取所有池中球员（去重）
  const allPoolPlayers = pool.flatMap((entry) => entry.players);
  const pickedNames = new Set([
    ...Object.values(myRoster).filter(Boolean).map((p) => p!.name),
    ...Object.values(oppRoster).filter(Boolean).map((p) => p!.name),
  ]);

  // 按位置筛选
  const filteredPlayers = allPoolPlayers.filter((p) => {
    if (pickedNames.has(p.name)) return false;
    if (filterTab === "all") return true;
    const allowed = POS_FILTER_MAP[filterTab] || [];
    return p.positions.some((pos) => allowed.includes(pos as Position));
  });

  // 按评分降序排列
  filteredPlayers.sort((a, b) => getPlayerRating(b) - getPlayerRating(a));

  // 倒计时
  useEffect(() => {
    if (!deadline || !isMyTurn) {
      setCountdown(0);
      return;
    }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setCountdown(remaining);
    };
    update();
    const timer = setInterval(update, 200);
    return () => clearInterval(timer);
  }, [deadline, isMyTurn]);

  // 获取当前池信息
  const poolInfo = pool[0];

  // 选人
  const handlePick = useCallback(
    (playerName: string) => {
      if (!selectedSlot || !isMyTurn) return;
      onPick(playerName, selectedSlot);
      setSelectedSlot(null);
    },
    [selectedSlot, isMyTurn, onPick]
  );

  // 检查是否所有人已选满 5 人
  const myFilledCount = Object.values(myRoster).filter(Boolean).length;
  const oppFilledCount = Object.values(oppRoster).filter(Boolean).length;
  const allFilled = myFilledCount >= 5 && oppFilledCount >= 5;

  return (
    <div
      className="battle-play-container"
      style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}
    >
      {/* 顶部状态栏 */}
      <div
        className="battle-play-banner"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          padding: "12px 20px",
          background: "var(--card-bg)",
          borderRadius: "12px",
          border: "1px solid var(--card-border)",
        }}
      >
        <div>
          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
            第 {currentRound}/5 轮
          </span>
          {poolInfo && (
            <span
              style={{
                marginLeft: "12px",
                color: "var(--gold)",
                fontWeight: 600,
              }}
            >
              {poolInfo.team} · {poolInfo.decade}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* 跳过按钮 */}
          <button
            className="btn btn-xs btn-secondary"
            disabled={!isMyTurn || mySkips.team <= 0}
            onClick={() => onSkip("team")}
            title="同年代换一队"
          >
            🔄 换队 ({mySkips.team})
          </button>
          <button
            className="btn btn-xs btn-secondary"
            disabled={!isMyTurn || mySkips.decade <= 0}
            onClick={() => onSkip("decade")}
            title="同队换年代"
          >
            ⏳ 换年代 ({mySkips.decade})
          </button>

          {/* 倒计时 */}
          {isMyTurn && (
            <div
              style={{
                padding: "4px 12px",
                borderRadius: "20px",
                background:
                  countdown <= 5
                    ? "rgba(231,76,60,0.2)"
                    : "rgba(243,156,18,0.15)",
                color: countdown <= 5 ? "var(--danger)" : "var(--gold)",
                fontFamily: "Oswald, monospace",
                fontSize: "1.2rem",
                fontWeight: 700,
                minWidth: "50px",
                textAlign: "center",
              }}
            >
              {countdown}s
            </div>
          )}

          {/* 回合指示 */}
          <div
            style={{
              padding: "4px 12px",
              borderRadius: "8px",
              background: isMyTurn
                ? "rgba(39,174,96,0.2)"
                : "rgba(255,255,255,0.05)",
              color: isMyTurn ? "var(--success)" : "var(--text-muted)",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            {isMyTurn ? "👈 你的回合" : "对手回合"}
          </div>
        </div>
      </div>

      {/* 双方阵容槽位 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        {/* 我的阵容 */}
        <div
          style={{
            padding: "12px",
            borderRadius: "10px",
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
          }}
        >
          <div
            style={{
              fontSize: "0.8rem",
              color: "var(--text-muted)",
              marginBottom: "8px",
            }}
          >
            我的阵容 ({myFilledCount}/5)
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            {POS_ORDER.map((pos) => {
              const player = myRoster[pos];
              const isSelected = selectedSlot === pos;
              return (
                <button
                  key={pos}
                  onClick={() => {
                    if (!player && isMyTurn) setSelectedSlot(isSelected ? null : pos);
                  }}
                  style={{
                    flex: 1,
                    padding: "6px 4px",
                    borderRadius: "6px",
                    border: isSelected
                      ? "2px solid var(--gold)"
                      : "1px solid var(--card-border)",
                    background: player
                      ? "rgba(39,174,96,0.15)"
                      : isSelected
                        ? "rgba(243,156,18,0.1)"
                        : "transparent",
                    cursor: !player && isMyTurn ? "pointer" : "default",
                    textAlign: "center",
                    fontSize: "0.7rem",
                    minHeight: "40px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    transition: "all 0.15s",
                  }}
                >
                  <span
                    style={{
                      color: "var(--text-muted)",
                      fontWeight: 700,
                      fontSize: "0.65rem",
                    }}
                  >
                    {pos}
                  </span>
                  {player ? (
                    <span
                      style={{
                        color: "#fff",
                        fontSize: "0.6rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "100%",
                      }}
                    >
                      {player.name.split("-").pop()}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)", fontSize: "0.55rem" }}>
                      {isSelected ? "选择中" : "空"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 对手阵容 */}
        <div
          style={{
            padding: "12px",
            borderRadius: "10px",
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
          }}
        >
          <div
            style={{
              fontSize: "0.8rem",
              color: "var(--text-muted)",
              marginBottom: "8px",
            }}
          >
            对手阵容 ({oppFilledCount}/5)
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            {POS_ORDER.map((pos) => {
              const player = oppRoster[pos];
              return (
                <div
                  key={pos}
                  style={{
                    flex: 1,
                    padding: "6px 4px",
                    borderRadius: "6px",
                    border: "1px solid var(--card-border)",
                    background: player
                      ? "rgba(231,76,60,0.1)"
                      : "transparent",
                    textAlign: "center",
                    fontSize: "0.7rem",
                    minHeight: "40px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      color: "var(--text-muted)",
                      fontWeight: 700,
                      fontSize: "0.65rem",
                    }}
                  >
                    {pos}
                  </span>
                  {player ? (
                    <span
                      style={{
                        color: "#fff",
                        fontSize: "0.6rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "100%",
                      }}
                    >
                      {player.name.split("-").pop()}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)", fontSize: "0.55rem" }}>
                      --
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 位置筛选标签 */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        {POS_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className={`filter-tab ${filterTab === cat.key ? "active" : ""}`}
            onClick={() => setFilterTab(cat.key)}
            style={{
              padding: "6px 16px",
              borderRadius: "20px",
              border: filterTab === cat.key
                ? "1px solid var(--gold)"
                : "1px solid var(--card-border)",
              background: filterTab === cat.key
                ? "rgba(243,156,18,0.15)"
                : "transparent",
              color: filterTab === cat.key ? "var(--gold)" : "var(--text-muted)",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: 600,
            }}
          >
            {cat.label}
          </button>
        ))}
        {selectedSlot && (
          <span
            style={{
              padding: "6px 16px",
              color: "var(--gold)",
              fontSize: "0.8rem",
            }}
          >
            ← 选择 {selectedSlot} 位球员
          </span>
        )}
      </div>

      {/* 球员列表 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "8px",
          marginBottom: "20px",
          maxHeight: "360px",
          overflowY: "auto",
        }}
      >
        {filteredPlayers.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: "40px",
              color: "var(--text-muted)",
            }}
          >
            {pool.length === 0
              ? "等待公共池生成..."
              : "该位置无可选球员"}
          </div>
        )}
        {filteredPlayers.map((p) => {
          const rating = getPlayerRating(p);
          return (
            <button
              key={p.name}
              className="player-card"
              disabled={!isMyTurn || !selectedSlot}
              onClick={() => handlePick(p.name)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--card-border)",
                background: "var(--card-bg)",
                cursor: isMyTurn && selectedSlot ? "pointer" : "default",
                opacity: isMyTurn && selectedSlot ? 1 : 0.6,
                textAlign: "left",
                transition: "all 0.15s",
                color: "#fff",
                width: "100%",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background:
                    rating >= 90
                      ? "rgba(168,85,247,0.3)"
                      : rating >= 80
                        ? "rgba(34,197,94,0.3)"
                        : "rgba(255,255,255,0.1)",
                  color:
                    rating >= 90
                      ? "#a855f7"
                      : rating >= 80
                        ? "#22c55e"
                        : "var(--text-muted)",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  minWidth: "32px",
                  textAlign: "center",
                }}
              >
                {Math.round(rating)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.name}
                </div>
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--text-muted)",
                  }}
                >
                  {p.positions.join("/")} · PTS:{p.pts} REB:{p.reb} AST:{p.ast}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 底部操作区 */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "12px",
          paddingTop: "12px",
          borderTop: "1px solid var(--card-border)",
        }}
      >
        {allFilled && (
          <button
            className="btn btn-gold"
            onClick={onConfirm}
            style={{ padding: "10px 32px" }}
          >
            ✅ 确认阵容，开始 BO7 对战
          </button>
        )}
        <button
          className="btn btn-secondary"
          onClick={onCancel}
          style={{ padding: "10px 24px" }}
        >
          离开房间
        </button>
      </div>
    </div>
  );
}
