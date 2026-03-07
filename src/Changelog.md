# Changelog

## [version_2] – 2026-03-04

### Added
- Matrix dot-grid display: waveform now renders as an 11-row × 44-col dot grid
- Dot grid constants: `DOT_SIZE`, `DOT_SPACING`, `GRID_ROWS`, `GRID_COLS`, layout offsets
- `bitmapToColumnDots()` — converts bitmap font to dot-grid format (`FONT_DOTS`)
- Layout constants extracted: `TRACK_PAD`, `BTN_W`, `WAVEFORM_W`
- Audio assets: `matrix_11dot_test_track.wav`, `demo.mp3`, `demo2–7`, `Cosmic_Cadence.mp3`
- `figmaExample.css` design reference added to assets

### Changed
- Bitmap font rendering switched from segment divs (`bitmapToColumnSegments` / `FONT`) to dot-based rendering (`bitmapToColumnDots` / `FONT_DOTS`)
- Word cue and font systems retained but flagged for future dot-grid integration
- `demo2.mp3` imported directly in `App.jsx` for audio playback

---

## [version_1] – 2026-02-24

### Fixed
- Cues being overwritten mid-animation — active cues now exit independently before a new cue takes over
- Spring and easing values adjusted for smoother transitions

### Fixed (2026-03-03)
- Missing `dev` script in `package.json` preventing `npm run dev` from working

---

## [initial] – 2026-02-23

### Added
- Single-component React + Vite audio player UI
- Simulated playback via `setInterval` advancing `progress` at 30ms intervals
- Waveform rendered from `BAR_HEIGHTS` array (~93 bars)
- Bitmap font (5×7) with `FONT_BITMAP` / `bitmapToColumnSegments`
- Word cue system (`WORDS` array with `start`/`end`/`text`)
- Animated letter zones: bars switch to bitmap letter columns on cue entry/exit
- `lockedZoneEnd` ref prevents zone drift during playback
- CSS keyframe animations: `segGrow`, `segShrink`, `barShrink`, `barGrow`
- Orange playhead indicator (`#FF6C2F`) and time label tracking `indicatorLeft`
- Fixed 453px pill-shaped player container

---

### Waveform tuning notes
1. Lower global ceiling (max 5–7 rows, most at 1–3)
2. Non-linear mapping — quiet = 1 dot, only peaks get tall
3. Faster decay
4. Better `peakMax` floor clamping
5. Multiple "islands" instead of one blob
6. Force hard gaps between islands
7. Reduced `fftSize` (1024)
