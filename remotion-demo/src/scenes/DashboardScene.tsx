import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, useFade, useSlideUp, useEntrySpring, SPRING_CONFIGS, staggerDelay } from "../utils/animations";

const METRICS = [
  { label: "Cities Monitored", value: "60", delta: "All India", up: true, color: COLORS.blueLight },
  { label: "Peak Demand Index", value: "94/100", delta: "Delhi + Chennai RED", up: true, color: COLORS.rose },
  { label: "Wave Status", value: "Wave 1", delta: "Active NOW", up: true, color: COLORS.amber },
  { label: "Open Alerts", value: "11", delta: "3 critical", up: false, color: COLORS.rose },
];

/**
 * Scene 3 — Dashboard Overview (8s / 240 frames)
 * Stylised browser mockup with 8-page nav and animated KPI cards.
 */
export function DashboardScene() {
  const frame = useCurrentFrame();

  const exitOpacity = interpolate(frame, [215, 238], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headingOpacity = useFade(8, 38);
  const headingY = useSlideUp(8, 60);

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
        padding: "55px 80px",
        gap: 36,
      }}
    >
      <div style={{ position: "absolute", width: 700, height: 700, borderRadius: "50%", background: `radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)`, top: -200, left: -150, pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)`, bottom: -100, right: -100, pointerEvents: "none" }} />

      {/* Section heading */}
      <div style={{ opacity: headingOpacity, transform: `translateY(${headingY}px)`, textAlign: "center" }}>
        <div style={{ display: "inline-flex", gap: 10, alignItems: "center", background: "rgba(37,99,235,0.12)", border: `1px solid rgba(59,130,246,0.3)`, borderRadius: 100, padding: "8px 20px", marginBottom: 16 }}>
          <span style={{ fontSize: 18, fontFamily: "system-ui, sans-serif", color: COLORS.blueLight, fontWeight: 700, letterSpacing: 1 }}>THE SOLUTION</span>
        </div>
        <h2 style={{ fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 58, fontWeight: 800, color: COLORS.white, margin: 0, letterSpacing: -1 }}>
          8 intelligence pages.{" "}
          <span style={{ background: `linear-gradient(135deg, ${COLORS.blueLight}, ${COLORS.emerald})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            One platform.
          </span>
        </h2>
      </div>

      {/* Browser mockup */}
      <div
        style={{
          opacity: browserOpacity,
          transform: `translateY(${browserY}px)`,
          width: "100%",
          maxWidth: 1600,
          background: COLORS.navyCard,
          borderRadius: 20,
          border: `1px solid ${COLORS.navyBorder}`,
          boxShadow: "0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
          overflow: "hidden",
        }}
      >
        <BrowserChrome />

        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
          <DashboardNav />

          <div style={{ display: "flex", gap: 18 }}>
            {METRICS.map((m, i) => (
              <MetricCard key={i} {...m} delay={50 + staggerDelay(i, 16)} />
            ))}
          </div>

          <ChartPlaceholder delay={115} frame={frame} />
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

function DashboardNav() {
  const opacity = useFade(35, 60);
  // The real 8 pages of the ForecastWell app
  const pages = ["Overview", "Analytics", "Forecasting", "Cities", "Alerts", "Insights", "Demand Intel", "Reports"];
  return (
    <div style={{ opacity, display: "flex", alignItems: "center", gap: 5, borderBottom: `1px solid ${COLORS.navyBorder}`, paddingBottom: 14 }}>
      <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 19, fontWeight: 700, color: COLORS.white, marginRight: 10, whiteSpace: "nowrap" }}>
        ForecastWell
      </span>
      {pages.map((t, i) => (
        <div
          key={i}
          style={{
            padding: "7px 13px",
            borderRadius: 8,
            background: i === 0 ? COLORS.blueSoft : "transparent",
            border: i === 0 ? `1px solid rgba(37,99,235,0.4)` : "none",
            fontFamily: "system-ui, sans-serif",
            fontSize: 14,
            color: i === 0 ? COLORS.blueLight : COLORS.dimmed,
            fontWeight: i === 0 ? 600 : 400,
            whiteSpace: "nowrap",
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
        padding: "18px 22px",
      }}
    >
      <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, color: COLORS.muted, marginBottom: 8, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 30, fontWeight: 800, color: COLORS.white, marginBottom: 6 }}>
        {value}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontFamily: "system-ui, sans-serif",
          fontSize: 13,
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

  const barHeights = [38, 52, 46, 60, 72, 58, 78, 68, 85, 92, 80, 96];
  const barsReveal = interpolate(frame, [delay + 10, delay + 75], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const waveOpacity = interpolate(frame, [delay + 60, delay + 85], [0, 1], {
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
        padding: "20px 24px",
        height: 200,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 16, fontWeight: 600, color: COLORS.white }}>
          Demand Index — All India City Ranking (Top 12)
        </span>
        <div style={{ display: "flex", gap: 14 }}>
          {([[COLORS.rose, "RED Zone"], [COLORS.amber, "AMBER Zone"], [COLORS.emerald, "GREEN Zone"]] as [string, string][]).map(([color, label]) => (
            <span key={label} style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, color }}>■ {label}</span>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 8 }}>
        {barHeights.map((h, i) => {
          const barColor = h > 70 ? COLORS.rose : h > 40 ? COLORS.amber : COLORS.emerald;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${h * barsReveal}%`,
                background: `linear-gradient(to top, ${barColor}60, ${barColor})`,
                borderRadius: "3px 3px 0 0",
              }}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 20, opacity: waveOpacity }}>
        {([["Wave 1 — Active NOW", COLORS.rose], ["Wave 2 — +2 Weeks", COLORS.amber], ["Wave 3 — +6 Weeks", COLORS.blueLight]] as [string, string][]).map(([label, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
            <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, color: COLORS.muted }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
