// ===================================================================
//  app/api/battle/route.ts — 对战域统一入口
// ===================================================================
import { NextResponse } from "next/server";
import { battleService } from "@/lib/server/battle.service";
import { requireAuth, sanitizeText, validateRoomCode, validateSlot, type ApiResponse } from "@/lib/server/auth";
import { validateServerEnv } from "@/lib/env";
import { withCsrfProtection } from "@/lib/server/csrf";

type BattleAction = "create" | "join" | "confirmRoster" | "simulate" | "getState" | "pickFromPool" | "skipPool" | "checkTimeout";

// ══════════════════════════════════════════════════════════════════

async function _post(req: Request): Promise<Response> {
  const envCheck = validateServerEnv();
  if (!envCheck.ok) {
    return NextResponse.json(
      { success: false, error: `服务配置缺失: ${envCheck.missing.join(", ")}` } satisfies ApiResponse,
      { status: 500 }
    );
  }

  // JWT 鉴权
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const userId = auth.userId;

  // 解析请求
  let body: { action?: BattleAction; payload?: Record<string, unknown> };
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "请求体格式错误" } satisfies ApiResponse, { status: 400 });
  }

  if (!body.action) {
    return NextResponse.json({ success: false, error: "缺少 action 字段" } satisfies ApiResponse, { status: 400 });
  }

  const payload = body.payload || {};

  try {
    switch (body.action) {
      case "create": return handleCreate(userId, payload);
      case "join": return handleJoin(userId, payload);
      case "confirmRoster": return handleConfirmRoster(userId, payload);
      case "simulate": return handleSimulate(userId, payload);
      case "getState": return handleGetState(userId, payload);
      case "pickFromPool": return handlePickFromPool(userId, payload);
      case "skipPool": return handleSkipPool(userId, payload);
      case "checkTimeout": return handleCheckTimeout(userId, payload);
      default: return NextResponse.json({ success: false, error: `无效操作: ${body.action}` } satisfies ApiResponse, { status: 400 });
    }
  } catch (err) {
    console.error("[battle API]", err);
    return NextResponse.json({ success: false, error: "服务器内部错误" } satisfies ApiResponse, { status: 500 });
  }
}

// ── Handlers ─────────────────────────────────────────────────────────

async function handleCreate(userId: string, payload: Record<string, unknown>): Promise<Response> {
  const nickname = sanitizeText(payload.nickname, 20) || "匿名球迷";
  const pickMode = (payload.pickMode === "common" ? "common" : "independent") as "independent" | "common";
  const result = await battleService.createRoom(userId, nickname, pickMode);
  if (!result.success) return NextResponse.json(result satisfies ApiResponse, { status: 400 });
  return NextResponse.json(result satisfies ApiResponse);
}

async function handleJoin(userId: string, payload: Record<string, unknown>): Promise<Response> {
  const roomCode = sanitizeText(payload.roomCode, 6).toUpperCase();
  if (!validateRoomCode(roomCode)) {
    return NextResponse.json({ success: false, error: "房间号格式不正确" } satisfies ApiResponse, { status: 400 });
  }
  const nickname = sanitizeText(payload.nickname, 20) || "匿名球迷";
  const result = await battleService.joinRoom(userId, roomCode, nickname);
  if (!result.success) return NextResponse.json(result satisfies ApiResponse, { status: 400 });
  return NextResponse.json(result satisfies ApiResponse);
}

async function handleConfirmRoster(userId: string, payload: Record<string, unknown>): Promise<Response> {
  const roomCode = sanitizeText(payload.roomCode, 6).toUpperCase();
  const roster = payload.roster;
  if (!roomCode || !Array.isArray(roster)) {
    return NextResponse.json({ success: false, error: "缺少 roomCode 或 roster" } satisfies ApiResponse, { status: 400 });
  }
  const result = await battleService.confirmRoster(userId, roomCode, roster as never);
  if (!result.success) return NextResponse.json(result satisfies ApiResponse, { status: 400 });
  return NextResponse.json(result satisfies ApiResponse);
}

async function handleSimulate(userId: string, payload: Record<string, unknown>): Promise<Response> {
  const roomCode = sanitizeText(payload.roomCode, 6).toUpperCase();
  const mode = payload.mode === "series" ? "series" : "single";
  if (!roomCode) {
    return NextResponse.json({ success: false, error: "缺少 roomCode" } satisfies ApiResponse, { status: 400 });
  }
  const result = await battleService.simulateBattle(userId, roomCode, mode);
  if (!result.success) return NextResponse.json(result satisfies ApiResponse, { status: 400 });
  return NextResponse.json(result satisfies ApiResponse);
}

async function handleGetState(userId: string, payload: Record<string, unknown>): Promise<Response> {
  const roomCode = sanitizeText(payload.roomCode, 6).toUpperCase();
  if (!roomCode) {
    return NextResponse.json({ success: false, error: "缺少 roomCode" } satisfies ApiResponse, { status: 400 });
  }
  const result = await battleService.getRoomState(userId, roomCode);
  if (!result.success) return NextResponse.json(result satisfies ApiResponse, { status: 400 });
  return NextResponse.json(result satisfies ApiResponse);
}

async function handlePickFromPool(userId: string, payload: Record<string, unknown>): Promise<Response> {
  const roomCode = sanitizeText(payload.roomCode, 6).toUpperCase();
  const playerName = sanitizeText(payload.playerName, 80);
  const slot = sanitizeText(payload.slot, 2).toUpperCase();
  if (!roomCode || !playerName || !validateSlot(slot)) {
    return NextResponse.json({ success: false, error: "参数无效" } satisfies ApiResponse, { status: 400 });
  }
  const result = await battleService.pickFromCommonPool(userId, roomCode, playerName, slot);
  if (!result.success) return NextResponse.json(result satisfies ApiResponse, { status: 400 });
  return NextResponse.json(result satisfies ApiResponse);
}

async function handleSkipPool(userId: string, payload: Record<string, unknown>): Promise<Response> {
  const roomCode = sanitizeText(payload.roomCode, 6).toUpperCase();
  const skipType = sanitizeText(payload.type, 10);
  if (!roomCode || !["team", "decade"].includes(skipType)) {
    return NextResponse.json({ success: false, error: "参数无效" } satisfies ApiResponse, { status: 400 });
  }
  const result = await battleService.skipCommonPool(userId, roomCode, skipType as "team" | "decade");
  if (!result.success) return NextResponse.json(result satisfies ApiResponse, { status: 400 });
  return NextResponse.json(result satisfies ApiResponse);
}

async function handleCheckTimeout(userId: string, payload: Record<string, unknown>): Promise<Response> {
  const roomCode = sanitizeText(payload.roomCode, 6).toUpperCase();
  if (!roomCode) {
    return NextResponse.json({ success: false, error: "缺少 roomCode" } satisfies ApiResponse, { status: 400 });
  }
  const result = await battleService.checkPickTimeout(userId, roomCode);
  if (!result.success) return NextResponse.json(result satisfies ApiResponse, { status: 400 });
  return NextResponse.json(result satisfies ApiResponse);
}

export const POST = withCsrfProtection(_post);
