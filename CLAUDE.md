# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # dev server (Vite HMR)
npm run build      # production build
npm run lint       # ESLint
npm run preview    # serve production build locally
```

No test suite is configured.

## Architecture

This is a single-component React + Vite app (`src/App.jsx`) that renders an animated audio player UI. There is no actual audio — playback is simulated by advancing a `progress` value (0–1) via `setInterval` at 30ms intervals.

### Key data structures

- **`BAR_HEIGHTS`** — array of ~93 integers defining the waveform shape. Each entry maps to one rendered bar.
- **`WORDS`** — array of `{ start, end, text }` cue objects. When `progress` enters a cue's range, the corresponding text animates into the waveform.
- **`FONT_BITMAP`** / **`FONT`** — a custom 5×7 bitmap font. `bitmapToColumnSegments()` converts the raw bitmap strings into `{ top, height }` segment descriptors used for rendering. Each character occupies exactly 5 bar slots; `null` entries represent inter-letter gaps.

### Word zone rendering

When a word cue becomes active, a contiguous slice of bar slots (`zoneStart`–`zoneEnd`) switches from plain waveform bars to bitmap letter columns. The zone end index is **locked** (`lockedZoneEnd` ref) the moment the word appears, so it doesn't drift as playback continues. Each bar slot in the zone renders a `letterCol` div containing stacked absolutely-positioned segment divs animated with CSS keyframes (`segGrow`/`segShrink` for letter segments, `barShrink`/`barGrow` for the underlying waveform bar). Exit animations run for 350ms before `displayWord` is cleared.

### Layout

The player is a fixed-width (453px) pill-shaped container (`s.track`). The orange playhead indicator (`#FF6C2F`) and a time label above the pill both track `indicatorLeft`, which is computed to keep the indicator aligned with the exact pixel position of the current bar. All styles are inline via the `s` object at the bottom of the file.

### File notes

- `src/App.jsx` — the active component (imported by `src/main.jsx`)
- `AudioPlayer.jsx` (repo root) and `src/AudioPlayer-bkp.jsx` — older/backup variants, not used at runtime
- ESLint `no-unused-vars` ignores names matching `^[A-Z_]` (all-caps constants)
