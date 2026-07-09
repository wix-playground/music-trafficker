import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import DiscoScene, { type SceneApi } from "./DiscoScene";
import type { VideoItem } from "./types";

type Phase = "idle" | "flying" | "playing" | "closing";

export default function DiscoExperience() {
  const [videos, setVideos] = useState<VideoItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [active, setActive] = useState<VideoItem | null>(null);
  const sceneApi = useRef<SceneApi | null>(null);

  useEffect(() => {
    fetch("/api/videos")
      .then((r) => r.json())
      .then((data) => {
        if (data?.videos?.length) setVideos(data.videos);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, []);

  const handleTakeoff = useCallback((video: VideoItem) => {
    setActive(video);
    setPhase("flying");
  }, []);

  const handleArrived = useCallback(() => setPhase("playing"), []);

  const handleLanded = useCallback(() => {
    setActive(null);
    setPhase("idle");
  }, []);

  const close = useCallback(() => {
    setPhase((current) => {
      if (current !== "playing") return current;
      // Fade the player out, then fly the tile back into the ball.
      window.setTimeout(() => sceneApi.current?.flyBack(), 240);
      return "closing";
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  if (failed) {
    return (
      <div className="disco-status">
        <p>The mirror ball lost its playlist. Try refreshing.</p>
      </div>
    );
  }

  if (!videos) {
    return (
      <div className="disco-status">
        <div className="disco-loader" />
        <p>warming up the mirror ball…</p>
      </div>
    );
  }

  return (
    <div className="disco-stage">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        camera={{ fov: 42, position: [0, 0.35, 11], near: 0.1, far: 50 }}
      >
        <Suspense fallback={null}>
          <DiscoScene
            videos={videos}
            interactive={phase === "idle"}
            apiRef={sceneApi}
            onTakeoff={handleTakeoff}
            onArrived={handleArrived}
            onLanded={handleLanded}
          />
        </Suspense>
      </Canvas>

      <header className={`disco-header ${phase === "idle" ? "" : "hidden"}`}>
        <h1>MUSIC TRAFFICKER</h1>
        <p>a spinning ball of songs — click a window to play</p>
      </header>

      {active && (phase === "playing" || phase === "closing") && (
        <div className={`disco-player ${phase === "playing" ? "visible" : ""}`}>
          <iframe
            src={`https://www.youtube.com/embed/${active.id}?autoplay=1&start=0&rel=0&playsinline=1`}
            title={active.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          />
          <div className="disco-player-title">{active.title}</div>
          <button className="disco-close" onClick={close} aria-label="Back to the disco ball">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
