// ===================================================================
//  lib/frontend/states/classic.state.ts — 经典模式状态机
//  封装：5轮老虎机选人 → 82场模拟 → 结算
// ===================================================================
import { BaseGameState } from "./base-game-state";
import { RosterManager } from "../roster-manager";
import { SlotMachine, type PlayerDataSource } from "../slot-machine";
import { calcRegularSeasonWins, getGradeByWins } from "@/lib/game-core";
import type { GameStateSnapshot, GameMode } from "../types";
import type { Player, Position, RosterSlots } from "@/lib/game-core";

export class ClassicState extends BaseGameState {
  readonly roster: RosterManager;
  readonly slotMachine: SlotMachine;

  private _round = 0;
  private _maxRounds = 5;

  constructor(playerData: PlayerDataSource) {
    super("classic");
    this.roster = new RosterManager();
    this.slotMachine = new SlotMachine(playerData);

    // 阵容变更时通知
    this.roster.on("roster-update", () => this.emit("roster-update"));
  }

  // ── 状态访问 ──────────────────────────────────────────────────────

  get round(): number { return this._round; }
  get maxRounds(): number { return this._maxRounds; }
  get currentTeam(): string | null { return this.slotMachine.currentTeam; }
  get currentDecade(): string | null { return this.slotMachine.currentDecade; }

  reset(): void {
    this._round = 0;
    this.roster.reset();
    this.slotMachine.reset();
    this.emit("state-change");
  }

  // ── 选人流程 ──────────────────────────────────────────────────────

  /** 进入下一轮（老虎机随机） */
  startRound(): void {
    if (this._round >= this._maxRounds) {
      this.finishPicking();
      return;
    }
    this.slotMachine.reset({ team: this.slotMachine.skipTeamCount, decade: this.slotMachine.skipDecadeCount });
    this.emit("round-change", { round: this._round + 1, total: this._maxRounds });
  }

  /** 老虎机转动 */
  spin(): { team: string; decade: string } {
    const result = this.slotMachine.spin();
    return result;
  }

  /** 跳过球队 */
  skipTeam(): { team: string; decade: string } | null {
    return this.slotMachine.skipTeam();
  }

  /** 跳过年代 */
  skipDecade(): { team: string; decade: string } | null {
    return this.slotMachine.skipDecade();
  }

  /** 获取当前可选球员（Top 20，排除已选） */
  getTopPlayers(n = 20): Player[] {
    return this.slotMachine.getTopPlayers(n, this.roster.getPickedNames());
  }

  /** 确认选择球员 */
  confirmPick(player: Player, slot: Position): boolean {
    if (this._round >= this._maxRounds) return false;
    const ok = this.roster.addPlayer(player, slot);
    if (!ok) return false;
    this._round++;
    this.emit("pick-confirmed", { player: player.name, slot, round: this._round });

    if (this._round >= this._maxRounds) {
      this.finishPicking();
    }
    return true;
  }

  /** 选人完成 */
  private finishPicking(): void {
    this.emit("simulation-complete", this.simulate());
  }

  // ── 模拟 ──────────────────────────────────────────────────────────

  simulate(): { wins: number; losses: number; grade: string; label: string; color: string; teamOvr: number } {
    const rating = this.roster.getRating();
    const wins = calcRegularSeasonWins(rating);
    const { grade, label, color } = getGradeByWins(wins);
    return { wins, losses: 82 - wins, grade, label, color, teamOvr: Math.round(rating * 10) / 10 };
  }

  // ── 快照 ──────────────────────────────────────────────────────────

  getSnapshot(): GameStateSnapshot {
    return {
      mode: "classic",
      round: this._round,
      maxRounds: this._maxRounds,
      slots: this.roster.slots,
      roster: Object.values(this.roster.slots).filter(Boolean) as Player[],
      usedDecades: this.roster.usedDecades,
      usedCombos: this.slotMachine.state.usedCombos,
      skipTeam: this.slotMachine.skipTeamCount,
      skipDecade: this.slotMachine.skipDecadeCount,
      currentTeam: this.currentTeam,
      currentDecade: this.currentDecade as never,
      spun: this.slotMachine.spun,
    };
  }
}
