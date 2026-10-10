"use client";

import { useState } from "react";

/**
 * Jio/Airtel/JioFiber intermittently resolve these player hosts to nothing.
 * The notice is small, dismissible and stored, because it must be *in* the shell
 * rather than a README line nobody reads.
 */
export function DnsNotice() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="dns-notice" role="note">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 2 20h20L12 3z" />
        <path d="M12 10v4M12 17h.01" />
      </svg>
      <span>
        Server not loading? <strong>Use the 1.1.1.1 app</strong> (or set DNS to 1.1.1.1) — your ISP
        blocks some players.
      </span>
      <button type="button" onClick={() => setHidden(true)}>
        Dismiss
      </button>
    </div>
  );
}
