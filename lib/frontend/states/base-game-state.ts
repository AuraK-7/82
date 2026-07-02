// ===================================================================
//  lib/frontend/states/base-game-state.ts — 游戏状态基类
//  事件订阅、状态快照、回滚、流转校验
// ===================================================================
import type { GameEvent, EventCallback, GameStateSnapshot, GameMode } from "../types";
import type { Player, Position, RosterSlots } from "@/lib/game-core";

type ListenerMap = Partial<Record<GameEvent, EventCallback[]>>;

export abstract class BaseGameState {
  protected _mode: GameMode;
  protected _listeners: ListenerMap = {};
  protected _log: string[] = [];

  constructor(mode: GameMode) {
    this._mode = mode;
  }

  // ── 事件系统 ──────────────────────────────────────────────────────

  on(event: GameEvent, cb: EventCallback): () => void {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event]!.push(cb);
    return () => {
      this._listeners[event] = this._listeners[event]?.filter((l) => l !== cb) ?? [];
    };
  }

  protected emit(event: GameEvent, payload?: unknown): void {
    this._debug(`${this._mode} emit: ${event}`);
    (this._listeners[event] || []).forEach((cb) => cb(payload));
  }

  // ── 调试日志 ──────────────────────────────────────────────────────

  protected _debug(msg: string): void {
    if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).__GAME_DEBUG__) {
      console.log(`[State:${this._mode}]`, msg);
    }
    this._log.push(`[${new Date().toISOString()}] ${msg}`);
    if (this._log.length > 100) this._log.shift();
  }

  getLog(): string[] { return [...this._log]; }

  // ── 销毁与清理 ──────────────────────────────────────────────────────

  /** 销毁状态机：清除所有事件订阅、日志、定时器 */
  destroy(): void {
    // 清除所有事件监听器
    for (const event of Object.keys(this._listeners) as GameEvent[]) {
      this._listeners[event] = [];
    }
    this._listeners = {};
    // 清除日志
    this._log = [];
    // 重置内部状态
    this.reset();
  }

  // ── 抽象方法 ──────────────────────────────────────────────────────

  abstract getSnapshot(): GameStateSnapshot;
  abstract reset(): void;

  // ── 通用校验 ──────────────────────────────────────────────────────

  get mode(): GameMode { return this._mode; }

  /** 校验阵容完整性（5个位置都有球员） */
  protected _validateSlotsComplete(slots: RosterSlots): boolean {
    const req: Position[] = ["PG", "SG", "SF", "PF", "C"];
    return req.every((pos) => !!slots[pos]);
  }
}
