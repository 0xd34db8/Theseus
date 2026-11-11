"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Check, X, RotateCcw, AlertCircle } from "lucide-react";

export interface ImageCropModalProps {
  isOpen: boolean;
  src: string;
  alt?: string;
  onApply: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

interface CropRect {
  x: number; // 0 to 1 fraction
  y: number; // 0 to 1 fraction
  width: number; // 0 to 1 fraction
  height: number; // 0 to 1 fraction
}

type DragHandleType =
  | "move"
  | "nw"
  | "ne"
  | "sw"
  | "se"
  | "n"
  | "s"
  | "w"
  | "e";

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  src,
  alt = "Image crop preview",
  onApply,
  onCancel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [naturalDimensions, setNaturalDimensions] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });

  const [crop, setCrop] = useState<CropRect>({
    x: 0.05,
    y: 0.05,
    width: 0.9,
    height: 0.9,
  });

  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef<{
    type: DragHandleType;
    startX: number;
    startY: number;
    initialCrop: CropRect;
    rectWidth: number;
    rectHeight: number;
  } | null>(null);

  // Initialize crop when opened
  useEffect(() => {
    if (isOpen) {
      setCrop({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
      setAspectRatio(null);
      setErrorMessage(null);
    }
  }, [isOpen, src]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget;
    setNaturalDimensions({
      width: target.naturalWidth,
      height: target.naturalHeight,
    });
  };

  // Keyboard shortcut listener (Escape to cancel, Enter to apply)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        handleApply();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, crop, naturalDimensions]);

  const handlePointerDown = (
    type: DragHandleType,
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    dragRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      initialCrop: { ...crop },
      rectWidth: rect.width,
      rectHeight: rect.height,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const { type, startX, startY, initialCrop, rectWidth, rectHeight } =
        dragRef.current;
      if (rectWidth <= 0 || rectHeight <= 0) return;

      const dx = (e.clientX - startX) / rectWidth;
      const dy = (e.clientY - startY) / rectHeight;

      const minW = Math.max(0.04, 24 / rectWidth);
      const minH = Math.max(0.04, 24 / rectHeight);

      if (type === "move") {
        const maxX = 1 - initialCrop.width;
        const maxY = 1 - initialCrop.height;
        const newX = Math.max(0, Math.min(initialCrop.x + dx, maxX));
        const newY = Math.max(0, Math.min(initialCrop.y + dy, maxY));
        setCrop((prev) => ({ ...prev, x: newX, y: newY }));
        return;
      }

      let { x, y, width, height } = initialCrop;

      if (type.includes("e")) {
        width = Math.max(
          minW,
          Math.min(initialCrop.width + dx, 1 - initialCrop.x)
        );
      }
      if (type.includes("w")) {
        const newX = Math.max(
          0,
          Math.min(initialCrop.x + dx, initialCrop.x + initialCrop.width - minW)
        );
        width = initialCrop.width + (initialCrop.x - newX);
        x = newX;
      }
      if (type.includes("s")) {
        height = Math.max(
          minH,
          Math.min(initialCrop.height + dy, 1 - initialCrop.y)
        );
      }
      if (type.includes("n")) {
        const newY = Math.max(
          0,
          Math.min(initialCrop.y + dy, initialCrop.y + initialCrop.height - minH)
        );
        height = initialCrop.height + (initialCrop.y - newY);
        y = newY;
      }

      // Maintain aspect ratio constraint if set
      if (
        aspectRatio &&
        naturalDimensions.width > 0 &&
        naturalDimensions.height > 0
      ) {
        const targetFractionRatio =
          aspectRatio *
          (naturalDimensions.height / naturalDimensions.width);
        const constrainedHeight = width / targetFractionRatio;

        if (y + constrainedHeight <= 1) {
          height = constrainedHeight;
        } else {
          height = 1 - y;
          width = height * targetFractionRatio;
        }
      }

      setCrop({ x, y, width, height });
    };

    const onPointerUp = () => {
      dragRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [aspectRatio, naturalDimensions]);

  const setPresetRatio = (ratio: number | null) => {
    setAspectRatio(ratio);
    if (
      !ratio ||
      naturalDimensions.width === 0 ||
      naturalDimensions.height === 0
    ) {
      return;
    }

    const targetFractionRatio =
      ratio * (naturalDimensions.height / naturalDimensions.width);

    let newW = 0.9;
    let newH = 0.9;

    if (targetFractionRatio <= 1) {
      newW = 0.9 * targetFractionRatio;
      newH = 0.9;
    } else {
      newW = 0.9;
      newH = 0.9 / targetFractionRatio;
    }

    setCrop({
      x: Math.max(0, (1 - newW) / 2),
      y: Math.max(0, (1 - newH) / 2),
      width: Math.min(1, newW),
      height: Math.min(1, newH),
    });
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0, width: 1, height: 1 });
    setAspectRatio(null);
  };

  const handleApply = () => {
    if (!imgRef.current) return;
    const img = imgRef.current;
    const nw = naturalDimensions.width || img.naturalWidth || img.width;
    const nh = naturalDimensions.height || img.naturalHeight || img.height;

    if (!nw || !nh) return;

    const sx = Math.max(0, Math.round(crop.x * nw));
    const sy = Math.max(0, Math.round(crop.y * nh));
    const sw = Math.max(
      1,
      Math.min(Math.round(crop.width * nw), nw - sx)
    );
    const sh = Math.max(
      1,
      Math.min(Math.round(crop.height * nh), nh - sy)
    );

    try {
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const isJpeg = src.startsWith("data:image/jpeg");
      const isWebp = src.startsWith("data:image/webp");
      const mime = isJpeg ? "image/jpeg" : isWebp ? "image/webp" : "image/png";

      const croppedDataUrl = canvas.toDataURL(mime, 0.92);
      onApply(croppedDataUrl);
    } catch (err) {
      console.error("Canvas crop error:", err);
      setErrorMessage(
        "Cannot export cropped image due to cross-origin host restrictions. Upload or paste the image file directly to crop."
      );
    }
  };

  if (!isOpen || typeof document === "undefined") return null;

  const croppedPixelWidth =
    naturalDimensions.width > 0
      ? Math.round(crop.width * naturalDimensions.width)
      : 0;
  const croppedPixelHeight =
    naturalDimensions.height > 0
      ? Math.round(crop.height * naturalDimensions.height)
      : 0;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center p-3 sm:p-6 select-none animate-in fade-in duration-150 font-manrope"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div className="w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header Toolbar */}
        <div className="px-4 py-3 border-b border-border-subtle flex flex-wrap items-center justify-between gap-2 bg-subtle">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              Crop Image
            </span>
            {croppedPixelWidth > 0 && croppedPixelHeight > 0 && (
              <span className="text-xs text-muted-foreground font-mono">
                ({croppedPixelWidth} × {croppedPixelHeight} px)
              </span>
            )}
          </div>

          {/* Aspect Ratio Presets */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5 text-xs">
            {[
              { label: "Free", value: null },
              { label: "1:1", value: 1 },
              { label: "4:3", value: 4 / 3 },
              { label: "16:9", value: 16 / 9 },
              { label: "3:2", value: 3 / 2 },
            ].map((preset) => {
              const active =
                preset.value === null
                  ? aspectRatio === null
                  : aspectRatio !== null &&
                    Math.abs(aspectRatio - preset.value) < 0.01;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setPresetRatio(preset.value)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    active
                      ? "bg-accent text-accent-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-subtle"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card border border-transparent hover:border-border transition-colors cursor-pointer"
              title="Reset to full image"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-border mx-1 shrink-0" />
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card border border-transparent hover:border-border transition-colors cursor-pointer"
              title="Cancel (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-accent-foreground font-semibold text-xs transition-colors hover:opacity-90 shadow-2xs cursor-pointer"
              title="Apply Crop (Enter)"
            >
              <Check className="w-4 h-4" />
              <span>Apply</span>
            </button>
          </div>
        </div>

        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-xs text-red-500 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="p-0.5 text-red-500 hover:text-red-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Stage Area */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-black/40 min-h-[300px]">
          <div
            ref={containerRef}
            className="relative inline-block max-w-full max-h-[60vh] select-none shadow-xl"
            style={{
              cursor: isDragging ? "grabbing" : "default",
            }}
          >
            {/* Base Image */}
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              crossOrigin="anonymous"
              onLoad={handleImageLoad}
              className="block max-w-full max-h-[60vh] w-auto h-auto object-contain pointer-events-none"
              draggable={false}
            />

            {/* Dark Masks around Crop Area */}
            {/* Top mask */}
            <div
              className="absolute left-0 right-0 top-0 bg-black/60 pointer-events-none"
              style={{ height: `${crop.y * 100}%` }}
            />
            {/* Bottom mask */}
            <div
              className="absolute left-0 right-0 bottom-0 bg-black/60 pointer-events-none"
              style={{
                top: `${(crop.y + crop.height) * 100}%`,
              }}
            />
            {/* Left mask */}
            <div
              className="absolute left-0 bg-black/60 pointer-events-none"
              style={{
                top: `${crop.y * 100}%`,
                width: `${crop.x * 100}%`,
                height: `${crop.height * 100}%`,
              }}
            />
            {/* Right mask */}
            <div
              className="absolute right-0 bg-black/60 pointer-events-none"
              style={{
                top: `${crop.y * 100}%`,
                left: `${(crop.x + crop.width) * 100}%`,
                height: `${crop.height * 100}%`,
              }}
            />

            {/* The Active Crop Box */}
            <div
              className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] z-20"
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.width * 100}%`,
                height: `${crop.height * 100}%`,
              }}
            >
              {/* Inner Drag to Move Area */}
              <div
                onPointerDown={(e) => handlePointerDown("move", e)}
                className="w-full h-full cursor-move relative"
                title="Drag to reposition crop box"
              >
                {/* Rule of Thirds Guides */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                  <div className="border-r border-b border-white/30 border-dashed" />
                  <div className="border-r border-b border-white/30 border-dashed" />
                  <div className="border-b border-white/30 border-dashed" />
                  <div className="border-r border-b border-white/30 border-dashed" />
                  <div className="border-r border-b border-white/30 border-dashed" />
                  <div className="border-b border-white/30 border-dashed" />
                  <div className="border-r border-white/30 border-dashed" />
                  <div className="border-r border-white/30 border-dashed" />
                  <div />
                </div>
              </div>

              {/* 4 Corner Handles */}
              <div
                onPointerDown={(e) => handlePointerDown("nw", e)}
                className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border border-black/40 rounded-xs cursor-nwse-resize shadow-md z-30 hover:scale-125 transition-transform"
                title="Resize from top-left"
              />
              <div
                onPointerDown={(e) => handlePointerDown("ne", e)}
                className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border border-black/40 rounded-xs cursor-nesw-resize shadow-md z-30 hover:scale-125 transition-transform"
                title="Resize from top-right"
              />
              <div
                onPointerDown={(e) => handlePointerDown("sw", e)}
                className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border border-black/40 rounded-xs cursor-nesw-resize shadow-md z-30 hover:scale-125 transition-transform"
                title="Resize from bottom-left"
              />
              <div
                onPointerDown={(e) => handlePointerDown("se", e)}
                className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border border-black/40 rounded-xs cursor-nwse-resize shadow-md z-30 hover:scale-125 transition-transform"
                title="Resize from bottom-right"
              />

              {/* 4 Edge Handles */}
              <div
                onPointerDown={(e) => handlePointerDown("n", e)}
                className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-white border border-black/40 rounded-xs cursor-ns-resize shadow-md z-30 hover:scale-110 transition-transform"
                title="Resize top edge"
              />
              <div
                onPointerDown={(e) => handlePointerDown("s", e)}
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-white border border-black/40 rounded-xs cursor-ns-resize shadow-md z-30 hover:scale-110 transition-transform"
                title="Resize bottom edge"
              />
              <div
                onPointerDown={(e) => handlePointerDown("w", e)}
                className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-6 bg-white border border-black/40 rounded-xs cursor-ew-resize shadow-md z-30 hover:scale-110 transition-transform"
                title="Resize left edge"
              />
              <div
                onPointerDown={(e) => handlePointerDown("e", e)}
                className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-6 bg-white border border-black/40 rounded-xs cursor-ew-resize shadow-md z-30 hover:scale-110 transition-transform"
                title="Resize right edge"
              />
            </div>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="px-4 py-2 border-t border-border-subtle bg-subtle flex items-center justify-between text-xs text-muted-foreground">
          <span>Drag handles or inner area to adjust crop</span>
          <div className="flex items-center gap-3">
            <span>Enter to apply</span>
            <span>Esc to cancel</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
