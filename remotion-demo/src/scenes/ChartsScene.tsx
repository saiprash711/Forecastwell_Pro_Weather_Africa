import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, useFade, useSlideUp, useEntrySpring, SPRING_CONFIGS } from "../utils/animations";

// Synthetic temperature data for 30 days
const ACTUAL_TEMPS = [
  26, 27, 28, 28.5, 29, 28, 27.5, 28.5, 30, 31, 32, 31.5, 30, 29, 28.5,
  29, 30, 31, 32.5, 33, 33.5, 32, 31, 30.5, 31, 32, 33, 34, 33.5, 32,
];

const FORECAST_TEMPS = [
  null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
  null, null, null, null, null, null, null, null, null, 31.5, 33, 34, 35, 35.5, 34.5,
  35, 36, 36, 35, 34, 35.5, 36.5, 37, 36, 35,
].slice(0, 30);

const DEMAND_DATA = [
  45, 48, 52, 54, 57, 50, 48, 55, 65, 70, 75, 73, 66, 60, 58,
  62, 68, 72, 78, 82, 85, 80, 74, 71, 73, 78, 84, 90, 88, 85,
];

const SVG_W = 900;
const SVG_H = 220;
const PAD = { top: 20, right: 20, bottom: 30, left: 50 };

function scaleX(i: number, total: number) {
  return PAD.left + (i / (total - 1)) * (SVG_W - PAD.left - PAD.right);
}

function scaleY(val: number, min: number, max: number) {
  return PAD.top + (1 - (val - min) / (max - min)) * (SVG_H - PAD.top - PAD.bottom);
}

function buildPath(data: (number | null)[], min: number, max: number, total: number): string {
  let path = "";
  data.forEach((v, i) => {
    if (v === null) return;
    const x = scaleX(i, total);
    const y = scaleY(v, min, max);
    path += path === "" ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });
  return path;
}

/**
 * Scene 5 — Temperature Trend Charts (8s / 240 frames)
 */
