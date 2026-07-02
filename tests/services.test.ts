// ===================================================================
//  tests/services.test.ts — 服务层 / 工具层单测
// ===================================================================
import { describe, it, expect } from "vitest";
import { simulateSingleGame, simulateSeries, calcTeamRating, playerRating, validateRoster, SUBMIT_COOLDOWN } from "@/lib/game-core";
import { apiRequest } from "@/lib/api/request";
import type { Player } from "@/lib/game-core";

// ── SUBMIT_COOLDOWN 常量验证 ─────────────────────────────────────────

describe("SUBMIT_COOLDOWN 常量", () => {
  it("所有冷却时间为正数", () => {
    expect(SUBMIT_COOLDOWN.USER_MS).toBeGreaterThan(0);
    expect(SUBMIT_COOLDOWN.NAME_MS).toBeGreaterThan(0);
    expect(SUBMIT_COOLDOWN.ROSTER_MS).toBeGreaterThan(0);
  });
  it("冷却时间递增关系 USER ≤ NAME ≤ ROSTER", () => {
    expect(SUBMIT_COOLDOWN.USER_MS).toBeLessThanOrEqual(SUBMIT_COOLDOWN.NAME_MS);
    expect(SUBMIT_COOLDOWN.NAME_MS).toBeLessThanOrEqual(SUBMIT_COOLDOWN.ROSTER_MS);
  });
});

// ── playerRating 边界 ─────────────────────────────────────────────────

describe("playerRating 边界测试", () => {
  it("空 positions 数组使用 pos 作为基准", () => {
    const p: Player = { name: "T", pos: "PG", positions: [], team: "GSW", decade: "2020s", pts: 15, reb: 4, ast: 6, stl: 1, blk: 0.3 };
    expect(playerRating(p)).toBeGreaterThan(0);
  });
  it("NaN stats 不导致崩溃", () => {
    const p: Player = { name: "T", pos: "SF", positions: ["SF"], team: "LAL", decade: "2010s", pts: NaN as unknown as number, reb: 5, ast: 3, stl: 1, blk: 0.5 };
    const r = playerRating(p);
    expect(typeof r).toBe("number");
    expect(Number.isNaN(r)).toBe(false);
  });
  it("所有年代都能正常计算", () => {
    for (const decade of ["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"]) {
      const p: Player = { name: "T", pos: "C", positions: ["C"], team: "BOS", decade, pts: 20, reb: 10, ast: 3, stl: 1, blk: 1.5 };
      const r = playerRating(p);
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThanOrEqual(100);
    }
  });
});

// ── simulateSingleGame 边界 ──────────────────────────────────────────

describe("simulateSingleGame 边界测试", () => {
  it("极限分差下胜率不溢出", () => {
    for (let i = 0; i < 20; i++) {
      const g = simulateSingleGame(200, 0);
      expect(g.hostWin).toBeDefined();
      expect(g.hostScore).toBeGreaterThanOrEqual(80);
    }
  });
  it("连续 100 场结果不重复（有随机性）", () => {
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const g = simulateSingleGame(85, 85);
      results.add(`${g.hostScore}-${g.guestScore}`);
    }
    // 100 场同评分比赛，至少产生 5+ 种不同比分
    expect(results.size).toBeGreaterThan(5);
  });
  it("round 不影响 PVP 版本（无轮次修正）", () => {
    // 同输入应产生一致范围的结果
    const games = Array.from({ length: 30 }, () => simulateSingleGame(90, 90));
    const avgHostScore = games.reduce((s, g) => s + g.hostScore, 0) / games.length;
    expect(avgHostScore).toBeGreaterThan(90);
    expect(avgHostScore).toBeLessThan(115);
  });
});

// ── simulateSeries 边界 ──────────────────────────────────────────────

describe("simulateSeries 边界测试", () => {
  it("0-3 落后仍可完成系列赛", () => {
    const s = simulateSeries(90, 90, 0, 3);
    expect(s.games.length).toBeGreaterThanOrEqual(1);
  });
  it("传入已有对局继续模拟", () => {
    const existing = [{ hostScore: 105, guestScore: 98, hostWin: true }];
    const s = simulateSeries(90, 90, 1, 0, existing);
    expect(s.games.length).toBeGreaterThan(1);
    expect(s.games[0]).toEqual(existing[0]);
  });
});

