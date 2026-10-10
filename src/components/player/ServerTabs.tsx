"use client";

import type { PlayerSource } from "@/lib/types";
import { hostOf } from "@/lib/sandbox";

export type SourceStatus = "idle" | "loading" | "ready" | "failed";

interface Props {
  sources: PlayerSource[];
  active: number;
  statuses: Record<number, SourceStatus>;
  onSelect: (index: number) => void;
}

/**
 * The four tabs above the player. Tab count is whatever the episode row has
 * (1..N); disabled rows render as "Coming Soon" so the layout stays stable.
 */
export function ServerTabs({ sources, active, statuses, onSelect }: Props) {
  return (
    <div className="server-tabs" role="tablist" aria-label="Servers">
      {sources.map((source, i) => {
        const status = statuses[i] ?? (i === active ? "loading" : "idle");
        const disabled = source.enabled === false;
        const stateClass = disabled ? "" : status === "failed" ? "failed" : status === "loading" ? "pending" : "";
        return (
          <button
            key={`${source.label}-${i}`}
            role="tab"
            type="button"
            id={`server-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`server-panel-${i}`}
            aria-disabled={disabled || undefined}
            disabled={disabled}
            title={disabled ? "Coming soon" : `${hostOf(source.url)} · ${source.kind}`}
            className={`server-tab ${stateClass}`}
            onClick={() => !disabled && onSelect(i)}
          >
            <span className="tab-key" aria-hidden="true">
              {i + 1}
            </span>
            <span>
              <span className="tab-kicker">{source.kind === "video" ? "Direct" : "Embed"}</span>
              {source.label}
            </span>
            {!disabled && <span className="tab-state" aria-hidden="true" />}
            {disabled && <span className="tab-state" style={{ background: "#5b5f68" }} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
