// ===================================================================
//  lib/frontend/slot-machine.ts — 老虎机引擎
// ===================================================================
import type { Player, Position, Decade } from "@/lib/game-core";
import type { SlotMachineState, GameEvent, EventCallback } from "./types";

type ListenerMap = Partial<Record<GameEvent, EventCallback[]>>;

/** 外部提供的球员数据源 */
export type PlayerDataSource = Record<string, Record<string, Player[]>>;

export class SlotMachine {
  private _state: SlotMachineState;
  private _playerData: PlayerDataSource;
  private _listeners: ListenerMap = {};

  constructor(playerData: PlayerDataSource) {
    this._playerData = playerData;
    this._state = this._createInitialState();
  }

  private _createInitialState(): SlotMachineState {
    return {
      currentTeam: null,
      currentDecade: null,
      skipTeam: 1,
      skipDecade: 1,
      usedCombos: [],
      spun: false,
      availablePlayers: [],
    };
  }

  // ── 事件 ──────────────────────────────────────────────────────────

  on(event: GameEvent, cb: EventCallback): () => void {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event]!.push(cb);
    return () => {
      this._listeners[event] = this._listeners[event]?.filter((l) => l !== cb) ?? [];
    };
  }

  private emit(event: GameEvent, payload?: unknown): void {
    (this._listeners[event] || []).forEach((cb) => cb(payload));
  }

  // ── 状态访问 ──────────────────────────────────────────────────────

  get state(): Readonly<SlotMachineState> { return this._state; }
  get currentTeam(): string | null { return this._state.currentTeam; }
  get currentDecade(): Decade | null { return this._state.currentDecade; }
  get skipTeamCount(): number { return this._state.skipTeam; }
  get skipDecadeCount(): number { return this._state.skipDecade; }
  get spun(): boolean { return this._state.spun; }
  get availablePlayers(): Player[] { return this._state.availablePlayers; }

  reset(skips = { team: 1, decade: 1 }): void {
    this._state = this._createInitialState();
    this._state.skipTeam = skips.team;
    this._state.skipDecade = skips.decade;
  }

  /** 获取所有可用的 (decade, team) 组合 */
  private _getAllValidCombos(): { team: string; decade: string }[] {
    const combos: { team: string; decade: string }[] = [];
    const usedSet = new Set(this._state.usedCombos);
    for (const decade of Object.keys(this._playerData).filter((d) => d !== "1950s")) {
      for (const team of Object.keys(this._playerData[decade] || {})) {
        if (!usedSet.has(`${decade}|${team}`)) {
          combos.push({ team, decade });
        }
      }
    }
    if (combos.length === 0) {
      const d = Object.keys(this._playerData).filter((x) => x !== "1950s")[0];
      const t = Object.keys(this._playerData[d] || {})[0];
      combos.push({ team: t, decade: d });
    }
    return combos;
  }

  /** 老虎机转动 → 随机锁定一个组合 */
  spin(): { team: string; decade: string } {
    const combos = this._getAllValidCombos();
    const result = combos[Math.floor(Math.random() * combos.length)];
    this._state.currentTeam = result.team;
    this._state.currentDecade = result.decade as Decade;
    this._state.usedCombos.push(`${result.decade}|${result.team}`);
    this._state.spun = true;
    this._state.availablePlayers = this._getPlayers(result.team, result.decade);
    this.emit("spin-result", result);
    return result;
  }

  /** 跳过球队（同年代换队） */
  skipTeam(): { team: string; decade: string } | null {
    if (this._state.skipTeam <= 0 || !this._state.currentDecade) return null;
    this._state.skipTeam--;

    const decadeTeams = Object.keys(this._playerData[this._state.currentDecade] || {});
    const usedSet = new Set(this._state.usedCombos);
    const available = decadeTeams.filter((t) => !usedSet.has(`${this._state.currentDecade}|${t}`));
    const pick = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : decadeTeams.filter((t) => t !== this._state.currentTeam)[0] || decadeTeams[0];

    this._state.currentTeam = pick;
    this._state.usedCombos.push(`${this._state.currentDecade}|${pick}`);
    this._state.availablePlayers = this._getPlayers(pick, this._state.currentDecade);
    this.emit("skip-update", { type: "team", remaining: this._state.skipTeam });
    return { team: pick, decade: this._state.currentDecade };
  }

  /** 跳过年代（同队换年代） */
  skipDecade(): { team: string; decade: string } | null {
    if (this._state.skipDecade <= 0 || !this._state.currentTeam) return null;
    this._state.skipDecade--;

    const teamDecades = Object.keys(this._playerData).filter(
      (d) => d !== "1950s" && this._playerData[d]?.[this._state.currentTeam!]
    );
    const usedSet = new Set(this._state.usedCombos);
    const available = teamDecades.filter((d) => !usedSet.has(`${d}|${this._state.currentTeam}`));
    if (available.length === 0) return null;

    const pick = available[Math.floor(Math.random() * available.length)];
    this._state.currentDecade = pick as Decade;
    this._state.usedCombos.push(`${pick}|${this._state.currentTeam}`);
    this._state.availablePlayers = this._getPlayers(this._state.currentTeam, pick);
    this.emit("skip-update", { type: "decade", remaining: this._state.skipDecade });
    return { team: this._state.currentTeam, decade: pick };
  }

  /** 获取指定组合的球员，排除已选 */
  private _getPlayers(team: string, decade: string): Player[] {
    return this._playerData[decade]?.[team] || [];
  }

  /** 获取 Top N 球员（按 PTS+REB+AST 降序） */
  getTopPlayers(n = 20, excludeNames: string[] = []): Player[] {
    const exclude = new Set(excludeNames);
    return [...this._state.availablePlayers]
      .filter((p) => !exclude.has(p.name))
      .sort((a, b) => (b.pts + b.reb + b.ast) - (a.pts + a.reb + a.ast))
      .slice(0, n);
  }

  /** 按位置筛选 */
  filterByPosition(pos: Position, pool?: Player[]): Player[] {
    const source = pool || this._state.availablePlayers;
    return source.filter((p) => p.positions.includes(pos));
  }

  /** 按位置类别筛选（G=PG+SG, F=SF+PF, C=C） */
  filterByCategory(cat: "g" | "f" | "c" | "all", pool: Player[]): Player[] {
    if (cat === "all") return pool;
    const map: Record<string, Position[]> = { g: ["PG", "SG"], f: ["SF", "PF"], c: ["C"] };
    return pool.filter((p) => p.positions.some((pos) => map[cat].includes(pos)));
  }

  getState(): SlotMachineState {
    return { ...this._state, availablePlayers: [...this._state.availablePlayers] };
  }
}
