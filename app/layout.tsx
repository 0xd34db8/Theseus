import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["200", "300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://theseusmind.vercel.app"),
  title: {
    default: "Theseus",
    template: "%s - Theseus",
  },
  description:
    "AI-powered syllabus organizer and study workspace. Transform course syllabi into interactive study trees, generate structured notes, and track learning progress.",
  applicationName: "Theseus",
  authors: [
    { name: "0xd34db8", url: "https://github.com/0xd34db8" },
    { name: "Theseus", url: "https://theseusmind.vercel.app" },
  ],
  creator: "0xd34db8",
  publisher: "Theseus",
  keywords: [
    "Theseus",
    "Theseus Mind",
    "syllabus organizer",
    "curriculum planner",
    "AI syllabus notes",
    "study notes generator",
    "course organizer",
    "learning roadmap",
    "markdown note editor",
    "interactive syllabus",
    "study workspace",
    "KaTeX math notes",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Theseus",
    description:
      "AI-powered syllabus organizer and study workspace. Transform course syllabi into interactive study trees, generate structured notes, and track learning progress.",
    url: "https://theseusmind.vercel.app",
    siteName: "Theseus",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Theseus",
    description:
      "AI-powered syllabus organizer and study workspace. Transform course syllabi into interactive study trees, generate structured notes, and track learning progress.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  verification: {
    google: "CaeM2PmoY9jYJqQ1ZtJFcVwc-TxgXuCXzqeJDQr9p2c",
  },
  category: "education",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": "https://theseusmind.vercel.app/#webapp",
      "name": "Theseus",
      "url": "https://theseusmind.vercel.app",
      "codeRepository": "https://github.com/0xd34db8/Theseus",
      "sameAs": [
        "https://github.com/0xd34db8/Theseus"
      ],
      "description":
        "AI-powered syllabus organizer and study workspace. Transform course syllabi into interactive study trees, generate structured notes, and track learning progress.",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "All",
      "browserRequirements": "Requires JavaScript. Requires HTML5.",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
      },
      "featureList": [
        "AI syllabus parsing from outline, text, and documents",
        "Hierarchical study tree with progress tracking",
        "Markdown note editor with live KaTeX math and syntax highlighting",
        "Local-first privacy and .theseus file export",
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://theseusmind.vercel.app/#website",
      "url": "https://theseusmind.vercel.app",
      "name": "Theseus",
      "description":
        "AI-powered syllabus organizer and study workspace",
      "sameAs": [
        "https://github.com/0xd34db8/Theseus"
      ],
      "publisher": {
        "@type": "Organization",
        "name": "Theseus",
        "url": "https://theseusmind.vercel.app",
        "sameAs": [
          "https://github.com/0xd34db8/Theseus",
          "https://github.com/0xd34db8"
        ],
        "logo": {
          "@type": "ImageObject",
          "url": "https://theseusmind.vercel.app/icon.png",
        },
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={manrope.variable} suppressHydrationWarning>
      <head>
        <meta
          name="google-site-verification"
          content="CaeM2PmoY9jYJqQ1ZtJFcVwc-TxgXuCXzqeJDQr9p2c"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_BOOTSTRAP_SCRIPT,
          }}
        />
      </head>
      <body className={`${manrope.className} antialiased min-h-screen select-none font-sans`}>
        {children}
      </body>
    </html>
  );
}
