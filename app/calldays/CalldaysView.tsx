"use client";

import { useState } from "react";
import type { DashboardCallday } from "@/lib/dashboard/data";
import { ShareableSticker } from "./ShareableSticker";

/**
 * /calldays — nur Tage, nur Card-View. Der frueher Days/Weeks/Months-Toggle
 * und der Card/List-Toggle sind raus (Jan 2026-08-12, "es soll nur noch Days
 * sein"). Statt allen Kacheln auf einmal wird paginiert: initial 9 (3x3 im
 * dash-duo-3er-Grid), dann per "Show more" jeweils 9 mehr.
 */
const PAGE = 9;

export function CalldaysView({ calldays }: { calldays: DashboardCallday[] }) {
  const [shown, setShown] = useState(PAGE);
  const visible = calldays.slice(0, shown);
  const remaining = calldays.length - visible.length;

  return (
    <>
      <div className="dash-head">
        <h1 className="dash-greet">Your Calldays</h1>
      </div>

      <div className="dash-duo">
        {visible.map((item) => (
          <ShareableSticker key={item.isoDate} day={item} />
        ))}
      </div>

      {remaining > 0 && (
        <div className="calldays-more-wrap">
          <button
            type="button"
            className="calldays-more"
            onClick={() => setShown((s) => s + PAGE)}
          >
            Show more
            <span className="calldays-more-count">
              {remaining} more
            </span>
          </button>
        </div>
      )}
    </>
  );
}
