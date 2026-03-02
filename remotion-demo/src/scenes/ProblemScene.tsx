import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, useFade, useSlideUp, useEntrySpring, staggerDelay, SPRING_CONFIGS } from "../utils/animations";

const PAIN_POINTS = [
  {
    icon: "📊",
    title: "Blind Inventory Planning",
    desc: "AC demand swings ±40% with temperature — but most teams plan on gut feel.",
    color: COLORS.rose,
  },
  {
    icon: "🌡️",
    title: "Missed Heat Waves",
    desc: "A 2°C spike in night temps triggers demand surges. You're 2 weeks behind.",
    color: COLORS.amber,
  },
  {
    icon: "🏭",
    title: "Production Lag",
    desc: "Factories need 3–6 week lead time. Without foresight, you lose the season.",
    color: COLORS.blueLight,
  },
];

/**
 * Scene 2 — Problem Statement (7s / 210 frames)
 */
export function ProblemScene() {
  const frame = useCurrentFrame();

  const exitOpacity = interpolate(frame, [185, 208], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headingOpacity = useFade(10, 40);
  const headingY = useSlideUp(10, 70);

  const subOpacity = useFade(35, 65);
  const subY = useSlideUp(35, 40);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 70% 30%, #0F1E3D 0%, ${COLORS.navy} 65%)`,
        opacity: exitOpacity,
        overflow: "hidden",
      }}
    >
      {/* Subtle grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(37,99,235,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(37,99,235,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Two-column layout */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          padding: "0 120px",
          gap: 100,
        }}
      >
        {/* Left: headline */}
        <div style={{ flex: "0 0 520px" }}>
          <div style={{ opacity: headingOpacity, transform: `translateY(${headingY}px)` }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                background: "rgba(244,63,94,0.12)",
                border: `1px solid rgba(244,63,94,0.3)`,
                borderRadius: 100,
                padding: "8px 20px",
                marginBottom: 28,
              }}
            >
              <span style={{ fontSize: 18, fontFamily: "system-ui, sans-serif", color: COLORS.rose, fontWeight: 700, letterSpacing: 1 }}>
                THE PROBLEM
              </span>
            </div>
            <h2
              style={{
                fontFamily: "system-ui, -apple-system, sans-serif",
                fontSize: 72,
                fontWeight: 800,
                color: COLORS.white,
                margin: 0,
                lineHeight: 1.1,
                letterSpacing: -1.5,
              }}
            >
              Weather moves
              <br />
              <span
                style={{
                  background: `linear-gradient(135deg, ${COLORS.rose} 0%, ${COLORS.amber} 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                demand.
              </span>
              <br />
              <span style={{ fontSize: 52, fontWeight: 600, color: COLORS.muted }}>
                Are you ready?
              </span>
            </h2>
          </div>
          <div style={{ opacity: subOpacity, transform: `translateY(${subY}px)`, marginTop: 32 }}>
            <p
              style={{
                fontFamily: "system-ui, sans-serif",
                fontSize: 22,
                color: COLORS.muted,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              South India's HVAC market is uniquely sensitive to temperature — especially night temperatures.
              Most companies are flying blind.
            </p>
          </div>
        </div>

        {/* Right: pain point cards */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
          {PAIN_POINTS.map((point, i) => (
            <PainCard key={i} {...point} index={i} />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function PainCard({
  icon,
  title,
  desc,
  color,
  index,
}: {
  icon: string;
  title: string;
  desc: string;
  color: string;
  index: number;
}) {
  const delay = 55 + staggerDelay(index, 25);
  const spring = useEntrySpring(delay, SPRING_CONFIGS.smooth);
  const opacity = interpolate(spring, [0, 1], [0, 1]);
  const x = interpolate(spring, [0, 1], [60, 0]);

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${x}px)`,
        background: COLORS.navyCard,
        border: `1px solid ${COLORS.navyBorder}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 16,
        padding: "28px 32px",
        display: "flex",
        alignItems: "flex-start",
        gap: 20,
      }}
    >
      <span style={{ fontSize: 40, lineHeight: 1 }}>{icon}</span>
      <div>
        <div
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 22,
            fontWeight: 700,
            color: COLORS.white,
            marginBottom: 8,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 18,
            color: COLORS.muted,
            lineHeight: 1.5,
          }}
        >
          {desc}
        </div>
      </div>
    </div>
  );
}
