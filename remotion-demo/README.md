# ForecastWell – Product Demo Video (Remotion)

A **55-second, 1920×1080, 30fps** product demo video for the ForecastWell Dashboard,
built entirely with [Remotion](https://www.remotion.dev/).

---

## Video Structure

| # | Scene | Duration | Frames |
|---|-------|----------|--------|
| 1 | Hero – Brand reveal | 8s | 0–240 |
| 2 | Problem – Why weather matters | 7s | 240–450 |
| 3 | Dashboard Overview | 8s | 450–690 |
| 4 | Feature 01: South India Map | 7s | 690–900 |
| 5 | Feature 02: Temperature & Demand Charts | 8s | 900–1140 |
| 6 | Feature 03: Alert Engine | 7s | 1140–1350 |
| 7 | Outro – CTA & brand close | 10s | 1350–1650 |

**Total: 55 seconds · 1650 frames**

---

## Quick Start

### 1. Install dependencies

```bash
cd remotion-demo
npm install
```

### 2. Open Remotion Studio (live preview)

```bash
npm run start
```

Opens `http://localhost:3000`. You can scrub through all scenes and preview each
composition individually (HeroScene, MapScene, etc.).

### 3. Render to MP4

```bash
npm run render
```

Output: `out/forecastwell-demo.mp4`

### 4. Render thumbnail (frame 0)

```bash
npm run still
```

Output: `out/thumbnail.png`

---

## Other render targets

| Command | Output |
|---------|--------|
| `npm run render` | `out/forecastwell-demo.mp4` (H.264, CRF 18) |
| `npm run render:webm` | `out/forecastwell-demo.webm` (VP8) |
| `npm run render:gif` | `out/forecastwell-demo.gif` (optimised) |

---

## Project Structure

```
remotion-demo/
├── src/
│   ├── index.ts                  Entry point (registerRoot)
│   ├── Root.tsx                  All Composition registrations
│   ├── ForecastWellDemo.tsx      Master video (Series of all scenes)
│   ├── scenes/
│   │   ├── HeroScene.tsx         Scene 1 – Brand hero
│   │   ├── ProblemScene.tsx      Scene 2 – Problem statement
│   │   ├── DashboardScene.tsx    Scene 3 – Dashboard overview
│   │   ├── MapScene.tsx          Scene 4 – South India city map
│   │   ├── ChartsScene.tsx       Scene 5 – Temperature trend charts
│   │   ├── AlertsScene.tsx       Scene 6 – Alert engine
│   │   └── OutroScene.tsx        Scene 7 – CTA / outro
│   └── utils/
│       └── animations.ts         Spring helpers, interpolation utils, brand palette
├── remotion.config.ts
├── tsconfig.json
└── package.json
```

---

## Customisation

### Brand colours (`src/utils/animations.ts`)
All brand tokens live in the `COLORS` object. Swap any hex value to retheme the
entire video instantly.

### Scene durations (`src/Root.tsx`)
Edit `SCENE_DURATIONS` to lengthen or shorten individual scenes. The master
composition recalculates the total automatically.

### Copy & data
- **City temperatures** — edit the `CITIES` array in `MapScene.tsx`
- **Chart data** — edit `ACTUAL_TEMPS` / `DEMAND_DATA` in `ChartsScene.tsx`
- **Alert messages** — edit the `ALERTS` array in `AlertsScene.tsx`
- **CTA URL** — update `forecastwell.hansei.in` in `OutroScene.tsx`

---

## Requirements

- Node.js ≥ 18
- `npm` (or `pnpm` / `yarn`)
- For video render: ffmpeg is bundled with Remotion — no separate install needed.

---

*Built with [Remotion 4](https://www.remotion.dev/) · Hansei Consultancy 2026*
