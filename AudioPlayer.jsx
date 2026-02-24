import { useState, useEffect, useRef, useCallback } from "react";

// ─── Waveform data ────────────────────────────────────────────────────────────
const BAR_HEIGHTS = [
  3,3,3,3,3,3,3,3,
  11,11,11,11,9,
  23,25,29,25,19,9,13,11,11,11,
  17,17,11,13,13,13,
  15,47,109,179,113,119,191,199,197,167,143,109,71,65,61,41,35,21,
  13,15,13,15,17,13,15,15,15,
  73,169,131,123,109,101,79,113,135,113,99,75,
  11,17,17,11,13,13,13,15,
  47,109,179,113,119,191,199,197,167,143,109,71,65,61,41,35,21,
];
const MAX_BAR = 199;
const PILL_H  = 86;

// ─── Bitmap font (5 cols × 7 rows) ───────────────────────────────────────────
const FONT_BITMAP = {
  " ": ["000","000","000","000","000","000","000"],
  A:   ["01110","10001","10001","11111","10001","10001","10001"],
  B:   ["11110","10001","10001","11110","10001","10001","11110"],
  C:   ["01111","10000","10000","10000","10000","10000","01111"],
  D:   ["11100","10010","10001","10001","10001","10010","11100"],
  E:   ["11111","10000","10000","11110","10000","10000","11111"],
  F:   ["11111","10000","10000","11110","10000","10000","10000"],
  G:   ["01111","10000","10000","10111","10001","10001","01110"],
  H:   ["10001","10001","10001","11111","10001","10001","10001"],
  I:   ["11111","00100","00100","00100","00100","00100","11111"],
  J:   ["00111","00010","00010","00010","10010","10010","01100"],
  K:   ["10001","10010","10100","11000","10100","10010","10001"],
  L:   ["10000","10000","10000","10000","10000","10000","11111"],
  M:   ["10001","11011","10101","10001","10001","10001","10001"],
  N:   ["10001","11001","10101","10011","10001","10001","10001"],
  O:   ["01110","10001","10001","10001","10001","10001","01110"],
  P:   ["11110","10001","10001","11110","10000","10000","10000"],
  Q:   ["01110","10001","10001","10001","10101","10010","01101"],
  R:   ["11110","10001","10001","11110","10100","10010","10001"],
  S:   ["01111","10000","10000","01110","00001","00001","11110"],
  T:   ["11111","00100","00100","00100","00100","00100","00100"],
  U:   ["10001","10001","10001","10001","10001","10001","01110"],
  V:   ["10001","10001","10001","10001","10001","01010","00100"],
  W:   ["10001","10001","10001","10101","10101","11011","10001"],
  X:   ["10001","10001","01010","00100","01010","10001","10001"],
  Y:   ["10001","10001","01010","00100","00100","00100","00100"],
  Z:   ["11111","00001","00010","00100","01000","10000","11111"],
  "-": ["00000","00000","00000","11111","00000","00000","00000"],
  "'": ["00100","00100","00000","00000","00000","00000","00000"],
  "!": ["00100","00100","00100","00100","00100","00000","00100"],
};

const PADDING = 0.33;
const USABLE  = 1 - PADDING * 2;

function bitmapToColumnSegments(rows) {
  const numRows = rows.length;
  const numCols = rows[0].length;
  return Array.from({ length: numCols }, (_, c) => {
    const segments = [];
    let runStart = -1;
    for (let r = 0; r <= numRows; r++) {
      const on = r < numRows && rows[r][c] === "1";
      if (on && runStart === -1) runStart = r;
      if (!on && runStart !== -1) {
        segments.push({
          top:    PADDING + (runStart / numRows) * USABLE,
          height: ((r - runStart) / numRows) * USABLE,
        });
        runStart = -1;
      }
    }
    return segments;
  });
}

const FONT = Object.fromEntries(
  Object.entries(FONT_BITMAP).map(([k, v]) => [k, bitmapToColumnSegments(v)])
);

