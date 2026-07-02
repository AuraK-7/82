"use client";

// ===================================================================
//  app/page.tsx — 首页
// ===================================================================
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useGameContext } from "@/components/game/GameProviders";
import { useBattleRealtime } from "@/hooks/useBattleRealtime";
import { MainMenu } from "@/components/menu/MainMenu";
import { GameResult } from "@/components/result/GameResult";
import { BattleLobby } from "@/components/battle/BattleLobby";
import { BattleArena } from "@/components/battle/BattleArena";
import { ClassicSlotPanel } from "@/components/classic/ClassicSlotPanel";
import { CustomPickPanel } from "@/components/custom/CustomPickPanel";
import { ChallengePanel } from "@/components/challenge/ChallengePanel";
import { DreamSelectPanel } from "@/components/dream/DreamSelectPanel";
import { DreamResult } from "@/components/dream/DreamResult";
import { LeaderboardPanel } from "@/components/leaderboard/LeaderboardPanel";
import { ClassicState, CustomState, ChallengeState, BattleState, DreamState } from "@/lib/frontend";
import { PlayoffPanel } from "@/components/dream/PlayoffPanel";
import type { PlayoffStep } from "@/components/dream/DreamResult";
import { buildPlayerDataSource, POSTER_BG_SRC } from "@/lib/game-core";
import { apiPost } from "@/lib/api/request";
import type { PlayerDataSource } from "@/lib/frontend";
import type { ScreenId } from "@/components/game/GameProviders";

function LoadingSkeleton() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100vh", gap: 20,
      background: `url(${POSTER_BG_SRC}) center/cover no-repeat`,
      position: "relative",
    }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(10,15,30,0.82)" }} />
      <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        <div style={{
          fontSize: "4rem", lineHeight: 1, margin: "0 auto",
          animation: "bounce 0.6s ease-in-out infinite alternate",
          filter: "drop-shadow(0 0 24px rgba(245,158,11,0.5))",
        }}>🏀</div>
        <p style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, marginTop: 16, marginBottom: 4 }}>
          82-0 完美赛季大挑战
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>加载球员数据...</p>
        <div style={{
          width: 120, height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2,
          margin: "12px auto 0", overflow: "hidden",
        }}>
          <div style={{
            width: "60%", height: "100%", borderRadius: 2,
            background: "linear-gradient(90deg, #f59e0b, #eab308)",
            animation: "loadingBar 1.2s ease-in-out infinite",
          }} />
        </div>
      </div>
      <style>{`
        @keyframes bounce { 0% { transform: translateY(0); } 100% { transform: translateY(-12px); } }
        @keyframes loadingBar { 0% { transform: translateX(-60%); } 50% { transform: translateX(40%); } 100% { transform: translateX(-60%); } }
      `}</style>
    </div>
  );
}

