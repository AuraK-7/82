"use client";

// ===================================================================
//  components/background/ParticlesBackground.tsx — 粒子背景组件
// ===================================================================
import { useParticles } from "@/hooks/useParticles";

export function ParticlesBackground() {
  const { canvasRef } = useParticles();

  return (
    <canvas
      ref={canvasRef}
      id="particles-canvas"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
