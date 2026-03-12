import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, useFade, useSlideUp, useEntrySpring, staggerDelay, SPRING_CONFIGS, useCountUp } from "../utils/animations";

// 6-level alert scale — from the actual app
const ALERT_LEVELS = [
  { label: "BLUE",    desc: "Off Season",      temp: "< 20°C",  color: "#3B82F6" },
  { label: "GREEN",   desc: "Normal",          temp: "≥ 20°C",  color: "#10B981" },
  { label: "YELLOW",  desc: "Warm",            temp: "≥ 24°C",  color: "#EAB308" },
  { label: "ORANGE",  desc: "High",            temp: "≥ 28°C",  color: "#F97316" },
  { label: "RED",     desc: "EXTREME",         temp: "≥ 32°C",  color: "#EF4444" },
  { label: "PURPLE",  desc: "Kerala Special",  temp: "Coastal", color: "#A855F7" },
];

const ALERTS = [
  {
    priority: "CRITICAL",
    city: "Chennai",
    alertLevel: "RED",
    type: "Heatwave + Demand Surge",
    message: "Night temp 33.1°C — Day 4 of heatwave (≥40°C / ≥28°C threshold). Wet bulb 31.2°C approaching 32°C danger. AC demand projected +28%.",
    action: "Increase distributor stock 50–60% immediately",
    color: "#EF4444",
    icon: "🔥",
    time: "2 hrs ago",
  },
  {
    priority: "HIGH",
    city: "Kochi",
    alertLevel: "KERALA SPECIAL",
    type: "Coastal Hot Night Alert",
    message: "Humid coastal night: 28.9°C / 84% RH. Wet bulb index elevated. Overnight AC usage projected 10+ hrs continuously.",
    action: "Activate Kerala coastal priority distribution",
    color: "#A855F7",
    icon: "🌊",
    time: "3 hrs ago",
  },
  {
    priority: "HIGH",
    city: "Delhi",
    alertLevel: "ORANGE",
    type: "Demand Acceleration",
    message: "Heat dome: Night 31.2°C, Demand Index 90/100. Wave 1 active. Multi-channel alert dispatched via Email + WhatsApp.",
    action: "Accelerate replenishment order +30–40%",
    color: "#F97316",
    icon: "⚡",
    time: "5 hrs ago",
  },
];

const STATS = [
  { label: "Alerts Fired",  value: 47,  suffix: "",  color: "#EF4444"   },
  { label: "Forecast Accuracy", value: 94,  suffix: "%", color: COLORS.emerald },
  { label: "Lead Time",     value: 12,  suffix: "d", color: COLORS.amber },
];

