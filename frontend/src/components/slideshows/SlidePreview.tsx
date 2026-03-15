"use client";

import { cn } from "@/lib/utils";
import type { Slide, SlideshowSettings } from "@/types/slideshow";
import { ImageIcon } from "lucide-react";

/**
 * TikTok/Instagram caption font mapping.
 *
 * TikTok's native caption font is "TikTok Display" (proprietary).
 * Closest free alternatives ranked by similarity:
 * 1. Plus Jakarta Sans — geometric, rounded, very close to TikTok Display
 * 2. DM Sans — clean geometric sans-serif, Instagram-like
 * 3. Inter — fallback, clean but less character
 *
 * The font CSS variables are loaded in layout.tsx via next/font/google.
 */
const CAPTION_FONTS: Record<string, string> = {
  "tiktok": "var(--font-tiktok), 'TikTok Sans', sans-serif",
  "instagram": "var(--font-dm-sans), 'DM Sans', sans-serif",
  "inter": "var(--font-inter), 'Inter', sans-serif",
};

interface SlidePreviewProps {
  slide: Slide;
  settings: SlideshowSettings;
  isSelected?: boolean;
  scale?: number;
  onClick?: () => void;
  captionStyle?: "tiktok" | "instagram" | "inter";
  showPill?: boolean; // Toggle white pill/badge on body slides
}

export function SlidePreview({
  slide,
  settings,
  isSelected = false,
  scale = 1,
  onClick,
  captionStyle = "tiktok",
  showPill = true,
}: SlidePreviewProps) {
  const overlayOpacity = slide.overlayOpacity ?? settings.overlay.opacity;
  const overlayColor = settings.overlay.color;
  const fontFamily = CAPTION_FONTS[captionStyle] || CAPTION_FONTS.tiktok;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border-2 transition-all duration-200 cursor-pointer select-none",
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/40",
      )}
      style={{
        width: `${Math.round(270 * scale)}px`,
        aspectRatio: "9 / 16",
      }}
      onClick={onClick}
    >
      {/* Background image */}
      {slide.imageUrl ? (
        <img
          src={slide.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <ImageIcon className="size-8 text-muted-foreground/40" />
        </div>
      )}

      {/* Dark overlay */}
      {settings.overlay.enabled && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: overlayColor,
            opacity: overlayOpacity,
          }}
        />
      )}

      {/* Text content */}
      {slide.type === "hook" ? (
        <HookTextOverlay
          text={slide.text}
          scale={scale}
          fontFamily={fontFamily}
          captionStyle={captionStyle}
        />
      ) : (
        <BodyTextOverlay
          textContent={slide.textContent}
          fallbackText={slide.text}
          scale={scale}
          fontFamily={fontFamily}
          captionStyle={captionStyle}
          showPill={showPill}
        />
      )}
    </div>
  );
}

function HookTextOverlay({
  text,
  scale,
  fontFamily,
  captionStyle,
}: {
  text: string;
  scale: number;
  fontFamily: string;
  captionStyle: string;
}) {
  if (!text) return null;
  const fontSize = Math.round(28 * scale);
  const letterSpacing = captionStyle === "tiktok" ? "-0.02em" : "0em";

  return (
    <div className="absolute inset-0 flex items-start justify-center px-[8%] pt-[15%]">
      <p
        className="text-white text-center font-extrabold leading-[1.15] lowercase"
        style={{
          fontFamily,
          fontSize: `${fontSize}px`,
          letterSpacing,
          textShadow:
            captionStyle === "instagram"
              ? "0 1px 3px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.25)"
              : "0 2px 8px rgba(0,0,0,0.6), 0 0px 2px rgba(0,0,0,0.3)",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        {text}
      </p>
    </div>
  );
}

function BodyTextOverlay({
  textContent,
  fallbackText,
  scale,
  fontFamily,
  captionStyle,
  showPill,
}: {
  textContent?: { title: string; subtitle: string; action: string };
  fallbackText: string;
  scale: number;
  fontFamily: string;
  captionStyle: string;
  showPill: boolean;
}) {
  const title = textContent?.title || fallbackText;
  const subtitle = textContent?.subtitle;
  const action = textContent?.action;

  if (!title && !subtitle && !action) return null;

  const titleSize = Math.round(15 * scale);
  const bodySize = Math.round(14 * scale);
  const gap = Math.round(20 * scale);
  const letterSpacing = captionStyle === "tiktok" ? "-0.01em" : "0em";

  // Pill/badge style settings per caption style
  const pillStyles: Record<string, React.CSSProperties> = {
    tiktok: {
      background: "white",
      borderRadius: `${Math.round(20 * scale)}px`,
      padding: `${Math.round(4 * scale)}px ${Math.round(14 * scale)}px`,
      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    },
    instagram: {
      background: "rgba(255,255,255,0.95)",
      borderRadius: `${Math.round(12 * scale)}px`,
      padding: `${Math.round(5 * scale)}px ${Math.round(16 * scale)}px`,
      boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
    },
    inter: {
      background: "white",
      borderRadius: `${Math.round(10 * scale)}px`,
      padding: `${Math.round(4 * scale)}px ${Math.round(12 * scale)}px`,
      boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
    },
  };

  const subtitleShadow =
    captionStyle === "instagram"
      ? "0 1px 4px rgba(0,0,0,0.5), 0 2px 10px rgba(0,0,0,0.3)"
      : "0 1px 6px rgba(0,0,0,0.8), 0 0px 2px rgba(0,0,0,0.4)";

  return (
    <div
      className="absolute inset-0 flex flex-col items-center px-[7%] pt-[12%]"
      style={{ gap: `${gap}px`, fontFamily }}
    >
      {/* Title — either white pill/badge or plain white text */}
      {title && (
        showPill ? (
          <div className="max-w-[85%]" style={pillStyles[captionStyle] || pillStyles.tiktok}>
            <p
              className="text-black text-center font-bold leading-snug lowercase"
              style={{
                fontSize: `${titleSize}px`,
                letterSpacing,
                WebkitFontSmoothing: "antialiased",
              }}
            >
              {title}
            </p>
          </div>
        ) : (
          <p
            className="text-white text-center font-bold leading-snug lowercase max-w-[85%]"
            style={{
              fontSize: `${titleSize}px`,
              letterSpacing,
              textShadow: subtitleShadow,
              WebkitFontSmoothing: "antialiased",
            }}
          >
            {title}
          </p>
        )
      )}

      {/* Subtitle — context/complaint */}
      {subtitle && (
        <p
          className="text-white text-center font-semibold leading-snug lowercase max-w-[80%]"
          style={{
            fontSize: `${bodySize}px`,
            letterSpacing,
            textShadow: subtitleShadow,
            WebkitFontSmoothing: "antialiased",
          }}
        >
          {subtitle}
        </p>
      )}

      {/* Action line */}
      {action && (
        <p
          className="text-white text-center font-semibold leading-snug lowercase max-w-[80%]"
          style={{
            fontSize: `${bodySize}px`,
            letterSpacing,
            textShadow: subtitleShadow,
            WebkitFontSmoothing: "antialiased",
          }}
        >
          {action}
        </p>
      )}
    </div>
  );
}
