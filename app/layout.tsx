import type { Metadata, Viewport } from "next";
import { Geist, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Marketing display + headings.
const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Body copy.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

// Labels and small accents (// THE FLOW, etc.).
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// `viewport-fit: cover` is what makes `env(safe-area-inset-top)` non-zero on
// iOS devices that have a notch / Dynamic Island. On non-notched devices
// (iPhone SE, older iPhones) env(safe-area-inset-top) just returns 0 and
// cover has no effect — the layout viewport sits below the iOS status bar
// chrome, and that chrome zone is only colorable via `themeColor` below.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Colors the iOS Safari browser chrome (URL bar, status-bar zone on
  // non-notched devices) and the Android Chrome system status bar.
  // Defaults to the hero's dark navy — SiteNav.tsx mutates this meta
  // tag at runtime when the user scrolls past the hero so the chrome
  // tint stays matched to the visible page state.
  themeColor: "#0d0f14",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://callday.app"),
  title: "Callday. Make today a Callday.",
  description:
    "The cold calling app for solo founders and freelancers. Less avoiding. More dialing. Apply for one of 50 closed-beta spots.",
  openGraph: {
    title: "Callday. Make today a Callday.",
    description:
      "Less avoiding. More dialing. Cold calling momentum that survives the gaps where focus usually dies.",
    url: "https://callday.app",
    siteName: "Callday",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Callday. Make today a Callday.",
    description:
      "Less avoiding. More dialing. Cold calling momentum that survives the gaps where focus usually dies.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
