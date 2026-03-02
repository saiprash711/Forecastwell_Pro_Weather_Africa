import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, useFade, useSlideUp, useEntrySpring, SPRING_CONFIGS, staggerDelay } from "../utils/animations";

const FEATURE_RECAP = [
  { icon: "🗺️", label: "Live South India Map", sub: "6 cities, real-time IMD data" },
  { icon: "📈", label: "Temperature Trend Charts", sub: "Actual + 10-day forecast" },
  { icon: "🔔", label: "Intelligent Alert Engine", sub: "Threshold triggers + AI actions" },
  { icon: "📦", label: "Inventory Recommendations", sub: "Stock & production planning" },
];

/**
 * Scene 7 — Outro / CTA (10s / 300 frames)
 */
export function OutroScene() {
  const frame = useCurrentFrame();

  // Fade in
  const sceneOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Orbs
  const orb1 = interpolate(frame, [0, 300], [1, 1.2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // CTA heading
  const ctaOpacity = useFade(20, 55);
  const ctaY = useSlideUp(20, 80);

  // Sub heading
  const subOpacity = useFade(55, 85);
  const subY = useSlideUp(55, 50);

  // Feature recap
  const recapOpacity = useFade(90, 120);
  const recapY = useSlideUp(90, 40);

  // CTA button
  const btnSpring = useEntrySpring(130, SPRING_CONFIGS.bouncy);
  const btnScale = interpolate(btnSpring, [0, 1], [0.6, 1]);
  const btnOpacity = interpolate(btnSpring, [0, 1], [0, 1]);

  // Glow pulse on button
  const glow = interpolate(Math.sin((frame * Math.PI * 2) / 80), [-1, 1], [0.5, 1]);

  // Footer
  const footerOpacity = useFade(180, 210);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 50%, #0F1E3D 0%, ${COLORS.navy} 60%)`,
        opacity: sceneOpacity,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
      }}
    >
      {/* Animated background orbs */}
      <div style={{ position: "absolute", width: 1000, height: 1000, borderRadius: "50%", background: `radial-gradient(circle, rgba(37,99,235,0.25) 0%, transparent 65%)`, top: "50%", left: "50%", transform: `translate(-50%, -50%) scale(${orb1})`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)`, bottom: -100, right: 100, pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)`, top: -50, left: 50, pointerEvents: "none" }} />

      {/* Grid */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(37,99,235,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.04) 1px, transparent 1px)`, backgroundSize: "80px 80px" }} />

      {/* Main CTA */}
      <div style={{ opacity: ctaOpacity, transform: `translateY(${ctaY}px)`, textAlign: "center", marginBottom: 20 }}>
        <h1
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 96,
            fontWeight: 900,
            color: COLORS.white,
            margin: 0,
            lineHeight: 1.05,
            letterSpacing: -2,
          }}
        >
          Forecast Smarter.
          <br />
          <span
            style={{
              background: `linear-gradient(135deg, ${COLORS.blueLight} 0%, ${COLORS.emerald} 50%, ${COLORS.amber} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Sell More.
          </span>
        </h1>
      </div>

      {/* Sub-headline */}
      <div style={{ opacity: subOpacity, transform: `translateY(${subY}px)`, textAlign: "center", marginBottom: 48, maxWidth: 900 }}>
        <p
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 28,
            color: COLORS.muted,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          ForecastWell gives your HVAC sales team a{" "}
          <span style={{ color: COLORS.white, fontWeight: 600 }}>12-day planning advantage</span>{" "}
          over competitors still using gut feel.
        </p>
      </div>

      {/* Feature recap pills */}
      <div
        style={{
          opacity: recapOpacity,
          transform: `translateY(${recapY}px)`,
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          justifyContent: "center",
          marginBottom: 56,
          maxWidth: 1100,
        }}
      >
        {FEATURE_RECAP.map((f, i) => (
          <FeaturePill key={i} {...f} delay={95 + staggerDelay(i, 12)} />
        ))}
      </div>

      {/* CTA Button */}
      <div
        style={{
          opacity: btnOpacity,
          transform: `scale(${btnScale})`,
          marginBottom: 60,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 16,
            background: `linear-gradient(135deg, ${COLORS.blue} 0%, #1D4ED8 100%)`,
            borderRadius: 20,
            padding: "24px 56px",
            boxShadow: `0 0 60px rgba(37,99,235,${glow * 0.5}), 0 20px 60px rgba(0,0,0,0.4)`,
            cursor: "pointer",
          }}
        >
          <span
            style={{
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.white,
              letterSpacing: -0.5,
            }}
          >
            Start Your Free Trial
          </span>
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <path d="M5 12H19M13 6l6 6-6 6" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* URL */}
      <div style={{ opacity: btnOpacity, marginBottom: 20 }}>
        <span
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 22,
            color: COLORS.muted,
            letterSpacing: 0.5,
          }}
        >
          forecastwell.hansei.in
        </span>
      </div>

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 24,
          opacity: footerOpacity,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.emerald, boxShadow: `0 0 8px ${COLORS.emerald}` }} />
          <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 15, color: COLORS.dimmed }}>Real-time IMD Data</span>
        </div>
        <div style={{ width: 1, height: 16, background: COLORS.navyBorder }} />
        <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 15, color: COLORS.dimmed }}>
          Hansei Consultancy · 2026
        </span>
        <div style={{ width: 1, height: 16, background: COLORS.navyBorder }} />
        <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 15, color: COLORS.dimmed }}>
          HVAC · Consumer Durables · South India
        </span>
      </div>
    </AbsoluteFill>
  );
}

function FeaturePill({ icon, label, sub, delay }: { icon: string; label: string; sub: string; delay: number }) {
  const sp = useEntrySpring(delay, SPRING_CONFIGS.snappy);
  const opacity = interpolate(sp, [0, 1], [0, 1]);
  const y = interpolate(sp, [0, 1], [20, 0]);

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: COLORS.navyCard,
        border: `1px solid ${COLORS.navyBorder}`,
        borderRadius: 14,
        padding: "14px 22px",
      }}
    >
      <span style={{ fontSize: 26 }}>{icon}</span>
      <div>
        <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 17, fontWeight: 600, color: COLORS.white }}>{label}</div>
        <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, color: COLORS.muted }}>{sub}</div>
      </div>
    </div>
  );
}
