// ===================================================================
//  lib/game-core/playoff.ts — 季后赛 / 对战模拟
// ===================================================================
import type { SingleGameResult, SeriesResult } from "./types";
import { PLAYOFF_CONFIG } from "./constants";

/**
 * 模拟单场对战（Elo 变体，PVP 版）
 *
 * 胜率公式: 1 / (1 + 10^(-Δrating / 30))
 * 比分: pace + gap + jitter
 * 限制: 胜率 5%～95%
 */
export function simulateSingleGame(
  hostRating: number,
  guestRating: number
): SingleGameResult {
  // Elo 基础胜率（房主视角）
  const basePct =
    1 / (1 + Math.pow(10, -(hostRating - guestRating) / PLAYOFF_CONFIG.ELO_DENOMINATOR));
  const winPct = Math.min(
    Math.max(basePct, PLAYOFF_CONFIG.MIN_WIN_PCT),
    PLAYOFF_CONFIG.MAX_WIN_PCT
  );

  const roll = Math.random();
  const hostWin = roll < winPct;

  // 比分生成
  const pace =
    PLAYOFF_CONFIG.PACE_MIN +
    Math.floor(Math.random() * (PLAYOFF_CONFIG.PACE_MAX - PLAYOFF_CONFIG.PACE_MIN + 1));
  const diff = Math.abs(hostRating - guestRating);
  const baseGap = (diff / 8) * 4;
  const jitter = Math.round(Math.random() * 4 - 2);

  let hostScore: number;
  let guestScore: number;

  if (hostWin) {
    hostScore = Math.round(pace + baseGap / 2 + jitter / 2);
    guestScore = Math.round(pace - baseGap / 2 - jitter / 2);
  } else {
    hostScore = Math.round(pace - baseGap / 2 + jitter / 2);
    guestScore = Math.round(pace + baseGap / 2 - jitter / 2);
  }

  // Safety: 确保胜者分数更高
  if (hostWin && hostScore <= guestScore) {
    hostScore = guestScore + Math.floor(Math.random() * 3) + 1;
  } else if (!hostWin && guestScore <= hostScore) {
    guestScore = hostScore + Math.floor(Math.random() * 3) + 1;
  }

  return {
    hostScore: Math.max(hostScore, PLAYOFF_CONFIG.MIN_SCORE),
    guestScore: Math.max(guestScore, PLAYOFF_CONFIG.MIN_SCORE),
    hostWin,
  };
}

/**
 * 模拟完整 BO7 系列赛
 * 从当前比分开始，直到一方先赢 4 场
 */
export function simulateSeries(
  hostRating: number,
  guestRating: number,
  currentHostWins = 0,
  currentGuestWins = 0,
  existingGames: SingleGameResult[] = []
): SeriesResult {
  const games = [...existingGames];
  let hostWins = currentHostWins;
  let guestWins = currentGuestWins;

  while (hostWins < PLAYOFF_CONFIG.BO7_WINS && guestWins < PLAYOFF_CONFIG.BO7_WINS) {
    const result = simulateSingleGame(hostRating, guestRating);
    games.push(result);
    if (result.hostWin) hostWins++;
    else guestWins++;
  }

  return { games, hostWins, guestWins, hostWin: hostWins >= PLAYOFF_CONFIG.BO7_WINS };
}
