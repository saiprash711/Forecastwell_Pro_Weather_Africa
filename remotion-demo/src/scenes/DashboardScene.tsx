import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, useFade, useSlideUp, useEntrySpring, SPRING_CONFIGS, staggerDelay } from "../utils/animations";

const METRICS = [
  { label: "Avg. Night Temp", value: "28.4°C", delta: "+2.1°C", up: true, color: COLORS.amber },
  { label: "Demand Index", value: "87/100", delta: "+12 pts", up: true, color: COLORS.emerald },
  { label: "Cities Monitored", value: "6", delta: "Live", up: true, color: COLORS.blueLight },
  { label: "Active Alerts", value: "3", delta: "High priority", up: false, color: COLORS.rose },
];

/**
 * Scene 3 — Dashboard Overview (8s / 240 frames)
 * Shows a stylised "browser window" with the dashboard UI animating in.
 */
export function DashboardScene() {
  const frame = useCurrentFrame();

  const exitOpacity = interpolate(frame, [215, 238], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Heading
  const headingOpacity = useFade(8, 38);
  const headingY = useSlideUp(8, 60);

  // Browser window springs in
  const browserSpring = useEntrySpring(25, SPRING_CONFIGS.gentle);
  const browserY = interpolate(browserSpring, [0, 1], [80, 0]);
  const browserOpacity = interpolate(browserSpring, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 0%, #0D1B35 0%, ${COLORS.navy} 70%)`,
        opacity: exitOpacity,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 80px",
        gap: 40,
      }}
    >
      {/* Orbs */}
      <div style={{ position: "absolute", width: 700, height: 700, borderRadius: "50%", background: `radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)`, top: -200, left: -150, pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)`, bottom: -100, right: -100, pointerEvents: "none" }} />

      {/* Section heading */}
      <div style={{ opacity: headingOpacity, transform: `translateY(${headingY}px)`, textAlign: "center" }}>
        <div style={{ display: "inline-flex", gap: 10, alignItems: "center", background: "rgba(37,99,235,0.12)", border: `1px solid rgba(59,130,246,0.3)`, borderRadius: 100, padding: "8px 20px", marginBottom: 16 }}>
          <span style={{ fontSize: 18, fontFamily: "system-ui, sans-serif", color: COLORS.blueLight, fontWeight: 700, letterSpacing: 1 }}>THE SOLUTION</span>
        </div>
        <h2 style={{ fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 60, fontWeight: 800, color: COLORS.white, margin: 0, letterSpacing: -1 }}>
          One dashboard. Complete{" "}
          <span style={{ background: `linear-gradient(135deg, ${COLORS.blueLight}, ${COLORS.emerald})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            weather intelligence.
          </span>
        </h2>
      </div>

      {/* Browser mockup */}
      <div
        style={{
          opacity: browserOpacity,
          transform: `translateY(${browserY}px)`,
          width: "100%",
          maxWidth: 1500,
          background: COLORS.navyCard,
          borderRadius: 20,
          border: `1px solid ${COLORS.navyBorder}`,
          boxShadow: "0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
          overflow: "hidden",
        }}
      >
        {/* Browser chrome */}
        <BrowserChrome />

        {/* Dashboard content */}
        <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Nav bar */}
          <DashboardNav frame={frame} />

          {/* Metric cards row */}
          <div style={{ display: "flex", gap: 20 }}>
            {METRICS.map((m, i) => (
              <MetricCard key={i} {...m} delay={55 + staggerDelay(i, 18)} />
            ))}
          </div>

          {/* Chart area placeholder */}
          <ChartPlaceholder delay={120} frame={frame} />
        </div>
      </div>
    </AbsoluteFill>
  );
}

