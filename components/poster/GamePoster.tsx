"use client";

// ===================================================================
//  components/poster/GamePoster.tsx — 海报生成组件
// ===================================================================
import { useState, useRef, useCallback, useEffect } from "react";
import { POSTER_BG_SRC } from "@/lib/game-core/data/poster-bg";
import { TEAM_COLORS, teamCN } from "@/lib/game-core";
import type { Player } from "@/lib/game-core";

// ── 常量───────────────────────────────────────

const POSTER_W = 600;
const POSTER_H = 1100;
const POSTER_SCALE = 2;

// ── Props ───────────────────────────────────────────────────────────────

export interface PosterPlayer {
  pos: string;
  name: string;
  team: string;
  decade: string;
  color?: string;
  color2?: string;
}

export interface PosterProps {
  /** 球员列表（5人，PG→C顺序） */
  players: PosterPlayer[];
  /** 战绩字符串，如 "82-0" */
  record?: string;
  /** 段位，如 "S", "A+" */
  grade?: string;
  /** 段位标签，如 "完美赛季" */
  tier?: string;
  /** 关闭回调 */
  onClose?: () => void;
}

// ── Canvas 绘制工具函数 ─────────────────────────────────────────────────

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** 绘制战绩 + 段位区域 */
function drawRecordGroup(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  w: number,
  record: string,
  grade: string,
  tier: string,
  recColor: string
): void {
  const [wins = "0", losses = "82"] = String(record || "0-82").split("-");

  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = '900 24px -apple-system, "PingFang SC", sans-serif';
  ctx.fillText("我的完美阵容战绩", 58, topY);

  ctx.font = '900 92px Oswald, Impact, "Arial Black", sans-serif';
  ctx.fillText(wins, 58, topY + 38);
  const winsW = ctx.measureText(wins).width;
  ctx.fillText(" - ", 58 + winsW + 6, topY + 38);
  const dashW = ctx.measureText(" - ").width;
  ctx.fillStyle = "#8f8f8f";
  ctx.fillText(losses, 58 + winsW + dashW + 12, topY + 38);

  ctx.textAlign = "right";
  ctx.fillStyle = recColor;
  ctx.font = '900 24px -apple-system, "PingFang SC", sans-serif';
  ctx.fillText(tier || "历史级强队", w - 58, topY);
  ctx.font = '900 108px Oswald, Impact, "Arial Black", sans-serif';
  ctx.fillText(grade || "S", w - 58, topY + 40);
}

// ── 背景图片缓存 ────────────────────────────────────────────────────────

let _bgImg: HTMLImageElement | null = null;
let _bgLoading = false;
let _bgResolve: (() => void) | null = null;

function loadPosterBackground(): Promise<void> {
  return new Promise((resolve) => {
    if (_bgImg && _bgImg.complete && _bgImg.naturalWidth > 0) {
      resolve();
      return;
    }
    _bgResolve = resolve;
    if (_bgLoading) return;
    _bgLoading = true;
    _bgImg = new Image();
    _bgImg.onload = () => {
      _bgResolve?.();
      _bgResolve = null;
    };
    _bgImg.onerror = () => {
      // 加载失败也继续（降级为黑色背景）
      _bgResolve?.();
      _bgResolve = null;
    };
    _bgImg.src = POSTER_BG_SRC;
  });
}

/** 绘制完整海报 */
// 使用模块级变量存储当前渲染数据，避免闭包问题
let _currentOptions: {
  players: PosterPlayer[];
  record: string;
  grade: string;
  tier: string;
} | null = null;

// ── 组件 ────────────────────────────────────────────────────────────────

