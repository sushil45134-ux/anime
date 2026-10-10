"use client";

import { useEffect, useRef, useState } from "react";
import { IFRAME_ALLOW, IFRAME_SANDBOX, assertSandboxPolicy } from "@/lib/sandbox";
import type { PlayerSource } from "@/lib/types";

interface Props {
  source: PlayerSource;
  /** ms with no `load` event => declare the server dead */
  watchdogMs?: number;
  onReady: () => void;
  onFailed: (reason: string) => void;
}

/**
 * Sandboxed third-party embed.
 *
 * `sandbox` is imported from lib/sandbox.ts — there is exactly one definition of the
 * policy in this codebase, and `allow-popups` is not in it, so every popup/new-tab the
 * player tries to open is killed by the browser before it ever reaches the user.
 */
export function EmbedStage({ source, watchdogMs = 11000, onReady, onFailed }: Props) {
  const [loaded, setLoaded] = useState(false);
  const frameKey = useRef(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    assertSandboxPolicy();
  }, []);

  useEffect(() => {
    setLoaded(false);
    frameKey.current += 1;
    let armed = true;
    const timer = window.setTimeout(() => {
      if (armed) onFailed("This server did not answer inside 11 seconds.");
    }, watchdogMs);
    return () => {
      armed = false;
      window.clearTimeout(timer);
    };
  }, [source.url, nonce, watchdogMs, onFailed]);

  useEffect(() => {
    if (loaded) onReady();
  }, [loaded, onReady]);

  return (
    <div className="embed-stage">
      {source.url !== "about:blank" && (
        <iframe
          key={`${source.url}-${frameKey.current}-${nonce}`}
          title={`${source.label} player`}
          src={source.url}
          sandbox={IFRAME_SANDBOX}
          allow={IFRAME_ALLOW}
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => onFailed("The frame reported a network error.")}
        />
      )}
      {!loaded && (
        <div className="player-overlay">
          <div className="overlay-loading">
            <span className="overlay-spinner" />
            Connecting to {source.label}
            <button
              type="button"
              className="secondary"
              style={{ textTransform: "uppercase", fontSize: 11, padding: "8px 12px" }}
              onClick={() => setNonce((n) => n + 1)}
            >
              Reload frame
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
