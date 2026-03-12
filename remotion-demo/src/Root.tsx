import React from "react";
import { Composition } from "remotion";
import { HeroScene } from "./scenes/HeroScene";
import { ProblemScene } from "./scenes/ProblemScene";
import { DashboardScene } from "./scenes/DashboardScene";
import { MapScene } from "./scenes/MapScene";
import { DemandIntelScene } from "./scenes/DemandIntelScene";
import { AlertsScene } from "./scenes/AlertsScene";
import { OutroScene } from "./scenes/OutroScene";
import { ForecastWellDemo } from "./ForecastWellDemo";

// Video constants — 30fps, 1920×1080
export const VIDEO_FPS = 30;
export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;

// Scene durations in frames at 30fps
export const SCENE_DURATIONS = {
  hero: 240,         // 8s
  problem: 210,      // 7s
  dashboard: 240,    // 8s
  map: 210,          // 7s
  demandIntel: 240,  // 8s  ← Night-Priority Index + Wave Sequence
  alerts: 210,       // 7s
  outro: 300,        // 10s
} as const;

export const TOTAL_FRAMES =
  SCENE_DURATIONS.hero +
  SCENE_DURATIONS.problem +
  SCENE_DURATIONS.dashboard +
  SCENE_DURATIONS.map +
  SCENE_DURATIONS.demandIntel +
  SCENE_DURATIONS.alerts +
  SCENE_DURATIONS.outro; // 1650 frames = 55s

export function Root() {
  return (
    <>
      <Composition
        id="ForecastWellDemo"
        component={ForecastWellDemo}
        durationInFrames={TOTAL_FRAMES}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      {/* Individual scene previews for development */}
      <Composition
        id="HeroScene"
        component={HeroScene}
        durationInFrames={SCENE_DURATIONS.hero}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="ProblemScene"
        component={ProblemScene}
        durationInFrames={SCENE_DURATIONS.problem}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="DashboardScene"
        component={DashboardScene}
        durationInFrames={SCENE_DURATIONS.dashboard}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="MapScene"
        component={MapScene}
        durationInFrames={SCENE_DURATIONS.map}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="DemandIntelScene"
        component={DemandIntelScene}
        durationInFrames={SCENE_DURATIONS.demandIntel}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="AlertsScene"
        component={AlertsScene}
        durationInFrames={SCENE_DURATIONS.alerts}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="OutroScene"
        component={OutroScene}
        durationInFrames={SCENE_DURATIONS.outro}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
    </>
  );
}
