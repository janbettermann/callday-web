"use client";

import { useEffect, useState } from "react";

import {
  POST_WINDOW_HOURS,
  fmtRelative,
  type PostStat,
} from "@/lib/affiliate-activity";
import { deleteAffiliatePostAction } from "./dashboard/actions";

/**
 * Post-Liste — geteilt vom Dashboard (`todayOnly`, nur heutige Posts) und
 * /affiliate/posts (alle). Client-Component, weil `todayOnly` auf dem LOKALEN
 * Kalendertag filtert (Browser-Zeitzone).
 *
 * Mounted-Guard gegen Hydration-Mismatch: SSR + initialer Client rendern
 * ungefiltert (Server kennt die lokale Zeit nicht), erst nach dem Mount wird
 * auf heute gefiltert. Bei kleinem Volumen praktisch kein Flackern.
 */
export function PostList({
  posts,
  todayOnly = false,
}: {
  posts: PostStat[];
  todayOnly?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  let visible = posts;
  if (todayOnly && mounted) {
    const now = new Date();
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const end = start + 24 * 60 * 60 * 1000;
    visible = posts.filter((p) => {
      const t = new Date(p.post.posted_at).getTime();
      return t >= start && t < end;
    });
  }

  if (visible.length === 0) {
    return (
      <p style={{ margin: 0, color: "var(--ink-dim)", fontSize: 14 }}>
        {todayOnly ? "No posts logged today yet." : "No posts logged yet."}
      </p>
    );
  }

  return (
    <ul
      style={{
        margin: 0,
        padding: 0,
        listStyle: "none",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {visible.map(({ post, visitors, signups }) => (
        <li
          key={post.id}
          style={{
            padding: "16px 0",
            borderTop: "0.5px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: "var(--ink-faint)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                minWidth: 0,
              }}
            >
              {post.platform ? (
                <span
                  style={{
                    background: "rgba(26,29,38,0.06)",
                    borderRadius: 6,
                    padding: "2px 8px",
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--ink-dim)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {post.platform}
                </span>
              ) : null}
              <span style={{ whiteSpace: "nowrap" }}>
                posted {fmtRelative(post.posted_at)}
              </span>
            </span>
            <form action={deleteAffiliatePostAction}>
              <input type="hidden" name="id" value={post.id} />
              <button
                type="submit"
                aria-label="Remove post"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--ink-faint)",
                  fontSize: 13,
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                Remove
              </button>
            </form>
          </div>

          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 14,
              color: "var(--blue-deep, #2563e8)",
              textDecoration: "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {post.url}
          </a>

          <div
            style={{
              fontSize: 13,
              color: "var(--ink-dim)",
              background: "rgba(37,99,232,0.06)",
              borderRadius: 10,
              padding: "8px 12px",
            }}
          >
            <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
              {visitors}
            </strong>{" "}
            visitors and{" "}
            <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
              {signups}
            </strong>{" "}
            sign-ups in the {POST_WINDOW_HOURS} h after
          </div>
        </li>
      ))}
    </ul>
  );
}
