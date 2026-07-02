"use client";

// ===================================================================
//  components/battle/BattleArena.tsx — 对战过程页
//  支持独立随机 + 公共池抢选双模式
// ===================================================================
import { useEffect, useState } from "react";
import type { SingleGameResult, Position, Player } from "@/lib/game-core";
import type { BattleState } from "@/lib/frontend";
import { CommonPickPanel } from "./CommonPickPanel";
import type { CommonPickViewState } from "./CommonPickPanel";

interface Props {
  state: BattleState;
  myName: string;
  oppName: string;
  userId: string | null;
  onPickPlayer?: (playerName: string, slot: Position) => void;
  onSkipPool?: (type: "team" | "decade") => void;
  onConfirmRoster?: () => void;
  onCancelPick?: () => void;
  onFinish: () => void;
}

function seg7html(num: number): string {
  const m: Record<number, number[]> = {
    0: [1, 1, 1, 1, 1, 1, 0],
    1: [0, 1, 1, 0, 0, 0, 0],
    2: [1, 1, 0, 1, 1, 0, 1],
    3: [1, 1, 1, 1, 0, 0, 1],
    4: [0, 1, 1, 0, 0, 1, 1],
    5: [1, 0, 1, 1, 0, 1, 1],
    6: [1, 0, 1, 1, 1, 1, 1],
    7: [1, 1, 1, 0, 0, 0, 0],
    8: [1, 1, 1, 1, 1, 1, 1],
    9: [1, 1, 1, 1, 0, 1, 1],
  };
  const p = m[num] || m[8];
  const names = ["a", "b", "c", "d", "e", "f", "g"];
  return p
    .map((on, i) => `<i class="seg seg-${names[i]}${on ? "" : " off"}"></i>`)
    .join("");
}

