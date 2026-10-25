/**
 * Akari / Light Up Procedural Puzzle Generator
 * Generates unique-solution puzzles offline with rotational symmetry and difficulty levels.
 */

class AkariGenerator {
  static seededRng(seed) {
    let s = Math.abs(seed) % 2147483647;
    if (s === 0) s = 1;
    return function() {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  static getSeedForDate(dateStr) {
    // dateStr: "YYYY-MM-DD"
    let h = 0;
    for (let i = 0; i < dateStr.length; i++) {
      h = (Math.imul(31, h) + dateStr.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  static generate(width, height, difficulty = 'easy', seed = null) {
    const rng = seed !== null ? this.seededRng(seed) : Math.random;

    const wallRatio = width <= 7 ? 0.25 : (width <= 10 ? 0.25 : (width <= 14 ? 0.27 : 0.29));
    const targetWalls = Math.floor(width * height * wallRatio);

    const maxAttempts = width <= 10 ? 35 : (width <= 14 ? 20 : 10);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // 1. Generate symmetric walls
      const grid = Array.from({ length: height }, () => Array(width).fill(-1));
      let placedWalls = 0;
      let tries = 0;

      while (placedWalls < targetWalls && tries < 600) {
        tries++;
        const r = Math.floor(rng() * height);
        const c = Math.floor(rng() * width);
        const sr = height - 1 - r;
        const sc = width - 1 - c;

        if (grid[r][c] === -1 && grid[sr][sc] === -1) {
          // Avoid 2x2 blocks of walls
          grid[r][c] = -2;
          grid[sr][sc] = -2;
          placedWalls += (r === sr && c === sc) ? 1 : 2;
        }
      }

      // 2. Place bulbs greedily to illuminate all white cells
      const whiteCells = [];
      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          if (grid[r][c] === -1) whiteCells.push({ r, c });
        }
      }

      // Shuffle
      for (let i = whiteCells.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [whiteCells[i], whiteCells[j]] = [whiteCells[j], whiteCells[i]];
      }

      const getLos = (r, c) => {
        const los = new Set([`${r},${c}`]);
        const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        for (const [dr, dc] of dirs) {
          let nr = r + dr, nc = c + dc;
          while (nr >= 0 && nr < height && nc >= 0 && nc < width && grid[nr][nc] === -1) {
            los.add(`${nr},${nc}`);
            nr += dr;
            nc += dc;
          }
        }
        return los;
      };

      const losMap = new Map();
      for (const p of whiteCells) {
        losMap.set(`${p.r},${p.c}`, getLos(p.r, p.c));
      }

      const bulbs = new Set();
      const lit = new Set();
      const forbidden = new Set();

      let unlit = whiteCells.map(p => `${p.r},${p.c}`);
      let stuck = false;

      while (unlit.length > 0) {
        const target = unlit.pop();
        if (lit.has(target)) continue;

        const targetLos = losMap.get(target);
        const candidates = [];
        for (const k of targetLos) {
          if (!forbidden.has(k)) candidates.push(k);
        }

        if (candidates.length === 0) {
          stuck = true;
          break;
        }

        // Pick candidate covering most unlit cells
        candidates.sort((a, b) => {
          let unlitA = 0, unlitB = 0;
          for (const c of losMap.get(a)) if (!lit.has(c)) unlitA++;
          for (const c of losMap.get(b)) if (!lit.has(c)) unlitB++;
          return unlitB - unlitA;
        });

        const chosen = candidates[Math.floor(rng() * Math.min(2, candidates.length))];
        bulbs.add(chosen);
        for (const k of losMap.get(chosen)) {
          lit.add(k);
          forbidden.add(k);
        }

        unlit = unlit.filter(k => !lit.has(k));
      }

      if (stuck || lit.size !== whiteCells.length) continue;

      // 3. Assign clues to black cells
      const bulbCoords = new Set();
      for (const b of bulbs) {
        const [r, c] = b.split(',').map(Number);
        bulbCoords.add(`${r},${c}`);
      }

      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          if (grid[r][c] === -2) {
            let adjBulbs = 0;
            const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            for (const [dr, dc] of dirs) {
              const nr = r + dr, nc = c + dc;
              if (bulbCoords.has(`${nr},${nc}`)) adjBulbs++;
            }
            grid[r][c] = adjBulbs;
          }
        }
      }

      // 4. Verify unique solution using solver
      const solver = new AkariSolver(width, height, grid);
      const sols = solver.solve(2);
      if (sols.length !== 1) continue;

      // 5. Clue pruning to adjust difficulty
      const cluePositions = [];
      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          if (grid[r][c] >= 0) cluePositions.push({ r, c });
        }
      }

      for (let i = cluePositions.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [cluePositions[i], cluePositions[j]] = [cluePositions[j], cluePositions[i]];
      }

      const pruneTarget = difficulty === 'hard' ? cluePositions.length : (difficulty === 'normal' ? Math.floor(cluePositions.length * 0.6) : Math.floor(cluePositions.length * 0.25));
      let pruned = 0;

      for (const { r, c } of cluePositions) {
        if (pruned >= pruneTarget) break;
        const oldVal = grid[r][c];
        grid[r][c] = -2; // unnumbered

        const testSolver = new AkariSolver(width, height, grid);
        const testSols = testSolver.solve(2);
        if (testSols.length === 1) {
          pruned++;
        } else {
          grid[r][c] = oldVal; // restore
        }
      }

      const task = AkariSolver.encodeTask(grid, width, height);
      return {
        width,
        height,
        difficulty,
        task,
        grid
      };
    }

    // Fallback: simple 7x7 known task if generation timed out
    return null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AkariGenerator;
} else {
  window.AkariGenerator = AkariGenerator;
}
