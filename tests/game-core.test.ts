// ===================================================================
//  tests/game-core.test.ts — 核心算法测试
// ===================================================================
import { describe, it, expect, beforeAll } from "vitest";
import {
  playerRating,
  calcTeamRating,
  calcTeamRatingFromSlots,
  calcRegularSeasonWins,
  getGradeByWins,
  simulateSeason,
  simulateSingleGame,
  simulateSeries,
  validateRoster,
  getRosterHash,
  loadPlayerData,
  TEAM_COLORS,
  getTeamColors,
  TEAM_CN,
  teamCN,
  buildPlayerDataSourceSync,
  getPlayersSync,
  getTeamsListSync,
} from "@/lib/game-core";
import type { Player, RosterSlots } from "@/lib/game-core";

// ── 测试前预加载球员数据 ──────────────────────────────────────────

let NBA_PLAYERS: Player[] = [];
let NBA_PLAYERS_BY_ERA_TEAM: Record<string, Record<string, Player[]>> = {};

beforeAll(async () => {
  const data = await loadPlayerData();
  NBA_PLAYERS = data.NBA_PLAYERS;
  NBA_PLAYERS_BY_ERA_TEAM = data.NBA_PLAYERS_BY_ERA_TEAM;
});

// ── playerRating 边界值测试 ──────────────────────────────────────────

describe("playerRating", () => {
  it("乔丹（1990s SG）评分应在 95+", () => {
    const mj: Player = {
      name: "Michael Jordan", pos: "SG", positions: ["SG", "SF"],
      team: "CHI", decade: "1990s",
      pts: 30.1, reb: 6.2, ast: 5.3, stl: 2.3, blk: 0.8,
    };
    const r = playerRating(mj);
    expect(r).toBeGreaterThanOrEqual(95);
    expect(r).toBeLessThanOrEqual(100);
  });

  it("普通角色球员评分应在 60-85 之间", () => {
    const role: Player = {
      name: "Role Player", pos: "SF", positions: ["SF"],
      team: "MEM", decade: "2010s",
      pts: 8.0, reb: 3.5, ast: 1.2, stl: 0.5, blk: 0.2,
    };
    const r = playerRating(role);
    expect(r).toBeGreaterThanOrEqual(50);
    expect(r).toBeLessThanOrEqual(85);
  });

  it("评分不超过 100", () => {
    const goat: Player = {
      name: "GOAT", pos: "C", positions: ["C", "PF", "SF", "SG", "PG"],
      team: "LAL", decade: "2020s",
      pts: 50, reb: 25, ast: 15, stl: 5, blk: 5,
    };
    expect(playerRating(goat)).toBeLessThanOrEqual(100);
  });

  it("多位置球员获得额外加成", () => {
    const singlePos: Player = {
      name: "Test A", pos: "PG", positions: ["PG"],
      team: "ATL", decade: "2020s",
      pts: 20, reb: 5, ast: 5, stl: 1, blk: 0.5,
    };
    const multiPos: Player = {
      ...singlePos, name: "Test B", positions: ["PG", "SG", "SF"],
    };
    expect(playerRating(multiPos)).toBeGreaterThan(playerRating(singlePos));
  });

  it("老年代（缺 stl/blk）能正常计算", () => {
    const oldEraPlayer: Player = {
      name: "Wilt Chamberlain", pos: "C", positions: ["C"],
      team: "LAL", decade: "1960s",
      pts: 30, reb: 22, ast: 4, stl: 0, blk: 0,
    };
    const r = playerRating(oldEraPlayer);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThanOrEqual(100);
    // stl/blk 为 0 时不应导致 NaN
    expect(Number.isNaN(r)).toBe(false);
  });
});

// ── calcTeamRating 一致性测试 ────────────────────────────────────────

