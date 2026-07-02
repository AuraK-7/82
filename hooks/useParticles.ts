"use client";

// ===================================================================
//  hooks/useParticles.ts — 粒子背景动画 Hook
// ===================================================================
import { useEffect, useRef, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  r: number;
  dx: number;
  dy: number;
  o: number;
}

const PARTICLE_COUNT = 60;
const PARTICLE_COLOR_PREFIX = "rgba(243,156,18,"; // f39c12 = var(--gold)

/**
 * 创建并管理粒子背景动画
 * 返回 canvas ref 用于挂载到 DOM
 */
export function useParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    const particles: Particle[] = [];

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = w;
      canvas!.height = h;
    }
    resize();
    window.addEventListener("resize", resize);

    // 初始化 60 个粒子
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 2 + 0.5,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        o: Math.random() * 0.4 + 0.1,
      });
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = PARTICLE_COLOR_PREFIX + p.o + ")";
        ctx!.fill();
      }
      animFrameRef.current = requestAnimationFrame(draw);
    }

    draw();

    // 清理函数
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    const cleanup = init();
    return () => {
      cleanup?.();
    };
  }, [init]);

  return { canvasRef };
}
