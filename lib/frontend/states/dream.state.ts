// ===================================================================
//  lib/frontend/states/dream.state.ts — 圆梦模式状态机
//  封装：圆梦球星选择 → 队长锁定 → 4轮选人 → 季后赛资格判定
// ===================================================================
import { BaseGameState } from "./base-game-state";
import { RosterManager } from "../roster-manager";
import { SlotMachine, type PlayerDataSource } from "../slot-machine";
import { calcRegularSeasonWins, getGradeByWins, simulateSingleGame, simulateSeries } from "@/lib/game-core";
import type { GameStateSnapshot } from "../types";
import type { Player, Position, RosterSlots, SingleGameResult } from "@/lib/game-core";
import type { DreamPlayer } from "../types";

const PLAYOFF_MULTIPLIERS = [86.6, 94.8, 98.1, 100.4];
const PLAYOFF_NAMES = ["首轮", "次轮", "分区决赛", "总决赛"];

export class DreamState extends BaseGameState {
  readonly roster: RosterManager;
  readonly slotMachine: SlotMachine;

  private _round = 0;
  private _maxRounds = 5;
  private _dreamPlayer: DreamPlayer | null = null;
  private _playoffRound = 0;
  private _playoffGames: SingleGameResult[] = [];
  private _playoffHostWins = 0;
  private _playoffGuestWins = 0;

  constructor(playerData: PlayerDataSource) {
    super("dream");
    this.roster = new RosterManager();
    this.slotMachine = new SlotMachine(playerData);
    this.roster.on("roster-update", () => this.emit("roster-update"));
  }

  get round(): number { return this._round; }
  get dreamPlayer(): DreamPlayer | null { return this._dreamPlayer; }
  get hasPlayoffChance(): boolean { return this.simulate().wins >= 50; }

  reset(): void {
    this._round = 0;
    this._dreamPlayer = null;
    this._playoffRound = 0;
    this._playoffGames = [];
    this._playoffHostWins = 0;
    this._playoffGuestWins = 0;
    this.roster.reset();
    this.slotMachine.reset();
    this.emit("state-change");
  }

  /** 选择圆梦球星 */
  selectDreamPlayer(dp: DreamPlayer): void {
    this._dreamPlayer = dp;
    const firstPos = dp.positions[0];
    this.roster.addPlayer(dp as Player, firstPos);
    this._round = 1; // 队长已占1轮
  }

  /** 老虎机操作（复用 slot-machine） */
  startRound(): void {
    if (this._round >= this._maxRounds) return;
    this.slotMachine.reset({ team: this.slotMachine.skipTeamCount, decade: this.slotMachine.skipDecadeCount });
  }
  spin() { return this.slotMachine.spin(); }
  skipTeam() { return this.slotMachine.skipTeam(); }
  skipDecade() { return this.slotMachine.skipDecade(); }
  get currentTeam(): string | null { return this.slotMachine.currentTeam; }
  get currentDecade(): string | null { return this.slotMachine.currentDecade; }
  get maxRounds(): number { return this._maxRounds; }

  confirmPick(player: Player, slot: Position): boolean {
    if (this._round >= this._maxRounds) return false;
    if (!this.roster.addPlayer(player, slot)) return false;
    this._round++;
    if (this._round >= this._maxRounds) this.emit("pick-confirmed", null);
    return true;
  }

  /** 模拟常规赛 */
  simulate(): { wins: number; losses: number; grade: string; label: string; color: string; teamOvr: number } {
    const rating = this.roster.getRating();
    const wins = calcRegularSeasonWins(rating);
    const { grade, label, color } = getGradeByWins(wins);
    return { wins, losses: 82 - wins, grade, label, color, teamOvr: Math.round(rating * 10) / 10 };
  }

  /** 季后赛：获取当前轮对手评分 */
  getOppRating(): number { return PLAYOFF_MULTIPLIERS[this._playoffRound]; }

  /** 季后赛：模拟一场 */
  simulateOneGame(): SingleGameResult {
    const r = simulateSingleGame(this.roster.getRating(), this.getOppRating());
    this._playoffGames.push(r);
    if (r.hostWin) this._playoffHostWins++; else this._playoffGuestWins++;
    return r;
  }

  /** 系列赛是否结束 */
  isPlayoffSeriesOver(): boolean {
    return this._playoffHostWins >= 4 || this._playoffGuestWins >= 4;
  }

  /** 晋级下一轮 */
  advancePlayoffRound(): void {
    this._playoffRound++;
    this._playoffGames = [];
    this._playoffHostWins = 0;
    this._playoffGuestWins = 0;
  }

  get playoffRound(): number { return this._playoffRound; }
  get playoffWon(): boolean { return this._playoffHostWins >= 4; }
  get isChampion(): boolean { return this._playoffRound >= 3 && this.playoffWon; }

  getSnapshot(): GameStateSnapshot {
    return {
      mode: "dream",
      round: this._round, maxRounds: this._maxRounds,
      slots: this.roster.slots,
      roster: Object.values(this.roster.slots).filter(Boolean) as Player[],
      usedDecades: this.roster.usedDecades,
      usedCombos: this.slotMachine.state.usedCombos,
      skipTeam: this.slotMachine.skipTeamCount, skipDecade: this.slotMachine.skipDecadeCount,
      currentTeam: this.slotMachine.currentTeam,
      currentDecade: this.slotMachine.currentDecade as never,
      spun: this.slotMachine.spun,
    };
  }
}