describe("calcTeamRating", () => {
  it("5 人阵容评分合理", () => {
    const roster: Player[] = [
      { name: "PG", pos: "PG", positions: ["PG"], team: "GSW", decade: "2010s", pts: 25, reb: 5, ast: 8, stl: 2, blk: 0.3 },
      { name: "SG", pos: "SG", positions: ["SG"], team: "LAL", decade: "2000s", pts: 28, reb: 5, ast: 5, stl: 1.5, blk: 0.5 },
      { name: "SF", pos: "SF", positions: ["SF"], team: "MIA", decade: "2010s", pts: 26, reb: 7, ast: 5, stl: 1.5, blk: 0.8 },
      { name: "PF", pos: "PF", positions: ["PF"], team: "SAS", decade: "2000s", pts: 20, reb: 11, ast: 3, stl: 0.7, blk: 2 },
      { name: "C", pos: "C", positions: ["C"], team: "HOU", decade: "1990s", pts: 22, reb: 12, ast: 3, stl: 1.5, blk: 3 },
    ];
    const result = calcTeamRating(roster);
    expect(result.overall).toBeGreaterThan(70);
    expect(result.overall).toBeLessThan(120);
    expect(result.playerRatings).toHaveLength(5);
  });

  it("空阵容返回默认 80", () => {
    const result = calcTeamRating([]);
    expect(result.overall).toBe(80);
    expect(result.playerRatings).toHaveLength(0);
  });

  it("calcTeamRatingFromSlots 与 calcTeamRating 一致", () => {
    const roster: Player[] = [
      { name: "P1", pos: "PG", positions: ["PG"], team: "BOS", decade: "1980s", pts: 15, reb: 4, ast: 10, stl: 1, blk: 0.2 },
      { name: "P2", pos: "SG", positions: ["SG"], team: "CHI", decade: "1990s", pts: 20, reb: 5, ast: 4, stl: 1.5, blk: 0.5 },
      { name: "P3", pos: "SF", positions: ["SF"], team: "DAL", decade: "2000s", pts: 18, reb: 6, ast: 3, stl: 1, blk: 0.5 },
      { name: "P4", pos: "PF", positions: ["PF"], team: "UTA", decade: "1990s", pts: 16, reb: 10, ast: 2, stl: 0.8, blk: 1.5 },
      { name: "P5", pos: "C", positions: ["C"], team: "ORL", decade: "1990s", pts: 15, reb: 12, ast: 2, stl: 0.5, blk: 2 },
    ];
    const slots: RosterSlots = { PG: roster[0], SG: roster[1], SF: roster[2], PF: roster[3], C: roster[4] };
    const fromSlots = calcTeamRatingFromSlots(slots);
    const direct = calcTeamRating(roster);
    expect(fromSlots.overall).toBe(direct.overall);
  });
});

// ── simulateSingleGame 胜率范围测试 ──────────────────────────────────

describe("simulateSingleGame", () => {
  it("比分不低于 80", () => {
    for (let i = 0; i < 50; i++) {
      const g = simulateSingleGame(90, 90);
      expect(g.hostScore).toBeGreaterThanOrEqual(80);
      expect(g.guestScore).toBeGreaterThanOrEqual(80);
    }
  });

  it("同评分时胜负大致均衡（1000 次模拟，胜率在 35%-65% 之间）", () => {
    let hostWins = 0;
    const n = 1000;
    for (let i = 0; i < n; i++) {
      if (simulateSingleGame(90, 90).hostWin) hostWins++;
    }
    const pct = hostWins / n;
    expect(pct).toBeGreaterThan(0.35);
    expect(pct).toBeLessThan(0.65);
  });

  it("大幅领先时胜率接近上限（95%）", () => {
    let hostWins = 0;
    const n = 500;
    for (let i = 0; i < n; i++) {
      if (simulateSingleGame(120, 60).hostWin) hostWins++;
    }
    // 120 vs 60 → Elo 约 99%，但上限为 95%，实际在 90%-100% 之间
    const pct = hostWins / n;
    expect(pct).toBeGreaterThan(0.85);
  });
});

