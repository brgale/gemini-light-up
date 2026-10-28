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
    let h = 53;
    for (let i = 0; i < dateStr.length; i++) {
      h = (Math.imul(31, h) + dateStr.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  static generate(width, height, difficulty = 'easy', seed = null) {
    const rng = seed !== null && seed !== undefined ? this.seededRng(seed) : Math.random;

    const area = width * height;
    const wallRatio = width <= 7 ? 0.22 : (width <= 10 ? 0.24 : (width <= 14 ? 0.26 : 0.275));
    const targetWalls = Math.floor(area * wallRatio);
    const maxAttempts = 50;

    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const grid = Array.from({ length: height }, () => Array(width).fill(-1));
      let currentWalls = 0;

      // 1a. Seed symmetric random walls first (48% of target) so natural clusters form
      const initialTarget = Math.floor(targetWalls * 0.48);
      let tries = 0;
      const maxWallTries = targetWalls * 6;
      while (currentWalls < initialTarget && tries < maxWallTries) {
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

      // 1b. Break long horizontal and vertical corridors so no wide-open strips remain (max corridor 5-6)
      if (width >= 10) {
        for (let r = 0; r < Math.ceil(height / 2); r++) {
          let run = 0;
          for (let c = 0; c < width; c++) {
            if (grid[r][c] === -1) run++;
            else run = 0;
            if ((run >= 5 && rng() < 0.55) || run >= 7) {
              const sr = height - 1 - r;
              const sc = width - 1 - c;
              if (grid[r][c] === -1 && grid[sr][sc] === -1) {
                grid[r][c] = -2;
                grid[sr][sc] = -2;
                currentWalls += (r === sr && c === sc) ? 1 : 2;
              }
              run = 0;
            }
          }
        }
        for (let c = 0; c < Math.ceil(width / 2); c++) {
          let run = 0;
          for (let r = 0; r < height; r++) {
            if (grid[r][c] === -1) run++;
            else run = 0;
            if ((run >= 5 && rng() < 0.55) || run >= 7) {
              const sr = height - 1 - r;
              const sc = width - 1 - c;
              if (grid[r][c] === -1 && grid[sr][sc] === -1) {
                grid[r][c] = -2;
                grid[sr][sc] = -2;
                currentWalls += (r === sr && c === sc) ? 1 : 2;
              }
              run = 0;
            }
          }
        }
      }

      // 1c. Top up to targetWalls
      while (currentWalls < targetWalls && tries < maxWallTries) {
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

      // 2. Place bulbs preferring wall-adjacent positions so clues naturally form 2s, 3s, and 4s
      // and allow the majority of black walls (~62-68%) to remain unnumbered (B)
      const whiteCells = [];
      const adjWallScore = new Int8Array(area);
      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          if (grid[r][c] === -1) {
            const idx = r * width + c;
            whiteCells.push(idx);
            let aw = 0;
            for (let d = 0; d < 4; d++) {
              const nr = r + dirs[d][0], nc = c + dirs[d][1];
              if (nr >= 0 && nr < height && nc >= 0 && nc < width && grid[nr][nc] === -2) aw++;
            }
            adjWallScore[idx] = aw;
          }
        }
      }

      // Shuffle first for variety among equal-length LOS cells
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

      // Satisfy constrained cells first
      whiteCells.sort((a, b) => losMap[a].length - losMap[b].length);

      const bulbs = new Set();
      const lit = new Set();
      const forbidden = new Set();
      let stuck = false;

      for (let i = 0; i < whiteCells.length; i++) {
        const targetCell = whiteCells[i];
        if (lit.has(targetCell)) continue;

        const cand = losMap[targetCell].filter(k => !forbidden.has(k));
        if (cand.length === 0) {
          stuck = true;
          break;
        }

        cand.sort((a, b) => (adjWallScore[b] * 4 - losMap[b].length * 0.2) - (adjWallScore[a] * 4 - losMap[a].length * 0.2));

        const chosen = cand[Math.floor(rng() * Math.min(2, cand.length))];
        bulbs.add(chosen);
        for (const k of losMap[chosen]) {
          lit.add(k);
          forbidden.add(k);
        }
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

      // Helper to verify that adding symmetric walls does not block all illumination for any white cell
      const allLitByBulbs = () => {
        const litSet = new Set();
        for (const b of bulbs) {
          const br = Math.floor(b / width), bc = b % width;
          if (grid[br][bc] !== -1) return false;
          litSet.add(b);
          for (let d = 0; d < 4; d++) {
            let nr = br + dirs[d][0], nc = bc + dirs[d][1];
            while (nr >= 0 && nr < height && nc >= 0 && nc < width && grid[nr][nc] === -1) {
              litSet.add(nr * width + nc);
              nr += dirs[d][0];
              nc += dirs[d][1];
            }
          }
        }
        for (let r = 0; r < height; r++) {
          for (let c = 0; c < width; c++) {
            if (grid[r][c] === -1 && !litSet.has(r * width + c)) return false;
          }
        }
        return true;
      };

      // 4. Resolve undetermined regions using fast propagation so the board is cleanly human-solvable
      let solver;
      const maxRounds = area >= 600 ? 15 : 10;
      const maxFixesPerRound = area >= 600 ? 4 : 2;

      for (let round = 0; round < maxRounds; round++) {
        solver = new AkariSolver(width, height, grid);
        solver._initFastStructures();
        const st = new Int8Array(area);
        st.fill(-2);
        for (let i = 0; i < solver.whiteIndices.length; i++) st[solver.whiteIndices[i]] = -1;
        const prop = solver.fastPropagate(st);
        if (!prop) break;

        const undetBulbs = [];
        for (const b of bulbs) {
          if (prop[b] === -1) undetBulbs.push({ r: Math.floor(b / width), c: b % width });
        }
        if (undetBulbs.length === 0) break;

        const fixedCenters = [];
        let fixedCount = 0;

        for (const u of undetBulbs) {
          const br = u.r, bc = u.c;
          if (fixedCenters.some(p => Math.abs(p.r - br) + Math.abs(p.c - bc) < 4)) continue;

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
              if (allLitByBulbs()) {
                fixedCenters.push({ r: br, c: bc }, { r: height - 1 - br, c: width - 1 - bc });
                fixedCount++;
                break;
              } else {
                grid[wr][wc] = -1;
                grid[swr][swc] = -1;
              }
            }
          }
          if (fixedCount >= maxFixesPerRound) break;
        }
        if (fixedCount === 0) break;
      }

      // Unnumber interior walls surrounded by 4 walls
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
      const sols = solver.solve(2, 40);
      if (sols.length !== 1) continue;

      // 5. Prune clues aggressively so most black walls (~62-68%) are unnumbered (B) like authentic puzzles,
      // prioritizing removing redundant 0 and 1 clues while preserving higher anchor clues
      const clueIndices = solver.clues.map((_, i) => i);
      const clueOrderNoise = clueIndices.map(() => rng() * 1.6);
      clueIndices.sort((a, b) => (solver.clues[a].clue + clueOrderNoise[a]) - (solver.clues[b].clue + clueOrderNoise[b]));

      const pruneRatio = difficulty === 'hard' ? 0.76 : (difficulty === 'normal' ? 0.68 : 0.65);
      const pruneTarget = Math.floor(clueIndices.length * pruneRatio);
      const maxPruneNodes = difficulty === 'easy' ? 2 : (difficulty === 'normal' ? 6 : 24);
      const maxTests = area >= 1200 ? Math.min(260, clueIndices.length) : clueIndices.length;
      let pruned = 0;

      for (let i = 0; i < maxTests && pruned < pruneTarget; i++) {
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
