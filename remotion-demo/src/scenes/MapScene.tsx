import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, useFade, useSlideUp, useEntrySpring, staggerDelay, SPRING_CONFIGS } from "../utils/animations";

// All 60 cities — SVG viewBox 540×720
// Projection: x = 35 + (lon-68)/29*470,  y = 20 + (36-lat)/28*680
const ALL_CITIES = [
  { name: "Delhi",              x: 184, y: 194, demand: 90, color: "#EF4444", labeled: true  },
  { name: "Mumbai",             x: 112, y: 418, demand: 75, color: COLORS.amber,   labeled: true  },
  { name: "Bangalore",          x: 190, y: 560, demand: 68, color: COLORS.emerald, labeled: true  },
  { name: "Hyderabad",          x: 215, y: 458, demand: 82, color: COLORS.amber,   labeled: true  },
  { name: "Chennai",            x: 243, y: 556, demand: 94, color: "#EF4444", labeled: true  },
  { name: "Kolkata",            x: 378, y: 336, demand: 78, color: COLORS.amber,   labeled: true  },
  { name: "Ahmedabad",          x: 110, y: 327, demand: 85, color: "#EF4444", labeled: true  },
  { name: "Jaipur",             x: 162, y: 235, demand: 88, color: "#EF4444", labeled: true  },
  { name: "Lucknow",            x: 253, y: 235, demand: 76, color: COLORS.amber,   labeled: true  },
  { name: "Kochi",              x: 178, y: 625, demand: 71, color: "#A855F7",  labeled: true  },
  // unlabeled dots
  { name: "Pune",               x: 124, y: 432, demand: 65, color: COLORS.amber,   labeled: false },
  { name: "Surat",              x: 108, y: 370, demand: 72, color: COLORS.amber,   labeled: false },
  { name: "Kanpur",             x: 237, y: 244, demand: 74, color: COLORS.amber,   labeled: false },
  { name: "Nagpur",             x: 212, y: 375, demand: 68, color: COLORS.amber,   labeled: false },
  { name: "Indore",             x: 163, y: 320, demand: 70, color: COLORS.amber,   labeled: false },
  { name: "Bhopal",             x: 184, y: 305, demand: 66, color: COLORS.amber,   labeled: false },
  { name: "Visakhapatnam",      x: 302, y: 450, demand: 80, color: COLORS.amber,   labeled: false },
  { name: "Patna",              x: 302, y: 256, demand: 73, color: COLORS.amber,   labeled: false },
  { name: "Vadodara",           x: 118, y: 333, demand: 68, color: COLORS.amber,   labeled: false },
  { name: "Ghaziabad",          x: 188, y: 188, demand: 87, color: "#EF4444", labeled: false },
  { name: "Ludhiana",           x: 164, y: 140, demand: 62, color: COLORS.emerald, labeled: false },
  { name: "Agra",               x: 196, y: 226, demand: 84, color: "#EF4444", labeled: false },
  { name: "Nashik",             x: 130, y: 400, demand: 62, color: COLORS.emerald, labeled: false },
  { name: "Varanasi",           x: 268, y: 258, demand: 76, color: COLORS.amber,   labeled: false },
  { name: "Meerut",             x: 192, y: 183, demand: 86, color: "#EF4444", labeled: false },
  { name: "Rajkot",             x:  85, y: 333, demand: 65, color: COLORS.amber,   labeled: false },
  { name: "Madurai",            x: 224, y: 600, demand: 85, color: "#EF4444", labeled: false },
  { name: "Coimbatore",         x: 198, y: 578, demand: 78, color: COLORS.amber,   labeled: false },
  { name: "Thiruvananthapuram", x: 185, y: 640, demand: 68, color: "#A855F7",  labeled: false },
  { name: "Kozhikode",          x: 165, y: 571, demand: 66, color: "#A855F7",  labeled: false },
  { name: "Chandigarh",         x: 172, y: 148, demand: 58, color: COLORS.emerald, labeled: false },
  { name: "Guwahati",           x: 440, y: 212, demand: 72, color: COLORS.amber,   labeled: false },
  { name: "Bhubaneswar",        x: 342, y: 368, demand: 75, color: COLORS.amber,   labeled: false },
  { name: "Dehradun",           x: 195, y: 165, demand: 55, color: COLORS.emerald, labeled: false },
  { name: "Ranchi",             x: 318, y: 305, demand: 66, color: COLORS.amber,   labeled: false },
  { name: "Raipur",             x: 268, y: 338, demand: 68, color: COLORS.amber,   labeled: false },
  { name: "Vijayawada",         x: 262, y: 490, demand: 82, color: COLORS.amber,   labeled: false },
  { name: "Jodhpur",            x: 138, y: 248, demand: 82, color: "#EF4444", labeled: false },
  { name: "Amritsar",           x: 152, y: 135, demand: 58, color: COLORS.emerald, labeled: false },
  { name: "Prayagraj",          x: 256, y: 250, demand: 75, color: COLORS.amber,   labeled: false },
  { name: "Gwalior",            x: 196, y: 238, demand: 82, color: "#EF4444", labeled: false },
  { name: "Jabalpur",           x: 230, y: 318, demand: 65, color: COLORS.amber,   labeled: false },
  { name: "Noida",              x: 190, y: 192, demand: 88, color: "#EF4444", labeled: false },
  { name: "Gurugram",           x: 182, y: 196, demand: 88, color: "#EF4444", labeled: false },
  { name: "Tiruchirappalli",    x: 228, y: 590, demand: 80, color: "#EF4444", labeled: false },
  { name: "Salem",              x: 216, y: 570, demand: 76, color: COLORS.amber,   labeled: false },
  { name: "Mangalore",          x: 164, y: 528, demand: 62, color: COLORS.amber,   labeled: false },
  { name: "Mysore",             x: 196, y: 546, demand: 65, color: COLORS.emerald, labeled: false },
  { name: "Hubli",              x: 172, y: 502, demand: 68, color: COLORS.amber,   labeled: false },
  { name: "Aurangabad",         x: 140, y: 392, demand: 65, color: COLORS.amber,   labeled: false },
  { name: "Solapur",            x: 145, y: 430, demand: 62, color: COLORS.amber,   labeled: false },
  { name: "Thane",              x: 110, y: 408, demand: 72, color: COLORS.amber,   labeled: false },
  { name: "Navi Mumbai",        x: 108, y: 424, demand: 73, color: COLORS.amber,   labeled: false },
  { name: "Warangal",           x: 238, y: 445, demand: 78, color: COLORS.amber,   labeled: false },
  { name: "Jammu",              x: 180, y: 118, demand: 55, color: COLORS.emerald, labeled: false },
  { name: "Cuttack",            x: 347, y: 358, demand: 73, color: COLORS.amber,   labeled: false },
  { name: "Udaipur",            x: 148, y: 278, demand: 72, color: COLORS.amber,   labeled: false },
  { name: "Kota",               x: 170, y: 265, demand: 80, color: "#EF4444", labeled: false },
  { name: "Bareilly",           x: 220, y: 210, demand: 70, color: COLORS.amber,   labeled: false },
  { name: "Guntur",             x: 255, y: 480, demand: 80, color: COLORS.amber,   labeled: false },
];

