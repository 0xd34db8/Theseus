"use client";

import React, { useState } from "react";
import { NodeViewProps } from "@tiptap/react";
import { Crop } from "lucide-react";
import { ImageCropModal } from "./ImageCropModal";
import { ResizableMediaFrame } from "./ResizableMediaFrame";

export const ResizableImage: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  selected,
  editor,
  getPos,
  deleteNode,
}) => {
  const [isCropping, setIsCropping] = useState(false);

  return (
    <ResizableMediaFrame
      editor={editor}
      node={node}
      updateAttributes={updateAttributes}
      selected={selected}
      getPos={getPos}
      deleteNode={deleteNode}
      minWidth={80}
      deleteLabel="Delete image"
      extraToolbarActions={
        <button
          type="button"
          title="Crop image (or double-click)"
          onClick={() => setIsCropping(true)}
          className="p-1 rounded-md text-foreground-subtle hover:text-foreground hover:bg-subtle transition-colors cursor-pointer"
        >
          <Crop className="w-3.5 h-3.5" />
        </button>
      }
    >
      {({ isHovered }) => (
        <>
          <img
            src={node.attrs.src}
            alt={node.attrs.alt || ""}
            title={
              editor?.isEditable
                ? "Double-click to crop"
                : node.attrs.title || ""
            }
            onDoubleClick={(e) => {
              if (!editor || !editor.isEditable) return;
              e.preventDefault();
              e.stopPropagation();
              setIsCropping(true);
            }}
            className={`block w-full h-auto object-contain rounded-xl border border-border transition-shadow cursor-pointer ${
              selected
                ? "ring-2 ring-accent ring-offset-2 ring-offset-card"
                : isHovered
                  ? "ring-1 ring-border"
                  : ""
            }`}
          />

          {isCropping && (
            <ImageCropModal
              isOpen={isCropping}
              src={node.attrs.src}
              alt={node.attrs.alt}
              onApply={(croppedDataUrl) => {
                updateAttributes({ src: croppedDataUrl });
                setIsCropping(false);
              }}
              onCancel={() => setIsCropping(false)}
            />
          )}
        </>
      )}
    </ResizableMediaFrame>
  );
};
