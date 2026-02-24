import { useState, useEffect, useRef, useCallback } from "react";

// ─── Waveform data ────────────────────────────────────────────────────────────
const BAR_HEIGHTS = [
  3, 3, 3, 3, 3, 3, 3, 3, 11, 11, 11, 11, 9, 23, 25, 29, 25, 19, 9, 13, 11, 11,
  11, 17, 17, 11, 13, 13, 13, 15, 47, 109, 179, 113, 119, 191, 199, 197, 167,
  143, 109, 71, 65, 61, 41, 35, 21, 13, 15, 13, 15, 17, 13, 15, 15, 15, 73, 169,
  131, 123, 109, 101, 79, 113, 135, 113, 99, 75, 11, 17, 17, 11, 13, 13, 13, 15,
  47, 109, 179, 113, 119, 191, 199, 197, 167, 143, 109, 71, 65, 61, 41, 35, 21,
];
const MAX_BAR = 199;
const PILL_H = 86;

// ─── Bitmap font (5 cols × 7 rows) ───────────────────────────────────────────
const FONT_BITMAP = {
  " ": ["000", "000", "000", "000", "000", "000", "000"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10001", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "'": ["00100", "00100", "00000", "00000", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
};

const PADDING = 0.33;
const USABLE = 1 - PADDING * 2;

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
          top: PADDING + (runStart / numRows) * USABLE,
          height: ((r - runStart) / numRows) * USABLE,
        });
        runStart = -1;
      }
    }
    return segments;
  });
}

const FONT = Object.fromEntries(
  Object.entries(FONT_BITMAP).map(([k, v]) => [k, bitmapToColumnSegments(v)]),
);

// ─── Word cues ────────────────────────────────────────────────────────────────
const WORDS = [
  { start: 0.1, end: 0.2, text: "CH" },
  { start: 0.2, end: 0.3, text: "CHH" },
  { start: 0.3, end: 0.43, text: "CHECK" },
  { start: 0.46, end: 0.54, text: "ONE" },
  { start: 0.57, end: 0.65, text: "TWO" },
];

// Exit anim duration — must be longer than segMerge (500ms) + max center-out stagger
const EXIT_DURATION = 750;

function buildWordColumns(text) {
  const cols = [];
  [...text.toUpperCase()].forEach((char, ci) => {
    (FONT[char] ?? FONT[" "]).forEach((segs) => cols.push(segs));
    if (ci < text.length - 1) cols.push(null);
  });
  return cols;
}

