import React from "react";

/** Intrinsic aspect ratio (width / height) of the logo artwork. */
const LOGO_ASPECT = 318 / 400;

export const TheseusLogo: React.FC<{ className?: string; size?: number }> = ({
  className = "h-10 w-auto",
  size,
}) => {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Theseus"
      width={318}
      height={400}
      draggable={false}
      className={`inline-block shrink-0 object-contain select-none ${className}`}
      style={size ? { width: size * LOGO_ASPECT, height: size } : undefined}
    />
  );
};
