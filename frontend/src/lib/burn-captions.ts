/**
 * Burns word-level captions into a video using Canvas + MediaRecorder.
 * Runs entirely in the browser — no server, no FFmpeg, no WASM.
 *
 * The video plays once in real-time while each frame is drawn onto a canvas
 * with the active caption word highlighted. MediaRecorder captures the canvas
 * stream as a video blob for download.
 */

import type { WordCue } from "@/lib/srt";

const PAGE_SIZE = 8;

interface ActivePage {
  words: WordCue[];
  pageStart: number;
  activeIdx: number;
}

function getActivePage(wordCues: WordCue[], t: number): ActivePage | null {
  const activeIdx = wordCues.findIndex((w) => t >= w.start && t < w.end);
  if (activeIdx < 0) return null;
  const pageStart = Math.floor(activeIdx / PAGE_SIZE) * PAGE_SIZE;
  return { words: wordCues.slice(pageStart, pageStart + PAGE_SIZE), pageStart, activeIdx };
}

function drawCaptions(
  ctx: CanvasRenderingContext2D,
  page: ActivePage,
  canvasWidth: number,
  canvasHeight: number,
) {
  const { words, pageStart, activeIdx } = page;
  const fontSize = Math.round(canvasHeight * 0.028); // ~24px on 854h video
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;

  // Measure total text width for the background box
  const spaced = words.map((w) => w.word).join(" ");
  const totalWidth = ctx.measureText(spaced).width;
  const padding = fontSize * 0.8;
  const boxW = Math.min(totalWidth + padding * 2, canvasWidth * 0.9);
  const boxH = fontSize * 2;
  const boxX = (canvasWidth - boxW) / 2;
  const boxY = canvasHeight - boxH - fontSize;

  // Background pill
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.beginPath();
  (ctx as CanvasRenderingContext2D & { roundRect: (...a: number[]) => void })
    .roundRect(boxX, boxY, boxW, boxH, 8);
  ctx.fill();

  // Draw each word, yellow for active, white for rest
  let x = boxX + padding;
  const textY = boxY + fontSize * 1.35;
  for (let i = 0; i < words.length; i++) {
    const wordText = words[i].word + (i < words.length - 1 ? " " : "");
    ctx.fillStyle = pageStart + i === activeIdx ? "#FACC15" : "#FFFFFF";
    ctx.fillText(wordText, x, textY);
    x += ctx.measureText(wordText).width;
  }
}

export type BurnProgress = { ratio: number };

export function burnCaptionsToVideo(
  videoUrl: string,
  wordCues: WordCue[],
  onProgress?: (p: BurnProgress) => void,
): Promise<{ blob: Blob; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const ctx = canvas.getContext("2d")!;

    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "auto";
    video.src = videoUrl;

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth || 480;
      canvas.height = video.videoHeight || 854;

      // Prefer MP4 (Safari), fall back to WebM (Chrome/Firefox)
      const mimeType = MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")
        ? "video/mp4"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 8_000_000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const outputMime = mimeType.split(";")[0];
        resolve({ blob: new Blob(chunks, { type: outputMime }), mimeType: outputMime });
      };

      let rafId: number;
      function drawFrame() {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const page = getActivePage(wordCues, video.currentTime);
        if (page) drawCaptions(ctx, page, canvas.width, canvas.height);
        if (onProgress && video.duration > 0) {
          onProgress({ ratio: video.currentTime / video.duration });
        }
        rafId = requestAnimationFrame(drawFrame);
      }

      function stop() {
        cancelAnimationFrame(rafId);
        // Give MediaRecorder a moment to flush the last chunk
        setTimeout(() => recorder.stop(), 250);
      }

      video.onplay = () => {
        recorder.start(100);
        rafId = requestAnimationFrame(drawFrame);
      };
      video.onended = stop;
      video.onerror = () => { stop(); reject(new Error("Video playback failed")); };

      video.play().catch(reject);
    };

    video.onerror = () => reject(new Error("Failed to load video"));
  });
}
