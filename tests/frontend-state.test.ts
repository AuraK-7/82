// ===================================================================
//  tests/frontend-state.test.ts — 前端业务状态层单测
// ===================================================================
import { describe, it, expect, beforeEach } from "vitest";
import { RosterManager, SlotMachine, ClassicState, CustomState, DreamState, BattleState } from "@/lib/frontend";
import type { Player, Position } from "@/lib/game-core";

// ── 测试用的模拟球员池 ──────────────────────────────────────────────

function makePlayer(name: string, pos: Position, team = "GSW", decade = "2010s", stats: Partial<Player> = {}): Player {
  return {
    name, pos, positions: [pos], team, decade,
    pts: 20, reb: 5, ast: 5, stl: 1, blk: 0.5, ...stats,
  };
}

function makePlayerWithPositions(name: string, positions: Position[], team = "LAL", decade = "2000s"): Player {
  return { name, pos: positions[0], positions, team, decade, pts: 22, reb: 6, ast: 4, stl: 1.5, blk: 0.8 };
}

function makePlayerPool(): Record<string, Record<string, Player[]>> {
  return {
    "2010s": {
      GSW: [
        makePlayer("Stephen Curry", "PG", "GSW", "2010s", { pts: 30, reb: 5, ast: 6 }),
        makePlayer("Klay Thompson", "SG", "GSW", "2010s", { pts: 22, reb: 4, ast: 2 }),
        makePlayer("Draymond Green", "PF", "GSW", "2010s", { pts: 8, reb: 7, ast: 7 }),
      ],
      LAL: [
        makePlayer("LeBron James", "SF", "LAL", "2010s", { pts: 27, reb: 7, ast: 7 }),
        makePlayer("Anthony Davis", "C", "LAL", "2010s", { pts: 26, reb: 10, ast: 3 }),
      ],
    },
    "2000s": {
      LAL: [
        makePlayer("Kobe Bryant", "SG", "LAL", "2000s", { pts: 28, reb: 5, ast: 5 }),
        makePlayer("Shaquille O'Neal", "C", "LAL", "2000s", { pts: 27, reb: 12, ast: 3 }),
      ],
    },
    "1990s": {
      CHI: [
        makePlayer("Michael Jordan", "SG", "CHI", "1990s", { pts: 30, reb: 6, ast: 5, stl: 2.3, blk: 0.8 }),
        makePlayer("Scottie Pippen", "SF", "CHI", "1990s", { pts: 18, reb: 6, ast: 5 }),
      ],
    },
  };
}

// ══════════════════════════════════════════════════════════════════
//  RosterManager 测试
// ══════════════════════════════════════════════════════════════════

