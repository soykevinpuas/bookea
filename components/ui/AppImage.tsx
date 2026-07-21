"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

type AppImageProps = Omit<ImageProps, "src" | "alt"> & {
  src: string;
  alt: string;
};

export default function AppImage({
  alt,
  fill,
  height,
  src,
  unoptimized = true,
  width,
  ...props
}: AppImageProps) {
  const fallbackSrc = "/icon.png";
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const resolvedSrc = !src || failedSrc === src ? fallbackSrc : src;

  const handleError: ImageProps["onError"] = (event) => {
    if (src && failedSrc !== src) setFailedSrc(src);
    props.onError?.(event);
  };

  if (fill) {
    return <Image alt={alt} fill src={resolvedSrc} unoptimized={unoptimized} {...props} onError={handleError} />;
  }

  return (
    <Image
      alt={alt}
      height={height ?? 144}
      src={resolvedSrc}
      unoptimized={unoptimized}
      width={width ?? 96}
      {...props}
      onError={handleError}
    />
  );
}
