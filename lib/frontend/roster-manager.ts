// ===================================================================
//  lib/frontend/roster-manager.ts — 阵容管理器
// ===================================================================
import type { Player, Position, RosterSlots } from "@/lib/game-core";
import { POS_ORDER, validateRoster, getRosterHash, playerRating, calcTeamRating } from "@/lib/game-core";
import type { RosterManagerState, GameEvent, EventCallback } from "./types";

type ListenerMap = Partial<Record<GameEvent, EventCallback[]>>;

export class RosterManager {
  private _slots: RosterSlots = {};
  private _usedDecades: string[] = [];
  private _listeners: ListenerMap = {};

  constructor() {
    this.reset();
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

  // ── 槽位操作 ──────────────────────────────────────────────────────

  get slots(): RosterSlots {
    const s: RosterSlots = {};
    for (const pos of POS_ORDER) s[pos] = this._slots[pos] || null;
    return s;
  }

  get usedDecades(): string[] { return [...this._usedDecades]; }

  reset(): void {
    this._slots = {};
    POS_ORDER.forEach((p: Position) => (this._slots[p] = null));
    this._usedDecades = [];
  }

  /** 添加球员到指定位置 */
  addPlayer(player: Player, slot: Position): boolean {
    if (!this.canPlaceAt(player, slot)) return false;
    this._slots[slot] = player;
    if (player.decade && !this._usedDecades.includes(player.decade)) {
      this._usedDecades.push(player.decade);
    }
    this.emit("roster-update", this.getState());
    return true;
  }

  /** 移除指定位置的球员 */
  removePlayer(slot: Position): Player | null {
    const p = this._slots[slot] || null;
    this._slots[slot] = null;
    if (p) this.emit("roster-update", this.getState());
    return p;
  }

  /** 将球员从 fromSlot 移动到 toSlot */
  movePlayer(fromSlot: Position, toSlot: Position): boolean {
    const player = this._slots[fromSlot];
    if (!player) return false;
    if (!this.canPlaceAt(player, toSlot)) return false;
    this._slots[toSlot] = player;
    this._slots[fromSlot] = null;
    this.emit("roster-update", this.getState());
    return true;
  }

  /** 检查球员是否可以放在指定位置 */
  canPlaceAt(player: Player, slot: Position): boolean {
    if (this._slots[slot]) return false; // 位置已占
    return player.positions.includes(slot);
  }

  /** 获取球员的可选空位列表 */
  getEmptyEligible(player: Player): Position[] {
    return player.positions.filter((pos) => !this._slots[pos]);
  }

  /** 阵容是否已满 */
  isFull(): boolean {
    return POS_ORDER.every((pos) => !!this._slots[pos]);
  }

  /** 已选球员数 */
  filledCount(): number {
    return POS_ORDER.filter((pos) => !!this._slots[pos]).length;
  }

  /** 获取已选球员名列表 */
  getPickedNames(): string[] {
    return POS_ORDER.map((pos) => this._slots[pos]?.name).filter(Boolean) as string[];
  }

  /** 阵容合法性 */
  validate(): ReturnType<typeof validateRoster> {
    return validateRoster(this.slots);
  }

  /** 阵容哈希 */
  getHash(): string {
    return getRosterHash(this.slots);
  }

  /** 阵容总评分 */
  getRating(): number {
    const roster = POS_ORDER.map((pos) => this._slots[pos]).filter(Boolean) as Player[];
    return calcTeamRating(roster).overall;
  }

  /** 球员评分列表 */
  getPlayerRatings(): number[] {
    return POS_ORDER
      .map((pos) => this._slots[pos])
      .filter(Boolean)
      .map((p) => playerRating(p!));
  }

  /** 获取状态快照 */
  getState(): RosterManagerState {
    return {
      slots: this.slots,
      usedDecades: this.usedDecades,
      pickedNames: this.getPickedNames(),
    };
  }

  /** 从快照恢复 */
  restoreState(state: RosterManagerState): void {
    this._slots = { ...state.slots };
    this._usedDecades = [...state.usedDecades];
  }

  /** 获取指定位置的球员 */
  at(pos: Position): Player | null {
    return this._slots[pos] || null;
  }
}