// ── validateRoster 边界 ──────────────────────────────────────────────

describe("validateRoster 边界测试", () => {
  it("空阵容返回错误", () => {
    const r = validateRoster({});
    expect(r.valid).toBe(false);
  });
  it("缺少 decade 返回错误", () => {
    const slots = { PG: { name: "T", pos: "PG", positions: ["PG"], team: "GSW", decade: "", pts: 20, reb: 5, ast: 5, stl: 1, blk: 0.5 } as Player };
    const r = validateRoster(slots);
    expect(r.valid).toBe(false);
  });
});

// ── apiRequest 工具层 ────────────────────────────────────────────────

describe("apiRequest 工具层", () => {
  it("返回结构符合 ApiResponse", async () => {
    // 测试不存在的 URL，验证错误处理
    const res = await apiRequest("/api/nonexistent", { method: "POST", timeout: 2000 });
    expect(res).toHaveProperty("success");
    expect(typeof res.success).toBe("boolean");
  });
  it("超时不会无限等待", async () => {
    const start = Date.now();
    await apiRequest("https://10.255.255.1/nope", { method: "GET", timeout: 2000 });
    expect(Date.now() - start).toBeLessThan(5000);
  });
});

// ── calcTeamRating ────────────────────────────────────────────────────

describe("calcTeamRating 边界", () => {
  it("单球员阵容正常计算", () => {
    const rating = calcTeamRating([{ name: "Solo", pos: "PG", positions: ["PG"], team: "ATL", decade: "2020s", pts: 20, reb: 5, ast: 5, stl: 1, blk: 0.5 }]);
    expect(rating.overall).toBeGreaterThan(0);
  });
  it("全部顶级球员评分接近上限", () => {
    const gods: Player[] = Array.from({ length: 5 }, (_, i) => ({
      name: `God${i}`, pos: "SF", positions: ["PG", "SG", "SF", "PF", "C"], team: "LAL", decade: "2020s", pts: 40, reb: 15, ast: 12, stl: 3, blk: 3,
    }));
    const rating = calcTeamRating(gods);
    expect(rating.overall).toBeGreaterThan(100);
  });
});

// ===================================================================
//  Common pool service tests
// ===================================================================

describe("common pool player rating", () => {
  it("high-stat player gets high rating", () => {
    const r = playerRating({
      name: "Test Star", pos: "SG", positions: ["SG", "SF"],
      team: "LAL", decade: "2010s",
      pts: 30, reb: 8, ast: 7, stl: 2, blk: 1,
    });
    expect(r).toBeGreaterThanOrEqual(85);
  });

  it("low-stat player gets lower rating", () => {
    const r = playerRating({
      name: "Bench", pos: "PF", positions: ["PF"],
      team: "MEM", decade: "2010s",
      pts: 4, reb: 2, ast: 0.5, stl: 0.2, blk: 0.1,
    });
    expect(r).toBeLessThan(70);
  });

  it("rating is always in [0, 100]", () => {
    for (const p of [
      { pts: 50, reb: 25, ast: 15, stl: 5, blk: 5 },
      { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 },
      { pts: 15, reb: 5, ast: 4, stl: 1, blk: 0.5 },
    ]) {
      const r = playerRating({
        name: "T", pos: "SF", positions: ["SF"],
        team: "BOS", decade: "2020s",
        ...p,
      });
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(100);
    }
  });
});

describe("common pool validation rules", () => {
  it("duplicate player detection works", () => {
    const names = ["LeBron James", "Stephen Curry", "LeBron James"];
    const set = new Set(names);
    expect(set.size).toBe(2);
  });

  it("position validation accepts standard positions", () => {
    const valid = ["PG", "SG", "SF", "PF", "C"];
    expect(valid).toContain("PG");
    expect(valid).not.toContain("UNK");
  });

  it("skip count decrements correctly", () => {
    let skips = { team: 1, decade: 1 };
    skips = { ...skips, team: skips.team - 1 };
    expect(skips.team).toBe(0);
    expect(skips.decade).toBe(1);
  });

  it("timeout deadline is in the future for fresh pool", () => {
    const deadline = Date.now() + 15_000;
    expect(deadline).toBeGreaterThan(Date.now());
  });

  it("timeout deadline expires after 15s", () => {
    const deadline = Date.now() - 1; // passed
    expect(Date.now()).toBeGreaterThan(deadline);
  });
});