const KEY_CITIES = ALL_CITIES.filter((c) => c.labeled);

/**
 * Scene 4 — All India Map (7s / 210 frames)
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
  const mapScale  = interpolate(mapSpring, [0, 1], [0.92, 1]);

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
          padding: "0 80px 0 100px",
          gap: 60,
        }}
      >
        {/* ── Left column ── */}
        <div style={{ flex: "0 0 420px", display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ opacity: headingOpacity, transform: `translateY(${headingY}px)` }}>
            <div style={{ display: "inline-flex", gap: 10, alignItems: "center", background: "rgba(37,99,235,0.12)", border: `1px solid rgba(59,130,246,0.3)`, borderRadius: 100, padding: "7px 18px", marginBottom: 18 }}>
              <span style={{ fontSize: 16, fontFamily: "system-ui, sans-serif", color: COLORS.blueLight, fontWeight: 700, letterSpacing: 1 }}>FEATURE 01</span>
            </div>
            <h2 style={{ fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 52, fontWeight: 800, color: COLORS.white, margin: 0, lineHeight: 1.1, letterSpacing: -1 }}>
              60 Cities.
              <br />
              <span style={{ background: `linear-gradient(135deg, ${COLORS.blueLight}, ${COLORS.amber})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                All India.
              </span>
            </h2>
            <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 17, color: COLORS.muted, marginTop: 14, lineHeight: 1.5 }}>
              Real-time Open-Meteo data across 9 demand zones — Jammu to Kanyakumari.
            </p>
          </div>

          {/* Zone badges */}
          <ZoneSummary />

          {/* Key city rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {KEY_CITIES.map((city, i) => (
              <CityRow key={city.name} city={city} index={i} />
            ))}
          </div>
        </div>

        {/* ── Right: India SVG ── */}
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
          <IndiaMap frame={frame} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function ZoneSummary() {
  const sp = useEntrySpring(30, SPRING_CONFIGS.smooth);
  const opacity = interpolate(sp, [0, 1], [0, 1]);
  const y = interpolate(sp, [0, 1], [20, 0]);

  const zones = [
    { label: "RED",    count: 18, color: "#EF4444" },
    { label: "AMBER",  count: 30, color: COLORS.amber },
    { label: "GREEN",  count: 10, color: COLORS.emerald },
    { label: "PURPLE", count:  2, color: "#A855F7" },
  ];

  return (
    <div style={{ opacity, transform: `translateY(${y}px)`, display: "flex", gap: 10, flexWrap: "wrap" }}>
      {zones.map((z) => (
        <div key={z.label} style={{ display: "flex", alignItems: "center", gap: 7, background: `${z.color}12`, border: `1px solid ${z.color}30`, borderRadius: 8, padding: "6px 12px" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: z.color }} />
          <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: 700, color: z.color }}>{z.count}</span>
          <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: COLORS.muted }}>{z.label}</span>
        </div>
      ))}
    </div>
  );
}

function CityRow({ city, index }: { city: typeof ALL_CITIES[0]; index: number }) {
  const delay = 42 + staggerDelay(index, 14);
  const sp = useEntrySpring(delay, SPRING_CONFIGS.smooth);
  const opacity = interpolate(sp, [0, 1], [0, 1]);
  const x = interpolate(sp, [0, 1], [-26, 0]);
  const zone = city.demand > 70 ? "RED" : city.demand > 40 ? "AMBER" : "GREEN";

  return (
    <div style={{ opacity, transform: `translateX(${x}px)`, display: "flex", alignItems: "center", gap: 12, background: COLORS.navyCard, border: `1px solid ${COLORS.navyBorder}`, borderRadius: 9, padding: "9px 14px" }}>
      <div style={{ width: 9, height: 9, borderRadius: "50%", background: city.color, boxShadow: `0 0 8px ${city.color}`, flexShrink: 0 }} />
      <div style={{ flex: 1, fontFamily: "system-ui, sans-serif", fontSize: 15, fontWeight: 600, color: COLORS.white }}>{city.name}</div>
      <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 15, fontWeight: 700, color: city.color }}>{city.demand}</div>
      <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, color: COLORS.dimmed, width: 44, textAlign: "right" }}>{zone}</div>
    </div>
  );
}

function IndiaMap({ frame }: { frame: number }) {
  return (
    <svg viewBox="0 0 540 720" width={520} height={690} style={{ filter: "drop-shadow(0 20px 60px rgba(0,0,0,0.5))" }}>
      <defs>
        <radialGradient id="indiaGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(37,99,235,0.14)" />
          <stop offset="100%" stopColor="rgba(37,99,235,0.04)" />
        </radialGradient>
        <filter id="cityGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* India outline — simplified but recognisable */}
      <path
        d="M 192,32 L 280,42 L 360,62 L 430,82 L 480,102
           L 510,132 L 500,178 L 430,218 L 400,288
           L 385,358 L 368,418 L 345,488 L 315,548
           L 285,592 L 260,628 L 240,652
           L 218,628 L 196,578 L 168,518
           L 148,458 L 130,402 L 112,348
           L 102,292 L  96,248 L 108,198
           L 125,155 L 158,108 L 188,64 Z"
        fill="url(#indiaGrad)"
        stroke="rgba(59,130,246,0.25)"
        strokeWidth={1.5}
      />

      {/* All 60 city markers */}
      {ALL_CITIES.map((city, i) => {
        const delay = 25 + i * 3;
        const appear = interpolate(frame, [delay, delay + 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const pulsePhase = (frame - delay) / 45;
        const pulseR  = 14 + 5  * Math.max(0, Math.sin(pulsePhase * Math.PI * 2));
        const pulseOp = 0.25 + 0.2 * Math.max(0, Math.sin(pulsePhase * Math.PI * 2));

        return (
          <g key={city.name} opacity={appear}>
            {city.labeled && (
              <circle cx={city.x} cy={city.y} r={pulseR} fill="none" stroke={city.color} strokeWidth={1.5} opacity={pulseOp} />
            )}
            <circle
              cx={city.x} cy={city.y}
              r={city.labeled ? 5 : 3}
              fill={city.color}
              filter={city.labeled ? "url(#cityGlow)" : undefined}
              opacity={city.labeled ? 1 : 0.72}
            />
            {city.labeled && (
              <>
                <text x={city.x + 10} y={city.y + 4}  fontFamily="system-ui, sans-serif" fontSize={13} fontWeight={700} fill={COLORS.white}>{city.name}</text>
                <text x={city.x + 10} y={city.y + 17} fontFamily="system-ui, sans-serif" fontSize={11} fill={city.color}>{city.demand}</text>
              </>
            )}
          </g>
        );
      })}

      {/* Footer label */}
      <text x={430} y={706} fontFamily="system-ui, sans-serif" fontSize={13} fill={COLORS.dimmed} textAnchor="middle">
        60 cities · Open-Meteo
      </text>
    </svg>
  );
}
