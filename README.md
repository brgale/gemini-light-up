# Gemini Light Up - Offline Edition (Version 2.1)

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
- **Built-in Library of 220+ Authentic Puzzles**: Instantly playable without generating.
- **Daily, Weekly, and Monthly Challenges**:
  - Authentic large format special puzzles for every challenge period!
- **Procedural Offline Generator**:
  - Automatically generates unlimited new puzzles of any dimensions with rotational symmetry and guaranteed unique solutions.
- **Personal Leaderboard**:
  - Tracks top 10 best times per puzzle size & difficulty with medals, rank badges, and new record notifications.
- **Buttery 120fps Pinch-to-Zoom & Pan**:
  - Hardware GPU-accelerated multi-touch zoom with zero reflow stutter, plus simultaneous 2-finger pan & zoom anywhere on the screen.
- **Fluid Board Panning & Dragging**:
  - Effortlessly drag the board around with 2 fingers, single finger on walls/background, or use the dedicated **Pan (Hand ✋)** tool (`[5]` or Spacebar).
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
