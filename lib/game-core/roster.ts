// ===================================================================
//  lib/game-core/roster.ts — 阵容工具函数
// ===================================================================
import type { Player, Position, RosterSlots } from "./types";
import { POS_ORDER } from "./constants";

/**
 * 校验阵容合法性
 * - 必须 5 个位置各有 1 名球员
 * - 球员名/球队/年代不可空
 * - 不可有重复位置或重复球员
 */
export function validateRoster(slots: RosterSlots): { valid: boolean; error?: string } {
  const seenSlots = new Set<string>();
  const seenNames = new Set<string>();

  for (const pos of POS_ORDER) {
    const p = slots[pos];
    if (!p) return { valid: false, error: `缺少 ${pos} 位置球员` };
    if (!p.name || !p.team || !p.decade) return { valid: false, error: `${pos} 球员信息不完整` };
    if (seenSlots.has(pos)) return { valid: false, error: `重复的位置: ${pos}` };
    if (seenNames.has(p.name)) return { valid: false, error: `重复的球员: ${p.name}` };
    seenSlots.add(pos);
    seenNames.add(p.name);
  }

  return { valid: true };
}

/**
 * 阵容哈希（用于防刷比较）
 * 排序后 djb2
 */
export function getRosterHash(slots: RosterSlots): string {
  const names = POS_ORDER
    .map((pos) => slots[pos]?.name || "")
    .filter(Boolean)
    .sort();
  const joined = names.join("|");
  let hash = 5381;
  for (let i = 0; i < joined.length; i++) {
    hash = ((hash << 5) + hash) + joined.charCodeAt(i);
    hash |= 0;
  }
  return "rh_" + (hash >>> 0).toString(36);
}

/**
 * 检查球员是否可打某位置
 */
export function matchPosition(player: Player, targetPos: Position): boolean {
  return player.positions.includes(targetPos);
}

/**
 * 获取球员的可选空位
 */
export function getEmptyEligiblePositions(player: Player, slots: RosterSlots): Position[] {
  return player.positions.filter((pos) => !slots[pos]);
}

/**
 * 从 slots 提取球员数组
 */
export function slotsToArray(slots: RosterSlots): Player[] {
  return POS_ORDER.map((pos) => slots[pos]).filter(Boolean) as Player[];
}
