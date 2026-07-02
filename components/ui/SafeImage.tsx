"use client";

// ===================================================================
//  components/ui/SafeImage.tsx — 安全图片组件
// ===================================================================
import { useState } from "react";

const DEFAULT_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23333' width='100' height='100'/%3E%3Ctext x='50' y='54' text-anchor='middle' fill='%23999' font-size='14'%3E🏀%3C/text%3E%3C/svg%3E";

interface SafeImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  width?: number;
  height?: number;
  /** 自定义占位图 */
  fallbackSrc?: string;
  /** 加载中占位背景色 */
  placeholderBg?: string;
}

/**
 * 安全图片组件
 * - 空 src 自动兜底，不渲染 img 标签
 * - 加载失败自动切换默认占位图
 * - 加载中展示占位背景
 */
export function SafeImage({
  src,
  alt,
  className,
  style,
  width,
  height,
  fallbackSrc,
  placeholderBg,
}: SafeImageProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // 空 src 直接渲染占位元素
  if (!src || src.trim() === "") {
    return (
      <span
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: width || 50,
          height: height || 50,
          background: placeholderBg || "rgba(255,255,255,0.05)",
          borderRadius: 4,
          fontSize: width ? Math.min(width, height || width) * 0.4 : 20,
          ...style,
        }}
        aria-label={alt || "图片占位"}
        role="img"
      >
        🏀
      </span>
    );
  }

  // 加载失败或加载中
  if (imgError) {
    const placeholder = fallbackSrc || DEFAULT_PLACEHOLDER;
    return (
      <img
        className={className}
        src={placeholder}
        alt={alt}
        style={{
          objectFit: "contain",
          width: width || "auto",
          height: height || "auto",
          ...style,
        }}
      />
    );
  }

  return (
    <span style={{ position: "relative", display: "inline-block", lineHeight: 0 }}>
      {!imgLoaded && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            background: placeholderBg || "rgba(255,255,255,0.05)",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          🏀
        </span>
      )}
      <img
        className={className}
        src={src}
        alt={alt}
        style={{
          objectFit: "contain",
          width: width || "auto",
          height: height || "auto",
          ...style,
          ...(imgLoaded ? {} : { opacity: 0 }),
        }}
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgError(true)}
      />
    </span>
  );
}

/**
 * 简化版：仅处理空 src 和 onError
 * 适用于已有复杂样式的图片
 */
export function SafeImg({
  src,
  alt,
  className,
  style,
  onError: externalOnError,
  ...rest
}: React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string | null | undefined;
}) {
  const [error, setError] = useState(false);

  // 空 src 不渲染
  if (!src || src.trim() === "") {
    return null;
  }

  if (error) {
    return (
      <img
        src={DEFAULT_PLACEHOLDER}
        alt={alt || ""}
        className={className}
        style={{ objectFit: "contain", ...style }}
        {...rest}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt || ""}
      className={className}
      style={style}
      onError={(e) => {
        setError(true);
        externalOnError?.(e);
      }}
      {...rest}
    />
  );
}
