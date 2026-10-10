"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlayerSource } from "@/lib/types";

interface Props {
  source: PlayerSource;
  poster?: string;
  resumeAt?: number;
  onReady: () => void;
  onFailed: (reason: string) => void;
  onTime: (seconds: number, duration: number) => void;
}

const fmt = (t: number) => {
  if (!Number.isFinite(t) || t < 0) return "0:00";
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};

/**
 * Direct-playback stage (<video>). Used for our own .mp4 files and for any .m3u8 we are
 * allowed to pull, so there is no third-party frame at all on this server — zero ad
 * surface. hls.js is loaded lazily and only when the URL is a playlist.
 */
export function VideoStage({ source, poster, resumeAt, onReady, onFailed, onTime }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;

    const isPlaylist = /\.m3u8(\?|#|$)/i.test(source.url) || /format=m3u8/i.test(source.url);
    const nativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";

    const watchdog = window.setTimeout(() => {
      if (!cancelled && video.readyState < 2) onFailed("No video data from this server.");
    }, 14000);

    if (isPlaylist && !nativeHls && typeof window !== "undefined") {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (cancelled) return;
          if (!Hls.isSupported()) {
            video.src = source.url;
            return;
          }
          const hls = new Hls({ enableWorker: true, lowLatencyMode: false, manifestLoadingTimeOut: 9000 });
          hls.loadSource(source.url);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_evt, data) => {
            if (data?.fatal) onFailed(`HLS error: ${data.type}/${data.details}`);
          });
          hlsRef.current = hls as unknown as { destroy: () => void };
        })
        .catch(() => onFailed("hls.js failed to load."));
    } else {
      video.src = source.url;
    }

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
  }, [source.url, onFailed]);

  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => onFailed("The browser blocked autoplay here — press play again."));
    else video.pause();
  }, [onFailed]);

  return (
    <>
      <video
        ref={videoRef}
        playsInline
        preload="metadata"
        poster={poster}
        muted={muted}
        onClick={toggle}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDuration(v.duration || 0);
          onReady();
          if (resumeAt && resumeAt > 5 && (!v.duration || resumeAt < v.duration - 10)) v.currentTime = resumeAt;
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setCurrent(v.currentTime);
          onTime(v.currentTime, v.duration || 0);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => onFailed("The file could not be decoded or was blocked (CORS).")}
      />

      {!playing && (
        <button className="big-play" type="button" aria-label="Play video" onClick={toggle}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 4l13 8-13 8z" />
          </svg>
        </button>
      )}

      <div className="player-controls">
        <div className="timeline-wrap">
          <span className="timeline-track" />
          <span className="timeline-played" style={{ width: duration ? `${(current / duration) * 100}%` : "0%" }} />
          <input
            className="timeline"
            type="range"
            min={0}
            max={1000}
            value={duration ? (current / duration) * 1000 : 0}
            aria-label="Video progress"
            onChange={(e) => {
              const v = videoRef.current;
              if (!v || !Number.isFinite(v.duration)) return;
              v.currentTime = (Number(e.target.value) / 1000) * v.duration;
            }}
          />
        </div>
        <div className="control-row">
          <button className="ctrl" type="button" aria-label={playing ? "Pause" : "Play"} onClick={toggle}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {playing ? <path className="fill" d="M8 5h3v14H8zM13 5h3v14h-3z" /> : <path className="fill" d="M7 4l13 8-13 8z" />}
            </svg>
          </button>
          <button
            className="ctrl skip"
            type="button"
            aria-label="Rewind 10 seconds"
            onClick={() => {
              if (videoRef.current) videoRef.current.currentTime -= 10;
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 10V5m0 0h5M4 5l3.5 3.5A7 7 0 1 1 5.2 15" />
            </svg>
            <b>10</b>
          </button>
          <button
            className="ctrl skip"
            type="button"
            aria-label="Forward 10 seconds"
            onClick={() => {
              if (videoRef.current) videoRef.current.currentTime += 10;
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 10V5m0 0h-5m5 0-3.5 3.5A7 7 0 1 0 18.8 15" />
            </svg>
            <b>10</b>
          </button>
          <button
            className="ctrl"
            type="button"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={() => {
              setMuted((m) => {
                if (videoRef.current) videoRef.current.muted = !m;
                return !m;
              });
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 9v6h4l5 4V5L9 9z" />
              <path d="M17 9a4 4 0 0 1 0 6" />
            </svg>
          </button>
          <input
            className="volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            aria-label="Volume"
            onChange={(e) => {
              const val = Number(e.target.value);
              setVolume(val);
              if (videoRef.current) {
                videoRef.current.volume = val;
                videoRef.current.muted = val === 0;
              }
            }}
          />
          <span className="time-readout">
            <span>{fmt(current)}</span> / <span>{fmt(duration)}</span>
          </span>
          <span className="control-spacer" />
          <span style={{ fontSize: 11, color: "#9a9da3", fontWeight: 900, textTransform: "uppercase", letterSpacing: ".06em" }}>
            {source.note ?? "Direct file"}
          </span>
        </div>
      </div>
    </>
  );
}
