// ===================================================================
//  lib/frontend/states/battle.state.ts — 双人对战前端状态机
//  封装：房间状态同步、选人进度、对战进度、轮询/Realtime 状态对齐
// ===================================================================
import { BaseGameState } from "./base-game-state";
import { RosterManager } from "../roster-manager";
import { SlotMachine, type PlayerDataSource } from "../slot-machine";
import { calcTeamRating } from "@/lib/game-core";
import type { GameStateSnapshot } from "../types";
import type { Player, Position, RosterSlots, SingleGameResult } from "@/lib/game-core";

// ── 公共池类型 ──────────────────────────────────────────────────────

export interface CommonPoolPlayer {
  name: string;
  pos: string;
  positions: string[];
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
}

export interface CommonPoolEntry {
  team: string;
  decade: string;
  players: CommonPoolPlayer[];
}

export class BattleState extends BaseGameState {
  readonly roster: RosterManager;
  readonly slotMachine: SlotMachine;

  private _round = 0;
  private _maxRounds = 5;
  private _roomCode: string | null = null;
  private _isHost = false;
  private _status: string | null = null;
  private _opponentName = "";
  private _opponentProgress = 0;
  private _opponentReady = false;
  private _myReady = false;
  private _playoffGames: SingleGameResult[] = [];
  private _hostWins = 0;
  private _guestWins = 0;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;

  // 公共池抢选
  private _pickMode: "independent" | "common" = "independent";
  private _commonPool: CommonPoolEntry[] = [];
  private _currentPickRound = 0;
  private _currentPicker: string | null = null;
  private _pickDeadline: number | null = null;
  private _mySkips = { team: 1, decade: 1 };
  private _myUserId: string | null = null;

  private _getMyUserId(): string { return this._myUserId || ""; }

  constructor(playerData: PlayerDataSource) {
    super("battle");
    this.roster = new RosterManager();
    this.slotMachine = new SlotMachine(playerData);
    this.roster.on("roster-update", () => this.emit("roster-update"));
  }

  // ── 状态访问 ──────────────────────────────────────────────────────

  get roomCode(): string | null { return this._roomCode; }
  get isHost(): boolean { return this._isHost; }
  get status(): string | null { return this._status; }
  get opponentName(): string { return this._opponentName; }
  get opponentProgress(): number { return this._opponentProgress; }
  get opponentReady(): boolean { return this._opponentReady; }
  get myReady(): boolean { return this._myReady; }
  get round(): number { return this._round; };

  // ── 公共池访问器 ──────────────────────────────────────────────────

  get pickMode(): "independent" | "common" { return this._pickMode; }
  get commonPool(): CommonPoolEntry[] { return this._commonPool; }
  get currentPickRound(): number { return this._currentPickRound; }
  get currentPicker(): string | null { return this._currentPicker; }
  get pickDeadline(): number | null { return this._pickDeadline; }
  get mySkips(): { team: number; decade: number } { return { ...this._mySkips }; }

  /** 是否为当前选人方 */
  get isMyTurn(): boolean {
    return this._currentPicker !== null && this._currentPicker === this._getMyUserId();
  }

  /** 获取倒计时秒数 */
  getCountdown(): number {
    if (!this._pickDeadline) return 0;
    const remaining = Math.ceil((this._pickDeadline - Date.now()) / 1000);
    return Math.max(0, remaining);
  }

  /** 初始化公共池选人 */
  enterCommonPicking(roomCode: string, isHost: boolean, myUserId: string): void {
    this._roomCode = roomCode;
    this._isHost = isHost;
    this._myUserId = myUserId;
    this._pickMode = "common";
    this._status = "picking";
    this._round = 0;
    this._myReady = false;
    this._mySkips = { team: 1, decade: 1 };
    this.roster.reset();
    this.slotMachine.reset();
  }