export function GamePoster({
  players,
  record = "82-0",
  grade = "S",
  tier = "完美赛季",
  onClose,
}: PosterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataURL, setDataURL] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const drawPoster = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      // 背景
      if (_bgImg && _bgImg.complete && _bgImg.naturalWidth > 0) {
        ctx.drawImage(_bgImg, 0, 0, w, h);
      } else {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, w, h);
      }

      // 战绩颜色
      const wins = Number(String(record || "0-82").split("-")[0]);
      const recColor =
        record === "82-0"
          ? "#f4c351"
          : wins >= 70
            ? "#f4c351"
            : wins >= 50
              ? "#f39c12"
              : "#e74c3c";

      drawRecordGroup(ctx, w / 2, 170, w, record, grade, tier, recColor);

      // 球员卡片
      const cardX = 52;
      const cardW = w - 104;
      const cardH = 82;
      const cardGap = 24;
      const startY = 330;

      players.forEach((p, i) => {
        if (!p) return;
        const x = cardX;
        const y = startY + i * (cardH + cardGap);
        const cy = y + cardH / 2;
        const accent = p.color || (p.team ? TEAM_COLORS[p.team]?.[0] : null) || "#2d76ca";

        // 卡片背景
        ctx.fillStyle = "rgba(0,0,0,0.86)";
        ctx.fillRect(x, y, cardW, cardH);
        ctx.lineWidth = 3;
        ctx.strokeStyle = accent;
        ctx.strokeRect(x, y, cardW, cardH);
        // 左侧强调色条
        ctx.fillStyle = accent;
        ctx.fillRect(x, y, 8, cardH);

        // 位置标识
        ctx.fillStyle = accent;
        ctx.font = '900 30px Oswald, Impact, "Arial Black", sans-serif';
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(p.pos || "", x + 28, cy);

        // 球员姓名
        ctx.fillStyle = "#ffffff";
        ctx.font = '900 31px -apple-system, "PingFang SC", sans-serif';
        ctx.fillText(p.name, x + 108, cy);

        // 球队中文名
        ctx.fillStyle = "#5d5d5d";
        ctx.font = '500 27px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = "right";
        ctx.fillText(p.team ? teamCN(p.team) : "", x + cardW - 30, cy - 16);

        // 年代
        ctx.font = '500 24px -apple-system, "PingFang SC", sans-serif';
        ctx.fillText(p.decade || "", x + cardW - 30, cy + 18);
      });

      // 底部文案
      ctx.textAlign = "left";
      ctx.fillStyle = "#ffffff";
      ctx.font = '900 26px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText("我的阵容名单", cardX, startY + 5 * (cardH + cardGap) + 8);
    },
    [players, record, grade, tier]
  );

  // 生成海报
  useEffect(() => {
    let cancelled = false;

    async function generate() {
      try {
        setLoading(true);
        setError(null);
        await loadPosterBackground();

        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = POSTER_W * POSTER_SCALE;
        canvas.height = POSTER_H * POSTER_SCALE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.scale(POSTER_SCALE, POSTER_SCALE);
        drawPoster(ctx, POSTER_W, POSTER_H);

        const url = canvas.toDataURL("image/png");
        if (!cancelled) {
          setDataURL(url);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
          setLoading(false);
        }
      }
    }

    generate();
    return () => {
      cancelled = true;
    };
  }, [drawPoster]);

  // 导出为 Blob
  const getBlob = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) return reject(new Error("Canvas not ready"));
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("toBlob failed"));
        },
        "image/png"
      );
    });
  }, []);

  // 分享海报（通过 colorbox-ai-bridge）
  const handleShare = useCallback(async () => {
    try {
      const blob = await getBlob();
      if (blob.size === 0) return;

      // colorbox-ai-bridge postMessage 协议
      if (typeof window !== "undefined" && window.parent) {
        window.parent.postMessage(
          {
            type: "colorbox-ai-bridge",
            action: "uploadImage",
            data: { blob },
          },
          "*"
        );
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
  }, [getBlob]);

  return (
    <>
      {/* 隐藏的渲染用 Canvas */}
      <canvas
        ref={canvasRef}
        id="posterCanvas"
        style={{ display: "none" }}
      />

      {/* 海报预览遮罩 */}
      {dataURL && !loading && (
        <div
          id="posterOverlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.9)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            gap: "16px",
          }}
        >
          <img
            id="posterPreviewImg"
            src={dataURL}
            alt="Game Poster"
            style={{
              maxWidth: "90vw",
              maxHeight: "80vh",
              borderRadius: "12px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
          />
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              className="btn btn-gold"
              onClick={handleShare}
              style={{ padding: "10px 28px" }}
            >
              📤 分享海报
            </button>
            <button
              className="btn btn-secondary"
              onClick={onClose}
              style={{ padding: "10px 28px" }}
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* 加载状态 */}
      {loading && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            color: "var(--gold)",
            fontFamily: "Oswald, sans-serif",
            fontSize: "1.5rem",
          }}
        >
          🏀 生成海报中...
        </div>
      )}

      {/* 错误状态 */}
      {error && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.9)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            color: "#e74c3c",
            gap: "12px",
          }}
        >
          <div>😵 海报生成失败</div>
          <button className="btn btn-secondary" onClick={onClose}>
            关闭
          </button>
        </div>
      )}
    </>
  );
}