export default function HomePage() {
  const { currentScreen, setCurrentScreen, navigate, urlParams, userId: currentUserId } = useGameContext();
  const isActive = (id: ScreenId) => currentScreen === id;

  // ── 球员数据异步加载 ───────────────────────────────────────────────
  const [playerData, setPlayerData] = useState<PlayerDataSource | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    buildPlayerDataSource()
      .then((data) => { if (!cancelled) { setPlayerData(data); setDataLoading(false); } })
      .catch((err) => { console.error("[HomePage] 球员数据加载失败:", err); if (!cancelled) setDataLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── 模拟结果（传递给结算页） ───────────────────────────────────
  const [simResult, setSimResult] = useState<{
    wins: number; grade: string; tier: string; color: string; teamOvr: number; roster: import("@/lib/game-core").RosterSlots;
  } | null>(null);

  // 记住最后玩的模式，结算页"再来一局"用
  const lastModeRef = useRef<"classic" | "custom" | "dream">("classic");
  // 记住打开排行榜前的屏幕，关闭时返回
  const beforeLeaderboardRef = useRef<ScreenId>("screen-menu");
  const handleOpenLeaderboard = useCallback(() => {
    beforeLeaderboardRef.current = currentScreen;
    setCurrentScreen("screen-leaderboard");
  }, [currentScreen, setCurrentScreen]);
  const handleCloseLeaderboard = useCallback(() => {
    setCurrentScreen(beforeLeaderboardRef.current);
  }, [setCurrentScreen]);

  // ── 游戏 key：每次进入游戏递增，强制重新挂载（清空旧状态） ────
  const gameKeyRef = useRef(0);
  const [gameKey, setGameKey] = useState(0);

  // ── 对战房间状态 ─────────────────────────────────────────────────
  const [battleLoading, setBattleLoading] = useState(false);
  const [roomCodeCreated, setRoomCodeCreated] = useState<string | null>(null);
  const [battleError, setBattleError] = useState<string | null>(null);

  const handleCreateRoom = useCallback(async (pickMode: string) => {
    setBattleLoading(true);
    setBattleError(null);
    try {
      const res = await apiPost("/api/battle", {
        action: "create",
        payload: { nickname: "房主", pickMode },
      });
      if (res.success && res.data) {
        const data = res.data as { room_code: string };
        setRoomCodeCreated(data.room_code);
        // 更新 URL 附带房间号（可复制分享给好友加入）
        navigate("screen-battle-lobby", { room: data.room_code });
      } else {
        setBattleError(res.error || "创建房间失败");
      }
    } catch {
      setBattleError("网络错误，请重试");
    } finally {
      setBattleLoading(false);
    }
  }, [navigate]);

  const handleJoinRoom = useCallback(async (roomCode: string) => {
    setBattleLoading(true);
    setBattleError(null);
    try {
      const res = await apiPost("/api/battle", {
        action: "join",
        payload: { roomCode, nickname: "挑战者" },
      });
      if (res.success && res.data) {
        setCurrentScreen("screen-battle-play");
      } else {
        setBattleError(res.error || "加入房间失败");
      }
    } catch {
      setBattleError("网络错误，请重试");
    } finally {
      setBattleLoading(false);
    }
  }, [setCurrentScreen]);

  const handleBackToMenu = useCallback(() => {
    setRoomCodeCreated(null);
    setBattleError(null);
    setCurrentScreen("screen-menu");
  }, [setCurrentScreen]);

  // ── 分享链接自动加入房间 ────────────────────────────────────────
  const shareRoomCode = urlParams.room;
  useEffect(() => {
    if (shareRoomCode && shareRoomCode.length === 6 && currentScreen === "screen-battle-lobby" && !roomCodeCreated) {
      // 通过分享链接进入 → 清空 URL 中的 room 参数（防止重复加入）
      handleJoinRoom(shareRoomCode.toUpperCase()).then(() => {
        // 加入成功后清除 URL 中的 room 参数，使链接失效
        navigate("screen-battle-lobby");
      });
    }
  }, [shareRoomCode]); // 仅在 URL 参数变化时触发

  // ── Supabase Realtime 实时同步对手加入 ──────────────────────────
  const activeRoomCode = roomCodeCreated || (currentScreen === "screen-battle-lobby" ? shareRoomCode : null);
  useBattleRealtime({
    roomCode: activeRoomCode || "",
    isHost: !!roomCodeCreated,
    enabled: !!activeRoomCode && currentScreen === "screen-battle-lobby",
    onOpponentJoined: () => {
      setCurrentScreen("screen-battle-play");
    },
  });

  // ── 进入经典/自选模式时自动重置旧状态 ──────────────────────────
  useEffect(() => {
    if (currentScreen === "screen-game") {
      classicState?.reset();
      gameKeyRef.current += 1;
      setGameKey(gameKeyRef.current);
    }
  }, [currentScreen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 状态机（数据加载完成后才创建） ─────────────────────────────
  const allPlayers = useMemo(() => {
    if (!playerData) return [];
    return Object.values(playerData).flatMap((teams) => Object.values(teams).flat());
  }, [playerData]);

  const classicState = useMemo(() => {
    if (!playerData) return null;
    return new ClassicState(playerData);
  }, [playerData]);

  const customState = useMemo(() => {
    if (allPlayers.length === 0) return null;
    return new CustomState(allPlayers);
  }, [allPlayers]);

  const challengeState = useMemo(() => {
    if (allPlayers.length === 0) return null;
    return new ChallengeState("era-cross", allPlayers);
  }, [allPlayers]);

  const battleState = useMemo(() => {
    if (!playerData) return null;
    return new BattleState(playerData);
  }, [playerData]);

  // ── 圆梦模式状态 ─────────────────────────────────────────────────
  const [dreamPlayer, setDreamPlayer] = useState<import("@/lib/frontend").DreamPlayer | null>(null);
  const dreamState = useMemo(() => {
    if (!playerData) return null;
    const ds = new DreamState(playerData);
    return ds;
  }, [playerData]);
  const [dreamGameKey, setDreamGameKey] = useState(0);
  const dreamGameKeyRef = useRef(0);
  // 常规赛结果（用于显示结算页+季后赛入口）
  const [dreamRegResult, setDreamRegResult] = useState<{
    wins: number; grade: string; tier: string; color: string; teamOvr: number; roster: import("@/lib/game-core").RosterSlots;
  } | null>(null);
  // 季后赛结果
  const [dreamPlayoffResult, setDreamPlayoffResult] = useState<{
    outcome: "champion" | "eliminated" | "missed-playoffs";
    playerName: string;
    playerIcon: string;
    regRecord: string;
    playoffPath?: import("@/components/dream/DreamResult").PlayoffPath;
    eliminatedRound?: string;
  } | null>(null);

  // 圆梦模式：确认球星 → 进入选人
  const handleDreamConfirm = useCallback((dp: import("@/lib/frontend").DreamPlayer) => {
    if (!dreamState || !playerData) return;
    lastModeRef.current = "dream";
    dreamState.reset();
    dreamState.selectDreamPlayer(dp);
    setDreamPlayer(dp);
    setDreamRegResult(null);
    setDreamPlayoffResult(null);
    dreamGameKeyRef.current += 1;
    setDreamGameKey(dreamGameKeyRef.current);
    setCurrentScreen("screen-game");
  }, [dreamState, playerData, setCurrentScreen]);

  // 圆梦模式：选人完成 → 常规赛模拟 → 判断季后赛资格
  const handleDreamPickComplete = useCallback((_wins: number) => {
    if (!dreamState) return;
    const sim = dreamState.simulate();
    setDreamRegResult({ wins: sim.wins, grade: sim.grade, tier: sim.label, color: sim.color, teamOvr: sim.teamOvr, roster: dreamState.roster.slots });

    if (sim.wins < 50) {
      // 无缘季后赛 → 直接结局
      setDreamPlayoffResult({
        outcome: "missed-playoffs",
        playerName: dreamPlayer?.cname || "",
        playerIcon: dreamPlayer?.icon || "",
        regRecord: `${sim.wins}-${sim.losses}`,
      });
      setCurrentScreen("screen-dream-result");
    } else {
      // 显示常规赛结算 + 季后赛入口
      setSimResult({ wins: sim.wins, grade: sim.grade, tier: sim.label, color: sim.color, teamOvr: sim.teamOvr, roster: dreamState.roster.slots });
      setCurrentScreen("screen-result");
    }
  }, [dreamState, dreamPlayer, setCurrentScreen]);

  // 圆梦模式：进入季后赛
  const handleDreamEnterPlayoffs = useCallback(() => {
    setCurrentScreen("screen-playoffs");
  }, [setCurrentScreen]);

  // 圆梦模式：季后赛结束
  const handleDreamPlayoffFinish = useCallback((outcome: "champion" | "eliminated", playoffPath: PlayoffStep[]) => {
    const reg = dreamRegResult;
    const eliminatedRound = outcome === "eliminated" ? (playoffPath.length > 0 ? ["首轮","次轮","分区决赛","总决赛"][playoffPath[playoffPath.length - 1].round] : "首轮") : undefined;
    setDreamPlayoffResult({
      outcome,
      playerName: dreamPlayer?.cname || "",
      playerIcon: dreamPlayer?.icon || "",
      regRecord: reg ? `${reg.wins}-${82 - reg.wins}` : "41-41",
      playoffPath: playoffPath as unknown as import("@/components/dream/DreamResult").PlayoffStep[],
      eliminatedRound,
    });
    setCurrentScreen("screen-dream-result");
  }, [dreamRegResult, dreamPlayer, setCurrentScreen]);

  // ── 加载中展示骨架屏 ────────────────────────────────────────────
  if (dataLoading || !playerData) {
    return <LoadingSkeleton />;
  }

  return (
    <>
      <div id="screen-menu" className={`screen ${isActive("screen-menu") ? "active" : ""}`}>
        <MainMenu />
      </div>
      <div id="screen-game" className={`screen ${isActive("screen-game") ? "active" : ""}`}>
        {/* 圆梦模式选人（已有队长时进入） */}
        {dreamPlayer && dreamState ? (
          <ClassicSlotPanel
            key={`dream-${dreamGameKey}`}
            state={dreamState as unknown as ClassicState}
            onComplete={handleDreamPickComplete}
          />
        ) : classicState ? (
          <ClassicSlotPanel
            key={gameKey}
            state={classicState}
            onComplete={(_wins) => {
              lastModeRef.current = "classic";
              const sim = classicState.simulate();
              setSimResult({ wins: sim.wins, grade: sim.grade, tier: sim.label, color: sim.color, teamOvr: sim.teamOvr, roster: classicState.roster.slots });
              setCurrentScreen("screen-result");
            }}
          />
        ) : null}
      </div>
      <div id="screen-custom" className={`screen ${isActive("screen-custom") ? "active" : ""}`}>
        {customState && (
          <CustomPickPanel
            state={customState}
            allPlayers={allPlayers}
            onSimulate={() => {
              lastModeRef.current = "custom";
              const sim = customState.simulate();
              setDreamRegResult(null);
              setDreamPlayer(null);
              setSimResult({ wins: sim.wins, grade: sim.grade, tier: sim.label, color: sim.color, teamOvr: sim.teamOvr, roster: customState.roster.slots });
              setCurrentScreen("screen-result");
            }}
          />
        )}
      </div>
      <div id="screen-result" className={`screen ${isActive("screen-result") ? "active" : ""}`}>
        <GameResult
          wins={simResult?.wins ?? 0}
          grade={simResult?.grade ?? "C"}
          tier={simResult?.tier ?? "季后赛球队"}
          color={simResult?.color ?? "#f59e0b"}
          teamOvr={simResult?.teamOvr ?? 75}
          roster={simResult?.roster ?? {}}
          gameMode={lastModeRef.current}
          dreamPlayerName={dreamPlayer?.cname}
          onBackToMenu={() => { setSimResult(null); setDreamRegResult(null); setCurrentScreen("screen-menu"); }}
          onPlayAgain={() => {
            const mode = lastModeRef.current;
            if (mode === "dream" && dreamPlayer) {
              dreamState?.reset();
              dreamState?.selectDreamPlayer(dreamPlayer);
              dreamGameKeyRef.current += 1;
              setDreamGameKey(dreamGameKeyRef.current);
              setCurrentScreen("screen-game");
            } else if (mode === "custom") {
              customState?.reset();
              setCurrentScreen("screen-custom");
            } else {
              classicState?.reset();
              gameKeyRef.current += 1;
              setGameKey(gameKeyRef.current);
              setCurrentScreen("screen-game");
            }
            setSimResult(null);
            setDreamRegResult(null);
          }}
          onLeaderboard={handleOpenLeaderboard}
          extraActions={dreamPlayer && simResult && (simResult.wins >= 50) ? (
            <button className="btn btn-gold" onClick={handleDreamEnterPlayoffs}
              style={{ width: 220, justifyContent: "center", background: "linear-gradient(135deg,#e67e22,#e74c3c)" }}>
              🏀 进入季后赛
            </button>
          ) : undefined}
        />
      </div>
      <div id="screen-battle-lobby" className={`screen ${isActive("screen-battle-lobby") ? "active" : ""}`}>
        <BattleLobby
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onShowHistory={() => setCurrentScreen("screen-battle-lobby")}
          onBackToMenu={handleBackToMenu}
          loading={battleLoading}
          roomCodeCreated={roomCodeCreated}
        />
        {battleError && (
          <div style={{ textAlign: "center", color: "var(--danger)", marginTop: 12, fontSize: "0.85rem" }}>
            ❌ {battleError}
          </div>
        )}
      </div>
      <div id="screen-battle-play" className={`screen ${isActive("screen-battle-play") ? "active" : ""}`}>
        {battleState && (
          <BattleArena
            state={battleState}
            myName="房主" oppName="对手" userId={null}
            onFinish={() => setCurrentScreen("screen-battle-result")}
          />
        )}
      </div>
      <div id="screen-battle-result" className={`screen ${isActive("screen-battle-result") ? "active" : ""}`}>
        <GameResult
          wins={50} grade="C" tier="季后赛球队" color="#f59e0b" teamOvr={75}
          gameMode="battle"
          onBackToMenu={() => setCurrentScreen("screen-menu")}
          onPlayAgain={() => setCurrentScreen("screen-battle-lobby")}
          onLeaderboard={handleOpenLeaderboard}
        />
      </div>
      <div id="screen-dream-select" className={`screen ${isActive("screen-dream-select") ? "active" : ""}`}>
        <DreamSelectPanel
          onConfirm={handleDreamConfirm}
          onBack={() => setCurrentScreen("screen-menu")}
        />
      </div>
      <div id="screen-dream-result" className={`screen ${isActive("screen-dream-result") ? "active" : ""}`}>
        <DreamResult
          outcome={dreamPlayoffResult?.outcome || "champion"}
          playerName={dreamPlayoffResult?.playerName || ""}
          playerIcon={dreamPlayoffResult?.playerIcon || ""}
          regRecord={dreamPlayoffResult?.regRecord || ""}
          playoffPath={dreamPlayoffResult?.playoffPath}
          eliminatedRound={dreamPlayoffResult?.eliminatedRound}
          onPlayAgain={() => setCurrentScreen("screen-dream-select")}
          onBackToMenu={() => setCurrentScreen("screen-menu")}
        />
      </div>
      <div id="screen-leaderboard" className={`screen ${isActive("screen-leaderboard") ? "active" : ""}`}>
        {isActive("screen-leaderboard") && <LeaderboardPanel onClose={handleCloseLeaderboard} />}
      </div>
      <div id="screen-playoffs" className={`screen ${isActive("screen-playoffs") ? "active" : ""}`}>
        {/* 圆梦季后赛 */}
        {dreamPlayer && dreamState ? (
          <PlayoffPanel
            state={dreamState}
            onFinish={handleDreamPlayoffFinish}
          />
        ) : challengeState ? (
          <ChallengePanel
            state={challengeState}
            onComplete={() => setCurrentScreen("screen-result")}
          />
        ) : null}
      </div>
    </>
  );
}
