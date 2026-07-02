// ===================================================================
//  lib/game-core/constants.ts — 所有游戏常量
// ===================================================================
import type { Decade, Position, EraBenchmark, GradeBand, PositionWeights, StatKey } from "./types";

/** 所有可选年代 */
export const ALL_DECADES: Decade[] = [
  "1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s",
];

/** 位置顺序（老虎机 + 阵容展示） */
export const POS_ORDER: Position[] = ["PG", "SG", "SF", "C", "PF"];

/** 五项数据指标 */
export const STAT_KEYS: StatKey[] = ["pts", "reb", "ast", "stl", "blk"];

/** 位置权重（PG~C 对五项数据的侧重） */
export const POSITION_WEIGHTS: PositionWeights = {
  PG: { pts: 0.4,  reb: 0.1,  ast: 0.35, stl: 0.1,  blk: 0.05 },
  SG: { pts: 0.45, reb: 0.1,  ast: 0.2,  stl: 0.2,  blk: 0.05 },
  SF: { pts: 0.45, reb: 0.15, ast: 0.2,  stl: 0.15, blk: 0.05 },
  PF: { pts: 0.4,  reb: 0.3,  ast: 0.1,  stl: 0.1,  blk: 0.1 },
  C:  { pts: 0.4,  reb: 0.35, ast: 0.1,  stl: 0.05, blk: 0.1 },
};

/** 年代基准数据 */
export const ERA_BENCHMARKS: Record<string, EraBenchmark> = {
  "1960s": { pts: 30, reb: 18, ast: 8,  stl: 1.8, blk: 1.8 },
  "1970s": { pts: 28, reb: 13, ast: 9,  stl: 2,   blk: 2 },
  "1980s": { pts: 28, reb: 11, ast: 11, stl: 2.2, blk: 2 },
  "1990s": { pts: 27, reb: 11, ast: 9,  stl: 2,   blk: 2 },
  "2000s": { pts: 27, reb: 11, ast: 9,  stl: 2,   blk: 2 },
  "2010s": { pts: 28, reb: 11, ast: 9,  stl: 1.8, blk: 1.8 },
  "2020s": { pts: 28, reb: 11, ast: 9,  stl: 1.8, blk: 1.8 },
};

/** 无形资产球员（传奇加成 +2.5） */
export const INTANGIBLES: ReadonlySet<string> = new Set([
  "larry bird", "tim duncan", "kevin durant", "magic johnson",
  "shaquille o'neal", "hakeem olajuwon", "bill russell", "kobe bryant",
  "oscar robertson", "karl malone", "kevin garnett", "isiah thomas",
  "tony parker", "manu ginobili", "draymond green", "scottie pippen",
  "dennis rodman", "stephen curry", "nikola jokic", "dirk nowitzki",
]);

/** 段位评定 */
export const TEAM_GRADE_BANDS: GradeBand[] = [
  { min: 80, grade: "S",  label: "完美赛季",   color: "#a855f7" },
  { min: 72, grade: "A+", label: "历史级强队", color: "#22c55e" },
  { min: 62, grade: "A",  label: "王朝球队",   color: "#22c55e" },
  { min: 57, grade: "B",  label: "有力竞争者", color: "#3b82f6" },
  { min: 50, grade: "C",  label: "季后赛球队", color: "#f59e0b" },
  { min: 40, grade: "D",  label: "乐透球队",   color: "#64748b" },
  { min: 0,  grade: "F",  label: "摆烂大军",   color: "#ef4444" },
];

/** 评分算法参数 */
export const RATING_CONFIG = {
  BASE: 60,
  MULTIPLIER: 40,
  TEAM_OVR_MULTIPLIER: 1.1,
  VERSATILITY_BONUS: 3,
  INTANGIBLES_BONUS: 2.5,
  MAX_RATING: 100,
  RATIO_POWER: 1.25, // 超基准值凸函数放大指数
} as const;

/** 常规赛模拟参数 */
export const SEASON_CONFIG = {
  WIN_CURVE_DIVISOR: 110,
  WIN_CURVE_EXPONENT: 2.2,
  TOTAL_GAMES: 82,
} as const;

/** 排行榜提交防刷冷却时间（毫秒） */
export const SUBMIT_COOLDOWN = {
  USER_MS: 5_000,       // 同用户 5s
  NAME_MS: 30_000,      // 同昵称 30s
  ROSTER_MS: 120_000,   // 同阵容 2min
} as const;

/** 对战 / 季后赛参数 */
export const PLAYOFF_CONFIG = {
  BO7_WINS: 4,
  ELO_DENOMINATOR: 30,
  MIN_WIN_PCT: 0.05,
  MAX_WIN_PCT: 0.95,
  PACE_MIN: 100,
  PACE_MAX: 120,
  MIN_SCORE: 80,
} as const;
