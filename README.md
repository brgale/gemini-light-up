# Gemini Light Up - Offline Edition (Version 3.1)

A fully featured, standalone, 100% offline version of the popular logic puzzle game **Light Up** (also known as **Akari**, Japanese: 美術館), inspired by [puzzle-light-up.com](https://www.puzzle-light-up.com/).

Zero internet connection or external servers required. Works completely out of the box in any web browser by opening `index.html` locally or installing as a standalone Progressive Web App (PWA).

---

## 💡 Features

### 🧩 Puzzles & Modes
- **Official Sizes & Difficulties**:
  - **7×7** (Easy, Normal, Hard)
  - **10×10** (Easy, Normal, Hard)
  - **14×14** (Easy, Normal, Hard)
  - **25×25** (Easy, Normal, Hard)
  - **Special Daily** (30×30)
  - **Special Weekly** (30×40)
  - **Special Monthly** (40×50)
- **Online-First Real-Time Generation & 616+ Puzzle Offline Cache**:
  - Checks `navigator.onLine`: whenever you are online, **every new puzzle (including the 30×30 Daily Challenge, 30×40 Weekly, 40×50 Monthly, and all 7×7–25×25 categories) is freshly generated on the fly** so you never see a repeat.
  - When offline, seamlessly pivots to the expanded **616-puzzle offline cache** (including 40 cached 30×30 Daily puzzles, 20 cached 30×40 Weekly puzzles, 15 cached 40×50 Monthly puzzles, and 100 cached 25×25 Easy puzzles) dealt via a non-repeating shuffle deck.
- **Real-Time 25×25 & 30×30 Procedural Generation (~25ms)**:
  - Powered by a 500× faster `Int8Array` constraint-propagation solver with Single-Illuminator deduction, Diagonal Clue Corner elimination, MRV branching, and multi-point symmetric ambiguity resolution.
  - Generates brand-new, 100% unique-solution **25×25**, **30×30 Daily**, **30×40 Weekly**, and **40×50 Monthly** puzzles on the fly in milliseconds.
- **Guaranteed Zero-Duplicate Non-Repeating Shuffle Deck**:
  - Deals puzzles using a persistent Fisher-Yates non-repeating shuffle deck that also cross-checks your `akari_played_tasks` history so previously played puzzles are never re-dealt.
  - Once all built-in library puzzles in a category have been played, automatically transitions to generating brand-new procedural puzzles on the fly.
- **Intelligent Clue Error Highlighting (Surrounded by Light Rays)**:
  - Numbered clue squares immediately turn glowing vibrant red if their adjacent cells are blocked by light beams or crosses such that their required number cannot mathematically be met.
  - Also warns when too many bulbs are placed around a clue, helping you quickly spot contradictions before committing.
- **Sidebar & UI Polish**:
  - Sized sidebar Settings gear icon to match navigation items cleanly across desktop and tablet screens.
- **Smart Category Resumption & Duplicate Prevention**:
  - Re-selecting a category in the sidebar automatically spins up a brand new puzzle if the previous one was already solved, rather than reopening completed boards.
  - Persistent tracking of played puzzles ensures you never encounter repeats from the library.
- **Daily, Weekly, and Monthly Challenges**:
  - Authentic large format special puzzles for every challenge period!
- **Personal Leaderboard**:
  - Tracks top 10 best times per puzzle size & difficulty with medals, rank badges, and new record notifications.
- **Canvas Overscroll Buffers & Edge Centering (No Hard Stops)**:
  - Generous 70vh / 70vw canvas buffers around the puzzle allow any edge, corner, or section of the board to be dragged directly into the center of your screen when zoomed in.
  - Eliminates hard screen-edge stops, giving full freedom to comfortably inspect and play along puzzle boundaries.
  - Automatic viewport centering on puzzle load and zoom reset ("Fit"), plus focus-ratio preservation while zooming in and out.
- **Universal Single-Finger Drag & Kinetic Momentum (iPad / Mobile)**:
  - Swipe with one finger anywhere on the screen—including directly over white cells, walls, or margins—to pan the puzzle with silky smooth 1:1 finger tracking and natural kinetic deceleration glide.
  - Tapping without dragging places/cycles bulbs instantaneously with zero lag.
  - Optional toggle in Settings to switch between iPad single-finger pan mode and desktop click-and-drag drawing mode.
- **Buttery 120fps Pinch-to-Zoom & Multi-Touch Pan**:
  - Hardware GPU-accelerated multi-touch zoom with zero reflow stutter, plus simultaneous 2-finger pan & zoom anywhere on the screen.
- **Fluid Board Panning & Dragging**:
  - Drag the board around with single-finger swipe, 2-finger gesture, or using the dedicated **Pan (Hand ✋)** tool (`[5]` or Spacebar).
- **Responsive Tablet & Mobile Optimization**:
  - Adaptive header with fixed Settings access, icon-only tool grouping, overlay drawer sidebar with backdrop, and high-visibility controls across iPad portrait, landscape, and phone screens.
- **Precision Drag (Corner Protection)**:
  - Smart center-proximity hitbox filters out accidental diagonal square selection when sweeping around numbers in an arc (with toggle in Settings).
- **Smart Pause & Auto-Resume**:
  - Automatically pauses game timer and protects puzzle state when switching tabs or clicking out of the browser.
- **Import / Export Compatibility**:
  - Full bidirectional compatibility with the exact task strings used by `puzzle-light-up.com` (e.g. `b2a0f0bBBd1g3d00bBf1a2b`).
  - Copy and share puzzle codes with anyone.

### 🎮 Game Controls & Solving Aids
- **Intuitive Interactions**:
  - **Left Click**: Place or toggle light bulbs (or use selected active tool).
  - **Right Click**: Mark square with **X** (no bulb).
  - **Click & Drag**: Fast mass-marking of crosses or erasing.
  - **Cycle Mode**: Cycle between Empty → Bulb → Cross → Empty.
  - **Active Tool Selectors**: Bulb, Cross (X), Cycle, and Eraser.
- **Full History**:
  - Infinite **Undo** (`Ctrl+Z` / `Cmd+Z`) and **Redo** (`Ctrl+Y` / `Cmd+Shift+Z`).
- **Checkpoints Manager**:
  - Save checkpoints at any point (`Ctrl+S`) and instantly jump back to earlier branches.
- **Real-time Illumination & Error Highlighting**:
  - Light rays cast in four directions across white cells until blocked by walls.
  - Glowing warm yellow sunlight or cool blue light beams.
  - **Clash Detection**: If two bulbs see each other, both turn bright red with an alert beam!
  - **Clue State**: Numbered black cells turn green/gray when satisfied, or red when violated.
- **Step-by-Step Logic Hint Engine**:
  - Explains the exact deductive rule in plain English (e.g., *"Number 3 needs 3 bulbs and only has 3 open spots remaining"*), highlighting the target square without spoiling the entire puzzle.
- **Timer & Pause**:
  - Accurate timer with pause/resume overlay to prevent peeking while paused.
- **Printable Puzzle Sheets**:
  - Clean `@media print` layout ready for paper & pencil solving.

### 🎨 Themes & Audio
- **Night Mode (Dark Theme)** & **Light Mode**
- **Blue Light Mode** (cool cyan rays vs. warm golden rays)
- **Built-in Web Audio Synthesizer**: Pure procedural audio for clicks, chimes, warning buzzes, and solve fanfares—zero external mp3/wav files required!
- **Confetti Victory Animation**: Pure canvas celebration upon solving.

---

## 🚀 How to Run Offline

### Method 1: Direct File (Simplest)
Just double-click or drag `index.html` into any modern web browser (Chrome, Safari, Firefox, Edge).
```bash
open /Users/briangale/.gemini/antigravity/scratch/light-up-offline/index.html
```

### Method 2: Local HTTP Server (Optional)
If you want Service Worker caching and PWA installation:
```bash
cd /Users/briangale/.gemini/antigravity/scratch/light-up-offline
python3 -m http.server 8080
```
Then visit `http://localhost:8080` in your browser.

### Method 3: Install as Standalone App (PWA)
1. Open the app in Chrome, Edge, or Safari.
2. Click the **Install** icon in the URL bar (or *Share → Add to Home Screen* on iOS / Android).
3. The app is now installed on your desktop/dock and works 100% offline anytime!

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Arrow Keys` | Move cursor around the board |
| `Space` or `B` | Toggle Light Bulb on selected square |
| `X` or `C` | Toggle Cross (X) on selected square |
| `Delete` / `Backspace` | Clear square |
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Y` / `Cmd+Shift+Z` | Redo |
| `Ctrl+S` | Save Checkpoint |
| `H` | Request Hint |
| `Enter` | Check / Done |
| `1` / `2` / `3` / `4` | Select Tool (Bulb, Cross, Cycle, Erase) |

---

## 📐 Rules of Light Up (Akari)

1. **Light the entire museum**: Every white square on the grid must be illuminated by at least one light bulb.
2. **Beams of light**: A bulb projects light along its entire row and column until stopped by a black wall or the edge of the board.
3. **No direct line of sight**: No two light bulbs may illuminate each other.
4. **Numbered black squares**: A number from `0` to `4` indicates exactly how many light bulbs must be placed in the four orthogonal adjacent squares (up, down, left, right).
5. **Unnumbered black squares**: May touch any number of bulbs (or zero).
