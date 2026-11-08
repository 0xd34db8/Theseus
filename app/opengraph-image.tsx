import { ImageResponse } from "next/og";

export const alt = "Theseus - AI-powered syllabus organizer";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#090a0b",
          backgroundImage:
            "radial-gradient(circle at 50% 25%, #18191c 0%, #090a0b 70%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#ffffff",
          padding: "48px",
          position: "relative",
        }}
      >
        {/* Subtle decorative grid/border frame */}
        <div
          style={{
            position: "absolute",
            inset: "24px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "24px",
            display: "flex",
          }}
        />

        {/* Content Box */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            maxWidth: "900px",
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "8px 20px",
              borderRadius: "9999px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              fontSize: "14px",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#a1a1aa",
              marginBottom: "32px",
            }}
          >
            Syllabus Organizer &amp; Workspace
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: "76px",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
              marginBottom: "24px",
              color: "#ffffff",
            }}
          >
            Theseus
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: "24px",
              fontWeight: 400,
              lineHeight: 1.45,
              color: "#94a3b8",
              maxWidth: "720px",
            }}
          >
            Structure curricula, generate comprehensive study notes, and navigate learning paths with an interactive hierarchy and rich editor.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
