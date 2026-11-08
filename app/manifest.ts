import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Theseus",
    short_name: "Theseus",
    description: "AI-powered syllabus organizer and study workspace",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0d0e",
    theme_color: "#0c0d0e",
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
