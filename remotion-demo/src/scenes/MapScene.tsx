import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, useFade, useSlideUp, useEntrySpring, staggerDelay, SPRING_CONFIGS } from "../utils/animations";

// City positions relative to a 600x700 SVG viewBox
const CITIES = [
  { name: "Hyderabad", state: "Telangana", x: 260, y: 160, temp: 31.2, demand: 82, color: COLORS.amber },
  { name: "Visakhapatnam", state: "Andhra Pradesh", x: 370, y: 210, temp: 29.8, demand: 75, color: COLORS.blueLight },
  { name: "Chennai", state: "Tamil Nadu", x: 340, y: 360, temp: 33.1, demand: 94, color: COLORS.rose },
  { name: "Bangalore", state: "Karnataka", x: 230, y: 370, temp: 27.4, demand: 68, color: COLORS.emerald },
  { name: "Coimbatore", state: "Tamil Nadu", x: 200, y: 430, temp: 29.5, demand: 78, color: COLORS.amber },
  { name: "Kochi", state: "Kerala", x: 160, y: 460, temp: 28.9, demand: 71, color: COLORS.blueLight },
];

/**
 * Scene 4 — South India Map (7s / 210 frames)
 */
export function MapScene() {
  const frame = useCurrentFrame();

  const exitOpacity = interpolate(frame, [185, 208], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headingOpacity = useFade(8, 38);
  const headingY = useSlideUp(8, 60);

  const mapSpring = useEntrySpring(20, SPRING_CONFIGS.gentle);
  const mapOpacity = interpolate(mapSpring, [0, 1], [0, 1]);
  const mapScale = interpolate(mapSpring, [0, 1], [0.9, 1]);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 40% 60%, #0D1B35 0%, ${COLORS.navy} 70%)`,
        opacity: exitOpacity,
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(37,99,235,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.03) 1px, transparent 1px)`, backgroundSize: "80px 80px" }} />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          padding: "0 100px",
          gap: 80,
        }}
      >
        {/* Left: heading + city list */}
        <div style={{ flex: "0 0 480px", display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ opacity: headingOpacity, transform: `translateY(${headingY}px)` }}>
            <div style={{ display: "inline-flex", gap: 10, alignItems: "center", background: "rgba(37,99,235,0.12)", border: `1px solid rgba(59,130,246,0.3)`, borderRadius: 100, padding: "8px 20px", marginBottom: 20 }}>
              <span style={{ fontSize: 18, fontFamily: "system-ui, sans-serif", color: COLORS.blueLight, fontWeight: 700, letterSpacing: 1 }}>FEATURE 01</span>
            </div>
            <h2 style={{ fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 58, fontWeight: 800, color: COLORS.white, margin: 0, lineHeight: 1.1, letterSpacing: -1 }}>
              Live South India
              <br />
              <span style={{ background: `linear-gradient(135deg, ${COLORS.blueLight}, ${COLORS.amber})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Temperature Map
              </span>
            </h2>
            <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 20, color: COLORS.muted, marginTop: 16, lineHeight: 1.5 }}>
              Real-time IMD data for 6 key markets — from Hyderabad to Kochi.
            </p>
          </div>

          {/* City list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {CITIES.map((city, i) => (
              <CityRow key={city.name} city={city} index={i} />
            ))}
          </div>
        </div>

        {/* Right: SVG map */}
        <div
          style={{
            flex: 1,
            opacity: mapOpacity,
            transform: `scale(${mapScale})`,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <SouthIndiaMap frame={frame} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function CityRow({ city, index }: { city: typeof CITIES[0]; index: number }) {
  const delay = 40 + staggerDelay(index, 18);
  const sp = useEntrySpring(delay, SPRING_CONFIGS.smooth);
  const opacity = interpolate(sp, [0, 1], [0, 1]);
  const x = interpolate(sp, [0, 1], [-30, 0]);

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${x}px)`,
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: COLORS.navyCard,
        border: `1px solid ${COLORS.navyBorder}`,
        borderRadius: 10,
        padding: "10px 16px",
      }}
    >
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: city.color, boxShadow: `0 0 8px ${city.color}`, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 16, fontWeight: 600, color: COLORS.white }}>{city.name}</div>
        <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, color: COLORS.muted }}>{city.state}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: city.color }}>{city.temp}°C</div>
        <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: COLORS.muted }}>Demand: {city.demand}</div>
      </div>
    </div>
  );
}

function SouthIndiaMap({ frame }: { frame: number }) {
  return (
    <svg
      viewBox="0 0 600 700"
      width={580}
      height={620}
      style={{ filter: "drop-shadow(0 20px 60px rgba(0,0,0,0.5))" }}
    >
      {/* Map background region — stylised South India outline */}
      <defs>
        <radialGradient id="mapGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(37,99,235,0.12)" />
          <stop offset="100%" stopColor="rgba(37,99,235,0.03)" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Simplified South India polygon */}
      <path
        d="M180,80 L420,80 L470,160 L460,240 L400,320 L380,420 L340,480 L300,560 L270,580 L240,560 L190,480 L140,400 L110,300 L120,200 Z"
        fill="url(#mapGrad)"
        stroke="rgba(37,99,235,0.3)"
        strokeWidth={1.5}
      />

      {/* State boundaries */}
      <path d="M180,80 L420,80 L460,240 L300,260 L140,240 Z" fill="none" stroke="rgba(37,99,235,0.15)" strokeWidth={1} strokeDasharray="6,4" />
      <path d="M140,240 L300,260 L460,240 L400,320 L300,340 L200,320 Z" fill="none" stroke="rgba(37,99,235,0.15)" strokeWidth={1} strokeDasharray="6,4" />
      <path d="M200,320 L300,340 L400,320 L380,420 L300,440 L220,420 Z" fill="none" stroke="rgba(37,99,235,0.15)" strokeWidth={1} strokeDasharray="6,4" />

      {/* Connection lines between cities */}
      {CITIES.map((c, i) =>
        CITIES.slice(i + 1).map((c2, j) => {
          const dist = Math.hypot(c.x - c2.x, c.y - c2.y);
          if (dist > 200) return null;
          return (
            <line
              key={`${i}-${j}`}
              x1={c.x}
              y1={c.y}
              x2={c2.x}
              y2={c2.y}
              stroke="rgba(37,99,235,0.15)"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          );
        })
      )}

      {/* City markers */}
      {CITIES.map((city, i) => {
        const delay = 35 + staggerDelay(i, 20);
        const pulsePhase = (frame - delay) / 40;
        const pulseR = 18 + 6 * Math.sin(pulsePhase * Math.PI * 2);
        const pulseOpacity = 0.3 + 0.2 * Math.sin(pulsePhase * Math.PI * 2);
        const appear = interpolate(frame, [delay, delay + 20], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <g key={city.name} opacity={appear}>
            {/* Pulse ring */}
            <circle
              cx={city.x}
              cy={city.y}
              r={pulseR}
              fill="none"
              stroke={city.color}
              strokeWidth={1.5}
              opacity={pulseOpacity}
            />
            {/* Outer ring */}
            <circle cx={city.x} cy={city.y} r={12} fill={`${city.color}25`} stroke={city.color} strokeWidth={2} />
            {/* Inner dot */}
            <circle cx={city.x} cy={city.y} r={5} fill={city.color} filter="url(#glow)" />
            {/* Label */}
            <text
              x={city.x + 16}
              y={city.y + 5}
              fontFamily="system-ui, sans-serif"
              fontSize={15}
              fontWeight={700}
              fill={COLORS.white}
            >
              {city.name}
            </text>
            <text
              x={city.x + 16}
              y={city.y + 20}
              fontFamily="system-ui, sans-serif"
              fontSize={13}
              fill={city.color}
            >
              {city.temp}°C
            </text>
          </g>
        );
      })}
    </svg>
  );
}