export function BattleArena({
  state,
  myName,
  oppName,
  userId,
  onPickPlayer,
  onSkipPool,
  onConfirmRoster,
  onCancelPick,
  onFinish,
}: Props) {
  const [digiHome, setDigiHome] = useState("000");
  const [digiGuest, setDigiGuest] = useState("000");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const myWins = state.myWins;
  const oppWins = state.oppWins;
  const games = state.playoffGames;
  const isHost = state.isHost;
  const seriesOver = state.isSeriesOver();
  const iWon = state.iWon();

  useEffect(() => {
    if (seriesOver && !done) {
      setDone(true);
      onFinish();
    }
  }, [seriesOver, done, onFinish]);

  const animate = (h: number, g: number) => {
    setDigiHome("000");
    setDigiGuest("000");
    let t = 0;
    const iv = setInterval(() => {
      t++;
      const p = 1 - Math.pow(1 - t / 45, 4);
      setDigiHome(`${Math.min(Math.round(h * p), h)}`.padStart(3, "0"));
      setDigiGuest(`${Math.min(Math.round(g * p), g)}`.padStart(3, "0"));
      if (t >= 45) {
        clearInterval(iv);
        setDigiHome(`${h}`.padStart(3, "0"));
        setDigiGuest(`${g}`.padStart(3, "0"));
      }
    }, 45);
  };

  const handleSimOne = async () => {
    if (!isHost || loading || seriesOver) return;
    setLoading(true);
    try {
      const res = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "simulate",
          payload: { roomCode: state.roomCode, mode: "single" },
        }),
      });
      const json = await res.json();
      if (json.success?.data?.playoff_state) {
        const ps = json.success.data.playoff_state;
        const gs: SingleGameResult[] = ps.games || [];
        if (gs.length > 0)
          animate(gs[gs.length - 1].hostScore, gs[gs.length - 1].guestScore);
        state.syncFromRoom(json.success.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSimSeries = async () => {
    if (!isHost || loading || seriesOver) return;
    setLoading(true);
    const doNext = async () => {
      if (state.isSeriesOver()) {
        setLoading(false);
        setDone(true);
        onFinish();
        return;
      }
      try {
        const res = await fetch("/api/battle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "simulate",
            payload: { roomCode: state.roomCode, mode: "single" },
          }),
        });
        const json = await res.json();
        if (json.success?.data) {
          const ps = json.success.data.playoff_state as {
            games: SingleGameResult[];
            hostWins: number;
            guestWins: number;
            done: boolean;
          };
          const gs = ps.games || [];
          if (gs.length > 0)
            animate(gs[gs.length - 1].hostScore, gs[gs.length - 1].guestScore);
          state.syncFromRoom(json.success.data);
          setTimeout(() => doNext(), 600);
        }
      } catch {
        setLoading(false);
      }
    };
    doNext();
  };

  // ── 公共池选人模式 ──────────────────────────────────────────────────
  if (state.pickMode === "common" && state.status === "picking") {
    const viewState: CommonPickViewState = {
      pickMode: "common",
      currentRound: state.currentPickRound,
      currentPicker: state.currentPicker,
      pool: state.commonPool,
      deadline: state.pickDeadline,
      isMyTurn: state.isMyTurn,
      mySkips: state.mySkips,
      myRoster: state.roster.slots,
      oppRoster: {} as Record<Position, Player | null>,
      roomCode: state.roomCode || "",
      isHost: state.isHost,
      status: state.status,
    };

    return (
      <CommonPickPanel
        state={viewState}
        userId={userId}
        onPick={(name, slot) => onPickPlayer?.(name, slot)}
        onSkip={(type) => onSkipPool?.(type)}
        onConfirm={() => onConfirmRoster?.()}
        onCancel={() => onCancelPick?.()}
      />
    );
  }

  // ── 对战阶段 ────────────────────────────────────────────────────────
  return (
    <div
      id="screen-battle-play"
      className="screen"
      style={{ display: "flex", flexDirection: "column" }}
    >
      <div style={{ padding: "10px 16px" }}>
        <button className="back-nav" onClick={onFinish}>
          ← 返回
        </button>
      </div>
      <div
        className="battle-play-container"
        style={{ maxWidth: 600, margin: "0 auto", width: "100%" }}
      >
        <div
          className="battle-play-banner"
          style={{
            textAlign: "center",
            fontSize: "1.1rem",
            fontWeight: 700,
            padding: 8,
          }}
        >
          <span style={{ color: "var(--success)" }}>{myName}</span>{" "}
          <span style={{ color: "var(--text-muted)" }}>VS</span>{" "}
          <span style={{ color: "var(--danger)" }}>{oppName}</span>
        </div>
        <div
          className="battle-rosters"
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            padding: "8px 12px",
            fontSize: "0.7rem",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ color: "var(--success)", marginBottom: 4 }}>
              🏠 {myName}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: "right" }}>
            <div style={{ color: "var(--danger)", marginBottom: 4 }}>
              👤 {oppName}
            </div>
          </div>
        </div>
        <div
          className="digi-board"
          style={{
            margin: 12,
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16,
            padding: 16,
            textAlign: "center",
          }}
        >
          <div
            className="digi-row"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <div className="digi-score-col">
              <span
                className="digi-score home"
                dangerouslySetInnerHTML={{
                  __html: digiHome
                    .split("")
                    .map(
                      (c) =>
                        `<span class="seg7">${seg7html(parseInt(c) || 0)}</span>`
                    )
                    .join(""),
                }}
              />
              <span className="digi-team" style={{ color: "var(--success)" }}>
                {myName}
              </span>
            </div>
            <span className="digi-colon">-</span>
            <div className="digi-score-col">
              <span
                className="digi-score away"
                dangerouslySetInnerHTML={{
                  __html: digiGuest
                    .split("")
                    .map(
                      (c) =>
                        `<span class="seg7">${seg7html(parseInt(c) || 0)}</span>`
                    )
                    .join(""),
                }}
              />
              <span
                className="digi-team away"
                style={{ color: "var(--danger)" }}
              >
                {oppName}
              </span>
            </div>
          </div>
          <div
            className="battle-series"
            style={{ fontSize: "1.4rem", fontWeight: 700, marginTop: 8 }}
          >
            {myWins} - {oppWins}
          </div>
        </div>
        <div style={{ padding: "0 12px", maxHeight: 160, overflowY: "auto" }}>
          {games.map((g: SingleGameResult, i: number) => {
            const myS = isHost ? g.hostScore : g.guestScore;
            const oppS = isHost ? g.guestScore : g.hostScore;
            const win = isHost ? g.hostWin : !g.hostWin;
            return (
              <div
                key={i}
                className="battle-game-row"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 8px",
                  margin: "2px 0",
                  borderRadius: 4,
                  fontSize: "0.72rem",
                  background: win
                    ? "rgba(39,174,96,0.1)"
                    : "rgba(231,76,60,0.1)",
                }}
              >
                <span style={{ color: "var(--text-muted)" }}>G{i + 1}</span>
                <span style={{ fontWeight: 700 }}>
                  {myS} - {oppS}
                </span>
                <span>{win ? "✅" : "❌"}</span>
              </div>
            );
          })}
        </div>
        {!seriesOver && (
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              padding: 12,
            }}
          >
            <button
              className="btn btn-gold btn-sm"
              disabled={!isHost || loading}
              onClick={handleSimOne}
            >
              {isHost ? "🎮 模拟一场" : "⏳ 等待房主操作"}
            </button>
            <button
              className="btn btn-gold btn-sm"
              disabled={!isHost || loading}
              onClick={handleSimSeries}
            >
              {isHost ? "⚡ 一键系列赛" : "⏳ 等待房主操作"}
            </button>
          </div>
        )}
        {seriesOver && (
          <div
            className={`battle-series-result ${iWon ? "win" : "lose"}`}
            style={{
              textAlign: "center",
              padding: 16,
              fontSize: "1.2rem",
              fontWeight: 700,
              borderRadius: 12,
              margin: 12,
              color: iWon ? "var(--success)" : "var(--danger)",
              background: iWon
                ? "rgba(39,174,96,0.1)"
                : "rgba(231,76,60,0.1)",
              border: `1px solid ${iWon ? "rgba(39,174,96,0.3)" : "rgba(231,76,60,0.3)"}`,
            }}
          >
            {iWon ? "🎉" : "💔"} {myWins}-{oppWins}{" "}
            {iWon ? "你赢了！" : "你输了"}
          </div>
        )}
      </div>
    </div>
  );
}