function BrowserChrome() {
  return (
    <div
      style={{
        background: "#0D1221",
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        borderBottom: `1px solid ${COLORS.navyBorder}`,
      }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c, i) => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: c }} />
        ))}
      </div>
      <div
        style={{
          flex: 1,
          background: COLORS.navyLight,
          border: `1px solid ${COLORS.navyBorder}`,
          borderRadius: 8,
          padding: "8px 16px",
          fontFamily: "monospace",
          fontSize: 15,
          color: COLORS.muted,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ color: COLORS.emerald }}>🔒</span>
        forecastwell.hansei.in/dashboard
      </div>
    </div>
  );
}

function DashboardNav({ frame }: { frame: number }) {
  const opacity = useFade(35, 60);
  const tabs = ["Overview", "Temperature Trends", "City Details", "Alerts", "Reports"];
  return (
    <div style={{ opacity, display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${COLORS.navyBorder}`, paddingBottom: 16 }}>
      <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 22, fontWeight: 700, color: COLORS.white, marginRight: 16 }}>ForecastWell</span>
      {tabs.map((t, i) => (
        <div
          key={i}
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            background: i === 0 ? COLORS.blueSoft : "transparent",
            border: i === 0 ? `1px solid rgba(37,99,235,0.4)` : "none",
            fontFamily: "system-ui, sans-serif",
            fontSize: 16,
            color: i === 0 ? COLORS.blueLight : COLORS.dimmed,
            fontWeight: i === 0 ? 600 : 400,
          }}
        >
          {t}
        </div>
      ))}
    </div>
  );
}

function MetricCard({
  label,
  value,
  delta,
  up,
  color,
  delay,
}: {
  label: string;
  value: string;
  delta: string;
  up: boolean;
  color: string;
  delay: number;
}) {
  const sp = useEntrySpring(delay, SPRING_CONFIGS.snappy);
  const opacity = interpolate(sp, [0, 1], [0, 1]);
  const y = interpolate(sp, [0, 1], [30, 0]);

  return (
    <div
      style={{
        flex: 1,
        opacity,
        transform: `translateY(${y}px)`,
        background: COLORS.navyLight,
        border: `1px solid ${COLORS.navyBorder}`,
        borderTop: `2px solid ${color}`,
        borderRadius: 12,
        padding: "20px 24px",
      }}
    >
      <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, color: COLORS.muted, marginBottom: 8, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 32, fontWeight: 800, color: COLORS.white, marginBottom: 6 }}>
        {value}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontFamily: "system-ui, sans-serif",
          fontSize: 14,
          color: up ? COLORS.emerald : COLORS.rose,
          fontWeight: 600,
        }}
      >
        {up ? "▲" : "▼"} {delta}
      </div>
    </div>
  );
}

function ChartPlaceholder({ delay, frame }: { delay: number; frame: number }) {
  const sp = useEntrySpring(delay, SPRING_CONFIGS.gentle);
  const opacity = interpolate(sp, [0, 1], [0, 1]);
  const y = interpolate(sp, [0, 1], [40, 0]);

  // Animate a simple bar chart inside
  const barHeights = [40, 55, 48, 62, 70, 58, 75, 68, 82, 90, 78, 95];
  const barsReveal = interpolate(frame, [delay + 10, delay + 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        background: COLORS.navyLight,
        border: `1px solid ${COLORS.navyBorder}`,
        borderRadius: 12,
        padding: "24px 28px",
        height: 220,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 18, fontWeight: 600, color: COLORS.white }}>
          Night Temperature Trend — Chennai
        </span>
        <div style={{ display: "flex", gap: 16 }}>
          {[["─── Actual", COLORS.blueLight], ["─── Forecast", COLORS.amber]].map(([label, color]) => (
            <span key={label as string} style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, color: color as string }}>
              {label as string}
            </span>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 10, paddingTop: 8 }}>
        {barHeights.map((h, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${h * barsReveal}%`,
              background: i < 8
                ? `linear-gradient(to top, ${COLORS.blue}, ${COLORS.blueLight})`
                : `linear-gradient(to top, rgba(245,158,11,0.4), rgba(245,158,11,0.8))`,
              borderRadius: "4px 4px 0 0",
              position: "relative",
            }}
          />
        ))}
      </div>
    </div>
  );
}