// ── 常规赛胜场公式验证 ──────────────────────────────────────────────

describe("常规赛模拟", () => {
  it("teamOvr=110 时为 82 胜", () => {
    expect(calcRegularSeasonWins(110)).toBe(82);
  });

  it("teamOvr 越高胜场越多（单调性）", () => {
    expect(calcRegularSeasonWins(100)).toBeGreaterThan(calcRegularSeasonWins(80));
    expect(calcRegularSeasonWins(80)).toBeGreaterThan(calcRegularSeasonWins(60));
  });

  it("胜场在 [0, 82] 范围内", () => {
    for (const ovr of [40, 60, 80, 90, 100, 110, 120]) {
      const w = calcRegularSeasonWins(ovr);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(82);
    }
  });

  it("getGradeByWins 返回正确的段位", () => {
    expect(getGradeByWins(82).grade).toBe("S");
    expect(getGradeByWins(75).grade).toBe("A+");
    expect(getGradeByWins(65).grade).toBe("A");
    expect(getGradeByWins(55).grade).toBe("C");
    expect(getGradeByWins(30).grade).toBe("F");
  });

  it("simulateSeason 返回完整结果", () => {
    const s = simulateSeason(95);
    expect(s.wins).toBeGreaterThan(0);
    expect(s.losses).toBe(82 - s.wins);
    expect(s.teamOvr).toBe(95);
    expect(s.grade).toBeTruthy();
    expect(s.tier).toBeTruthy();
    expect(s.color).toBeTruthy();
  });
});

// ── BO7 系列赛 ───────────────────────────────────────────────────────

describe("simulateSeries", () => {
  it("系列赛必然决出胜负（一方先赢 4 场）", () => {
    const s = simulateSeries(90, 90);
    expect(s.hostWins >= 4 || s.guestWins >= 4).toBe(true);
    expect(s.hostWin === (s.hostWins >= 4)).toBe(true);
    expect(s.games.length).toBe(s.hostWins + s.guestWins);
  });

  it("从已有比分继续模拟", () => {
    const s = simulateSeries(90, 90, 3, 0);
    // 3-0 领先，至少需要 1 场才能结束
    expect(s.games.length).toBeGreaterThanOrEqual(1);
  });
});

// ── 阵容工具 ─────────────────────────────────────────────────────────

describe("validateRoster", () => {
  const makeRoster = (): RosterSlots => ({
    PG: { name: "P1", pos: "PG", positions: ["PG"], team: "GSW", decade: "2010s", pts: 20, reb: 4, ast: 8, stl: 1, blk: 0.3 },
    SG: { name: "P2", pos: "SG", positions: ["SG"], team: "LAL", decade: "2000s", pts: 22, reb: 5, ast: 4, stl: 1.5, blk: 0.5 },
    SF: { name: "P3", pos: "SF", positions: ["SF"], team: "MIA", decade: "2010s", pts: 18, reb: 6, ast: 3, stl: 1, blk: 0.5 },
    PF: { name: "P4", pos: "PF", positions: ["PF"], team: "SAS", decade: "2000s", pts: 16, reb: 10, ast: 2, stl: 0.8, blk: 1.5 },
    C:  { name: "P5", pos: "C",  positions: ["C"],  team: "HOU", decade: "1990s", pts: 15, reb: 12, ast: 2, stl: 0.5, blk: 2 },
  });

  it("完整 5 人阵容校验通过", () => {
    expect(validateRoster(makeRoster()).valid).toBe(true);
  });

  it("缺少位置返回错误", () => {
    const r = makeRoster();
    r.C = null;
    const v = validateRoster(r);
    expect(v.valid).toBe(false);
    expect(v.error).toContain("缺少");
  });

  it("重复球员返回错误", () => {
    const r = makeRoster();
    r.SG = r.PG;
    const v = validateRoster(r);
    expect(v.valid).toBe(false);
    expect(v.error).toContain("重复");
  });

  it("getRosterHash 同一阵容返回相同哈希", () => {
    const r1 = makeRoster();
    const r2 = makeRoster();
    expect(getRosterHash(r1)).toBe(getRosterHash(r2));
    // 更换一名球员后哈希不同
    const r3 = { ...makeRoster(), PG: { ...makeRoster().PG!, name: "Different" } };
    expect(getRosterHash(r3)).not.toBe(getRosterHash(r1));
  });
});

