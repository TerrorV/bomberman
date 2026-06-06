# Session Handoff — Bomberman Mobile Compatibility

## Goal
Make the Bomberman clone mobile-compatible: responsive design that adjusts to mobile screens + touch controls.

## Completed: 2026-06-07

### Files Modified
| File | Change |
|---|---|
| `index.html` | Added mobile viewport meta, web app meta, removed hardcoded canvas dimensions |
| `css/style.css` | Complete rewrite: responsive layout, touch overlay CSS, breakpoints for 480/768/1024px + landscape |
| `js/game.js` | Initialize touch controls in `init()`, responsive canvas scaling (upscaling allowed), tap-to-start for screens |
| `js/touch-controls.js` | Fixed D-pad grid order (was up/down swapped), added mouse fallback for desktop testing |

### Key Technical Details
- Canvas internal resolution: 720×624 (15×13 grid × 48px cells) — unchanged for correct game rendering
- Canvas CSS size set via `canvas.style.width`/`style.height` based on viewport, maintaining aspect ratio
- Touch overlay reserves 150px at bottom on mobile
- D-pad: CSS grid 3×2, positioned bottom-left. Bomb button: 70px circle, bottom-right
- Touch detection: `'ontouchstart' in window || navigator.maxTouchPoints > 0`
- Touch controls map to same key codes as keyboard (ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Space)
- Tap-to-start: `_onCanvasTap()` sets `_touchTap` flag, checked in `update()` for start/gameover/finalWin states

### Bugs Fixed
1. Touch controls never initialized (code existed but `_detectTouch()` not called)
2. D-pad up/down buttons swapped in HTML template
3. Canvas capped at 1× scale (`Math.min(..., 1)`) — tiny on mobile. Removed cap.
4. `transform: scale()` didn't affect layout — switched to direct CSS `width`/`height`

### Pending
- Test on actual mobile device
- Consider overlay/transparent touch controls to maximize game area

## Previous Sessions
See git history for refactoring session (game.js split into subsystems).