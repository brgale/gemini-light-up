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
    const rng = seed !== null && seed !== undefined ? this.seededRng(seed) : Math.random;

    const wallRatio = width <= 7 ? 0.22 : (width <= 10 ? 0.23 : (width <= 14 ? 0.25 : 0.28));
    const targetWalls = Math.floor(width * height * wallRatio);
    const maxAttempts = width <= 10 ? 30 : (width <= 14 ? 18 : 10);

    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // 1. Generate symmetric walls
      const grid = Array.from({ length: height }, () => Array(width).fill(-1));

      // Distributed seed walls for larger boards to maintain authentic corridor density
      if (width >= 10) {
        const step = width <= 14 ? 4 : 5;
        for (let r = 1; r < height - 1; r += step) {
          for (let c = 1; c < width - 1; c += step) {
            grid[r][c] = -2;
            grid[height - 1 - r][width - 1 - c] = -2;
          }
        }
      }

      let currentWalls = 0;
      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          if (grid[r][c] === -2) currentWalls++;
        }
      }

      let tries = 0;
      while (currentWalls < targetWalls && tries < 800) {
        tries++;
        const r = Math.floor(rng() * height);
        const c = Math.floor(rng() * width);
        const sr = height - 1 - r;
        const sc = width - 1 - c;

        if (grid[r][c] === -1 && grid[sr][sc] === -1) {
          grid[r][c] = -2;
          grid[sr][sc] = -2;
          currentWalls += (r === sr && c === sc) ? 1 : 2;
        }
      }

      // 2. Place bulbs greedily to illuminate all white cells
      const whiteCells = [];
      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          if (grid[r][c] === -1) whiteCells.push(r * width + c);
        }
      }

      // Shuffle
      for (let i = whiteCells.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [whiteCells[i], whiteCells[j]] = [whiteCells[j], whiteCells[i]];
      }

      const losMap = {};
      for (let i = 0; i < whiteCells.length; i++) {
        const idx = whiteCells[i];
        const wr = Math.floor(idx / width), wc = idx % width;
        const los = [idx];
        for (let d = 0; d < 4; d++) {
          let nr = wr + dirs[d][0], nc = wc + dirs[d][1];
          while (nr >= 0 && nr < height && nc >= 0 && nc < width && grid[nr][nc] === -1) {
            los.push(nr * width + nc);
            nr += dirs[d][0];
            nc += dirs[d][1];
          }
        }
        losMap[idx] = los;
      }

      const bulbs = new Set();
      const lit = new Set();
      const forbidden = new Set();
      let unlit = whiteCells.slice();
      let stuck = false;

      while (unlit.length > 0) {
        const targetCell = unlit.pop();
        if (lit.has(targetCell)) continue;

        const cand = losMap[targetCell].filter(k => !forbidden.has(k));
        if (cand.length === 0) {
          stuck = true;
          break;
        }

        cand.sort((a, b) => {
          let unlitA = 0, unlitB = 0;
          for (const k of losMap[a]) if (!lit.has(k)) unlitA++;
          for (const k of losMap[b]) if (!lit.has(k)) unlitB++;
          return unlitB - unlitA;
        });

        const chosen = cand[Math.floor(rng() * Math.min(2, cand.length))];
        bulbs.add(chosen);
        for (const k of losMap[chosen]) {
          lit.add(k);
          forbidden.add(k);
        }

        unlit = unlit.filter(k => !lit.has(k));
      }

      if (stuck || lit.size !== whiteCells.length) continue;

      // 3. Assign initial clues to black cells
      const bulbCoords = new Set();
      bulbs.forEach(b => bulbCoords.add(`${Math.floor(b / width)},${b % width}`));

      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          if (grid[r][c] === -2) {
            let adj = 0;
            for (let d = 0; d < 4; d++) {
              if (bulbCoords.has(`${r + dirs[d][0]},${c + dirs[d][1]}`)) adj++;
            }
            grid[r][c] = adj;
          }
        }
      }

      // 4. Verify unique solution using solver
      const solver = new AkariSolver(width, height, grid);
      let sols = solver.solve(2);

      // Fast targeted ambiguity resolution if exactly 2 symmetric solutions exist
      if (sols.length === 2) {
        const s0 = new Set(sols[0].map(b => `${b.r},${b.c}`));
        const s1 = new Set(sols[1].map(b => `${b.r},${b.c}`));
        const diff = [];
        s0.forEach(k => { if (!s1.has(k)) diff.push(k); });

        for (const k of diff) {
          const [br, bc] = k.split(',').map(Number);
          for (let d = 0; d < 4; d++) {
            const wr = br + dirs[d][0], wc = bc + dirs[d][1];
            const swr = height - 1 - wr, swc = width - 1 - wc;
            if (wr >= 0 && wr < height && wc >= 0 && wc < width && grid[wr][wc] === -1 && grid[swr][swc] === -1) {
              grid[wr][wc] = -2;
              grid[swr][swc] = -2;

              let c1 = 0, c2 = 0;
              for (let dd = 0; dd < 4; dd++) {
                if (s0.has(`${wr + dirs[dd][0]},${wc + dirs[dd][1]}`)) c1++;
                if (s0.has(`${swr + dirs[dd][0]},${swc + dirs[dd][1]}`)) c2++;
              }
              grid[wr][wc] = c1;
              grid[swr][swc] = c2;

              const testSolver = new AkariSolver(width, height, grid);
              const testSols = testSolver.solve(2);
              if (testSols.length === 1) {
                sols = testSols;
                break;
              }
              grid[wr][wc] = -1;
              grid[swr][swc] = -1;
            }
          }
          if (sols.length === 1) break;
        }
      }

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

      const pruneRatio = difficulty === 'hard' ? 0.70 : (difficulty === 'normal' ? 0.45 : 0.20);
      const pruneTarget = Math.floor(cluePositions.length * pruneRatio);
      const maxTests = Math.min(20, cluePositions.length);
      let pruned = 0;

      for (let i = 0; i < maxTests && pruned < pruneTarget; i++) {
        const pos = cluePositions[i];
        const oldVal = grid[pos.r][pos.c];
        grid[pos.r][pos.c] = -2;

        const testSolver = new AkariSolver(width, height, grid);
        if (testSolver.solve(2).length === 1) {
          pruned++;
        } else {
          grid[pos.r][pos.c] = oldVal;
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

    return null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AkariGenerator;
} else {
  window.AkariGenerator = AkariGenerator;
}
