import { useState, useEffect, useRef, useCallback } from "react";
import demoMp3 from "./assets/demo2.mp3";

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

// ─── Layout constants ─────────────────────────────────────────────────────────
const TRACK_PAD = 12;
const BTN_W = 64 + 8;
const WAVEFORM_W = 453 - TRACK_PAD * 2 - BTN_W;

// ─── Dot grid constants ───────────────────────────────────────────────────────
const DOT_SIZE = 3.5;
const DOT_SPACING = 8;
const GRID_ROWS = 11;
const GRID_COLS = Math.floor(WAVEFORM_W / DOT_SPACING); // 44
const DOT_TOP_OFFSET =
  (PILL_H - ((GRID_ROWS - 1) * DOT_SPACING + DOT_SIZE)) / 2;
const DOT_LEFT_PAD = (WAVEFORM_W - GRID_COLS * DOT_SPACING) / 2;
const FONT_ROW_OFFSET = Math.floor((GRID_ROWS - 7) / 2);

// ─── Bitmap font (kept for future word-cue integration) ───────────────────────
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

function bitmapToColumnDots(rows) {
  return Array.from({ length: rows[0].length }, (_, c) =>
    Array.from({ length: GRID_ROWS }, (_, r) => {
      const fr = r - FONT_ROW_OFFSET;
      return fr >= 0 && fr < rows.length && rows[fr][c] === "1";
    }),
  );
}

const FONT_DOTS = Object.fromEntries(
  Object.entries(FONT_BITMAP).map(([k, v]) => [k, bitmapToColumnDots(v)]),
);

// Word cues & exit timing (kept for future integration)
const WORDS = [
  { start: 0.1, end: 0.2, text: "CH" },
  { start: 0.2, end: 0.3, text: "CHH" },
  { start: 0.3, end: 0.43, text: "CHECK" },
  { start: 0.46, end: 0.54, text: "ONE" },
  { start: 0.57, end: 0.65, text: "TWO" },
];
const EXIT_DURATION = 750;

// ─── Dot color ────────────────────────────────────────────────────────────────
// Contrast knobs:
const DIM_OPACITY = 0.04; // unlit "ghost" dots  — lower = darker background
const MIN_BRIGHT = 0; // lit dot minimum opacity (at column edge)
const MAX_BRIGHT = 1.8; // lit dot peak opacity  (at column centre)
const EDGE_FALLOFF = 0.5; // how fast brightness drops toward edges (0=flat, 1=steep)

