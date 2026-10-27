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

    const wallRatio = width <= 7 ? 0.22 : (width <= 10 ? 0.24 : (width <= 14 ? 0.26 : 0.30));
    const targetWalls = Math.floor(width * height * wallRatio);
    const maxAttempts = 50;

    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // 1. Generate symmetric walls with randomized corridor breaking (unique geometry every time)
      const grid = Array.from({ length: height }, () => Array(width).fill(-1));
      let currentWalls = 0;

      if (width >= 10) {
        const maxRun = width >= 20 ? 6 : 5;
        for (let r = 0; r < Math.ceil(height / 2); r++) {
          let run = 0;
          for (let c = 0; c < width; c++) {
            if (grid[r][c] === -1) run++;
            else run = 0;
            if (run >= maxRun && rng() < 0.45) {
              const sr = height - 1 - r;
              const sc = width - 1 - c;
              grid[r][c] = -2;
              grid[sr][sc] = -2;
              currentWalls += (r === sr && c === sc) ? 1 : 2;
              run = 0;
            }
          }
        }
      }

      let tries = 0;
      while (currentWalls < targetWalls && tries < 1000) {
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

      // 4. Verify unique solution using fast Int8Array solver & multi-round ambiguity resolution
      let solver = new AkariSolver(width, height, grid);
      let sols = solver.solve(2, 60);

      for (let round = 0; round < 6 && sols.length === 2; round++) {
        const s0 = new Set(sols[0].map(b => `${b.r},${b.c}`));
        const s1 = new Set(sols[1].map(b => `${b.r},${b.c}`));
        let fixedOne = false;

        for (const k of s0) {
          if (!s1.has(k)) {
            const [br, bc] = k.split(',').map(Number);
            for (let d = 0; d < 4; d++) {
              const wr = br + dirs[d][0], wc = bc + dirs[d][1];
              const swr = height - 1 - wr, swc = width - 1 - wc;
              if (wr >= 0 && wr < height && wc >= 0 && wc < width &&
                  grid[wr][wc] === -1 && grid[swr][swc] === -1 &&
                  !bulbCoords.has(`${wr},${wc}`) && !bulbCoords.has(`${swr},${swc}`)) {
                let c1 = 0, c2 = 0;
                for (let dd = 0; dd < 4; dd++) {
                  if (bulbCoords.has(`${wr + dirs[dd][0]},${wc + dirs[dd][1]}`)) c1++;
                  if (bulbCoords.has(`${swr + dirs[dd][0]},${swc + dirs[dd][1]}`)) c2++;
                }
                grid[wr][wc] = c1;
                grid[swr][swc] = c2;

                solver = new AkariSolver(width, height, grid);
                sols = solver.solve(2, 60);
                fixedOne = true;
                break;
              }
            }
            if (fixedOne) break;
          }
        }
        if (!fixedOne) break;
      }

      if (sols.length !== 1) continue;

      // 5. Fast clue pruning to adjust difficulty while preserving unique solution
      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          if (grid[r][c] >= 0) {
            let adjW = 0;
            for (let d = 0; d < 4; d++) {
              const nr = r + dirs[d][0], nc = c + dirs[d][1];
              if (nr >= 0 && nr < height && nc >= 0 && nc < width && grid[nr][nc] === -1) adjW++;
            }
            if (adjW === 0) grid[r][c] = -2;
          }
        }
      }

      solver = new AkariSolver(width, height, grid);
      solver._initFastStructures();
      const clueIndices = solver.clues.map((_, i) => i);
      for (let i = clueIndices.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [clueIndices[i], clueIndices[j]] = [clueIndices[j], clueIndices[i]];
      }

      const pruneRatio = difficulty === 'hard' ? 0.70 : (difficulty === 'normal' ? 0.52 : 0.35);
      const pruneTarget = Math.floor(clueIndices.length * pruneRatio);
      const maxPruneNodes = difficulty === 'easy' ? 1 : (difficulty === 'normal' ? 10 : 40);
      let pruned = 0;

      for (let i = 0; i < clueIndices.length && pruned < pruneTarget; i++) {
        const cObj = solver.clues[clueIndices[i]];
        cObj.active = false;
        if (solver.solve(2, maxPruneNodes).length === 1) {
          grid[cObj.r][cObj.c] = -2;
          pruned++;
        } else {
          cObj.active = true;
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
