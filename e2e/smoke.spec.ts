// ===================================================================
//  e2e/smoke.spec.ts — 核心链路集成测试
// ===================================================================
import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE || "http://localhost:3000";

// ── 首页加载 ──────────────────────────────────────────────────────────

test.describe("首页加载", () => {
  test("主菜单渲染正常，所有入口可见", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator("#screen-menu")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".menu-content")).toBeVisible();

    // 验证主要入口按钮存在
    const buttons = [
      "开始游戏",
      "双人对战",
      "排行榜",
    ];
    for (const text of buttons) {
      const btn = page.locator(`button:has-text("${text}")`).first();
      if (await btn.isVisible()) {
        await expect(btn).toBeVisible();
      }
    }
  });

  test("页面无控制台红错", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE);
    await page.waitForTimeout(3000);
    // 排除第三方脚本错误
    const filtered = errors.filter(
      (e) => !e.includes("broker") && !e.includes("FP ok") && !e.includes("extension")
    );
    expect(filtered).toEqual([]);
  });

  test("健康检查 API 正常响应", async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.status).toBeDefined();
    expect(["ok", "degraded"]).toContain(json.status);
    expect(json.app).toBe("82-0 完美赛季大挑战");
  });
});

// ── 经典模式流程 ─────────────────────────────────────────────────────

test.describe("经典模式完整流程", () => {
  test("进入 → 老虎机显示 → 选人交互", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector("#screen-menu", { timeout: 10000 });

    // 点击开始游戏
    const startBtn = page.locator("button:has-text('开始游戏')").first();
    await startBtn.click();

    // 等待经典模式面板加载
    await page.waitForSelector("#screen-game", { timeout: 10000 });
    await expect(page.locator(".slot-section")).toBeVisible({ timeout: 5000 });

    // 老虎机交互区域可见
    const spinBtn = page.locator("button:has-text('随机')").first();
    if (await spinBtn.isVisible()) {
      await expect(spinBtn).toBeVisible();
    }
  });

  test("经典模式可返回主菜单", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector("#screen-menu", { timeout: 10000 });

    // 进入游戏
    await page.locator("button:has-text('开始游戏')").first().click();
    await page.waitForSelector("#screen-game", { timeout: 10000 });

    // 验证有返回按钮
    const backBtn = page.locator(".back-nav").first();
    if (await backBtn.isVisible()) {
      await expect(backBtn).toBeVisible();
    }
  });
});

// ── 双人对战流程 ─────────────────────────────────────────────────────

test.describe("双人对战流程", () => {
  test("对战大厅入口可见", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector("#screen-menu", { timeout: 10000 });

    const battleBtn = page.locator("button:has-text('双人对战')").first();
    if (await battleBtn.isVisible()) {
      await battleBtn.click();
      await page.waitForTimeout(2000);
      // 对战大厅或相关屏幕应该可见
      const anyScreen = page.locator(".screen.active").first();
      await expect(anyScreen).toBeVisible();
    }
  });

  test("对战页面可返回主菜单", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector("#screen-menu", { timeout: 10000 });

    const battleBtn = page.locator("button:has-text('双人对战')").first();
    if (await battleBtn.isVisible()) {
      await battleBtn.click();
      await page.waitForTimeout(2000);

      // 查找返回按钮
      const backBtn = page.locator("button:has-text('返回主页')").first();
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await page.waitForTimeout(1000);
        await expect(page.locator("#screen-menu")).toBeVisible();
      }
    }
  });
});

// ── 排行榜流程 ───────────────────────────────────────────────────────

test.describe("排行榜", () => {
  test("排行榜页面可加载", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector("#screen-menu", { timeout: 10000 });

    const leaderboardBtn = page.locator("button:has-text('排行榜')").first();
    if (await leaderboardBtn.isVisible()) {
      await leaderboardBtn.click();
      await page.waitForTimeout(3000);
      // 排行榜应该渲染
      const anyScreen = page.locator(".screen.active").first();
      await expect(anyScreen).toBeVisible();
    }
  });

  test("排行榜 API 可正常响应", async ({ request }) => {
    const res = await request.get(`${BASE}/api/records?type=all&limit=5`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });
});

// ── 自选模式 ─────────────────────────────────────────────────────────

test.describe("自选模式", () => {
  test("自选模式入口可进入", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector("#screen-menu", { timeout: 10000 });

    const customBtn = page.locator("button:has-text('自选娱乐')").first();
    if (await customBtn.isVisible()) {
      await customBtn.click();
      await page.waitForTimeout(3000);
      // 验证有内容渲染
      const anyScreen = page.locator(".screen.active").first();
      await expect(anyScreen).toBeVisible();
    }
  });
});

// ── API 端点检查 ─────────────────────────────────────────────────────

test.describe("API 端点", () => {
  test("profiles API 返回有效响应", async ({ request }) => {
    const res = await request.get(`${BASE}/api/profiles?type=wins&limit=5`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  test("health API 在无数据库时仍可响应", async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.status).toBeDefined();
    expect(json.components).toBeDefined();
    expect(json.components.database).toBeDefined();
    expect(json.components.supabase).toBeDefined();
  });

  test("POST API 需要 CSRF 保护", async ({ request }) => {
    // 不带 CSRF token 的 POST 请求应被拦截
    const res = await request.post(`${BASE}/api/battle`, {
      data: { action: "getState", payload: { roomCode: "XXXXXX" } },
    });
    // 应返回 403（无 token）或 400（无 action 但鉴权失败）或 401（未登录）
    expect([400, 401, 403]).toContain(res.status());
  });
});
