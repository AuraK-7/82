// ===================================================================
//  lib/frontend/states/challenge.state.ts — 挑战模式状态机
// ===================================================================
import { BaseGameState } from "./base-game-state";
import { playerRating } from "@/lib/game-core";
import type { Player, Position } from "@/lib/game-core";
import type { GameStateSnapshot, GameMode } from "../types";

export type ChallengeType = "era-cross" | "same-team" | "no-repeat";

interface ChallengeConfig { name: string; modeKey: GameMode; penalty: number; }

const CONFIGS: Record<ChallengeType, ChallengeConfig> = {
  "era-cross":   { name: "年代穿越", modeKey: "era-cross",   penalty: 5 },
  "same-team":   { name: "同队传奇", modeKey: "same-team",   penalty: 5 },
  "no-repeat":   { name: "国际阵容", modeKey: "no-repeat",   penalty: 5 },
};

const POS_ORDER: Position[] = ["PG", "SG", "SF", "PF", "C"];
const OPTIONS_COUNT = 8;

export class ChallengeState extends BaseGameState {
  private _type: ChallengeType;
  private _config: ChallengeConfig;
  private _round = 0;
  private _mistakes = 0;
  private _picks: Record<Position, Player | null> = { PG: null, SG: null, SF: null, PF: null, C: null };
  private _lockedTeam: string | null = null;
  private _targetEras: Record<Position, string> = {} as Record<Position, string>;
  private _usedTeams: string[] = [];
  private _allPlayers: Player[];
  private _currentOptions: Player[] = [];

  constructor(type: ChallengeType, allPlayers: Player[]) {
    super(CONFIGS[type].modeKey);
    this._type = type;
    this._config = CONFIGS[type];
    this._allPlayers = allPlayers;
  }

  get type() { return this._type; }
  get config() { return this._config; }
  get round() { return this._round; }
  get mistakes() { return this._mistakes; }
  get penalty() { return this._config.penalty; }
  get picks() { return { ...this._picks }; }
  get currentOptions() { return this._currentOptions; }

  reset(): void {
    this._round = 0; this._mistakes = 0;
    this._picks = { PG: null, SG: null, SF: null, PF: null, C: null };
    this._lockedTeam = null; this._targetEras = {} as Record<Position, string>;
    this._usedTeams = []; this._currentOptions = [];
    this.emit("state-change");
  }

  // ── 年代穿越模式 ──────────────────────────────────────────────────

  setTargetEras(eras: Record<Position, string>): void {
    this._targetEras = { ...eras };
  }

  get targetEras(): Record<Position, string> { return { ...this._targetEras }; }

  randomEras(): Record<Position, string> {
    const decades = [...new Set(this._allPlayers.map((p) => p.decade))];
    const shuffled = [...decades].sort(() => Math.random() - 0.5);
    const eras: Record<Position, string> = {} as Record<Position, string>;
    POS_ORDER.forEach((pos, i) => { eras[pos] = shuffled[i % shuffled.length]; });
    this._targetEras = eras;
    return eras;
  }

  // ── 同队传奇模式 ──────────────────────────────────────────────────

  get lockedTeam(): string | null { return this._lockedTeam; }
  setLockedTeam(team: string): void { this._lockedTeam = team; }

  getAvailableTeams(): string[] {
    return [...new Set(this._allPlayers.map((p) => p.team))].sort();
  }

  // ── 生成题目 ──────────────────────────────────────────────────────

  generateOptions(pos: Position): Player[] {
    const correctPool = this._getCorrectPool(pos);
    if (correctPool.length === 0) { this._currentOptions = []; return []; }
    const correct = correctPool[Math.floor(Math.random() * correctPool.length)];
    const distractors = this._getDistractors(pos, correct);
    const options = [correct, ...distractors].sort(() => Math.random() - 0.5);
    this._currentOptions = options;
    return options;
  }

  private _getCorrectPool(pos: Position): Player[] {
    const eligible = this._allPlayers.filter((p) => p.positions.includes(pos));
    if (this._type === "era-cross") {
      const era = this._targetEras[pos];
      return eligible.filter((p) => p.decade === era);
    }
    if (this._type === "same-team") {
      return eligible.filter((p) => p.team === this._lockedTeam);
    }
    return eligible.filter((p) => !this._usedTeams.includes(p.team));
  }

  private _getDistractors(pos: Position, correct: Player): Player[] {
    const eligible = this._allPlayers.filter(
      (p) => p.positions.includes(pos) && p.name !== correct.name
    );
    if (this._type === "era-cross") {
      return eligible
        .filter((p) => p.decade !== this._targetEras[pos])
        .sort((a, b) => Math.abs((a.rating ?? playerRating(a)) - (correct.rating ?? playerRating(correct))) -
          Math.abs((b.rating ?? playerRating(b)) - (correct.rating ?? playerRating(correct))))
        .slice(0, OPTIONS_COUNT - 1);
    }
    if (this._type === "same-team") {
      return eligible
        .filter((p) => p.team !== this._lockedTeam)
        .sort((a, b) => Math.abs((a.rating ?? playerRating(a)) - (correct.rating ?? playerRating(correct))) -
          Math.abs((b.rating ?? playerRating(b)) - (correct.rating ?? playerRating(correct))))
        .slice(0, OPTIONS_COUNT - 1);
    }
    const used = eligible.filter((p) => this._usedTeams.includes(p.team));
    const unused = eligible.filter((p) => !this._usedTeams.includes(p.team));
    return [...used.slice(0, 3), ...unused.slice(0, 4)].sort(() => Math.random() - 0.5).slice(0, OPTIONS_COUNT - 1);
  }

  // ── 答题 ──────────────────────────────────────────────────────────

  isCorrect(pos: Position, player: Player): boolean {
    if (this._type === "era-cross") return player.decade === this._targetEras[pos];
    if (this._type === "same-team") return player.team === this._lockedTeam;
    return !this._usedTeams.includes(player.team);
  }

  submitAnswer(pos: Position, player: Player): { correct: boolean; finalPlayer: Player } {
    const correct = this.isCorrect(pos, player);
    if (correct) {
      this._picks[pos] = player;
      if (this._type === "no-repeat") this._usedTeams.push(player.team);
    } else {
      this._mistakes++;
      const fallback = this._getCorrectPool(pos)[0] || player;
      this._picks[pos] = fallback;
      if (this._type === "no-repeat") this._usedTeams.push(fallback.team);
    }
    this._round++;
    this.emit("round-change", { round: this._round });
    return { correct, finalPlayer: this._picks[pos]! };
  }

  isFinished(): boolean { return this._round >= 5; }

  getResult(): { roster: Player[]; mistakes: number; penaltyWins: number } {
    const roster = POS_ORDER.map((pos) => this._picks[pos]).filter(Boolean) as Player[];
    return { roster, mistakes: this._mistakes, penaltyWins: this._mistakes * this._config.penalty };
  }

  getSnapshot(): GameStateSnapshot {
    return {
      mode: this._config.modeKey, round: this._round, maxRounds: 5,
      slots: this._picks as Record<Position, Player | null>,
      roster: Object.values(this._picks).filter(Boolean) as Player[],
      usedDecades: [], usedCombos: [], skipTeam: 0, skipDecade: 0,
      currentTeam: null, currentDecade: null, spun: false,
    };
  }
}
