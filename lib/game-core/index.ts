// ===================================================================
//  lib/game-core/index.ts — 统一入口
//  前后端共用
// ===================================================================

// 类型
export type {
  Player, PlayerStats, Position, Decade,
  RosterSlots, RatedPlayer, TeamRating,
  SingleGameResult, SeriesResult, SeasonResult,
  GradeBand, EraBenchmark, PositionWeights, StatKey,
} from "./types";

// 常量
export {
  ALL_DECADES, POS_ORDER, STAT_KEYS,
  POSITION_WEIGHTS, ERA_BENCHMARKS, INTANGIBLES,
  TEAM_GRADE_BANDS,
  RATING_CONFIG, SEASON_CONFIG, PLAYOFF_CONFIG, SUBMIT_COOLDOWN,
} from "./constants";

// 评分
export { playerRating, rateRoster, calcTeamRating, calcTeamRatingFromSlots } from "./rating";

// 常规赛
export { calcRegularSeasonWins, getGradeByWins, simulateSeason } from "./season";

// 季后赛 / 对战
export { simulateSingleGame, simulateSeries } from "./playoff";

// 阵容工具
export { validateRoster, getRosterHash, matchPosition, getEmptyEligiblePositions, slotsToArray } from "./roster";

// 球员数据（异步加载 + 同步兼容）
export {
  // 异步 API（推荐）
  loadPlayerData,
  getPlayers,
  getTeams,
  getTeamsList,
  getDecadesForTeam,
  getTeamsForDecade,
  buildPlayerDataSource,
  // 同步 API（需预加载）
  getPlayersSync,
  getTeamsListSync,
  buildPlayerDataSourceSync,
  // 其他数据
  TEAM_COLORS,
  getTeamColors,
  TEAM_CN,
  teamCN,
  POSTER_BG_SRC,
} from "./data";

// NBA_PLAYERS 和 NBA_PLAYERS_BY_ERA_TEAM 不再直接导出
// 使用 loadPlayerData() 或 buildPlayerDataSource() 访问