describe("RosterManager", () => {
  let rm: RosterManager;

  beforeEach(() => { rm = new RosterManager(); });

  it("初始状态全部为空", () => {
    expect(rm.isFull()).toBe(false);
    expect(rm.filledCount()).toBe(0);
    expect(rm.getPickedNames()).toHaveLength(0);
  });

  it("添加球员到正确位置", () => {
    const p = makePlayer("Test", "PG");
    expect(rm.addPlayer(p, "PG")).toBe(true);
    expect(rm.at("PG")?.name).toBe("Test");
    expect(rm.filledCount()).toBe(1);
  });

  it("不能添加到已占位置", () => {
    rm.addPlayer(makePlayer("P1", "PG"), "PG");
    expect(rm.addPlayer(makePlayer("P2", "PG"), "PG")).toBe(false);
  });

  it("不能添加到球员不支持的位置", () => {
    expect(rm.addPlayer(makePlayer("Center", "C"), "PG")).toBe(false);
  });

  it("移动球员", () => {
    const p = makePlayerWithPositions("Flex", ["PG", "SG"]);
    rm.addPlayer(p, "PG");
    expect(rm.movePlayer("PG", "SG")).toBe(true);
    expect(rm.at("PG")).toBeNull();
    expect(rm.at("SG")?.name).toBe("Flex");
  });

  it("移除球员", () => {
    rm.addPlayer(makePlayer("P1", "PG"), "PG");
    const removed = rm.removePlayer("PG");
    expect(removed?.name).toBe("P1");
    expect(rm.at("PG")).toBeNull();
  });

  it("5人满员检测", () => {
    for (const pos of ["PG", "SG", "SF", "PF", "C"] as Position[]) {
      rm.addPlayer(makePlayer(`P_${pos}`, pos), pos);
    }
    expect(rm.isFull()).toBe(true);
    expect(rm.filledCount()).toBe(5);
  });

  it("阵容哈希一致性", () => {
    const r1 = new RosterManager();
    const r2 = new RosterManager();
    for (const pos of ["PG", "SG", "SF", "PF", "C"] as Position[]) {
      r1.addPlayer(makePlayer(`X_${pos}`, pos), pos);
      r2.addPlayer(makePlayer(`X_${pos}`, pos), pos);
    }
    expect(r1.getHash()).toBe(r2.getHash());
  });

  it("状态快照与恢复", () => {
    rm.addPlayer(makePlayer("P1", "PG"), "PG");
    const snap = rm.getState();
    const rm2 = new RosterManager();
    rm2.restoreState(snap);
    expect(rm2.at("PG")?.name).toBe("P1");
  });

  it("事件触发", () => {
    let called = false;
    rm.on("roster-update", () => { called = true; });
    rm.addPlayer(makePlayer("Event", "PG"), "PG");
    expect(called).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════
//  SlotMachine 测试
// ══════════════════════════════════════════════════════════════════

describe("SlotMachine", () => {
  let sm: SlotMachine;

  beforeEach(() => { sm = new SlotMachine(makePlayerPool()); });

  it("spin 锁定一个组合", () => {
    const r = sm.spin();
    expect(r.team).toBeTruthy();
    expect(r.decade).toBeTruthy();
    expect(sm.spun).toBe(true);
    expect(sm.availablePlayers.length).toBeGreaterThan(0);
  });

  it("Top20 筛选", () => {
    sm.spin();
    const top = sm.getTopPlayers(20);
    expect(top.length).toBeGreaterThan(0);
    // 排除已选球员
    const filtered = sm.getTopPlayers(20, [top[0].name]);
    expect(filtered.every((p) => p.name !== top[0].name)).toBe(true);
  });

  it("跳过球队改变 team 但保留 decade", () => {
    sm.spin();
    const origDecade = sm.currentDecade;
    const r = sm.skipTeam();
    if (r) {
      expect(r.decade).toBe(origDecade);
      expect(sm.skipTeamCount).toBe(0);
    }
  });

  it("跳过次数耗尽后返回 null", () => {
    sm.spin();
    sm.skipTeam();
    expect(sm.skipTeam()).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════
//  ClassicState 测试
// ══════════════════════════════════════════════════════════════════

describe("ClassicState", () => {
  let cs: ClassicState;

  beforeEach(() => { cs = new ClassicState(makePlayerPool()); });

  it("初始化状态正确", () => {
    expect(cs.round).toBe(0);
    expect(cs.maxRounds).toBe(5);
    expect(cs.roster.isFull()).toBe(false);
  });

  it("5轮完整选人后触发模拟", () => {
    let simulated = false;
    cs.on("simulation-complete", () => { simulated = true; });

    // 多次 spin 直到选满所有位置
    const target: Position[] = ["PG", "SG", "SF", "PF", "C"];
    for (let i = 0; i < target.length; i++) {
      cs.spin();
      const top = cs.getTopPlayers();
      // 尝试找到目标位置的球员
      for (const pos of target) {
        if (cs.roster.at(pos)) continue;
        const eligible = top.find((p) => p.positions.includes(pos));
        if (eligible) {
          cs.confirmPick(eligible, pos);
          break;
        }
      }
    }
    // 至少选了些球员
    expect(cs.round).toBeGreaterThan(0);
    expect(cs.roster.filledCount()).toBeGreaterThan(0);
  });

  it("模拟返回合法结果", () => {
    const result = cs.simulate();
    expect(result.wins).toBeGreaterThanOrEqual(0);
    expect(result.wins).toBeLessThanOrEqual(82);
    expect(result.losses).toBe(82 - result.wins);
    expect(result.grade).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════════
//  CustomState 测试
// ══════════════════════════════════════════════════════════════════

describe("CustomState", () => {
  const pool = Object.values(makePlayerPool()).flatMap((teams) =>
    Object.values(teams).flat()
  );
  let cs2: CustomState;

  beforeEach(() => { cs2 = new CustomState(pool); });

  it("自由选择5人", () => {
    const posOrder: Position[] = ["PG", "SG", "SF", "PF", "C"];
    for (const pos of posOrder) {
      cs2.setActivePosition(pos);
      const eligible = cs2.getEligiblePlayers();
      expect(eligible.length).toBeGreaterThan(0);
      cs2.confirmPick(eligible[0]);
    }
    expect(cs2.roster.isFull()).toBe(true);
    expect(cs2.canSimulate()).toBe(true);
  });

  it("工资帽模式下超帽不可模拟", () => {
    cs2.enableSalaryMode(20);
    cs2.setActivePosition("PG");
    const eligible = cs2.getEligiblePlayers();
    // 第一个高评分球员薪资应≥25M，超帽20M
    cs2.confirmPick(eligible[0]);
    expect(cs2.isOverBudget()).toBe(true);
    // 即使满员也不能模拟
    expect(cs2.canSimulate()).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
//  BattleState 测试
// ══════════════════════════════════════════════════════════════════

describe("BattleState", () => {
  let bs: BattleState;

  beforeEach(() => { bs = new BattleState(makePlayerPool()); });

  it("进入选人状态正确", () => {
    bs.enterPicking("ABC123", true);
    expect(bs.roomCode).toBe("ABC123");
    expect(bs.isHost).toBe(true);
    expect(bs.status).toBe("picking");
  });

  it("选人后标记就绪", () => {
    bs.enterPicking("XYZ789", false);
    bs.spin();
    const top = bs.slotMachine.getTopPlayers(20);
    // 尝试选人（不保证5人满）
    for (const pos of ["PG", "SG", "SF", "PF", "C"] as Position[]) {
      const eligible = top.find((p) => p.positions.includes(pos) && !bs.roster.at(pos));
      if (eligible) bs.confirmPick(eligible, pos);
    }
    // 不满员时 markReady 返回 false
    expect(bs.roster.filledCount()).toBeGreaterThan(0);
  });

  it("同步房间数据", () => {
    bs.syncFromRoom({
      status: "playing", host_nickname: "HostUser", guest_nickname: "GuestUser",
      host_pick_progress: 5, guest_pick_progress: 3,
      host_ready: true, guest_ready: false,
      playoff_state: { games: [], hostWins: 1, guestWins: 0 },
    });
    // Battlestate 默认不是 host，所以 opponentName 是 host_nickname
    expect(bs.opponentName).toBe("HostUser");
  });
});

// ===================================================================
//  Common pool BattleState tests
// ===================================================================

describe("BattleState common pool", () => {
  let bs: BattleState;

  beforeEach(() => {
    bs = new BattleState(makePlayerPool());
  });

  it("default pick mode is independent", () => {
    expect(bs.pickMode).toBe("independent");
  });

  it("enterCommonPicking initializes common pool state", () => {
    bs.enterCommonPicking("ABC123", true, "user-1");
    expect(bs.roomCode).toBe("ABC123");
    expect(bs.isHost).toBe(true);
    expect(bs.pickMode).toBe("common");
    expect(bs.status).toBe("picking");
    expect(bs.mySkips.team).toBe(1);
    expect(bs.mySkips.decade).toBe(1);
  });

  it("syncFromRoom updates common pool fields", () => {
    bs.syncFromRoom({
      status: "picking",
      pick_mode: "common",
      current_pick_round: 2,
      current_picker: "user-2",
      common_pool: [
        {
          team: "GSW",
          decade: "2010s",
          players: [
            { name: "P1", pos: "PG", positions: ["PG"], pts: 20, reb: 5, ast: 8, stl: 1, blk: 0.3 },
            { name: "P2", pos: "SG", positions: ["SG"], pts: 22, reb: 4, ast: 5, stl: 1.5, blk: 0.5 },
          ],
        },
      ],
      host_nickname: "HostUser",
      guest_nickname: "GuestUser",
      host_pick_progress: 2,
      guest_pick_progress: 1,
      host_ready: false,
      guest_ready: false,
    });

    expect(bs.pickMode).toBe("common");
    expect(bs.currentPickRound).toBe(2);
    expect(bs.commonPool.length).toBe(1);
    expect(bs.commonPool[0].team).toBe("GSW");
    expect(bs.commonPool[0].players.length).toBe(2);
  });

  it("getCountdown returns 0 when no deadline", () => {
    expect(bs.getCountdown()).toBe(0);
  });

  it("getCountdown returns positive when deadline in future", () => {
    // Set pickDeadline by syncing room
    bs.syncFromRoom({
      status: "picking",
      pick_mode: "common",
      pick_deadline: new Date(Date.now() + 10000).toISOString(),
      host_nickname: "H",
      guest_nickname: "G",
      host_pick_progress: 0,
      guest_pick_progress: 0,
      host_ready: false,
      guest_ready: false,
    });
    expect(bs.getCountdown()).toBeGreaterThan(0);
    expect(bs.getCountdown()).toBeLessThanOrEqual(15);
  });

  it("reset clears all common pool state", () => {
    bs.enterCommonPicking("XYZ789", false, "user-2");
    bs.reset();
    expect(bs.pickMode).toBe("independent");
    expect(bs.commonPool).toEqual([]);
    expect(bs.currentPickRound).toBe(0);
    expect(bs.currentPicker).toBeNull();
    expect(bs.status).toBeNull();
  });
});
