"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ServerTabs, type SourceStatus } from "./ServerTabs";
import { EmbedStage } from "./EmbedStage";
import { VideoStage } from "./VideoStage";
import { DnsNotice } from "./DnsNotice";
import { assertSandboxPolicy, hostOf } from "@/lib/sandbox";
import { readProgressMap, rememberServerIndex } from "@/lib/progress";
import type { PlayerSource } from "@/lib/types";

const AUTO_SWITCH_MS = 6000;

interface Props {
  slug: string;
  episodeId: string;
  title: string;
  subtitle: string;
  sources: PlayerSource[];
  poster?: string | null;
  initialSource?: number;
  onClose?: () => void;
  upNext?: React.ReactNode;
}

/**
 * Player shell: 4 server tabs above one stage.
 *
 * Rules enforced here (and nowhere else):
 *  - every iframe goes through EmbedStage, which uses the pinned sandbox policy
 *  - a dead server shows the "Try another server" overlay; the user can pick a tab,
 *    wait for the countdown auto-switch, or reload the frame
 *  - the DNS-block notice is part of the shell so it can never be forgotten
 */
export function Player({
  slug,
  episodeId,
  title,
  subtitle,
  sources,
  poster,
  initialSource,
  onClose,
  upNext,
}: Props) {
  const enabledIdx = useMemo(() => sources.map((s, i) => (s.enabled === false ? -1 : i)).filter((i) => i >= 0), [sources]);
  const [active, setActive] = useState(() => {
    if (initialSource != null && sources[initialSource]?.enabled !== false) return initialSource;
    return enabledIdx[0] ?? 0;
  });
  const [statuses, setStatuses] = useState<Record<number, SourceStatus>>({});
  const [reason, setReason] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [resumeAt, setResumeAt] = useState(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const failuresRef = useRef<Set<number>>(new Set());
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    assertSandboxPolicy();
  }, []);

  // resume where the viewer stopped, if this is the episode they left on
  useEffect(() => {
    const entry = readProgressMap()[slug];
    setResumeAt(entry && entry.episodeId === episodeId ? entry.seconds : 0);
  }, [slug, episodeId]);

  // Reset per-episode: fresh failure memory, fresh resume point.
  useEffect(() => {
    failuresRef.current = new Set();
    setStatuses({});
    setReason(null);
    setCountdown(null);
    setActive(enabledIdx[0] ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCountdown(null);
  }, []);

  const nextLiveIdx = useCallback(
    (from: number) => {
      const pool = enabledIdx.filter((i) => !failuresRef.current.has(i));
      if (!pool.length) return null;
      const pos = pool.indexOf(from);
      return pool[(pos + 1) % pool.length] ?? pool[0];
    },
    [enabledIdx],
  );

  const select = useCallback(
    (index: number, opts: { manual?: boolean } = {}) => {
      clearTimer();
      setReason(null);
      setActive(index);
      setStatuses((prev) => ({ ...prev, [index]: "loading" }));
      rememberServerIndex(slug, index);
      if (opts.manual) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set("s", String(index));
          window.history.replaceState(null, "", url.toString());
        } catch {
          /* ignore */
        }
      }
    },
    [clearTimer, slug],
  );

  const markFailed = useCallback(
    (index: number, why: string) => {
      failuresRef.current.add(index);
      setStatuses((prev) => ({ ...prev, [index]: "failed" }));
      const target = nextLiveIdx(index);
      if (target == null) {
        setReason("Every server for this episode failed. Try again in a minute, or use another server next episode.");
        setCountdown(null);
        return;
      }
      setReason(why);
      let left = Math.round(AUTO_SWITCH_MS / 1000);
      setCountdown(left);
      clearTimer();
      timerRef.current = window.setInterval(() => {
        left -= 1;
        setCountdown(left);
        if (left <= 0) {
          clearTimer();
          select(target);
        }
      }, 1000);
    },
    [clearTimer, nextLiveIdx, select],
  );

  const markReady = useCallback((index: number) => {
    setStatuses((prev) => ({ ...prev, [index]: "ready" }));
  }, []);

  const activeSource = sources[active];
  const failed = statuses[active] === "failed";
  const liveCount = enabledIdx.filter((i) => !failuresRef.current.has(i)).length;
  const autoTarget = useMemo(() => (activeSource ? nextLiveIdx(active) : null), [active, activeSource, nextLiveIdx]);

  // keyboard: 1..4 = tabs, n = next server, f = fullscreen, esc = close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (/^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        if (sources[idx] && sources[idx].enabled !== false) select(idx, { manual: true });
      } else if (e.key.toLowerCase() === "n") {
        const t = nextLiveIdx(active);
        if (t != null) select(t, { manual: true });
      } else if (e.key.toLowerCase() === "f") {
        const stage = stageRef.current;
        if (!stage) return;
        if (document.fullscreenElement) void document.exitFullscreen();
        else void stage.requestFullscreen?.().catch(() => undefined);
      } else if (e.key === "Escape" && !failed) {
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, failed, nextLiveIdx, onClose, select, sources]);

  if (!activeSource) {
    return (
      <div className="video-stage" style={{ aspectRatio: "16/9" }}>
        <div className="player-overlay">
          <div className="player-overlay-card">
            <span className="eyebrow">No server wired</span>
            <h3>This episode has no sources yet</h3>
            <p>Run the import step so this row gets at least one source, then reload.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="player-layout">
      <div
        className="video-stage"
        ref={stageRef}
        style={{ flex: "1 1 auto", minWidth: 0, position: "relative", height: "auto", paddingBottom: 0, aspectRatio: "16 / 9", background: "#050505" }}
      >
        <div className="player-top" style={{ background: "transparent", border: 0, position: "absolute", inset: "0 0 auto", zIndex: 5, pointerEvents: "none" }}>
          <div style={{ pointerEvents: "auto", display: "flex", width: "100%", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <ServerTabs sources={sources} active={active} statuses={statuses} onSelect={(i) => select(i, { manual: true })} />
            <DnsNotice />
          </div>
        </div>

        {activeSource.kind === "iframe" ? (
          <EmbedStage
            source={activeSource}
            onReady={() => markReady(active)}
            onFailed={(why) => markFailed(active, why)}
          />
        ) : (
          <VideoStage
            source={activeSource}
            poster={poster ?? undefined}
            resumeAt={resumeAt}
            onReady={() => markReady(active)}
            onFailed={(why) => markFailed(active, why)}
            onTime={(sec, dur) => {
              if (dur > 0 && sec > 5) saveTick(slug, episodeId, sec, dur);
            }}
          />
        )}

        {failed && (
          <div className="player-overlay" role="alertdialog" aria-live="assertive">
            <div className="player-overlay-card">
              <span className="eyebrow">Try another server</span>
              <h3>{sources[active]?.label} didn&apos;t play</h3>
              <p>
                {reason} {countdown != null && autoTarget != null ? `Auto-switching in ${countdown}s.` : ""}
              </p>
              <div className="player-overlay-actions">
                {enabledIdx
                  .filter((i) => i !== active && !failuresRef.current.has(i))
                  .slice(0, 3)
                  .map((i) => (
                    <button key={i} className="primary" type="button" onClick={() => select(i, { manual: true })}>
                      {sources[i].label}
                    </button>
                  ))}
                {autoTarget != null && countdown != null && (
                  <button className="secondary" type="button" onClick={clearTimer}>
                    Cancel ({countdown}s)
                  </button>
                )}
                <button
                  className="secondary"
                  type="button"
                  onClick={() => {
                    failuresRef.current.delete(active);
                    select(active);
                  }}
                >
                  Retry this server
                </button>
              </div>
              <p style={{ margin: "14px 0 0", fontSize: 12 }}>
                Still nothing? The host may be DNS-blocked on your ISP — the 1.1.1.1 app usually fixes it in seconds.
              </p>
            </div>
          </div>
        )}
      </div>

      <div style={{ width: "100%", maxWidth: 1540, margin: "0 auto", padding: "0 3vw" }}>
        <div className="source-strip">
          <span>
            Active: <strong style={{ color: "#f7f7f7" }}>{activeSource.label}</strong> · {hostOf(activeSource.url)}
          </span>
          <span className={liveCount > 1 ? "ok" : "bad"}>
            {liveCount}/{enabledIdx.length} servers live on this episode
          </span>
          <span>Sandbox: {assertLabel()}</span>
          <span style={{ marginLeft: "auto" }}>
            Keys 1-{sources.length} switch · N next · F fullscreen
          </span>
        </div>
      </div>

      {upNext}
    </div>
  );
}

function assertLabel() {
  try {
    assertSandboxPolicy();
    return "popup-blocked";
  } catch {
    return "check policy";
  }
}

/** small helper so Player stays readable; keeps last position for resume + Continue watching */
function saveTick(slug: string, episodeId: string, seconds: number, duration: number) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const last = Number((window as unknown as { __anirollTick?: number }).__anirollTick ?? 0);
  if (now - last < 5000) return;
  (window as unknown as { __anirollTick: number }).__anirollTick = now;
  void import("@/lib/progress").then(({ saveProgress }) => saveProgress({ slug, episodeId, seconds, duration }));
}
