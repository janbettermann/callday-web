"use client";

import { useEffect, useState } from "react";

import { fmtRelative, type PostStat } from "@/lib/affiliate-activity";
import { WbBadge, WbEmpty, WbNumeric, WbRow, WbTable, WbTd, WbTh } from "@/app/components/werkbank";
import { deleteAffiliatePostAction } from "./dashboard/actions";

/**
 * Post-Liste als Tabelle, geteilt vom Dashboard (`todayOnly`) und
 * /affiliate/posts (alle). Client-Component, weil `todayOnly` auf dem
 * LOKALEN Kalendertag filtert (Browser-Zeitzone).
 *
 * Mounted-Guard gegen Hydration-Mismatch: SSR + initialer Client rendern
 * ungefiltert (Server kennt die lokale Zeit nicht), erst nach dem Mount
 * wird auf heute gefiltert. Bei kleinem Volumen praktisch kein Flackern.
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
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const end = start + 24 * 60 * 60 * 1000;
    visible = posts.filter((p) => {
      const t = new Date(p.post.posted_at).getTime();
      return t >= start && t < end;
    });
  }

  if (visible.length === 0) {
    return <WbEmpty>{todayOnly ? "No posts logged today yet." : "No posts logged yet."}</WbEmpty>;
  }

  return (
    <WbTable>
      <thead>
        <tr>
          <WbTh>Platform</WbTh>
          <WbTh>Link</WbTh>
          <WbTh>Posted</WbTh>
          <WbTh align="right">Visitors</WbTh>
          <WbTh align="right">Sign-ups</WbTh>
          <WbTh width={80} />
        </tr>
      </thead>
      <tbody>
        {visible.map(({ post, visitors, signups }) => (
          <WbRow key={post.id}>
            <WbTd nowrap>
              <span className="wb-inline" style={{ gap: 6 }}>
                <WbBadge>{post.platform ?? "Post"}</WbBadge>
                {post.type === "story" ? <WbBadge tone="blue">Story</WbBadge> : null}
              </span>
            </WbTd>
            <WbTd style={{ maxWidth: 360 }}>
              {post.url ? (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wb-link-blue"
                  style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {post.url}
                </a>
              ) : (
                <span className="is-faint" style={{ color: "var(--wb-ink-3)" }}>–</span>
              )}
            </WbTd>
            <WbTd nowrap muted>
              {fmtRelative(post.posted_at)}
            </WbTd>
            <WbTd align="right">
              <WbNumeric value={visitors} bold={visitors > 0} />
            </WbTd>
            <WbTd align="right">
              <WbNumeric value={signups} bold={signups > 0} />
            </WbTd>
            <WbTd align="right" nowrap>
              <form action={deleteAffiliatePostAction}>
                <input type="hidden" name="id" value={post.id} />
                <button type="submit" className="wb-btn is-ghost" style={{ height: 28 }} aria-label="Remove post">
                  Remove
                </button>
              </form>
            </WbTd>
          </WbRow>
        ))}
      </tbody>
    </WbTable>
  );
}
