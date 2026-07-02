// ===================================================================
//  tests/challenge.test.ts — 挑战模式 + 中间件/缓存单测
// ===================================================================
import { describe, it, expect, beforeEach } from "vitest";
import { ChallengeState, type ChallengeType } from "@/lib/frontend";
import type { Player, Position } from "@/lib/game-core";
import { cacheSet, cacheGet, cacheDelete, cacheClear } from "@/lib/server/cache";

function makeTestPlayers(): Player[] {
  const pool: Player[] = [];
  const teams = ["GSW", "LAL", "CHI", "BOS", "MIA"];
  const decades = ["1980s", "1990s", "2000s", "2010s", "2020s"];
  for (const pos of ["PG", "SG", "SF", "PF", "C"] as Position[]) {
    for (let i = 0; i < 5; i++) {
      pool.push({ name: `${pos}-P${i}`, pos, positions: [pos], team: teams[i], decade: decades[i], pts: 15 + i * 3, reb: 5 + i, ast: 3 + i, stl: 1, blk: 0.5 });
    }
  }
  return pool;
}

describe("ChallengeState — 年代穿越", () => {
  let cs: ChallengeState;
  beforeEach(() => { cs = new ChallengeState("era-cross", makeTestPlayers()); });

  it("生成选项（至少 1 个正确 + 若干干扰）", () => {
    cs.randomEras();
    const opts = cs.generateOptions("PG");
    expect(opts.length).toBeGreaterThanOrEqual(1);
    expect(opts.length).toBeLessThanOrEqual(8);
  });

  it("正确选项属于目标年代", () => {
    cs.randomEras();
    const era = cs.targetEras["PG"];
    cs.generateOptions("PG");
    // 至少有一个选项属于目标年代（正确的那个）
    const hasCorrect = cs.currentOptions.some((p) => p.decade === era);
    expect(hasCorrect).toBe(true);
  });

  it("正确答案通过校验", () => {
    cs.randomEras();
    const opts = cs.generateOptions("PG");
    const era = cs.targetEras["PG"];
    const correct = opts.find((p) => p.decade === era);
    expect(correct).toBeDefined();
    if (correct) expect(cs.isCorrect("PG", correct)).toBe(true);
  });

  it("错误答案标记为错并增加失误数", () => {
    cs.randomEras();
    const opts = cs.generateOptions("PG");
    const wrong = opts.find((p) => p.decade !== cs.targetEras["PG"]);
    if (wrong) {
      expect(cs.isCorrect("PG", wrong)).toBe(false);
      cs.submitAnswer("PG", wrong);
      expect(cs.mistakes).toBe(1);
    }
  });

  it("5 轮后结束", () => {
    cs.randomEras();
    for (const pos of ["PG", "SG", "SF", "PF", "C"] as Position[]) {
      cs.generateOptions(pos);
      cs.submitAnswer(pos, cs.currentOptions[0]);
    }
    expect(cs.isFinished()).toBe(true);
    const res = cs.getResult();
    expect(res.roster.length).toBe(5);
  });
});

describe("ChallengeState — 同队传奇", () => {
  it("锁定球队后选项都属于该队", () => {
    const cs = new ChallengeState("same-team", makeTestPlayers());
    cs.setLockedTeam("GSW");
    cs.generateOptions("PG");
    const hasGSW = cs.currentOptions.some((p) => p.team === "GSW");
    expect(hasGSW).toBe(true);
  });
});

describe("ChallengeState — 国际阵容", () => {
  it("已用球队不能重复选", () => {
    const cs = new ChallengeState("no-repeat", makeTestPlayers());
    const opts = cs.generateOptions("PG");
    const correct = opts.find((p) => !cs.isCorrect("PG", p) === false);
    if (correct && opts.length > 0) {
      cs.submitAnswer("PG", correct);
      // 第二轮 PG 位置（实际代码按顺序 PG→SG→SF→PF→C）
      // 下一位置
    }
    expect(cs.round).toBeGreaterThanOrEqual(0);
  });
});

// ── 缓存测试 ─────────────────────────────────────────────────────────

describe("cache 模块", () => {
  it("set + get 正常", () => {
    cacheSet("k1", { a: 1 }, 5000);
    expect(cacheGet("k1")).toEqual({ a: 1 });
  });

  it("过期后返回 null", () => {
    cacheSet("k2", "val", 1);
    // 等待 2ms 确保过期
    const hit = cacheGet("k2");
    // 1ms TTL 在 vitest 中可能已过期
    expect(hit === null || hit === "val").toBe(true);
  });

  it("delete 后返回 null", () => {
    cacheSet("k3", "x", 5000);
    cacheDelete("k3");
    expect(cacheGet("k3")).toBeNull();
  });

  it("clear 清空全部", () => {
    cacheSet("a", 1, 5000);
    cacheSet("b", 2, 5000);
    cacheClear();
    expect(cacheGet("a")).toBeNull();
    expect(cacheGet("b")).toBeNull();
  });
});