function getDotColor(r, numLit, amplitude) {
  const top = Math.floor((GRID_ROWS - numLit) / 2);
  if (r < top || r >= top + numLit) {
    return `rgba(144,169,234,${DIM_OPACITY})`;
    //return `rgba(255,255,255,${DIM_OPACITY})`;
  }
  const colCenter = (GRID_ROWS - 1) / 2;
  const dist = Math.abs(r - colCenter) / (GRID_ROWS / 2);
  const opacity = Math.min(
    MAX_BRIGHT,
    (1 - dist * EDGE_FALLOFF) *
      (MIN_BRIGHT + amplitude * (MAX_BRIGHT - MIN_BRIGHT)),
  );
  return `rgba(220,228,255,${opacity.toFixed(3)})`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AudioPlayer() {
  const [playing, setPlaying] = useState(false);
  // Amplitude buffer: index 0 = oldest (left), GRID_COLS-1 = newest (right).
  // Pre-filled with the BAR_HEIGHTS shape so there's a visible waveform before play.
  const [buffer, setBuffer] = useState(() =>
    Array.from({ length: GRID_COLS }, (_, c) => {
      const bi = Math.round((c * (BAR_HEIGHTS.length - 1)) / (GRID_COLS - 1));
      return (BAR_HEIGHTS[bi] / MAX_BAR) * 0.3;
    }),
  );

  const audioRef = useRef(null);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const animFrameRef = useRef(null);
  const setupDoneRef = useRef(false);

  // ── Web Audio setup (once, on first user gesture) ──────────────────────────
  const setupAudio = useCallback(() => {
    if (setupDoneRef.current) return;
    setupDoneRef.current = true;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    // 2048 samples ≈ 46 ms window — at 120 Hz speech that's ~5-6 half-cycles
    // across 44 columns, giving the multi-peak waveform look.
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0; // we do our own per-column smoothing
    ctx.createMediaElementSource(audioRef.current).connect(analyser);
    analyser.connect(ctx.destination);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
  }, []);

  // ── Play / pause toggle ────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    setupAudio();
    if (!playing) {
      if (audioRef.current.ended) audioRef.current.currentTime = 0;
      audioCtxRef.current?.resume();
      audioRef.current.play();
      setPlaying(true);
    } else {
      audioRef.current.pause();
      setPlaying(false);
    }
  }, [playing, setupAudio]);

  // ── Audio "ended" handler ──────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    const onEnd = () => setPlaying(false);
    audio.addEventListener("ended", onEnd);
    return () => audio.removeEventListener("ended", onEnd);
  }, []);

  // ── Animation loop (runs only while playing) ───────────────────────────────
  useEffect(() => {
    if (!playing) return;

    let lastFrame = 0;
    const smooth = new Float32Array(GRID_COLS);
    let peakMax = 0.12; // floor keeps normalization sane during silence

    const animate = (ts) => {
      animFrameRef.current = requestAnimationFrame(animate);
      if (ts - lastFrame < 60) return; // ~30 fps
      lastFrame = ts;

      const analyser = analyserRef.current;
      if (!analyser) return;

      const timeData = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(timeData);

      // First pass: per-column peak and frame maximum
      const rawPeaks = new Float32Array(GRID_COLS);
      let frameMax = 0;
      for (let c = 0; c < GRID_COLS; c++) {
        const lo = Math.floor((c * timeData.length) / GRID_COLS);
        const hi = Math.floor(((c + 1) * timeData.length) / GRID_COLS);
        for (let i = lo; i < hi; i++) {
          rawPeaks[c] = Math.max(
            rawPeaks[c],
            Math.abs(timeData[i] - 128) / 128,
          );
        }
        frameMax = Math.max(frameMax, rawPeaks[c]);
      }

      // const freqData = new Uint8Array(analyser.frequencyBinCount); // ~512 bins
      // analyser.getByteFrequencyData(freqData);

      // const rawPeaks = new Float32Array(GRID_COLS);
      // let frameMax = 0;
      // for (let c = 0; c < GRID_COLS; c++) {
      //   // Map 44 columns to low/mid frequencies (skip extreme bass/treble)
      //   const lo = Math.floor(c * 10); // 10 freq bins per column
      //   const hi = Math.floor((c + 1) * 10);
      //   let colEnergy = 0;
      //   for (let i = lo; i < Math.min(hi, freqData.length); i++) {
      //     colEnergy = Math.max(colEnergy, freqData[i] / 255);
      //   }
      //   rawPeaks[c] = colEnergy;
      //   frameMax = Math.max(frameMax, rawPeaks[c]);
      // }

      // Decay faster so quiet sections actually drop; floor prevents bloat
      peakMax = Math.max(0.12, Math.max(frameMax, peakMax * 0.97));

      setBuffer(
        Array.from({ length: GRID_COLS }, (_, c) => {
          const normalized = rawPeaks[c] / peakMax;
          // Power curve: bottom 35 % of range collapses to baseline, peaks stand out
          const compressed = Math.pow(normalized, 2);
          // Hard gap: columns below the threshold stay at 0 → 1-dot baseline only
          const target =
            compressed < 0.01 ? 0 : Math.min(0.7, compressed * 0.4);
          smooth[c] =
            target > smooth[c]
              ? smooth[c] * 0 + target * 1.8 // fast attack
              : smooth[c] * 0.68 + target * 0.52; // faster decay → gaps appear quickly
          return smooth[c];
        }),
      );
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [playing]);

  return (
    <div style={s.page}>
      {/* Hidden audio element */}
      <audio ref={audioRef} src={demoMp3} preload="auto" />

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
          />
          <path
            d="M405.15 136.28C407.08 161.65 424.73 174.06 442.65 174.06C454.23 174.06 466.09 169.93 473.81 156.96H513C505 179.03 483.22 203.57 443 203.57C395.29 203.57 367.43 167.99 367.43 125.25C367.43 81.1301 398.05 48.3101 441.89 48.3101C487.67 48.3101 516.35 83.8801 514.7 136.31L405.15 136.28ZM405.7 110.08H476C475.17 84.9901 457.52 76.1601 441.53 76.1601C427.21 76.1601 408.73 85.2601 405.7 110.08Z"
            fill="currentColor"
          />
          <path
            d="M565.771 200H527.711V0.0498047H565.771V200Z"
            fill="currentColor"
          />
          <path
            d="M616.56 136.23C618.49 161.6 636.14 174.01 654.06 174.01C665.65 174.01 677.5 169.88 685.22 156.92H724.39C716.39 178.98 694.6 203.52 654.39 203.52C606.68 203.52 578.83 167.95 578.83 125.2C578.83 81.0798 609.44 48.2598 653.29 48.2598C699.06 48.2598 727.74 83.8298 726.09 136.26L616.56 136.23ZM617.11 110.03H687.43C686.6 84.9398 669 76.1098 653 76.1098C638.62 76.1098 620.14 85.2098 617.11 110V110.03Z"
            fill="currentColor"
          />
          <path
            d="M739.119 248.2V51.57H777.179V70.57C785.179 56.78 801.179 48.23 819.929 48.23C855.779 48.23 884.459 79.12 884.459 125.72C884.459 173.16 854.949 203.49 819.649 203.49C804.209 203.49 786.559 197.42 777.179 181.15V248.15L739.119 248.2ZM844.469 126C844.469 97 830.129 77.46 810.549 77.46C789.549 77.46 775.799 95.94 775.799 125.72C775.799 156.06 789.589 174.26 810.549 174.26C830.129 174.29 844.469 155 844.469 126Z"
            fill="currentColor"
          />
          <path
            d="M943.48 203.52C915.07 203.52 890 187 890 160C890 125 929.43 114.5 987.62 107.88V105.4C987.62 82.51 975.21 74.51 959.77 74.51C945.15 74.51 933.02 82.23 932.19 98.51H896.6C899.35 69.28 923.6 47.77 961.68 47.77C996.98 47.77 1025.68 62.94 1025.68 113.13C1025.68 117.82 1025.13 137.39 1025.13 150.91C1025.13 174.35 1026.78 187.59 1029.54 200H994.54C993.253 193.888 992.404 187.693 992 181.46C981.53 196.9 965.82 203.52 943.48 203.52ZM988.7 132.1C946.23 136.51 929.14 141.47 929.14 158.02C929.14 168.77 937.69 177.6 954.78 177.6C978.5 177.6 988.7 164.6 988.7 143.13V132.1Z"
            fill="currentColor"
          />
          <path
            d="M1049 11.3101H1087V51.5701H1118V77.7701H1087.11V154.43C1087.11 169.6 1092.35 172.63 1105.87 172.63H1117.45V199.94H1089.6C1055.68 199.94 1049.06 189.46 1049.06 159.94V77.7701H1028.06V51.5701H1049.06L1049 11.3101Z"
            fill="currentColor"
          />
          <path
            d="M1168.52 71.15C1177.07 56.26 1193.34 48.26 1211.52 48.26C1247.09 48.26 1262.81 70.05 1262.81 106.45V199.94H1224.75V114.72C1224.75 95.42 1220.62 78.87 1199.11 78.87C1174.01 78.87 1168.49 99.28 1168.49 122.72V199.94H1130.49V0H1168.49L1168.52 71.15Z"
            fill="currentColor"
          />
          <path
            d="M1313.91 0V35.3H1275.85V0H1313.91ZM1313.91 51.57V199.94H1275.85V51.57H1313.91Z"
            fill="currentColor"
          />
          <path
            d="M1468.67 102.31H1432.27C1429.51 88.2498 1415.73 77.7698 1401.39 77.7698C1381.53 77.7698 1365.81 94.5898 1365.81 125.48C1365.81 156.64 1380.7 174.01 1401.66 174.01C1414.66 174.01 1428.66 167.4 1433.66 149.47H1470.06C1461.24 190.01 1430.35 203.52 1399.74 203.52C1355.34 203.52 1326.94 170.7 1326.94 126.03C1326.94 80.7998 1357 48.2598 1401.4 48.2598C1432.27 48.2598 1463.71 65.3598 1468.67 102.31Z"
            fill="currentColor"
          />
          <path
            d="M180 200H146V0H180C185.304 0 190.391 2.10714 194.142 5.85786C197.893 9.60859 200 14.6957 200 20V180C200 185.304 197.893 190.391 194.142 194.142C190.391 197.893 185.304 200 180 200ZM91 0V100H73V200H129V0H91ZM39 100V0H20C14.6957 0 9.60859 2.10714 5.85786 5.85786C2.10714 9.60859 0 14.6957 0 20L0 180C0 185.304 2.10714 190.391 5.85786 194.142C9.60859 197.893 14.6957 200 20 200H56V100H39Z"
            fill="currentColor"
          />
        </svg>
      </div>

      <div style={s.shell}>
        <div style={s.track}>
          {/* ── Dot-matrix waveform ── */}
          <div style={s.waveformWrap}>
            {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, idx) => {
              const c = idx % GRID_COLS;
              const r = Math.floor(idx / GRID_COLS);
              const amp = buffer[c];
              // Per-column noise: deterministic offset that occasionally drops
              // the baseline dot on quiet columns. Tune 0.01 (rare) – 0.08 (frequent).
              const jitter = ((c * 7 + 3) % 9) / 9;

              //This floor of 1 is what enforces the unbroken baseline, 0 = broken.
              //V
              const numLit = Math.max(
                0,
                Math.round((amp - jitter * 0.04) * GRID_ROWS),
              );
              //                           ^^^^
              //                                    0.01 = very rare dropout
              //                                    0.04 = roughly every 9th column at baseline
              //                                    0.08 = frequent, noticeable gaps
              return (
                <div
                  key={`d-${c}-${r}`}
                  style={{
                    ...s.dot,
                    left: DOT_LEFT_PAD + c * DOT_SPACING,
                    top: DOT_TOP_OFFSET + r * DOT_SPACING,
                    background: getDotColor(r, numLit, amp),
                  }}
                />
              );
            })}
          </div>

          {/* ── Play / Pause ── */}
          <button
            style={s.btn}
            onClick={togglePlay}
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
    height: "100%",
    overflow: "hidden",
    cursor: "pointer",
  },
  dot: {
    position: "absolute",
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: "50%",
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
