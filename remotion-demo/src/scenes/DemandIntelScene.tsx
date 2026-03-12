import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, useFade, useSlideUp, useEntrySpring, SPRING_CONFIGS, staggerDelay } from "../utils/animations";

// Top cities by demand index — pulled from the actual app's Demand Intel page
const CITIES_DEMAND = [
  { name: "Chennai",    nightTemp: 33.1, demandIdx: 94, zone: "RED",   color: "#EF4444", acHours: "14–16h" },
  { name: "Delhi",      nightTemp: 32.4, demandIdx: 90, zone: "RED",   color: "#EF4444", acHours: "14–16h" },
  { name: "Jaipur",     nightTemp: 31.8, demandIdx: 88, zone: "RED",   color: "#EF4444", acHours: "12–14h" },
  { name: "Hyderabad",  nightTemp: 31.2, demandIdx: 82, zone: "RED",   color: "#EF4444", acHours: "12–14h" },
  { name: "Ahmedabad",  nightTemp: 30.5, demandIdx: 85, zone: "RED",   color: "#EF4444", acHours: "12–14h" },
  { name: "Madurai",    nightTemp: 29.8, demandIdx: 85, zone: "RED",   color: "#EF4444", acHours: "12–14h" },
  { name: "Visakhapatnam", nightTemp: 29.5, demandIdx: 80, zone: "AMBER", color: COLORS.amber, acHours: "10–12h" },
  { name: "Kolkata",    nightTemp: 29.2, demandIdx: 78, zone: "AMBER", color: COLORS.amber, acHours: "10–12h" },
  { name: "Coimbatore", nightTemp: 28.9, demandIdx: 78, zone: "AMBER", color: COLORS.amber, acHours: "10–12h" },
  { name: "Kochi",      nightTemp: 28.5, demandIdx: 71, zone: "AMBER", color: "#A855F7",  acHours: "10–12h" },
  { name: "Mumbai",     nightTemp: 27.8, demandIdx: 75, zone: "AMBER", color: COLORS.amber, acHours: "8–10h" },
  { name: "Bangalore",  nightTemp: 22.4, demandIdx: 42, zone: "GREEN", color: COLORS.emerald, acHours: "4–6h" },
];

const WAVES = [
  {
    label: "Wave 1",
    timing: "NOW",
    badge: "ACTIVE",
    description: "Night temps ≥28°C across RED zone cities. Peak distribution window.",
    action: "Push distributor allocation +30–40%",
    color: "#EF4444",
  },
  {
    label: "Wave 2",
    timing: "+2 Weeks",
    badge: "PREPARE",
    description: "Monsoon-delay risk. Pre-position regional depot stock before shortages hit.",
    action: "Submit factory replenishment order",
    color: COLORS.amber,
  },
  {
    label: "Wave 3",
    timing: "+6 Weeks",
    badge: "PLAN",
    description: "Post-peak service surge: compressor failures, gas refills, warranty claims.",
    action: "Pre-load channel inventory + service parts",
    color: COLORS.blueLight,
  },
];

/**
 * Scene 5 — Demand Intelligence (8s / 240 frames)
 * Night-Priority Index formula + per-city bars + Wave Sequence.
 */
