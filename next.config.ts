import type { NextConfig } from "next";

const withBundleAnalyzer = process.env.ANALYZE === "true"
  ? require("@next/bundle-analyzer")({ enabled: true })
  : (c: NextConfig) => c;

const nextConfig: NextConfig = withBundleAnalyzer({
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.hoopchina.com.cn",
      },
      {
        protocol: "https",
        hostname: "**.hupu.com",
      },
      {
        protocol: "https",
        hostname: "**.hupucdn.com",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "activity-static.hupu.com",
      },
    ],
    unoptimized: true, // 对大陆 CDN 图片不做优化，减少延迟
  },

  // 编译优化
  compiler: {
    removeConsole: false, // 保留 console.log，游戏调试需要
  },

  // 实验性功能
  experimental: {
    optimizePackageImports: ["@supabase/supabase-js"],
  },

  // 输出模式
  output: "standalone",
});

export default nextConfig;