export function ChartsScene() {
  const frame = useCurrentFrame();

  const exitOpacity = interpolate(frame, [215, 238], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headingOpacity = useFade(8, 38);
  const headingY = useSlideUp(8, 60);

  // Chart reveal progress
  const chartReveal = interpolate(frame, [35, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const demandReveal = interpolate(frame, [80, 175], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const tempMin = 24, tempMax = 38;
  const demandMin = 40, demandMax = 100;

  // Build partial paths for animation
  const actualPoints = ACTUAL_TEMPS.filter((_, i) => i <= Math.floor(chartReveal * (ACTUAL_TEMPS.length - 1)));
  const forecastPoints = FORECAST_TEMPS.filter((v, i) => v !== null && i <= Math.floor(chartReveal * (FORECAST_TEMPS.length - 1)));

  const actualPath = buildPath(
    ACTUAL_TEMPS.map((v, i) => (i <= Math.floor(chartReveal * (ACTUAL_TEMPS.length - 1)) ? v : null)),
    tempMin, tempMax, ACTUAL_TEMPS.length
  );

  const forecastPath = buildPath(
    FORECAST_TEMPS.map((v, i) => (i <= Math.floor(chartReveal * (FORECAST_TEMPS.length - 1)) ? v : null)),
    tempMin, tempMax, FORECAST_TEMPS.length
  );

  const demandPath = buildPath(
    DEMAND_DATA.map((v, i) => (i <= Math.floor(demandReveal * (DEMAND_DATA.length - 1)) ? v : null)),
    demandMin, demandMax, DEMAND_DATA.length
  );

  const chartPanelSpring = useEntrySpring(25, SPRING_CONFIGS.gentle);
  const chartPanelOpacity = interpolate(chartPanelSpring, [0, 1], [0, 1]);
  const chartPanelY = interpolate(chartPanelSpring, [0, 1], [50, 0]);

  const demand2Spring = useEntrySpring(70, SPRING_CONFIGS.gentle);
  const demand2Opacity = interpolate(demand2Spring, [0, 1], [0, 1]);
  const demand2Y = interpolate(demand2Spring, [0, 1], [50, 0]);

  // Insight callout
  const insightOpacity = useFade(140, 170);
  const insightY = useSlideUp(140, 30);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 60% 20%, #0D1B35 0%, ${COLORS.navy} 65%)`,
        opacity: exitOpacity,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "50px 100px",
        gap: 24,
      }}
    >
      {/* Heading */}
      <div style={{ opacity: headingOpacity, transform: `translateY(${headingY}px)`, textAlign: "center" }}>
        <div style={{ display: "inline-flex", gap: 10, alignItems: "center", background: "rgba(37,99,235,0.12)", border: `1px solid rgba(59,130,246,0.3)`, borderRadius: 100, padding: "8px 20px", marginBottom: 16 }}>
          <span style={{ fontSize: 18, fontFamily: "system-ui, sans-serif", color: COLORS.blueLight, fontWeight: 700, letterSpacing: 1 }}>FEATURE 02</span>
        </div>
        <h2 style={{ fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 54, fontWeight: 800, color: COLORS.white, margin: 0, letterSpacing: -1 }}>
          Temperature & Demand{" "}
          <span style={{ background: `linear-gradient(135deg, ${COLORS.amber}, ${COLORS.rose})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Trend Charts
          </span>
        </h2>
      </div>

      {/* Temperature chart */}
      <div
        style={{
          width: "100%",
          opacity: chartPanelOpacity,
          transform: `translateY(${chartPanelY}px)`,
          background: COLORS.navyCard,
          border: `1px solid ${COLORS.navyBorder}`,
          borderRadius: 16,
          padding: "24px 28px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: COLORS.white }}>Night Temperature — Chennai (30 Days)</span>
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <Legend color={COLORS.blueLight} label="Actual" />
            <Legend color={COLORS.amber} label="IMD Forecast" dashed />
          </div>
        </div>

        <svg width="100%" height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="none">
          {/* Y-axis labels */}
          {[26, 30, 34, 38].map((t) => (
            <g key={t}>
              <line x1={PAD.left} y1={scaleY(t, tempMin, tempMax)} x2={SVG_W - PAD.right} y2={scaleY(t, tempMin, tempMax)} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
              <text x={PAD.left - 8} y={scaleY(t, tempMin, tempMax) + 5} textAnchor="end" fontFamily="system-ui" fontSize={13} fill={COLORS.dimmed}>{t}°</text>
            </g>
          ))}

          {/* Area fill — actual */}
          <defs>
            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.blueLight} stopOpacity={0.3} />
              <stop offset="100%" stopColor={COLORS.blueLight} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.amber} stopOpacity={0.2} />
              <stop offset="100%" stopColor={COLORS.amber} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Actual line */}
          <path d={actualPath} fill="none" stroke={COLORS.blueLight} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

          {/* Forecast line (dashed) */}
          <path d={forecastPath} fill="none" stroke={COLORS.amber} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8,5" />

          {/* Heat-wave threshold */}
          <line
            x1={PAD.left}
            y1={scaleY(32, tempMin, tempMax)}
            x2={SVG_W - PAD.right}
            y2={scaleY(32, tempMin, tempMax)}
            stroke={COLORS.rose}
            strokeWidth={1.5}
            strokeDasharray="6,4"
            opacity={0.7}
          />
          <text x={SVG_W - PAD.right + 4} y={scaleY(32, tempMin, tempMax) + 5} fontFamily="system-ui" fontSize={12} fill={COLORS.rose}>Trigger</text>
        </svg>
      </div>

      {/* Demand index chart + insight */}
      <div style={{ width: "100%", display: "flex", gap: 20 }}>
        <div
          style={{
            flex: 1,
            opacity: demand2Opacity,
            transform: `translateY(${demand2Y}px)`,
            background: COLORS.navyCard,
            border: `1px solid ${COLORS.navyBorder}`,
            borderRadius: 16,
            padding: "24px 28px",
          }}
        >
          <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: COLORS.white, display: "block", marginBottom: 14 }}>
            Demand Index — All Cities
          </span>
          <svg width="100%" height={140} viewBox={`0 0 ${SVG_W} ${140}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="demGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.emerald} stopOpacity={0.4} />
                <stop offset="100%" stopColor={COLORS.emerald} stopOpacity={0} />
              </linearGradient>
            </defs>
            {/* Area */}
            <path
              d={`${demandPath} L ${scaleX(Math.floor(demandReveal * (DEMAND_DATA.length - 1)), DEMAND_DATA.length)} ${140 - 30} L ${PAD.left} ${140 - 30} Z`}
              fill="url(#demGrad)"
            />
            <path d={demandPath} fill="none" stroke={COLORS.emerald} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* AI Insight callout */}
        <div
          style={{
            flex: "0 0 340px",
            opacity: insightOpacity,
            transform: `translateY(${insightY}px)`,
            background: `linear-gradient(135deg, rgba(37,99,235,0.15) 0%, rgba(16,185,129,0.08) 100%)`,
            border: `1px solid rgba(59,130,246,0.3)`,
            borderRadius: 16,
            padding: "28px 28px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 16,
          }}
        >
          <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: 700, color: COLORS.blueLight, letterSpacing: 1, textTransform: "uppercase" }}>
            AI Insight
          </div>
          <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 22, fontWeight: 700, color: COLORS.white, lineHeight: 1.4 }}>
            Demand surge predicted{" "}
            <span style={{ color: COLORS.amber }}>next 10 days</span> for Chennai & Hyderabad
          </div>
          <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 16, color: COLORS.muted, lineHeight: 1.5 }}>
            Night temps above 32°C threshold are forecast for 8 of the next 10 days.
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(16,185,129,0.15)",
              border: `1px solid rgba(16,185,129,0.3)`,
              borderRadius: 8,
              padding: "10px 16px",
              fontFamily: "system-ui, sans-serif",
              fontSize: 16,
              fontWeight: 600,
              color: COLORS.emerald,
            }}
          >
            ▲ Increase channel stock by 18%
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <svg width={28} height={12}>
        <line x1={0} y1={6} x2={28} y2={6} stroke={color} strokeWidth={2.5} strokeDasharray={dashed ? "6,4" : undefined} strokeLinecap="round" />
      </svg>
      <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 15, color: COLORS.muted }}>{label}</span>
    </div>
  );
}
