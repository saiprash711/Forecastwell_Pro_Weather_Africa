import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, useFade, useSlideUp, useEntrySpring, staggerDelay, SPRING_CONFIGS, useCountUp } from "../utils/animations";

const ALERTS = [
  {
    priority: "HIGH",
    city: "Chennai",
    type: "Demand Acceleration",
    message: "Night temp exceeded 32°C threshold for 3 consecutive days. AC demand projected +28%.",
    action: "Increase distributor stock allocation by 20%",
    color: COLORS.rose,
    icon: "🔥",
    time: "2 hrs ago",
  },
  {
    priority: "HIGH",
    city: "Hyderabad",
    type: "Demand Acceleration",
    message: "Heat dome pattern detected. Demand index at 82/100 and rising.",
    action: "Activate emergency procurement from warehouse",
    color: COLORS.amber,
    icon: "⚡",
    time: "4 hrs ago",
  },
  {
    priority: "MEDIUM",
    city: "Bangalore",
    type: "Demand Watch",
    message: "Temperatures approaching trigger threshold. Monitor next 48 hours.",
    action: "Pre-position stock at regional depot",
    color: COLORS.blueLight,
    icon: "👁️",
    time: "6 hrs ago",
  },
];

const STATS = [
  { label: "Alerts Fired", value: 47, suffix: "", color: COLORS.rose },
  { label: "Accuracy", value: 94, suffix: "%", color: COLORS.emerald },
  { label: "Avg Lead Time", value: 12, suffix: "d", color: COLORS.amber },
];

/**
 * Scene 6 — Alert System (7s / 210 frames)
 */
export function AlertsScene() {
  const frame = useCurrentFrame();

  const exitOpacity = interpolate(frame, [185, 208], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headingOpacity = useFade(8, 38);
  const headingY = useSlideUp(8, 60);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 30% 70%, #1A0D20 0%, ${COLORS.navy} 60%)`,
        opacity: exitOpacity,
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(244,63,94,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(244,63,94,0.02) 1px, transparent 1px)`, backgroundSize: "80px 80px" }} />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "50px 100px",
          gap: 28,
        }}
      >
        {/* Heading row */}
        <div style={{ opacity: headingOpacity, transform: `translateY(${headingY}px)`, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ display: "inline-flex", gap: 10, alignItems: "center", background: "rgba(244,63,94,0.12)", border: `1px solid rgba(244,63,94,0.3)`, borderRadius: 100, padding: "8px 20px", marginBottom: 16 }}>
              <span style={{ fontSize: 18, fontFamily: "system-ui, sans-serif", color: COLORS.rose, fontWeight: 700, letterSpacing: 1 }}>FEATURE 03</span>
            </div>
            <h2 style={{ fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 58, fontWeight: 800, color: COLORS.white, margin: 0, letterSpacing: -1, lineHeight: 1.1 }}>
              Intelligent{" "}
              <span style={{ background: `linear-gradient(135deg, ${COLORS.rose}, ${COLORS.amber})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Alert Engine
              </span>
              <br />
              <span style={{ fontSize: 36, color: COLORS.muted, fontWeight: 500 }}>
                + AI Action Recommendations
              </span>
            </h2>
          </div>
          {/* Stats */}
          <div style={{ display: "flex", gap: 20 }}>
            {STATS.map((s, i) => (
              <StatBadge key={i} {...s} delay={30 + i * 18} frame={frame} />
            ))}
          </div>
        </div>

        {/* Alert cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>
          {ALERTS.map((alert, i) => (
            <AlertCard key={i} alert={alert} index={i} />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function StatBadge({
  label,
  value,
  suffix,
  color,
  delay,
  frame,
}: {
  label: string;
  value: number;
  suffix: string;
  color: string;
  delay: number;
  frame: number;
}) {
  const sp = useEntrySpring(delay, SPRING_CONFIGS.snappy);
  const opacity = interpolate(sp, [0, 1], [0, 1]);
  const y = interpolate(sp, [0, 1], [20, 0]);
  const count = useCountUp(value, delay, delay + 60);

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        background: COLORS.navyCard,
        border: `1px solid ${COLORS.navyBorder}`,
        borderTop: `2px solid ${color}`,
        borderRadius: 12,
        padding: "16px 24px",
        textAlign: "center",
        minWidth: 120,
      }}
    >
      <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 36, fontWeight: 800, color }}>
        {count}{suffix}
      </div>
      <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, color: COLORS.muted, marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

function AlertCard({ alert, index }: { alert: typeof ALERTS[0]; index: number }) {
  const delay = 45 + staggerDelay(index, 28);
  const sp = useEntrySpring(delay, SPRING_CONFIGS.smooth);
  const opacity = interpolate(sp, [0, 1], [0, 1]);
  const x = interpolate(sp, [0, 1], [-50, 0]);

  const priorityColors: Record<string, string> = {
    HIGH: COLORS.rose,
    MEDIUM: COLORS.amber,
    LOW: COLORS.blueLight,
  };
  const pColor = priorityColors[alert.priority] ?? COLORS.muted;

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${x}px)`,
        background: COLORS.navyCard,
        border: `1px solid ${COLORS.navyBorder}`,
        borderLeft: `3px solid ${alert.color}`,
        borderRadius: 14,
        padding: "20px 28px",
        display: "flex",
        gap: 20,
        alignItems: "flex-start",
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: `${alert.color}18`,
          border: `1px solid ${alert.color}40`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
          flexShrink: 0,
        }}
      >
        {alert.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <span
            style={{
              background: `${pColor}20`,
              border: `1px solid ${pColor}50`,
              color: pColor,
              fontFamily: "system-ui, sans-serif",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.2,
              padding: "3px 10px",
              borderRadius: 100,
            }}
          >
            {alert.priority}
          </span>
          <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: COLORS.white }}>
            {alert.city} — {alert.type}
          </span>
          <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, color: COLORS.dimmed, marginLeft: "auto" }}>
            {alert.time}
          </span>
        </div>
        <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 16, color: COLORS.muted, margin: "0 0 10px", lineHeight: 1.5 }}>
          {alert.message}
        </p>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(16,185,129,0.1)",
            border: `1px solid rgba(16,185,129,0.25)`,
            borderRadius: 8,
            padding: "8px 14px",
            fontFamily: "system-ui, sans-serif",
            fontSize: 14,
            fontWeight: 600,
            color: COLORS.emerald,
          }}
        >
          <span>✓</span> Recommended Action: {alert.action}
        </div>
      </div>
    </div>
  );
}
