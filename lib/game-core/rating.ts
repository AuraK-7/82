// ===================================================================
//  lib/game-core/rating.ts — 球员评分 + 阵容战力
// ===================================================================
import type { Player, Position, RosterSlots, TeamRating } from "./types";
import {
  ERA_BENCHMARKS, POSITION_WEIGHTS, STAT_KEYS, INTANGIBLES,
  RATING_CONFIG, POS_ORDER,
} from "./constants";

/** 检查值是否为有效数字 */
function isNum(v: unknown): v is number {
  return typeof v === "number" && !Number.isNaN(v);
}

/**
 * 计算单个球员评分（0-100）
 * 算法公式：
 *   评分 = 60 + 40 × Σ(位置权重 × 球员数据 ÷ 年代基准^1.25)
 *         + 多位置加成(每额外位置+3) + 无形资产加成(+2.5)
 *   上限 100
 */
export function playerRating(p: Player): number {
  const bench = ERA_BENCHMARKS[p.decade] || ERA_BENCHMARKS["2020s"];
  const baseKey = (p.positions?.[0] || p.pos || "SF") as Position;
  const weights = { ...(POSITION_WEIGHTS[baseKey] || POSITION_WEIGHTS.SF) } as Record<string, number>;

  // 老年代缺少 stl/blk → 权重重新分配到 pts/reb/ast
  const missing = ["stl", "blk"].filter((k) => !isNum((p as unknown as Record<string, unknown>)[k]));
  if (missing.length > 0) {
    const kept = STAT_KEYS.filter((k) => !missing.includes(k)).reduce((sum, k) => sum + weights[k], 0);
    const scale = kept > 0 ? 1 / kept : 1;
    for (const k of ["pts", "reb", "ast"]) weights[k] *= scale;
    for (const k of missing) weights[k] = 0;
  }

  // 加权评分
  let n = 0;
  for (const k of STAT_KEYS) {
    const v = (p as unknown as Record<string, unknown>)[k];
    if (isNum(v)) {
      let ratio = v / bench[k as keyof typeof bench];
      if (ratio > 1) ratio = Math.pow(ratio, RATING_CONFIG.RATIO_POWER);
      n += weights[k] * ratio;
    }
  }

  const base = RATING_CONFIG.BASE + RATING_CONFIG.MULTIPLIER * n;
  const posCount = p.positions?.length || 1;
  const versatility = (posCount - 1) * RATING_CONFIG.VERSATILITY_BONUS;
  const playerName = (p.name || "").toLowerCase();
  const intangibles = INTANGIBLES.has(playerName) ? RATING_CONFIG.INTANGIBLES_BONUS : 0;

  return Math.min(RATING_CONFIG.MAX_RATING, Math.round((base + versatility + intangibles) * 10) / 10);
}

/**
 * 为阵容中每位球员计算评分，返回带 rating 字段的球员数组
 */
export function rateRoster(roster: Player[]): Player[] {
  return roster.map((p) => ({ ...p, rating: p.rating ?? playerRating(p) }));
}

/**
 * 计算阵容总评分
 * 几何平均 × 1.1
 */
export function calcTeamRating(roster: Player[]): TeamRating {
  if (roster.length === 0) return { overall: 80, playerRatings: [] };
  const ratings = roster.map((p) => p.rating ?? playerRating(p));
  const product = ratings.reduce((a, b) => a * b, 1);
  const overall = Math.round(Math.pow(product, 1 / ratings.length) * RATING_CONFIG.TEAM_OVR_MULTIPLIER * 10) / 10;
  return { overall, playerRatings: ratings };
}

/**
 * 从 slots 对象计算阵容评分
 */
export function calcTeamRatingFromSlots(slots: RosterSlots): TeamRating {
  const roster = POS_ORDER.map((pos) => slots[pos]).filter(Boolean) as Player[];
  return calcTeamRating(roster);
}
