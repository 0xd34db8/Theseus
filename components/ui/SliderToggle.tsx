import React from "react";
import { TooltipBubble } from "./TooltipBubble";

interface SliderToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  title?: string;
  tooltip?: React.ReactNode | string;
  disabled?: boolean;
  className?: string;
}

export const SliderToggle: React.FC<SliderToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  title,
  tooltip,
  disabled = false,
  className = "",
}) => {
  return (
    <div
      title={title}
      className={`inline-flex items-center gap-1.5 select-none text-xs ${
        disabled ? "opacity-50 pointer-events-none" : ""
      } ${className}`}
    >
      <label className="inline-flex items-center gap-2 cursor-pointer group">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        {/* Slider Track */}
        <div
          className={`relative inline-flex h-4.5 w-8 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
            checked ? "bg-accent" : "bg-border/90 group-hover:bg-border"
          }`}
        >
          {/* Slider Thumb */}
          <span
            className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out ${
              checked ? "translate-x-3.5" : "translate-x-0"
            }`}
          />
        </div>

        <div className="flex flex-col">
          <span className="font-normal text-foreground-subtle group-hover:text-foreground transition-colors">
            {label}
          </span>
          {description && (
            <span className="text-[10px] text-muted-foreground leading-tight">
              {description}
            </span>
          )}
        </div>
      </label>

      {/* Tooltip '?' button and speech bubble */}
      {tooltip && <TooltipBubble content={tooltip} />}
    </div>
  );
};
