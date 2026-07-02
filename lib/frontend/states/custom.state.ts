// ===================================================================
//  lib/frontend/states/custom.state.ts — 自选/工资帽模式状态机
//  封装：自由选人 → 球员筛选 → 薪资计算 → 模拟结算
// ===================================================================
import { BaseGameState } from "./base-game-state";
import { RosterManager } from "../roster-manager";
import { playerRating, calcTeamRating, calcRegularSeasonWins, getGradeByWins } from "@/lib/game-core";
import type { GameStateSnapshot, GameMode } from "../types";
import type { Player, Position, RosterSlots } from "@/lib/game-core";

export class CustomState extends BaseGameState {
  readonly roster: RosterManager;

  private _activePos: Position = "PG";
  private _decadeFilter = "all";
  private _teamFilter = "all";
  private _searchQuery = "";
  private _salaryMode = false;
  private _salaryCap = 100;
  private _allPlayers: Player[] = [];

  constructor(allPlayers: Player[], mode: GameMode = "custom") {
    super(mode);
    this.roster = new RosterManager();
    this._allPlayers = allPlayers;
    this.roster.on("roster-update", () => this.emit("roster-update"));
  }

  // ── 状态访问 ──────────────────────────────────────────────────────

  get activePos(): Position { return this._activePos; }
  get decadeFilter(): string { return this._decadeFilter; }
  get teamFilter(): string { return this._teamFilter; }
  get searchQuery(): string { return this._searchQuery; }
  get salaryMode(): boolean { return this._salaryMode; }
  get salaryCap(): number { return this._salaryCap; }
  /** 获取全部球员池（供组件端筛选） */
  get allPlayers(): Player[] { return this._allPlayers; }

  reset(): void {
    this._activePos = "PG";
    this._decadeFilter = "all";
    this._searchQuery = "";
    this._salaryMode = false;
    this.roster.reset();
    this.emit("state-change");
  }

  /** 启用工资帽模式 */
  enableSalaryMode(cap = 100): void {
    this._salaryMode = true;
    this._salaryCap = cap;
    this._mode = "salary" as GameMode;
  }

  /** 获取球员薪资（基于评分） */
  getPlayerSalary(p: Player): number {
    const r = p.rating ?? playerRating(p);
    if (r >= 90) return 45;
    if (r >= 85) return 35;
    if (r >= 80) return 25;
    if (r >= 75) return 18;
    if (r >= 70) return 12;
    return 6;
  }

  /** 已用薪资 */
  getSalaryUsed(): number {
    return (["PG", "SG", "SF", "PF", "C"] as Position[])
      .reduce((sum, pos) => sum + (this.roster.at(pos) ? this.getPlayerSalary(this.roster.at(pos)!) : 0), 0);
  }

  getSalaryRemaining(): number { return this._salaryCap - this.getSalaryUsed(); }
  isOverBudget(): boolean { return this.getSalaryRemaining() < 0; }

  // ── 球员筛选 ──────────────────────────────────────────────────────

  setActivePosition(pos: Position): void {
    this._activePos = pos;
  }

  setDecadeFilter(decade: string): void {
    this._decadeFilter = decade;
  }

  setTeamFilter(team: string): void {
    this._teamFilter = team;
  }

  setSearchQuery(q: string): void {
    this._searchQuery = q.toLowerCase().trim();
  }

  /** 获取当前激活位置的可选球员 */
  getEligiblePlayers(): Player[] {
    let pool = [...this._allPlayers];
    // 自选模式：优先按球队+年代筛选（不限位置），若未选则按位置筛选
    if (this._teamFilter !== "all") {
      pool = pool.filter((p) => p.team === this._teamFilter);
      if (this._decadeFilter !== "all") pool = pool.filter((p) => p.decade === this._decadeFilter);
    } else {
      pool = pool.filter((p) => p.positions.includes(this._activePos));
      if (this._decadeFilter !== "all") pool = pool.filter((p) => p.decade === this._decadeFilter);
    }
    if (this._searchQuery) pool = pool.filter((p) => p.name.toLowerCase().includes(this._searchQuery));
    // 排除已选
    const picked = new Set(this.roster.getPickedNames());
    pool = pool.filter((p) => !picked.has(p.name));
    // 按评分降序
    pool.sort((a, b) => (b.rating ?? playerRating(b)) - (a.rating ?? playerRating(a)));
    return pool;
  }

  /** 能否确认当前选择 */
  canConfirmPick(player: Player): boolean {
    if (!player.positions.includes(this._activePos)) return false;
    if (this._salaryMode) {
      const salary = this.getPlayerSalary(player);
      return salary <= this.getSalaryRemaining();
    }
    return true;
  }

  /** 确认选择 */
  confirmPick(player: Player): boolean {
    return this.roster.addPlayer(player, this._activePos);
  }

  /** 自动跳到下一个空位 */
  advanceToNextEmpty(): Position | null {
    for (const pos of ["PG", "SG", "SF", "PF", "C"] as Position[]) {
      if (!this.roster.at(pos)) return pos;
    }
    return null;
  }

  /** 随机填充剩余位置 */
  randomFillRemaining(): void {
    for (const pos of ["PG", "SG", "SF", "PF", "C"] as Position[]) {
      if (this.roster.at(pos)) continue;
      const picked = new Set(this.roster.getPickedNames());
      const eligible = this._allPlayers.filter(
        (p) => p.positions.includes(pos) && !picked.has(p.name)
      );
      if (this._salaryMode) {
        const filtered = eligible.filter((p) => this.getPlayerSalary(p) <= this.getSalaryRemaining());
        if (filtered.length > 0) {
          const pool = filtered.slice(0, Math.min(10, filtered.length));
          this.roster.addPlayer(pool[Math.floor(Math.random() * pool.length)], pos);
        }
      } else if (eligible.length > 0) {
        this.roster.addPlayer(eligible[Math.floor(Math.random() * eligible.length)], pos);
      }
    }
  }

  /** 是否可以模拟 */
  canSimulate(): boolean {
    if (!this.roster.isFull()) return false;
    if (this._salaryMode && this.isOverBudget()) return false;
    return true;
  }

  /** 模拟 */
  simulate(): { wins: number; losses: number; grade: string; label: string; color: string; teamOvr: number } {
    const rating = this.roster.getRating();
    const wins = calcRegularSeasonWins(rating);
    const { grade, label, color } = getGradeByWins(wins);
    return { wins, losses: 82 - wins, grade, label, color, teamOvr: Math.round(rating * 10) / 10 };
  }

  getSnapshot(): GameStateSnapshot {
    return {
      mode: this._mode,
      round: this.roster.filledCount(),
      maxRounds: 5,
      slots: this.roster.slots,
      roster: Object.values(this.roster.slots).filter(Boolean) as Player[],
      usedDecades: this.roster.usedDecades,
      usedCombos: [],
      skipTeam: 0, skipDecade: 0,
      currentTeam: null, currentDecade: null, spun: false,
    };
  }
}
