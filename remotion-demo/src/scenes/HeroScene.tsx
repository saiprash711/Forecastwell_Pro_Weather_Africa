import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { COLORS, useEntrySpring, useFade, useSlideUp, useScaleIn, SPRING_CONFIGS } from "../utils/animations";

/**
 * Scene 1 — Hero (0–8s / 240 frames)
 * Full-screen brand reveal: logo, tagline, animated gradient orbs.
 */
export function HeroScene() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Background orbs
  const orb1Opacity = interpolate(frame, [0, 40], [0, 0.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const orb2Opacity = interpolate(frame, [15, 55], [0, 0.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const orb1Scale = interpolate(frame, [0, durationInFrames], [1, 1.15], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Logo badge
  const badgeSpring = useEntrySpring(20, SPRING_CONFIGS.snappy);
  const badgeScale = interpolate(badgeSpring, [0, 1], [0.4, 1]);
  const badgeOpacity = interpolate(badgeSpring, [0, 1], [0, 1]);

  // Title
  const titleY = useSlideUp(45, 80);
  const titleOpacity = useFade(45, 75);

  // Tagline
  const taglineY = useSlideUp(70, 60);
  const taglineOpacity = useFade(70, 100);

  // Pill badge (category label)
  const pillOpacity = useFade(30, 55);
  const pillY = useSlideUp(30, 30);

  // Subtitle
  const subtitleOpacity = useFade(90, 120);
  const subtitleY = useSlideUp(90, 40);

  // CTA glow pulse
  const glowPulse = interpolate(
    Math.sin((frame * Math.PI * 2) / 60),
    [-1, 1],
    [0.5, 1]
  );

  // Scene exit fade
  const exitOpacity = interpolate(frame, [210, 235], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 30% 50%, #0F1E3D 0%, ${COLORS.navy} 60%)`,
        opacity: exitOpacity,
        overflow: "hidden",
      }}
    >
      {/* Animated gradient orbs */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(37,99,235,0.35) 0%, transparent 70%)`,
          top: -200,
          left: -100,
          opacity: orb1Opacity,
          transform: `scale(${orb1Scale})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(245,158,11,0.25) 0%, transparent 70%)`,
          bottom: -100,
          right: 200,
          opacity: orb2Opacity,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)`,
          top: 400,
          right: -50,
          opacity: orb2Opacity,
        }}
      />

      {/* Grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(37,99,235,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(37,99,235,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
          opacity: 0.8,
        }}
      />

      {/* Center content */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
        }}
      >
        {/* Logo badge */}
        <div
          style={{
            opacity: badgeOpacity,
            transform: `scale(${badgeScale})`,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: 28,
              background: `linear-gradient(135deg, ${COLORS.blue} 0%, #1D4ED8 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 60px rgba(37,99,235,${glowPulse * 0.6}), 0 20px 60px rgba(0,0,0,0.5)`,
            }}
          >
            <WeatherIcon size={54} />
          </div>
        </div>

        {/* Category pill */}
        <div
          style={{
            opacity: pillOpacity,
            transform: `translateY(${pillY}px)`,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(37,99,235,0.15)",
              border: `1px solid rgba(59,130,246,0.4)`,
              borderRadius: 100,
              padding: "8px 20px",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: COLORS.emerald,
                boxShadow: `0 0 8px ${COLORS.emerald}`,
              }}
            />
            <span
              style={{
                fontFamily: "system-ui, -apple-system, sans-serif",
                fontSize: 18,
                fontWeight: 600,
                color: COLORS.blueLight,
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              AI-Powered Demand Intelligence
            </span>
          </div>
        </div>

        {/* Main title */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            textAlign: "center",
            marginBottom: 28,
          }}
        >
          <h1
            style={{
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: 96,
              fontWeight: 800,
              color: COLORS.white,
              margin: 0,
              lineHeight: 1.05,
              letterSpacing: -2,
            }}
          >
            Forecast
            <span
              style={{
                background: `linear-gradient(135deg, ${COLORS.blueLight} 0%, ${COLORS.amber} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Well
            </span>
          </h1>
        </div>

        {/* Tagline */}
        <div
          style={{
            opacity: taglineOpacity,
            transform: `translateY(${taglineY}px)`,
            textAlign: "center",
            marginBottom: 48,
            maxWidth: 860,
          }}
        >
          <p
            style={{
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: 32,
              fontWeight: 400,
              color: COLORS.muted,
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Night-temperature demand forecasting for{" "}
            <span style={{ color: COLORS.white, fontWeight: 600 }}>HVAC & Consumer Durables</span>
            {" "}across South India
          </p>
        </div>

        {/* Subtitle */}
        <div
          style={{
            opacity: subtitleOpacity,
            transform: `translateY(${subtitleY}px)`,
            display: "flex",
            gap: 40,
            alignItems: "center",
          }}
        >
          {["6 South India Cities", "Open-Meteo Weather Data", "Wave Sequence Analysis"].map((text, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontFamily: "system-ui, -apple-system, sans-serif",
                fontSize: 20,
                color: COLORS.muted,
                fontWeight: 500,
              }}
            >
              <CheckIcon color={COLORS.emerald} />
              {text}
            </div>
          ))}
        </div>
      </AbsoluteFill>

      {/* Bottom watermark */}
      <div
        style={{
          position: "absolute",
          bottom: 48,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: subtitleOpacity * 0.5,
        }}
      >
        <span
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 16,
            color: COLORS.dimmed,
            letterSpacing: 2,
          }}
        >
          POWERED BY HANSEI CONSULTANCY
        </span>
      </div>
    </AbsoluteFill>
  );
}

function WeatherIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 54 54" fill="none">
      {/* Sun */}
      <circle cx="27" cy="22" r="9" fill="#FCD34D" />
      {/* Sun rays */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <line
          key={angle}
          x1={27 + 12 * Math.cos((angle * Math.PI) / 180)}
          y1={22 + 12 * Math.sin((angle * Math.PI) / 180)}
          x2={27 + 15 * Math.cos((angle * Math.PI) / 180)}
          y2={22 + 15 * Math.sin((angle * Math.PI) / 180)}
          stroke="#FCD34D"
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}
      {/* Cloud */}
      <ellipse cx="24" cy="35" rx="12" ry="7" fill="white" opacity={0.9} />
      <ellipse cx="31" cy="35" rx="9" ry="7" fill="white" opacity={0.9} />
      <ellipse cx="27.5" cy="31" rx="7" ry="6" fill="white" opacity={0.9} />
    </svg>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill={color} opacity={0.15} />
      <path d="M6 10.5L8.5 13L14 8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
