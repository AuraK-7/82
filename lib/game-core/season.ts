// ===================================================================
//  lib/game-core/season.ts — 常规赛 82 场模拟
// ===================================================================
import type { SeasonResult } from "./types";
import { SEASON_CONFIG, TEAM_GRADE_BANDS } from "./constants";

/**
 * 根据阵容评分计算 82 场胜场数
 * 公式: wins = round(82 × min(rating / 110, 1) ^ 2.2)
 */
export function calcRegularSeasonWins(teamRating: number): number {
  let wins = Math.round(
    SEASON_CONFIG.TOTAL_GAMES *
    Math.pow(Math.min(teamRating / SEASON_CONFIG.WIN_CURVE_DIVISOR, 1), SEASON_CONFIG.WIN_CURVE_EXPONENT)
  );
  let losses = SEASON_CONFIG.TOTAL_GAMES - wins;

  // 特殊规则修正
  if (wins === 64 && losses === 18) { wins = 65; losses = 17; }
  else if (wins === 18 && losses === 64) { wins = 17; losses = 65; }
  if (wins === 54) { wins = 55; losses = 27; }
  else if (losses === 54) { wins = 27; losses = 55; }

  return wins;
}

/**
 * 根据胜场获取段位
 */
export function getGradeByWins(wins: number): { grade: string; label: string; color: string } {
  const band = TEAM_GRADE_BANDS.find((b) => wins >= b.min) || TEAM_GRADE_BANDS[TEAM_GRADE_BANDS.length - 1];
  return { grade: band.grade, label: band.label, color: band.color };
}

/**
 * 完整常规赛模拟
 */
export function simulateSeason(teamOvr: number): SeasonResult {
  const wins = calcRegularSeasonWins(teamOvr);
  const { grade, label: tier, color } = getGradeByWins(wins);
  return {
    wins,
    losses: SEASON_CONFIG.TOTAL_GAMES - wins,
    teamOvr,
    grade,
    tier,
    color,
  };
}