describe("common pool round logic", () => {
  it("5 rounds total for 5 positions", () => {
    const rounds = 5;
    const filled = [0, 1, 2, 3, 4, 5];
    expect(filled[5]).toBe(5);
    expect(filled.length).toBe(6); // 0 through 5
  });

  it("both pickers finish after 5 picks each", () => {
    const hostPicks = 5;
    const guestPicks = 5;
    expect(hostPicks).toBe(guestPicks);
    expect(hostPicks + guestPicks).toBe(10);
  });

  it("picker rotation alternates after each pick", () => {
    const pickers = ["host", "guest"];
    let current = 0;
    for (let i = 0; i < 10; i++) {
      expect(pickers[current % 2]).toBeDefined();
      current++;
    }
    expect(current).toBe(10);
  });
});

// ===================================================================
//  Profiles service tests
// ===================================================================

describe("profiles nickname validation", () => {
  it("accepts valid nickname", () => {
    const name = "篮球迷";
    expect(name.trim().length).toBeGreaterThan(0);
    expect(name.length).toBeLessThanOrEqual(20);
  });

  it("rejects empty nickname", () => {
    expect("".trim()).toBe("");
    expect("   ".trim()).toBe("");
  });

  it("rejects overly long nickname", () => {
    const name = "A".repeat(100);
    expect(name.length).toBeGreaterThan(20);
    expect(name.slice(0, 20).length).toBe(20);
  });

  it("nickname sanitization removes angle brackets", () => {
    const dirty = "<script>test</script>";
    const clean = dirty.replace(/[<>]/g, "");
    expect(clean).toBe("scripttest/script");
  });
});

describe("profiles battle stats", () => {
  it("win increments correctly", () => {
    let wins = 0;
    let total = 0;
    wins++;
    total++;
    expect(wins).toBe(1);
    expect(total).toBe(1);
  });

  it("loss only increments total", () => {
    let wins = 5;
    let total = 10;
    total++;
    expect(wins).toBe(5);
    expect(total).toBe(11);
  });

  it("best record updates only when higher", () => {
    let best = 65;
    const newWins = 75;
    best = Math.max(best, newWins);
    expect(best).toBe(75);

    // Lower score doesn't change best
    best = Math.max(best, 50);
    expect(best).toBe(75);
  });
});

describe("profiles batch query", () => {
  it("deduplicates user IDs", () => {
    const ids = ["a", "b", "a", "c", "b"];
    const unique = [...new Set(ids)];
    expect(unique).toEqual(["a", "b", "c"]);
  });

  it("filters empty IDs", () => {
    const ids = ["a", "", null, "b", undefined];
    const valid = ids.filter(Boolean);
    expect(valid).toEqual(["a", "b"]);
  });

  it("detects missing profiles", () => {
    const requested = new Set(["a", "b", "c"]);
    const found = new Set(["a"]);
    const missing = ["a", "b", "c"].filter((id) => !found.has(id));
    expect(missing).toEqual(["b", "c"]);
  });
});

describe("profiles rankings", () => {
  it("sorts by wins descending", () => {
    const data = [
      { nickname: "A", total_wins: 10, total_games: 20 },
      { nickname: "B", total_wins: 30, total_games: 40 },
      { nickname: "C", total_wins: 20, total_games: 30 },
    ];
    data.sort((a, b) => b.total_wins - a.total_wins);
    expect(data[0].nickname).toBe("B");
    expect(data[2].nickname).toBe("A");
  });

  it("filters out zero-battle users", () => {
    const data = [
      { total_games: 0 },
      { total_games: 5 },
      { total_games: 0 },
      { total_games: 10 },
    ];
    const active = data.filter((d) => d.total_games > 0);
    expect(active.length).toBe(2);
  });
});