// ─── Keyframes ────────────────────────────────────────────────────────────────
const STYLE = `
  @keyframes segGrow {
    0%   { transform: scaleY(0.02); background: #b0b0b0; }
    40%  { background: #b0b0b0; }
    70%  { transform: scaleY(1.45); }
    85%  { transform: scaleY(0.85); }
    100% { transform: scaleY(1);    background: #9fcc9f; }
  }
  @keyframes segMerge {
    0%   { transform: scaleY(1);    background: #9fcc9f; }
    40%  { transform: scaleY(1.1);  background: #b8d4b8; }
    100% { transform: scaleY(0.02); background: #b0b0b0; }
  }
  @keyframes barShrink {
    from { transform: translateY(-50%) scaleY(1);    opacity: 1; }
    to   { transform: translateY(-50%) scaleY(0.02); opacity: 1; }
  }
  @keyframes barReveal {
    0%   { transform: translateY(-50%) scaleY(0.02); opacity: 0; }
    60%  { transform: translateY(-50%) scaleY(0.02); opacity: 0; }
    100% { transform: translateY(-50%) scaleY(1);    opacity: 1; }
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function AudioPlayer() {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [displayWord, setDisplayWord] = useState(null);
  const [exitingWord, setExitingWord] = useState(null);
  const [exitingZoneStart, setExitingZoneStart] = useState(-1);
  const [exitingZoneEnd, setExitingZoneEnd] = useState(-1);

  const lockedZoneEnd = useRef(null);
  const intervalRef = useRef(null);
  const waveformRef = useRef(null);
  const exitWordTimer = useRef(null);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 1) {
            setPlaying(false);
            return 0;
          }
          return p + 0.002;
        });
      }, 30);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing]);

  const activeWord =
    WORDS.find((w) => progress >= w.start && progress < w.end) ?? null;

  // Promote a word+zone to the independent exit overlay
  const promoteToExit = useCallback((word, zoneEnd) => {
    const cols = buildWordColumns(word.text);
    const start = Math.max(0, zoneEnd - cols.length);
    setExitingWord(word);
    setExitingZoneStart(start);
    setExitingZoneEnd(zoneEnd);
    clearTimeout(exitWordTimer.current);
    exitWordTimer.current = setTimeout(
      () => setExitingWord(null),
      EXIT_DURATION,
    );
  }, []);

  useEffect(() => {
    if (activeWord) {
      if (!displayWord || displayWord.text !== activeWord.text) {
        // Promote current word to exit overlay before swapping in new one
        if (displayWord) {
          promoteToExit(
            displayWord,
            lockedZoneEnd.current ?? Math.floor(progress * BAR_HEIGHTS.length),
          );
        }
        lockedZoneEnd.current = Math.floor(progress * BAR_HEIGHTS.length);
        setDisplayWord(activeWord);
      }
    } else if (displayWord) {
      // No incoming word — promote to exit overlay and clear display
      promoteToExit(
        displayWord,
        lockedZoneEnd.current ?? Math.floor(progress * BAR_HEIGHTS.length),
      );
      setDisplayWord(null);
      lockedZoneEnd.current = null;
    }
  }, [activeWord?.text]);

  const handleWaveformClick = useCallback((e) => {
    const rect = waveformRef.current.getBoundingClientRect();
    setProgress(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
  }, []);

  const playedBars = Math.floor(progress * BAR_HEIGHTS.length);
  const TRACK_PAD = 12;
  const BTN_W = 64 + 8;
  const BAR_W = 2.5;
  const WAVEFORM_W = 453 - TRACK_PAD * 2 - BTN_W;
  const BAR_GAP =
    (WAVEFORM_W - BAR_HEIGHTS.length * BAR_W) / (BAR_HEIGHTS.length - 1);
  const indicatorLeft = TRACK_PAD + progress * WAVEFORM_W;
  const timeLabel = `0:${String(Math.round(progress * 100)).padStart(2, "0")}`;
  const wordColumns = displayWord ? buildWordColumns(displayWord.text) : null;

  const zoneEnd = lockedZoneEnd.current ?? playedBars;
  const zoneStart = wordColumns
    ? Math.max(0, zoneEnd - wordColumns.length)
    : -1;

  const exitingColumns = exitingWord
    ? buildWordColumns(exitingWord.text)
    : null;
  const exitingCenter = exitingColumns ? (exitingColumns.length - 1) / 2 : 0;

  return (
    <div style={s.page}>
      <style>{STYLE}</style>
      <div>
        {" "}
        <svg
          viewBox="0 0 1471 249"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={s.logo}
        >
          <path
            d="M313.5 31.9998H252V0.0498047H414.71V31.9998H352.93V200H313.5V31.9998Z"
            fill="currentColor"
          ></path>
          <path
            d="M405.15 136.28C407.08 161.65 424.73 174.06 442.65 174.06C454.23 174.06 466.09 169.93 473.81 156.96H513C505 179.03 483.22 203.57 443 203.57C395.29 203.57 367.43 167.99 367.43 125.25C367.43 81.1301 398.05 48.3101 441.89 48.3101C487.67 48.3101 516.35 83.8801 514.7 136.31L405.15 136.28ZM405.7 110.08H476C475.17 84.9901 457.52 76.1601 441.53 76.1601C427.21 76.1601 408.73 85.2601 405.7 110.08Z"
            fill="currentColor"
          ></path>
          <path
            d="M565.771 200H527.711V0.0498047H565.771V200Z"
            fill="currentColor"
          ></path>
          <path
            d="M616.56 136.23C618.49 161.6 636.14 174.01 654.06 174.01C665.65 174.01 677.5 169.88 685.22 156.92H724.39C716.39 178.98 694.6 203.52 654.39 203.52C606.68 203.52 578.83 167.95 578.83 125.2C578.83 81.0798 609.44 48.2598 653.29 48.2598C699.06 48.2598 727.74 83.8298 726.09 136.26L616.56 136.23ZM617.11 110.03H687.43C686.6 84.9398 669 76.1098 653 76.1098C638.62 76.1098 620.14 85.2098 617.11 110V110.03Z"
            fill="currentColor"
          ></path>
          <path
            d="M739.119 248.2V51.57H777.179V70.57C785.179 56.78 801.179 48.23 819.929 48.23C855.779 48.23 884.459 79.12 884.459 125.72C884.459 173.16 854.949 203.49 819.649 203.49C804.209 203.49 786.559 197.42 777.179 181.15V248.15L739.119 248.2ZM844.469 126C844.469 97 830.129 77.46 810.549 77.46C789.549 77.46 775.799 95.94 775.799 125.72C775.799 156.06 789.589 174.26 810.549 174.26C830.129 174.29 844.469 155 844.469 126Z"
            fill="currentColor"
          ></path>
          <path
            d="M943.48 203.52C915.07 203.52 890 187 890 160C890 125 929.43 114.5 987.62 107.88V105.4C987.62 82.51 975.21 74.51 959.77 74.51C945.15 74.51 933.02 82.23 932.19 98.51H896.6C899.35 69.28 923.6 47.77 961.68 47.77C996.98 47.77 1025.68 62.94 1025.68 113.13C1025.68 117.82 1025.13 137.39 1025.13 150.91C1025.13 174.35 1026.78 187.59 1029.54 200H994.54C993.253 193.888 992.404 187.693 992 181.46C981.53 196.9 965.82 203.52 943.48 203.52ZM988.7 132.1C946.23 136.51 929.14 141.47 929.14 158.02C929.14 168.77 937.69 177.6 954.78 177.6C978.5 177.6 988.7 164.6 988.7 143.13V132.1Z"
            fill="currentColor"
          ></path>
          <path
            d="M1049 11.3101H1087V51.5701H1118V77.7701H1087.11V154.43C1087.11 169.6 1092.35 172.63 1105.87 172.63H1117.45V199.94H1089.6C1055.68 199.94 1049.06 189.46 1049.06 159.94V77.7701H1028.06V51.5701H1049.06L1049 11.3101Z"
            fill="currentColor"
          ></path>
          <path
            d="M1168.52 71.15C1177.07 56.26 1193.34 48.26 1211.52 48.26C1247.09 48.26 1262.81 70.05 1262.81 106.45V199.94H1224.75V114.72C1224.75 95.42 1220.62 78.87 1199.11 78.87C1174.01 78.87 1168.49 99.28 1168.49 122.72V199.94H1130.49V0H1168.49L1168.52 71.15Z"
            fill="currentColor"
          ></path>
          <path
            d="M1313.91 0V35.3H1275.85V0H1313.91ZM1313.91 51.57V199.94H1275.85V51.57H1313.91Z"
            fill="currentColor"
          ></path>
          <path
            d="M1468.67 102.31H1432.27C1429.51 88.2498 1415.73 77.7698 1401.39 77.7698C1381.53 77.7698 1365.81 94.5898 1365.81 125.48C1365.81 156.64 1380.7 174.01 1401.66 174.01C1414.66 174.01 1428.66 167.4 1433.66 149.47H1470.06C1461.24 190.01 1430.35 203.52 1399.74 203.52C1355.34 203.52 1326.94 170.7 1326.94 126.03C1326.94 80.7998 1357 48.2598 1401.4 48.2598C1432.27 48.2598 1463.71 65.3598 1468.67 102.31Z"
            fill="currentColor"
          ></path>
          <path
            d="M180 200H146V0H180C185.304 0 190.391 2.10714 194.142 5.85786C197.893 9.60859 200 14.6957 200 20V180C200 185.304 197.893 190.391 194.142 194.142C190.391 197.893 185.304 200 180 200ZM91 0V100H73V200H129V0H91ZM39 100V0H20C14.6957 0 9.60859 2.10714 5.85786 5.85786C2.10714 9.60859 0 14.6957 0 20L0 180C0 185.304 2.10714 190.391 5.85786 194.142C9.60859 197.893 14.6957 200 20 200H56V100H39Z"
            fill="currentColor"
          ></path>
        </svg>
      </div>

      <div style={s.shell}>
        <div style={{ ...s.timeLabel, left: indicatorLeft }}>{timeLabel}</div>

        <div style={s.track}>
          <div
            style={{
              ...s.indicator,
              left: indicatorLeft,
              height: "100%",
              top: 0,
            }}
          />

          <div
            ref={waveformRef}
            style={{ ...s.waveformWrap, gap: BAR_GAP }}
            onClick={handleWaveformClick}
          >
            {BAR_HEIGHTS.map((h, i) => {
              const played = i < playedBars;
              const inZone = wordColumns && i >= zoneStart && i < zoneEnd;
              const inExitZone =
                exitingWord && i >= exitingZoneStart && i < exitingZoneEnd;
              const scaledH = Math.max(3, (h / MAX_BAR) * PILL_H);

              if (!inZone) {
                return (
                  <div
                    key={i}
                    style={{
                      ...s.bar,
                      height: scaledH,
                      background: played ? "#b0b0b0" : "#606060",
                      opacity: inExitZone ? 0 : 1,
                    }}
                  />
                );
              }

              const colIdx = i - zoneStart;
              const centerIdx = (wordColumns.length - 1) / 2;
              const distFromCenter = Math.abs(colIdx - centerIdx);
              const segs = wordColumns[colIdx];

              if (segs === null) {
                return (
                  <div
                    key={i}
                    style={{
                      ...s.bar,
                      height: 3,
                      background: "#9fcc9f",
                      opacity: 0.3,
                    }}
                  />
                );
              }

              return (
                <div key={i} style={s.letterCol}>
                  {/* Bar shrinks out as word enters */}
                  <div
                    style={{
                      ...s.bar,
                      position: "absolute",
                      top: "50%",
                      transform: "translateY(-50%)",
                      height: scaledH,
                      background: "#b0b0b0",
                      transformOrigin: "center",
                      animation: `barShrink 0.35s cubic-bezier(0.4, 0, 1, 1) both`,
                      animationDelay: `${distFromCenter * 25}ms`,
                    }}
                  />
                  {segs.map((seg, j) => (
                    <div
                      key={j}
                      style={{
                        position: "absolute",
                        top: `${seg.top * 100}%`,
                        height: `${seg.height * 100}%`,
                        width: "100%",
                        background: "#9fcc9f",
                        borderRadius: 1,
                        transformOrigin: "center",
                        animation: `segGrow 0.60s cubic-bezier(0.34, 1.56, 0.64, 1) both`,
                        animationDelay: `${distFromCenter * 25}ms`,
                      }}
                    />
                  ))}
                </div>
              );
            })}

            {/* Independent exiting zone — renders on top, unaffected by incoming word */}
            {exitingColumns &&
              exitingColumns.map((segs, colIdx) => {
                const barIdx = exitingZoneStart + colIdx;
                const h = BAR_HEIGHTS[barIdx] ?? 3;
                const scaledH = Math.max(3, (h / MAX_BAR) * PILL_H);
                const distFromCenter = Math.abs(colIdx - exitingCenter);
                const slotW = BAR_W + BAR_GAP;
                const leftPx = exitingZoneStart * slotW + colIdx * slotW;

                if (segs === null) return null;

                return (
                  <div
                    key={`ex-${colIdx}`}
                    style={{
                      ...s.letterCol,
                      position: "absolute",
                      left: leftPx,
                      top: 0,
                      bottom: 0,
                      pointerEvents: "none",
                    }}
                  >
                    {/* Waveform bar grows back in */}
                    <div
                      style={{
                        ...s.bar,
                        position: "absolute",
                        top: "50%",
                        transform: "translateY(-50%)",
                        height: scaledH,
                        background: "#b0b0b0",
                        transformOrigin: "center",
                        animation: `barReveal 0.55s ease-out both`,
                        animationDelay: `${distFromCenter * 25}ms`,
                      }}
                    />
                    {/* Letter segs merge back to grey */}
                    {segs.map((seg, j) => (
                      <div
                        key={j}
                        style={{
                          position: "absolute",
                          top: `${seg.top * 100}%`,
                          height: `${seg.height * 100}%`,
                          width: "100%",
                          background: "#9fcc9f",
                          borderRadius: 1,
                          transformOrigin: "center",
                          animation: `segMerge 0.50s cubic-bezier(0.4, 0, 0.8, 1) both`,
                          animationDelay: `${distFromCenter * 25}ms`,
                        }}
                      />
                    ))}
                  </div>
                );
              })}
          </div>

          <button
            style={s.btn}
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <div style={s.pauseWrap}>
                <div style={s.pauseBar} />
                <div style={s.pauseBar} />
              </div>
            ) : (
              <div style={s.playTriangle} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  page: {
    minHeight: "100vh",
    minWidth: "100vw",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    background: "#3c3c3c",
  },
  logo: { width: "114px", height: "auto", paddingBottom: "18px" },
  shell: { position: "relative" },
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
    height: "100%",
    paddingRight: 8,
    overflow: "hidden",
    cursor: "pointer",
  },
  indicator: {
    position: "absolute",
    width: 2,
    background: "#FF6C2F",
    borderRadius: 1,
    pointerEvents: "none",
    zIndex: 5,
    transition: "left 0.03s linear",
  },
  timeLabel: {
    position: "absolute",
    top: -20,
    transform: "translateX(-50%)",
    color: "#FF6C2F",
    fontSize: 11,
    fontFamily: "monospace",
    fontWeight: 600,
    pointerEvents: "none",
    zIndex: 20,
    transition: "left 0.03s linear",
    whiteSpace: "nowrap",
  },
  bar: { width: 2.5, borderRadius: 2, flexShrink: 0 },
  letterCol: {
    position: "relative",
    width: 2.5,
    height: "100%",
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
    boxShadow:
      "0px 15px 30px rgba(0,0,0,0.3), inset 0px 1.7px 1.7px rgba(255,255,255,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    outline: "none",
    position: "relative",
    zIndex: 10,
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderTop: "10px solid transparent",
    borderBottom: "10px solid transparent",
    borderLeft: "17px solid #D8D8D8",
    marginLeft: 4,
  },
  pauseWrap: { display: "flex", gap: 6, alignItems: "center" },
  pauseBar: { width: 5, height: 20, background: "#D8D8D8", borderRadius: 2 },
};