  /** 从房间数据同步状态 */
  syncFromRoom(room: Record<string, unknown>): void {
    this._status = room.status as string;
    this._opponentName = this._isHost
      ? (room.guest_nickname as string) || "对手"
      : (room.host_nickname as string) || "对手";
    this._opponentProgress = this._isHost
      ? (room.guest_pick_progress as number) || 0
      : (room.host_pick_progress as number) || 0;
    this._opponentReady = this._isHost
      ? (room.guest_ready as boolean) || false
      : (room.host_ready as boolean) || false;

    // 公共池字段
    this._pickMode = (room.pick_mode as "independent" | "common") || "independent";
    this._commonPool = (room.common_pool as CommonPoolEntry[]) || [];
    this._currentPickRound = (room.current_pick_round as number) || 0;
    this._currentPicker = (room.current_picker as string) || null;
    const dl = room.pick_deadline as string | number | null;
    this._pickDeadline = dl ? new Date(dl as string).getTime() : null;
    const sk = this._isHost
      ? (room.host_skips as { team: number; decade: number })
      : (room.guest_skips as { team: number; decade: number });
    if (sk) this._mySkips = { ...sk };

    const ps = room.playoff_state as Record<string, unknown> | null;
    if (ps) {
      this._playoffGames = (ps.games as SingleGameResult[]) || [];
      this._hostWins = (ps.hostWins as number) || 0;
      this._guestWins = (ps.guestWins as number) || 0;
    }
  }

  /** 进入选人 */
  enterPicking(roomCode: string, isHost: boolean): void {
    this._roomCode = roomCode;
    this._isHost = isHost;
    this._status = "picking";
    this._round = 0;
    this._myReady = false;
    this.roster.reset();
    this.slotMachine.reset();
  }

  /** 开始轮询 */
  startPolling(onUpdate: (room: Record<string, unknown>) => void, interval = 2000): void {
    this.stopPolling();
    this._pollTimer = setInterval(() => {
      if (!this._roomCode) return;
      fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getState", payload: { roomCode: this._roomCode } }),
      })
        .then((r) => r.json())
        .then((res) => { if (res.success && res.data) onUpdate(res.data); });
    }, interval);
  }

  stopPolling(): void {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
  }

  // ── 选人操作 ──────────────────────────────────────────────────────

  spin() { return this.slotMachine.spin(); }
  skipTeam() { return this.slotMachine.skipTeam(); }
  skipDecode() { return this.slotMachine.skipDecade(); }

  confirmPick(player: Player, slot: Position): boolean {
    if (this._round >= this._maxRounds) return false;
    if (!this.roster.addPlayer(player, slot)) return false;
    this._round++;
    this.emit("opponent-progress", null);
    return true;
  }

  markReady(): boolean {
    if (!this.roster.isFull()) return false;
    this._myReady = true;
    return true;
  }

  // ── 对战进度 ──────────────────────────────────────────────────────

  get myWins(): number { return this._isHost ? this._hostWins : this._guestWins; }
  get oppWins(): number { return this._isHost ? this._guestWins : this._hostWins; }
  get playoffGames(): SingleGameResult[] { return this._playoffGames; }
  isSeriesOver(): boolean { return this._hostWins >= 4 || this._guestWins >= 4; }
  iWon(): boolean { return this._isHost ? this._hostWins >= 4 : this._guestWins >= 4; }

  reset(): void {
    this.stopPolling();
    this._round = 0; this._roomCode = null; this._isHost = false;
    this._status = null; this._opponentName = ""; this._opponentProgress = 0;
    this._opponentReady = false; this._myReady = false;
    this._playoffGames = []; this._hostWins = 0; this._guestWins = 0;
    this._pickMode = "independent"; this._commonPool = [];
    this._currentPickRound = 0; this._currentPicker = null;
    this._pickDeadline = null; this._mySkips = { team: 1, decade: 1 };
    this.roster.reset();
    this.slotMachine.reset();
    this.emit("state-change");
  }

  getSnapshot(): GameStateSnapshot {
    return {
      mode: "battle",
      round: this._round, maxRounds: this._maxRounds,
      slots: this.roster.slots,
      roster: Object.values(this.roster.slots).filter(Boolean) as Player[],
      usedDecades: [], usedCombos: [],
      skipTeam: 0, skipDecade: 0,
      currentTeam: null, currentDecade: null, spun: false,
    };
  }
}
