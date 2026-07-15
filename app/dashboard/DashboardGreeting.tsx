"use client";

import { useEffect, useState } from "react";

/**
 * Zeitabhaengige Begruessung wie im App-Home ("Good morning/afternoon/
 * evening"). Tageszeit ist geraetelokal → Client. Der Name kommt vom
 * Server; bis der Effect laeuft, zeigen wir eine neutrale Variante, um
 * einen Hydration-Mismatch zu vermeiden.
 */
function timeGreeting(): { word: string; emoji: string } {
  const h = new Date().getHours();
  if (h < 12) return { word: "Good morning", emoji: "☕" };
  if (h < 18) return { word: "Good afternoon", emoji: "📞" };
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
