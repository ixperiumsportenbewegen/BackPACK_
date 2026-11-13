import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Backpack_",
    short_name: "Backpack",
    description: "Alles voor de Ardennen-meerdaagse van Sportkunde in je backpack.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "nl",
    background_color: "#FFFFFF",
    theme_color: "#E50056",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
