import React from "react";
import { AbsoluteFill, Audio, Series, staticFile, useVideoConfig, interpolate, useCurrentFrame } from "remotion";
import { HeroScene } from "./scenes/HeroScene";
import { ProblemScene } from "./scenes/ProblemScene";
import { DashboardScene } from "./scenes/DashboardScene";
import { MapScene } from "./scenes/MapScene";
import { DemandIntelScene } from "./scenes/DemandIntelScene";
import { AlertsScene } from "./scenes/AlertsScene";
import { OutroScene } from "./scenes/OutroScene";
import { SCENE_DURATIONS } from "./Root";

const MUSIC_FILE = "background-music.mp3"; // place file in remotion-demo/public/

/**
 * Master composition: stitches all 7 scenes together using <Series>.
 * Scenes: Hero → Problem → Dashboard → Map → DemandIntel → Alerts → Outro
 * Each scene handles its own enter/exit transitions internally.
 */
export function ForecastWellDemo() {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  // Fade music in over first 1s, fade out over last 1.5s
  const fadeInEnd = fps * 1;                          // frame 30
  const fadeOutStart = durationInFrames - fps * 1.5;  // frame ~1605

  const musicVolume = interpolate(
    frame,
    [0, fadeInEnd, fadeOutStart, durationInFrames],
    [0, 0.45, 0.45, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ background: "#0A0E1A" }}>
      {/* Background music — plays across all scenes */}
      <Audio
        src={staticFile(MUSIC_FILE)}
        volume={musicVolume}
        // If your track is shorter than 55s, loop it:
        // loop
      />

      <Series>
        <Series.Sequence durationInFrames={SCENE_DURATIONS.hero}>
          <HeroScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENE_DURATIONS.problem}>
          <ProblemScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENE_DURATIONS.dashboard}>
          <DashboardScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENE_DURATIONS.map}>
          <MapScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENE_DURATIONS.demandIntel}>
          <DemandIntelScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENE_DURATIONS.alerts}>
          <AlertsScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENE_DURATIONS.outro}>
          <OutroScene />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
}
