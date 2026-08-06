"use client";

import { useEffect, useState } from "react";

/**
 * Zeitabhaengige Begruessung — 1:1 wie im App-Home (utils/format/greeting.ts,
 * germanGreeting): gleiche Texte, gleiche Emojis (👋/👋/🌆) und gleiche
 * Buckets (Morgen 05–11, Nachmittag 12–17, sonst Abend — 00–05 zaehlt also
 * als Abend). Tageszeit ist geraetelokal → Client. Der Name kommt vom
 * Server; bis der Effect laeuft, zeigen wir eine neutrale Variante, um einen
 * Hydration-Mismatch zu vermeiden.
 */
function timeGreeting(): { word: string; emoji: string } {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { word: "Good morning", emoji: "👋" };
  if (h >= 12 && h < 18) return { word: "Good afternoon", emoji: "👋" };
  return { word: "Good evening", emoji: "🌆" };
}

export function DashboardGreeting({ firstName }: { firstName: string | null }) {
  const [greeting, setGreeting] = useState<{ word: string; emoji: string } | null>(
    null,
  );

  useEffect(() => {
    setGreeting(timeGreeting());
  }, []);

  const namePart = firstName ? `, ${firstName}` : "";
  const text = greeting
    ? `${greeting.word}${namePart} ${greeting.emoji}`
    : `Welcome back${namePart}`;

  return <h1 className="dash-greet">{text}</h1>;
}
