"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** Additional class for the shimmer placeholder */
  shimmerClassName?: string;
}

export function OptimizedImage({ src, alt, className, shimmerClassName, ...props }: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative size-full">
      {!loaded && (
        <div className={cn("absolute inset-0 animate-pulse bg-muted", shimmerClassName)} />
      )}
      <img
        src={src}
        alt={alt}
        className={className}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        {...props}
      />
    </div>
  );
}
