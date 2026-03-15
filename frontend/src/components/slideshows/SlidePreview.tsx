"use client";

import { cn } from "@/lib/utils";
import type { Slide, SlideshowSettings } from "@/types/slideshow";
import { ImageIcon } from "lucide-react";

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
  showPill?: boolean;
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
      {/* Background image or dark placeholder */}
      {slide.imageUrl ? (
        <img
          src={slide.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-neutral-700 to-neutral-900">
          <ImageIcon className="size-8 text-white/15" />
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
  // Reference: ~36px at 1080w full res. At 270px preview = 270/1080 * 36 = 9px base, then * scale
  const fontSize = Math.round(20 * scale);
  const letterSpacing = captionStyle === "tiktok" ? "-0.02em" : "0em";

  return (
    <div className="absolute inset-0 flex items-start justify-center px-[6%] pt-[28%]">
      <p
        className="text-white text-center font-extrabold leading-[1.15] lowercase"
        style={{
          fontFamily,
          fontSize: `${fontSize}px`,
          letterSpacing,
          textShadow: "0 2px 12px rgba(0,0,0,0.7), 0 0px 4px rgba(0,0,0,0.4)",
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

  const titleSize = Math.round(14 * scale);
  const bodySize = Math.round(12 * scale);
  const gap = Math.round(8 * scale);
  const letterSpacing = captionStyle === "tiktok" ? "-0.01em" : "0em";

  const subtitleShadow = "0 2px 10px rgba(0,0,0,0.8), 0 0px 3px rgba(0,0,0,0.5)";

  const pillPadX = Math.round(10 * scale);
  const pillPadY = Math.round(3 * scale);
  const pillRadius = Math.round(6 * scale);

  return (
    <div
      className="absolute inset-0 flex flex-col items-center px-[5%] pt-[20%]"
      style={{ gap: `${gap}px`, fontFamily }}
    >
      {/* Title — single div pill (no per-line padding doubling) */}
      {title && (
        <div className="text-center max-w-[90%]">
          {showPill ? (
            <div
              className="inline-block"
              style={{
                background: "white",
                borderRadius: `${pillRadius}px`,
                padding: `${pillPadY}px ${pillPadX}px`,
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              <p
                className="text-black font-bold leading-tight lowercase"
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
              className="text-white font-bold leading-tight lowercase"
              style={{
                fontSize: `${titleSize}px`,
                letterSpacing,
                textShadow: subtitleShadow,
                WebkitFontSmoothing: "antialiased",
              }}
            >
              {title}
            </p>
          )}
        </div>
      )}

      {/* Subtitle — context/complaint */}
      {subtitle && (
        <p
          className="text-white text-center font-semibold leading-snug lowercase max-w-[85%]"
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
          className="text-white text-center font-semibold leading-snug lowercase max-w-[85%]"
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
