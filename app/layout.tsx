// ===================================================================
//  app/layout.tsx — 根布局
// ===================================================================
import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ParticlesBackground } from "@/components/background/ParticlesBackground";
import { ProfileButton } from "@/components/ui/ProfileButton";
import { GameProviders } from "@/components/game/GameProviders";
import { generateCsrfToken } from "@/lib/server/csrf";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "82-0完美赛季大挑战",
  description: "随机球队、随机年代、五次机会，挑选出五名球员组成阵容，谁能创造出82-0的完美阵容？",
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const csrfToken = generateCsrfToken();

  return (
    <html lang="zh" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__csrf_token__ = "${csrfToken}";`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <Suspense>
          <GameProviders>
            <ParticlesBackground />
            <ProfileButton />
            <ErrorBoundary>{children}</ErrorBoundary>
          </GameProviders>
        </Suspense>
      </body>
    </html>
  );
}