export function DemandIntelScene() {
  const frame = useCurrentFrame();

  const exitOpacity = interpolate(frame, [215, 238], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headingOpacity = useFade(8, 38);
  const headingY = useSlideUp(8, 60);

  const leftSpring = useEntrySpring(22, SPRING_CONFIGS.gentle);
  const leftOpacity = interpolate(leftSpring, [0, 1], [0, 1]);
  const leftY       = interpolate(leftSpring, [0, 1], [40, 0]);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 60% 20%, #0D1B35 0%, ${COLORS.navy} 65%)`,
        opacity: exitOpacity,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: "42px 80px 36px",
        gap: 22,
      }}
    >
      <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(37,99,235,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.03) 1px, transparent 1px)`, backgroundSize: "80px 80px" }} />

      {/* ── Heading row ── */}
      <div style={{ opacity: headingOpacity, transform: `translateY(${headingY}px)`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ display: "inline-flex", gap: 10, alignItems: "center", background: "rgba(37,99,235,0.12)", border: `1px solid rgba(59,130,246,0.3)`, borderRadius: 100, padding: "7px 18px", marginBottom: 12 }}>
            <span style={{ fontSize: 16, fontFamily: "system-ui, sans-serif", color: COLORS.blueLight, fontWeight: 700, letterSpacing: 1 }}>FEATURE 02</span>
          </div>
          <h2 style={{ fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 48, fontWeight: 800, color: COLORS.white, margin: 0, letterSpacing: -1 }}>
            Night-Priority Demand Intelligence &{" "}
            <span style={{ background: `linear-gradient(135deg, ${COLORS.amber}, "#EF4444")`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Wave Sequencing
            </span>
          </h2>
        </div>
        <DSBLegend />
      </div>

      {/* ── Two-column body ── */}
      <div style={{ flex: 1, display: "flex", gap: 22, minHeight: 0 }}>

        {/* Left: formula + city bars */}
        <div
          style={{
            opacity: leftOpacity,
            transform: `translateY(${leftY}px)`,
            flex: "0 0 580px",
            background: COLORS.navyCard,
            border: `1px solid ${COLORS.navyBorder}`,
            borderRadius: 16,
            padding: "22px 26px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <FormulaCard />
          {/* Column headers */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 4 }}>
            <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, fontWeight: 700, color: COLORS.dimmed, letterSpacing: 1, width: 110, textAlign: "right" }}>CITY</div>
            <div style={{ flex: 1 }} />
            <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, fontWeight: 700, color: COLORS.dimmed, letterSpacing: 1, width: 36 }}>IDX</div>
            <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, fontWeight: 700, color: COLORS.dimmed, letterSpacing: 1, width: 52 }}>ZONE</div>
            <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, fontWeight: 700, color: COLORS.dimmed, letterSpacing: 1, width: 52 }}>AC HRS</div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, overflowY: "hidden" }}>
            {CITIES_DEMAND.map((city, i) => (
              <CityDemandBar key={city.name} city={city} index={i} />
            ))}
          </div>
        </div>

        {/* Right: wave sequence */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <WaveSectionHeader />
          {WAVES.map((wave, i) => (
            <WaveCard key={i} wave={wave} index={i} />
          ))}
          {/* Insight badge */}
          <InsightBadge />
        </div>
      </div>
    </AbsoluteFill>
  );
}

function FormulaCard() {
  const sp = useEntrySpring(32, SPRING_CONFIGS.smooth);
  const opacity = interpolate(sp, [0, 1], [0, 1]);
  return (
    <div
      style={{
        opacity,
        background: "rgba(37,99,235,0.08)",
        border: `1px solid rgba(59,130,246,0.2)`,
        borderRadius: 10,
        padding: "13px 16px",
      }}
    >
      <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, fontWeight: 700, color: COLORS.blueLight, letterSpacing: 1, marginBottom: 7 }}>NIGHT-PRIORITY DEMAND INDEX</div>
      <div style={{ fontFamily: "monospace", fontSize: 15, color: COLORS.white, lineHeight: 1.6 }}>
        Index = (Night × <span style={{ color: "#EF4444" }}>60%</span>) + (Day × <span style={{ color: COLORS.amber }}>25%</span>) + (Humidity × <span style={{ color: COLORS.emerald }}>15%</span>)
      </div>
      <div style={{ fontFamily: "monospace", fontSize: 12, color: COLORS.muted, marginTop: 3 }}>
        Night &gt; 24°C → 12–16 hrs AC daily &nbsp;·&nbsp; Night &gt; 32°C → RED alert trigger
      </div>
    </div>
  );
}

function CityDemandBar({ city, index }: { city: typeof CITIES_DEMAND[0]; index: number }) {
  const frame = useCurrentFrame();
  const delay = 52 + staggerDelay(index, 12);
  const sp = useEntrySpring(delay, SPRING_CONFIGS.smooth);
  const opacity = interpolate(sp, [0, 1], [0, 1]);
  const barReveal = interpolate(frame, [delay + 5, delay + 38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ opacity, display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, color: COLORS.muted, width: 110, flexShrink: 0, textAlign: "right" }}>
        {city.name}
      </div>
      <div style={{ flex: 1, height: 18, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            width: `${city.demandIdx * barReveal}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${city.color}70, ${city.color})`,
            borderRadius: 4,
          }}
        />
      </div>
      <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: 700, color: city.color, width: 36, flexShrink: 0 }}>
        {Math.round(city.demandIdx * barReveal)}
      </div>
      <div style={{ background: `${city.color}18`, border: `1px solid ${city.color}40`, color: city.color, fontFamily: "system-ui, sans-serif", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100, width: 52, textAlign: "center", flexShrink: 0 }}>
        {city.zone}
      </div>
      <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, color: COLORS.dimmed, width: 52, flexShrink: 0, textAlign: "center" }}>
        {city.acHours}
      </div>
    </div>
  );
}

function DSBLegend() {
  const sp = useEntrySpring(14, SPRING_CONFIGS.smooth);
  const opacity = interpolate(sp, [0, 1], [0, 1]);
  return (
    <div style={{ opacity, display: "flex", gap: 10, alignItems: "center" }}>
      {([["GREEN", "≤40", COLORS.emerald], ["AMBER", "40–70", COLORS.amber], ["RED", ">70", "#EF4444"]] as [string, string, string][]).map(([label, sub, color]) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 8, padding: "6px 12px" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
          <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, fontWeight: 700, color }}>{label}</span>
          <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, color: COLORS.muted }}>{sub}</span>
        </div>
      ))}
    </div>
  );
}

function WaveSectionHeader() {
  const sp = useEntrySpring(28, SPRING_CONFIGS.smooth);
  const opacity = interpolate(sp, [0, 1], [0, 1]);
  const y = interpolate(sp, [0, 1], [18, 0]);
  return (
    <div style={{ opacity, transform: `translateY(${y}px)`, display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 15, fontWeight: 700, color: COLORS.white }}>Wave Sequence — Market Timing</span>
      <div style={{ flex: 1, height: 1, background: COLORS.navyBorder }} />
    </div>
  );
}

function WaveCard({ wave, index }: { wave: typeof WAVES[0]; index: number }) {
  const delay = 48 + staggerDelay(index, 28);
  const sp = useEntrySpring(delay, SPRING_CONFIGS.smooth);
  const opacity = interpolate(sp, [0, 1], [0, 1]);
  const x = interpolate(sp, [0, 1], [50, 0]);
  const isActive = index === 0;

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${x}px)`,
        flex: 1,
        background: isActive ? `linear-gradient(135deg, ${wave.color}10, rgba(37,99,235,0.05))` : COLORS.navyCard,
        border: `1px solid ${isActive ? `${wave.color}40` : COLORS.navyBorder}`,
        borderLeft: `3px solid ${wave.color}`,
        borderRadius: 14,
        padding: "16px 20px",
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
      }}
    >
      {/* Number badge */}
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${wave.color}18`, border: `2px solid ${wave.color}50`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: wave.color }}>{index + 1}</span>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
          <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 17, fontWeight: 800, color: COLORS.white }}>{wave.label}</span>
          <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, color: COLORS.muted }}>{wave.timing}</span>
          <span style={{ background: `${wave.color}20`, border: `1px solid ${wave.color}50`, color: wave.color, fontFamily: "system-ui, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: "2px 8px", borderRadius: 100 }}>
            {wave.badge}
          </span>
        </div>
        <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, color: COLORS.muted, margin: "0 0 9px", lineHeight: 1.4 }}>
          {wave.description}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: 600, color: COLORS.emerald }}>
          <span>→</span><span>{wave.action}</span>
        </div>
      </div>
    </div>
  );
}

function InsightBadge() {
  const sp = useEntrySpring(145, SPRING_CONFIGS.snappy);
  const opacity = interpolate(sp, [0, 1], [0, 1]);
  const y = interpolate(sp, [0, 1], [20, 0]);
  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        background: `linear-gradient(135deg, rgba(37,99,235,0.15), rgba(16,185,129,0.08))`,
        border: `1px solid rgba(59,130,246,0.3)`,
        borderRadius: 12,
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, fontWeight: 700, color: COLORS.blueLight, letterSpacing: 1, flexShrink: 0 }}>LIVE INSIGHT</div>
      <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 15, fontWeight: 600, color: COLORS.white, lineHeight: 1.4 }}>
        18 RED-zone cities. Wave 1 active. <span style={{ color: COLORS.amber }}>Push inventory now</span> — 12-day lead-time advantage.
      </div>
    </div>
  );
}