/**
 * Scene 6 — Alert Engine (7s / 210 frames)
 * 6-level color scale · Kerala Special · Wet Bulb · Multi-channel notifications.
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
          padding: "44px 100px 36px",
          gap: 20,
        }}
      >
        {/* ── Heading row ── */}
        <div style={{ opacity: headingOpacity, transform: `translateY(${headingY}px)`, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexShrink: 0 }}>
          <div>
            <div style={{ display: "inline-flex", gap: 10, alignItems: "center", background: "rgba(244,63,94,0.12)", border: `1px solid rgba(244,63,94,0.3)`, borderRadius: 100, padding: "7px 18px", marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontFamily: "system-ui, sans-serif", color: COLORS.rose, fontWeight: 700, letterSpacing: 1 }}>FEATURE 03</span>
            </div>
            <h2 style={{ fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 52, fontWeight: 800, color: COLORS.white, margin: 0, letterSpacing: -1, lineHeight: 1.1 }}>
              Intelligent{" "}
              <span style={{ background: `linear-gradient(135deg, ${COLORS.rose}, ${COLORS.amber})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Alert Engine
              </span>
              <br />
              <span style={{ fontSize: 30, color: COLORS.muted, fontWeight: 500 }}>
                6-Level Color Scale · Multi-Channel Dispatch
              </span>
            </h2>
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            {STATS.map((s, i) => (
              <StatBadge key={i} {...s} delay={28 + i * 16} frame={frame} />
            ))}
          </div>
        </div>

        {/* ── 6-level color spectrum strip ── */}
        <AlertLevelStrip />

        {/* ── Alert cards ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          {ALERTS.map((alert, i) => (
            <AlertCard key={i} alert={alert} index={i} />
          ))}
        </div>

        {/* ── Bottom: Heatwave + Wet Bulb + Channels ── */}
        <StatusFooter />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function AlertLevelStrip() {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
      {ALERT_LEVELS.map((level, i) => {
        const delay = 40 + staggerDelay(i, 14);
        const sp = useEntrySpring(delay, SPRING_CONFIGS.snappy);
        const opacity = interpolate(sp, [0, 1], [0, 1]);
        const y = interpolate(sp, [0, 1], [20, 0]);

        return (
          <div
            key={level.label}
            style={{
              flex: 1,
              opacity,
              transform: `translateY(${y}px)`,
              background: `${level.color}15`,
              border: `1px solid ${level.color}40`,
              borderTop: `3px solid ${level.color}`,
              borderRadius: 10,
              padding: "10px 12px",
              textAlign: "center",
            }}
          >
            <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: 800, color: level.color, letterSpacing: 0.5 }}>
              {level.label}
            </div>
            <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, color: COLORS.muted, marginTop: 3 }}>
              {level.temp}
            </div>
            <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, color: level.color, marginTop: 2, fontWeight: 600 }}>
              {level.desc}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatBadge({ label, value, suffix, color, delay, frame }: { label: string; value: number; suffix: string; color: string; delay: number; frame: number }) {
  const sp = useEntrySpring(delay, SPRING_CONFIGS.snappy);
  const opacity = interpolate(sp, [0, 1], [0, 1]);
  const y = interpolate(sp, [0, 1], [20, 0]);
  const count = useCountUp(value, delay, delay + 55);

  return (
    <div style={{ opacity, transform: `translateY(${y}px)`, background: COLORS.navyCard, border: `1px solid ${COLORS.navyBorder}`, borderTop: `2px solid ${color}`, borderRadius: 12, padding: "14px 22px", textAlign: "center", minWidth: 110 }}>
      <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 32, fontWeight: 800, color }}>{count}{suffix}</div>
      <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, color: COLORS.muted, marginTop: 3 }}>{label}</div>
    </div>
  );
}

function AlertCard({ alert, index }: { alert: typeof ALERTS[0]; index: number }) {
  const delay = 85 + staggerDelay(index, 24);
  const sp = useEntrySpring(delay, SPRING_CONFIGS.smooth);
  const opacity = interpolate(sp, [0, 1], [0, 1]);
  const x = interpolate(sp, [0, 1], [-48, 0]);
  const priorityColor = alert.priority === "CRITICAL" ? "#EF4444" : COLORS.amber;

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${x}px)`,
        background: COLORS.navyCard,
        border: `1px solid ${COLORS.navyBorder}`,
        borderLeft: `3px solid ${alert.color}`,
        borderRadius: 13,
        padding: "16px 24px",
        display: "flex",
        gap: 18,
        alignItems: "flex-start",
      }}
    >
      {/* Icon */}
      <div style={{ width: 46, height: 46, borderRadius: 12, background: `${alert.color}18`, border: `1px solid ${alert.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
        {alert.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
          <span style={{ background: `${priorityColor}20`, border: `1px solid ${priorityColor}50`, color: priorityColor, fontFamily: "system-ui, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, padding: "2px 9px", borderRadius: 100 }}>
            {alert.priority}
          </span>
          <span style={{ background: `${alert.color}15`, border: `1px solid ${alert.color}40`, color: alert.color, fontFamily: "system-ui, sans-serif", fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 100 }}>
            {alert.alertLevel}
          </span>
          <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: COLORS.white }}>
            {alert.city} — {alert.type}
          </span>
          <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, color: COLORS.dimmed, marginLeft: "auto" }}>{alert.time}</span>
        </div>
        <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, color: COLORS.muted, margin: "0 0 8px", lineHeight: 1.5 }}>
          {alert.message}
        </p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(16,185,129,0.1)", border: `1px solid rgba(16,185,129,0.25)`, borderRadius: 7, padding: "7px 13px", fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: 600, color: COLORS.emerald }}>
          <span>✓</span> {alert.action}
        </div>
      </div>
    </div>
  );
}

function StatusFooter() {
  const sp = useEntrySpring(160, SPRING_CONFIGS.smooth);
  const opacity = interpolate(sp, [0, 1], [0, 1]);
  const y = interpolate(sp, [0, 1], [16, 0]);

  return (
    <div style={{ opacity, transform: `translateY(${y}px)`, display: "flex", gap: 14, flexShrink: 0 }}>
      {/* Heatwave tracker */}
      <div style={{ flex: 1, background: "rgba(239,68,68,0.08)", border: `1px solid rgba(239,68,68,0.25)`, borderRadius: 10, padding: "11px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 20 }}>🌡️</span>
        <div>
          <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, fontWeight: 700, color: "#EF4444", letterSpacing: 1 }}>HEATWAVE ACTIVE</div>
          <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, color: COLORS.muted }}>Day 4 · 40.8°C / 28.9°C · threshold: ≥40°C day + ≥28°C night × 3 days</div>
        </div>
      </div>
      {/* Wet bulb */}
      <div style={{ flex: 1, background: "rgba(245,158,11,0.08)", border: `1px solid rgba(245,158,11,0.25)`, borderRadius: 10, padding: "11px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 20 }}>💧</span>
        <div>
          <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, fontWeight: 700, color: COLORS.amber, letterSpacing: 1 }}>WET BULB TEMP</div>
          <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, color: COLORS.muted }}>Chennai: 31.2°C &nbsp;·&nbsp; Danger threshold: 32°C (Stull 2011)</div>
        </div>
      </div>
      {/* Notification channels */}
      <div style={{ flex: "0 0 320px", background: "rgba(16,185,129,0.08)", border: `1px solid rgba(16,185,129,0.25)`, borderRadius: 10, padding: "11px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 20 }}>📡</span>
        <div>
          <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, fontWeight: 700, color: COLORS.emerald, letterSpacing: 1 }}>DISPATCHED VIA</div>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            {[["✉ Email", "#3B82F6"], ["💬 SMS", "#10B981"], ["📱 WhatsApp", "#25D366"]].map(([label, color]) => (
              <span key={label} style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, fontWeight: 600, color }}>{label}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