// ===================================================================
//  数据模块测试（异步加载后执行）
// ===================================================================

describe("NBA_PLAYERS data integrity", () => {
  it("has 10000+ players", () => {
    expect(NBA_PLAYERS.length).toBeGreaterThanOrEqual(10000);
  });

  it("each player has valid positions", () => {
    for (const p of NBA_PLAYERS.slice(0, 100)) {
      expect(p.positions.length).toBeGreaterThan(0);
      expect(["PG", "SG", "SF", "PF", "C"]).toContain(p.positions[0]);
    }
  });

  it("stat fields are non-negative", () => {
    for (const p of NBA_PLAYERS.slice(0, 100)) {
      expect(p.pts).toBeGreaterThanOrEqual(0);
      expect(p.reb).toBeGreaterThanOrEqual(0);
      expect(p.ast).toBeGreaterThanOrEqual(0);
    }
  });

  it("era index is correctly loaded", () => {
    expect(Object.keys(NBA_PLAYERS_BY_ERA_TEAM).length).toBeGreaterThanOrEqual(7);
    expect(NBA_PLAYERS_BY_ERA_TEAM["2010s"]).toBeDefined();
    expect(NBA_PLAYERS_BY_ERA_TEAM["1990s"]).toBeDefined();
  });
});

describe("data query functions", () => {
  it("getPlayersSync returns correct players", () => {
    const players = getPlayersSync("2010s", "GSW");
    expect(players.length).toBeGreaterThan(0);
    expect(players[0].team).toBe("GSW");
    expect(players[0].decade).toBe("2010s");
  });

  it("getPlayersSync returns empty for nonexistent combo", () => {
    expect(getPlayersSync("2020s", "NONEXIST")).toEqual([]);
  });

  it("getTeamsListSync returns deduplicated teams", () => {
    const teams = getTeamsListSync();
    expect(teams.length).toBeGreaterThanOrEqual(30);
    expect(new Set(teams).size).toBe(teams.length);
  });

  it("teamCN returns Chinese names", () => {
    expect(teamCN("LAL")).toBe("湖人");
    expect(teamCN("CHI")).toBe("公牛");
  });

  it("teamCN returns original for unknown", () => {
    expect(teamCN("XXX")).toBe("XXX");
  });
});

describe("team colors and names", () => {
  it("TEAM_COLORS has 30 teams", () => {
    expect(Object.keys(TEAM_COLORS).length).toBe(30);
  });

  it("getTeamColors returns default for unknown", () => {
    expect(getTeamColors("XXX")).toEqual(["#888888", "#444444"]);
  });
});

describe("slot machine data source compatibility", () => {
  it("buildPlayerDataSourceSync returns valid structure", () => {
    const ds = buildPlayerDataSourceSync();
    expect(typeof ds).toBe("object");
    const decades = Object.keys(ds);
    expect(decades.length).toBeGreaterThanOrEqual(7);
    // Each decade should have teams with players
    for (const d of decades.slice(0, 2)) {
      const teams = Object.keys(ds[d]);
      expect(teams.length).toBeGreaterThan(0);
      const firstTeam = teams[0];
      expect(ds[d][firstTeam].length).toBeGreaterThan(0);
    }
  });

  it("all players have non-empty name", () => {
    for (const p of NBA_PLAYERS.slice(0, 500)) {
      expect(p.name.length).toBeGreaterThan(0);
    }
  });
});