// ─── Word cues ────────────────────────────────────────────────────────────────
const WORDS = [
  { start: 0.15, end: 0.35, text: "A-HMM" },
  { start: 0.52, end: 0.70, text: "HELLO" },
  { start: 0.75, end: 0.97, text: "WORLD" },
];

function buildWordColumns(text) {
  const cols = [];
  [...text.toUpperCase()].forEach((char, ci) => {
    (FONT[char] ?? FONT[" "]).forEach(segs => cols.push(segs));
    if (ci < text.length - 1) cols.push(null); // letter gap
  });
  return cols;
}

// ─── Keyframes ────────────────────────────────────────────────────────────────
const STYLE = `
  @keyframes segGrow {
    from { transform: scaleY(0); opacity: 0; }
    to   { transform: scaleY(1); opacity: 1; }
  }
  @keyframes segShrink {
    from { transform: scaleY(1); opacity: 1; }
    to   { transform: scaleY(0); opacity: 0; }
  }
  @keyframes barFadeIn {
    from { transform: translateY(-50%) scaleY(0); opacity: 0; }
    to   { transform: translateY(-50%) scaleY(1); opacity: 1; }
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function AudioPlayer() {
  const [playing,     setPlaying]     = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [displayWord, setDisplayWord] = useState(null);
  const [exiting,     setExiting]     = useState(false);
  // Lock the word zone start bar when the word first appears so it doesn't drift
  const lockedZoneEnd = useRef(null);
  const intervalRef   = useRef(null);
  const waveformRef   = useRef(null);
  const exitTimer     = useRef(null);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setProgress(p => {
          if (p >= 1) { setPlaying(false); return 0; }
          return p + 0.002;
        });
      }, 30);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing]);

  const activeWord = WORDS.find(w => progress >= w.start && progress < w.end) ?? null;

  useEffect(() => {
    clearTimeout(exitTimer.current);
    if (activeWord) {
      if (!displayWord || displayWord.text !== activeWord.text) {
        // Lock the zone end to the bar index at the moment the word appears
        lockedZoneEnd.current = Math.floor(progress * BAR_HEIGHTS.length);
        setExiting(false);
        setDisplayWord(activeWord);
      }
    } else if (displayWord) {
      setExiting(true);
      exitTimer.current = setTimeout(() => {
        setDisplayWord(null);
        setExiting(false);
        lockedZoneEnd.current = null;
      }, 350);
    }
  }, [activeWord?.text]);

  const handleWaveformClick = useCallback((e) => {
    const rect = waveformRef.current.getBoundingClientRect();
    setProgress(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
  }, []);

  const playedBars    = Math.floor(progress * BAR_HEIGHTS.length);
  const currentBarH   = BAR_HEIGHTS[Math.min(playedBars, BAR_HEIGHTS.length - 1)];
  const indicatorH    = Math.max(3, (currentBarH / MAX_BAR) * PILL_H);
  // Pin indicator to the exact pixel position of the current bar slot
  const BAR_SLOT      = 2.5 + 3; // bar width + gap
  const indicatorLeft = playedBars * BAR_SLOT + 1.25; // centre of bar
  const wordColumns = displayWord ? buildWordColumns(displayWord.text) : null;

  // The word zone is a fixed slice of bar indices, locked when word appeared
  const zoneEnd   = lockedZoneEnd.current ?? playedBars;
  const zoneStart = wordColumns ? Math.max(0, zoneEnd - wordColumns.length) : -1;

  return (
    <div style={s.page}>
      <style>{STYLE}</style>
      <div style={s.track}>

        <div ref={waveformRef} style={s.waveformWrap} onClick={handleWaveformClick}>

          {/* Playhead — full height, pixel-aligned to current bar */}
          <div style={{
            ...s.indicator,
            left:   indicatorLeft,
            height: "100%",
            top:    0,
          }} />

          {/* Bars — letter zone bars render as bitmap columns, rest as waveform */}
          {BAR_HEIGHTS.map((h, i) => {
            const played    = i < playedBars;
            const inZone    = wordColumns && i >= zoneStart && i < zoneEnd;
            const scaledH   = Math.max(3, (h / MAX_BAR) * PILL_H);

            if (!inZone) {
              return (
                <div key={i} style={{
                  ...s.bar,
                  height: scaledH,
                  background: played ? "#b0b0b0" : "#606060",
                }} />
              );
            }

            // This bar slot is inside the word zone — render as a letter column
            const colIdx = i - zoneStart;
            const segs   = wordColumns[colIdx];

            // null = inter-letter gap column
            if (segs === null) {
              return <div key={i} style={{ ...s.bar, height: 3, background: "#9fcc9f", opacity: 0.3 }} />;
            }

            return (
              <div key={i} style={s.letterCol}>
                {/* Waveform bar restores centred — matches letter seg scaleY origin */}
                <div style={{
                  ...s.bar,
                  position:        "absolute",
                  top:             "50%",
                  transform:       `translateY(-50%)`,
                  height:          scaledH,
                  background:      "#b0b0b0",
                  transformOrigin: "center",
                  animation:       exiting ? `barFadeIn 0.25s ease-out both` : "none",
                  animationDelay:  exiting ? `${colIdx * 6}ms` : "0ms",
                  opacity:         exiting ? undefined : 0,
                }} />
                {segs.map((seg, j) => (
                  <div key={j} style={{
                    position:        "absolute",
                    top:             `${seg.top    * 100}%`,
                    height:          `${seg.height * 100}%`,
                    width:           "100%",
                    background:      "#9fcc9f",
                    borderRadius:    1,
                    transformOrigin: "center",
                    animation:       exiting
                      ? `segShrink 0.2s ease-in both`
                      : `segGrow 0.25s ease-out both`,
                    animationDelay:  exiting
                      ? `${colIdx * 6}ms`
                      : `${colIdx * 18}ms`,
                  }} />
                ))}
              </div>
            );
          })}

        </div>

        {/* Play / Pause */}
        <button style={s.btn} onClick={() => setPlaying(p => !p)} aria-label={playing ? "Pause" : "Play"}>
          {playing
            ? <div style={s.pauseWrap}><div style={s.pauseBar} /><div style={s.pauseBar} /></div>
            : <div style={s.playTriangle} />
          }
        </button>

      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#3c3c3c",
  },
  track: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    background: "#2f2f2f",
    borderRadius: 170,
    width: 453,
    height: PILL_H,
    padding: "0 12px",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  waveformWrap: {
    flex: 1,
    position: "relative",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: "100%",
    paddingRight: 8,
    overflow: "hidden",
    cursor: "pointer",
  },
  indicator: {
    position:      "absolute",
    width:         2,
    background:    "#FF6C2F",
    borderRadius:  1,
    pointerEvents: "none",
    zIndex:        10,
    transition:    "left 0.03s linear, height 0.03s linear, top 0.03s linear",
  },
  bar: {
    width: 2.5,
    borderRadius: 2,
    flexShrink: 0,
  },
  // A bar slot that can hold multiple positioned segments
  letterCol: {
    position:  "relative",
    width:     2.5,
    height:    "100%",
    flexShrink: 0,
  },
  btn: {
    flexShrink: 0,
    width: 64,
    height: 64,
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    background: "linear-gradient(180deg, #404040 0%, #191919 100%)",
    boxShadow: "0px 15px 30px rgba(0,0,0,0.3), inset 0px 1.7px 1.7px rgba(255,255,255,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    outline: "none",
  },
  playTriangle: {
    width: 0, height: 0,
    borderTop: "10px solid transparent",
    borderBottom: "10px solid transparent",
    borderLeft: "17px solid #D8D8D8",
    marginLeft: 4,
  },
  pauseWrap: { display: "flex", gap: 6, alignItems: "center" },
  pauseBar:  { width: 5, height: 20, background: "#D8D8D8", borderRadius: 2 },
};
