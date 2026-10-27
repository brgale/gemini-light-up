/**
 * Akari / Light Up Solver & Logic Engine
 * Compatible with puzzle-light-up.com task format
 */

class AkariSolver {
  constructor(width, height, board) {
    this.w = width;
    this.h = height;
    // board: 2D array: -1=white, -2=black(unnumbered), 0..4=black with clue
    this.board = board.map(row => [...row]);

    // Compute horizontal and vertical segments
    this.segH = Array.from({ length: height }, () => Array(width).fill(-1));
    this.segV = Array.from({ length: height }, () => Array(width).fill(-1));
    this.hCells = [];
    this.vCells = [];

    let hCount = 0;
    for (let r = 0; r < height; r++) {
      let c = 0;
      while (c < width) {
        if (this.board[r][c] === -1) {
          const cells = [];
          while (c < width && this.board[r][c] === -1) {
            this.segH[r][c] = hCount;
            cells.push({ r, c });
            c++;
          }
          this.hCells.push(cells);
          hCount++;
        } else {
          c++;
        }
      }
    }

    let vCount = 0;
    for (let c = 0; c < width; c++) {
      let r = 0;
      while (r < height) {
        if (this.board[r][c] === -1) {
          const cells = [];
          while (r < height && this.board[r][c] === -1) {
            this.segV[r][c] = vCount;
            cells.push({ r, c });
            r++;
          }
          this.vCells.push(cells);
          vCount++;
        } else {
          r++;
        }
      }
    }
  }

  static decodeTask(taskStr, width, height) {
    const cells = [];
    for (let i = 0; i < taskStr.length; i++) {
      const ch = taskStr[i];
      if (ch >= 'a' && ch <= 'z') {
        const count = ch.charCodeAt(0) - 'a'.charCodeAt(0) + 1;
        for (let k = 0; k < count; k++) cells.push(-1);
      } else if (ch === 'B') {
        cells.push(-2);
      } else if (ch >= '0' && ch <= '4') {
        cells.push(parseInt(ch, 10));
      }
    }
    const grid = [];
    for (let r = 0; r < height; r++) {
      grid.push(cells.slice(r * width, (r + 1) * width));
    }
    return grid;
  }

  static encodeTask(grid, width, height) {
    const flat = [];
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        flat.push(grid[r][c]);
      }
    }
    const out = [];
    let run = 0;
    for (const val of flat) {
      if (val === -1) {
        run++;
        if (run === 26) {
          out.push('z');
          run = 0;
        }
      } else {
        if (run > 0) {
          out.push(String.fromCharCode('a'.charCodeAt(0) + run - 1));
          run = 0;
        }
        if (val === -2) out.push('B');
        else out.push(String(val));
      }
    }
    if (run > 0) {
      out.push(String.fromCharCode('a'.charCodeAt(0) + run - 1));
    }
    return out.join('');
  }

  getAdjWhite(r, c) {
    const adj = [];
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < this.h && nc >= 0 && nc < this.w && this.board[nr][nc] === -1) {
        adj.push({ r: nr, c: nc, key: `${nr},${nc}` });
      }
    }
    return adj;
  }

  propagate(state) {
    // state: Map of "r,c" -> 1 (bulb), 0 (cross), or undefined (unknown)
    const st = new Map(state);
    let changed = true;

    while (changed) {
      changed = false;

      // 1. Check clues
      for (let r = 0; r < this.h; r++) {
        for (let c = 0; c < this.w; c++) {
          const clue = this.board[r][c];
          if (clue >= 0) {
            const adj = this.getAdjWhite(r, c);
            let bulbs = 0;
            const free = [];
            for (const p of adj) {
              const val = st.get(p.key);
              if (val === 1) bulbs++;
              else if (val === undefined) free.push(p);
            }

            if (bulbs > clue) return null; // Too many bulbs
            if (bulbs + free.length < clue) return null; // Cannot reach clue

            if (bulbs === clue && free.length > 0) {
              for (const p of free) {
                st.set(p.key, 0);
              }
              changed = true;
            } else if (bulbs + free.length === clue && free.length > 0) {
              for (const p of free) {
                st.set(p.key, 1);
              }
              changed = true;
            }
          }
        }
      }

      // 2. Segment rules: only 1 bulb per segment
      for (const cells of this.hCells) {
        let bulbs = 0;
        for (const p of cells) {
          if (st.get(`${p.r},${p.c}`) === 1) bulbs++;
        }
        if (bulbs > 1) return null;
        if (bulbs === 1) {
          for (const p of cells) {
            const key = `${p.r},${p.c}`;
            if (st.get(key) === undefined) {
              st.set(key, 0);
              changed = true;
            }
          }
        }
      }

      for (const cells of this.vCells) {
        let bulbs = 0;
        for (const p of cells) {
          if (st.get(`${p.r},${p.c}`) === 1) bulbs++;
        }
        if (bulbs > 1) return null;
        if (bulbs === 1) {
          for (const p of cells) {
            const key = `${p.r},${p.c}`;
            if (st.get(key) === undefined) {
              st.set(key, 0);
              changed = true;
            }
          }
        }
      }

      // 3. Illumination coverage rule:
      // Every white cell must be illuminated by either its h-segment or v-segment.
      for (let r = 0; r < this.h; r++) {
        for (let c = 0; c < this.w; c++) {
          if (this.board[r][c] !== -1) continue;
          const key = `${r},${c}`;
          const hid = this.segH[r][c];
          const vid = this.segV[r][c];
          const hHasBulb = this.hCells[hid].some(p => st.get(`${p.r},${p.c}`) === 1);
          const vHasBulb = this.vCells[vid].some(p => st.get(`${p.r},${p.c}`) === 1);
          if (hHasBulb || vHasBulb) continue;

          // Check possible places for a bulb in both segments
          const possH = this.hCells[hid].filter(p => st.get(`${p.r},${p.c}`) === undefined);
          const possV = this.vCells[vid].filter(p => st.get(`${p.r},${p.c}`) === undefined);

          if (possH.length === 0 && possV.length === 0) {
            return null; // Cell can never be lit
          }

          if (possH.length === 1 && possH[0].r === r && possH[0].c === c &&
              possV.length === 1 && possV[0].r === r && possV[0].c === c) {
            if (st.get(key) === undefined) {
              st.set(key, 1);
              changed = true;
            }
          }
        }
      }
    }

    return st;
  }

  _initFastStructures() {
    if (this._fastInit) return;
    this._fastInit = true;
    const w = this.w, h = this.h, N = w * h;
    this.flatBoard = new Int8Array(N);
    this.cellSegH = new Int16Array(N);
    this.cellSegV = new Int16Array(N);
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const idx = r * w + c;
        this.flatBoard[idx] = this.board[r][c];
        this.cellSegH[idx] = this.segH[r][c];
        this.cellSegV[idx] = this.segV[r][c];
      }
    }
    this.fastHCells = this.hCells.map(seg => Int16Array.from(seg.map(p => p.r * w + p.c)));
    this.fastVCells = this.vCells.map(seg => Int16Array.from(seg.map(p => p.r * w + p.c)));
    this.clues = [];
    this.whiteIndices = [];
    const diags = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const idx = r * w + c;
        const v = this.board[r][c];
        if (v >= 0) {
          const adj = this.getAdjWhite(r, c).map(p => p.r * w + p.c);
          const corners = [];
          for (const [dr, dc] of diags) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < h && nc >= 0 && nc < w && this.board[nr][nc] === -1) {
              if (this.board[r + dr][c] === -1 && this.board[r][c + dc] === -1) {
                corners.push({
                  diagIdx: nr * w + nc,
                  orth1: (r + dr) * w + c,
                  orth2: r * w + (c + dc)
                });
              }
            }
          }
          this.clues.push({ r, c, idx, clue: v, adj: Int16Array.from(adj), corners, active: true });
        } else if (v === -1) {
          this.whiteIndices.push(idx);
        }
      }
    }
    this.whiteIndices = Int16Array.from(this.whiteIndices);
  }

  fastPropagate(st) {
    const hCells = this.fastHCells;
    const vCells = this.fastVCells;
    const cellSegH = this.cellSegH;
    const cellSegV = this.cellSegV;
    const clues = this.clues;
    const whites = this.whiteIndices;
    let changed = true;

    const setBulb = (idx) => {
      const cur = st[idx];
      if (cur === 0) return false;
      if (cur === 1) return true;
      st[idx] = 1;
      changed = true;
      const hSeg = hCells[cellSegH[idx]];
      for (let i = 0; i < hSeg.length; i++) {
        const p = hSeg[i];
        if (p === idx) continue;
        if (st[p] === 1) return false;
        if (st[p] === -1) st[p] = 0;
      }
      const vSeg = vCells[cellSegV[idx]];
      for (let i = 0; i < vSeg.length; i++) {
        const p = vSeg[i];
        if (p === idx) continue;
        if (st[p] === 1) return false;
        if (st[p] === -1) st[p] = 0;
      }
      return true;
    };

    for (let i = 0; i < whites.length; i++) {
      const idx = whites[i];
      if (st[idx] === 1) {
        st[idx] = -1;
        if (!setBulb(idx)) return null;
      }
    }

    while (changed) {
      changed = false;

      // 1. Clues & diagonal corner elimination
      for (let i = 0; i < clues.length; i++) {
        const cObj = clues[i];
        if (!cObj.active) continue;
        const clue = cObj.clue;
        const adj = cObj.adj;
        let bulbs = 0;
        let freeCount = 0;
        for (let j = 0; j < adj.length; j++) {
          const v = st[adj[j]];
          if (v === 1) bulbs++;
          else if (v === -1) freeCount++;
        }
        if (bulbs > clue || bulbs + freeCount < clue) return null;
        if (freeCount > 0) {
          const rem = clue - bulbs;
          if (rem === 0) {
            for (let j = 0; j < adj.length; j++) {
              if (st[adj[j]] === -1) st[adj[j]] = 0;
            }
            changed = true;
          } else if (freeCount === rem) {
            for (let j = 0; j < adj.length; j++) {
              if (st[adj[j]] === -1) {
                if (!setBulb(adj[j])) return null;
              }
            }
          } else if (rem >= 1 && freeCount === rem + 1 && cObj.corners.length > 0) {
            for (let k = 0; k < cObj.corners.length; k++) {
              const cn = cObj.corners[k];
              if (st[cn.diagIdx] === -1 && st[cn.orth1] === -1 && st[cn.orth2] === -1) {
                st[cn.diagIdx] = 0;
                changed = true;
              }
            }
          }
        }
      }

      // 2. Full single-illuminator coverage deduction
      for (let i = 0; i < whites.length; i++) {
        const idx = whites[i];
        const hSeg = hCells[cellSegH[idx]];
        let isLit = false;
        for (let j = 0; j < hSeg.length; j++) {
          if (st[hSeg[j]] === 1) { isLit = true; break; }
        }
        if (isLit) continue;
        const vSeg = vCells[cellSegV[idx]];
        for (let j = 0; j < vSeg.length; j++) {
          if (st[vSeg[j]] === 1) { isLit = true; break; }
        }
        if (isLit) continue;

        let candCount = 0;
        let lastCand = -1;
        for (let j = 0; j < hSeg.length; j++) {
          const p = hSeg[j];
          if (st[p] === -1) {
            candCount++;
            lastCand = p;
            if (candCount > 1) break;
          }
        }
        if (candCount <= 1) {
          for (let j = 0; j < vSeg.length; j++) {
            const p = vSeg[j];
            if (p === idx) continue;
            if (st[p] === -1) {
              candCount++;
              lastCand = p;
              if (candCount > 1) break;
            }
          }
        }
        if (candCount === 0) return null;
        if (candCount === 1) {
          if (!setBulb(lastCand)) return null;
        }
      }
    }

    return st;
  }

  solve(maxSolutions = 1, maxNodes = 0) {
    this._initFastStructures();
    const N = this.w * this.h;
    const initial = new Int8Array(N);
    initial.fill(-2);
    const whites = this.whiteIndices;
    for (let i = 0; i < whites.length; i++) initial[whites[i]] = -1;

    const solutions = [];
    let nodes = 0;
    let aborted = false;

    const backtrack = (curr) => {
      if (solutions.length >= maxSolutions || aborted) return;
      nodes++;
      if (maxNodes > 0 && nodes > maxNodes) {
        aborted = true;
        return;
      }

      const prop = this.fastPropagate(new Int8Array(curr));
      if (!prop) return;

      let bestChoice = -1;
      let bestScore = 999999;

      const clues = this.clues;
      for (let i = 0; i < clues.length; i++) {
        if (!clues[i].active) continue;
        const adj = clues[i].adj;
        let bulbs = 0, free = 0, firstFree = -1;
        for (let j = 0; j < adj.length; j++) {
          const v = prop[adj[j]];
          if (v === 1) bulbs++;
          else if (v === -1) { free++; if (firstFree === -1) firstFree = adj[j]; }
        }
        if (free > 0 && bulbs < clues[i].clue) {
          if (free < bestScore) {
            bestScore = free;
            bestChoice = firstFree;
            if (bestScore <= 2) break;
          }
        }
      }

      let unlitCount = 0;
      for (let i = 0; i < whites.length; i++) {
        const idx = whites[i];
        const hSeg = this.fastHCells[this.cellSegH[idx]];
        let lit = false;
        for (let j = 0; j < hSeg.length; j++) if (prop[hSeg[j]] === 1) { lit = true; break; }
        if (!lit) {
          const vSeg = this.fastVCells[this.cellSegV[idx]];
          for (let j = 0; j < vSeg.length; j++) if (prop[vSeg[j]] === 1) { lit = true; break; }
        }
        if (!lit) {
          unlitCount++;
          if (bestChoice === -1) {
            for (let j = 0; j < hSeg.length; j++) {
              if (prop[hSeg[j]] === -1) { bestChoice = hSeg[j]; break; }
            }
            if (bestChoice === -1) {
              const vSeg = this.fastVCells[this.cellSegV[idx]];
              for (let j = 0; j < vSeg.length; j++) {
                if (prop[vSeg[j]] === -1) { bestChoice = vSeg[j]; break; }
              }
            }
          }
        }
      }

      if (unlitCount === 0) {
        for (let i = 0; i < clues.length; i++) {
          if (!clues[i].active) continue;
          const adj = clues[i].adj;
          let bulbs = 0;
          for (let j = 0; j < adj.length; j++) if (prop[adj[j]] === 1) bulbs++;
          if (bulbs !== clues[i].clue) return;
        }
        const resBulbs = [];
        for (let i = 0; i < whites.length; i++) {
          const idx = whites[i];
          if (prop[idx] === 1) {
            resBulbs.push({ r: Math.floor(idx / this.w), c: idx % this.w });
          }
        }
        solutions.push(resBulbs);
        return;
      }

      if (bestChoice === -1) return;

      const s1 = new Int8Array(prop);
      s1[bestChoice] = 1;
      backtrack(s1);
      if (solutions.length >= maxSolutions || aborted) return;

      const s0 = new Int8Array(prop);
      s0[bestChoice] = 0;
      backtrack(st0From(prop, bestChoice));
    };

    const st0From = (prop, idx) => {
      const s0 = new Int8Array(prop);
      s0[idx] = 0;
      return s0;
    };

    backtrack(initial);
    if (aborted) return [];
    return solutions;
  }

  /**
   * Human-friendly step-by-step hint generator
   */
  getHint(userBulbs, userCrosses) {
    // userBulbs: Set of "r,c"
    // userCrosses: Set of "r,c"

    // 1. Check for illegal clashing bulbs
    for (const b1 of userBulbs) {
      const [r1, c1] = b1.split(',').map(Number);
      for (const b2 of userBulbs) {
        if (b1 === b2) continue;
        const [r2, c2] = b2.split(',').map(Number);
        if (r1 === r2) {
          // Check if no wall between them
          const minC = Math.min(c1, c2);
          const maxC = Math.max(c1, c2);
          let blocked = false;
          for (let col = minC + 1; col < maxC; col++) {
            if (this.board[r1][col] !== -1) { blocked = true; break; }
          }
          if (!blocked) {
            return {
              type: 'error',
              r: r1, c: c1,
              related: [{ r: r2, c: c2 }],
              message: `Two light bulbs at (${r1 + 1}, ${c1 + 1}) and (${r2 + 1}, ${c2 + 1}) illuminate each other! Bulbs cannot shine on one another.`
            };
          }
        }
        if (c1 === c2) {
          const minR = Math.min(r1, r2);
          const maxR = Math.max(r1, r2);
          let blocked = false;
          for (let row = minR + 1; row < maxR; row++) {
            if (this.board[row][c1] !== -1) { blocked = true; break; }
          }
          if (!blocked) {
            return {
              type: 'error',
              r: r1, c: c1,
              related: [{ r: r2, c: c2 }],
              message: `Two light bulbs at (${r1 + 1}, ${c1 + 1}) and (${r2 + 1}, ${c2 + 1}) illuminate each other in column ${c1 + 1}!`
            };
          }
        }
      }
    }

    // Calculate illuminated cells from current bulbs
    const litMap = new Set();
    const losDirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const b of userBulbs) {
      const [br, bc] = b.split(',').map(Number);
      litMap.add(`${br},${bc}`);
      for (const [dr, dc] of losDirs) {
        let nr = br + dr, nc = bc + dc;
        while (nr >= 0 && nr < this.h && nc >= 0 && nc < this.w && this.board[nr][nc] === -1) {
          litMap.add(`${nr},${nc}`);
          nr += dr;
          nc += dc;
        }
      }
    }

    // 2. Check clue overloads / errors
    for (let r = 0; r < this.h; r++) {
      for (let c = 0; c < this.w; c++) {
        const clue = this.board[r][c];
        if (clue >= 0) {
          const adj = this.getAdjWhite(r, c);
          const bulbs = adj.filter(p => userBulbs.has(p.key));
          // Squares available for a bulb: must not be crossed, AND if not already a bulb, must not be illuminated by another bulb!
          const available = adj.filter(p => userBulbs.has(p.key) || (!userCrosses.has(p.key) && !litMap.has(p.key)));
          if (bulbs.length > clue) {
            return {
              type: 'error',
              r, c,
              related: bulbs.map(b => ({ r: b.r, c: b.c })),
              message: `Number ${clue} at (${r + 1}, ${c + 1}) has ${bulbs.length} adjacent bulbs, which exceeds its clue!`
            };
          }
          if (available.length < clue) {
            return {
              type: 'error',
              r, c,
              message: `Number ${clue} at (${r + 1}, ${c + 1}) cannot be satisfied because surrounding squares are blocked or illuminated by other light paths.`
            };
          }
        }
      }
    }

    // 3. Deductions: Clue 0
    for (let r = 0; r < this.h; r++) {
      for (let c = 0; c < this.w; c++) {
        if (this.board[r][c] === 0) {
          const adj = this.getAdjWhite(r, c);
          const unmarked = adj.filter(p => !userCrosses.has(p.key) && !userBulbs.has(p.key));
          if (unmarked.length > 0) {
            const p = unmarked[0];
            return {
              type: 'action',
              action: 'cross',
              r: p.r, c: p.c,
              targetClue: { r, c },
              message: `A black cell with '0' cannot have any bulbs around it. Mark (${p.r + 1}, ${p.c + 1}) with X.`
            };
          }
        }
      }
    }

    // 4. Deductions: Clue N with N available spots remaining
    for (let r = 0; r < this.h; r++) {
      for (let c = 0; c < this.w; c++) {
        const clue = this.board[r][c];
        if (clue > 0) {
          const adj = this.getAdjWhite(r, c);
          const bulbs = adj.filter(p => userBulbs.has(p.key));
          const available = adj.filter(p => !userCrosses.has(p.key));
          if (bulbs.length < clue && available.length === clue) {
            const missing = available.find(p => !userBulbs.has(p.key));
            if (missing) {
              return {
                type: 'action',
                action: 'bulb',
                r: missing.r, c: missing.c,
                targetClue: { r, c },
                message: `Number ${clue} at (${r + 1}, ${c + 1}) needs ${clue} bulb${clue > 1 ? 's' : ''} and only has ${available.length} free space${available.length > 1 ? 's' : ''} remaining. Place a bulb at (${missing.r + 1}, ${missing.c + 1})!`
              };
            }
          }
        }
      }
    }

    // 5. Deductions: Clue N satisfied -> remaining must be X
    for (let r = 0; r < this.h; r++) {
      for (let c = 0; c < this.w; c++) {
        const clue = this.board[r][c];
        if (clue > 0) {
          const adj = this.getAdjWhite(r, c);
          const bulbs = adj.filter(p => userBulbs.has(p.key));
          if (bulbs.length === clue) {
            const uncrossed = adj.filter(p => !userBulbs.has(p.key) && !userCrosses.has(p.key));
            if (uncrossed.length > 0) {
              const p = uncrossed[0];
              return {
                type: 'action',
                action: 'cross',
                r: p.r, c: p.c,
                targetClue: { r, c },
                message: `Number ${clue} at (${r + 1}, ${c + 1}) is already satisfied with ${clue} bulb${clue > 1 ? 's' : ''}. Mark the remaining neighbor (${p.r + 1}, ${p.c + 1}) with X.`
              };
            }
          }
        }
      }
    }

    // 6. Ray coverage: If a bulb is placed, all cells in its beam cannot have bulbs
    for (const b of userBulbs) {
      const [br, bc] = b.split(',').map(Number);
      const hid = this.segH[br][bc];
      const vid = this.segV[br][bc];
      for (const p of [...this.hCells[hid], ...this.vCells[vid]]) {
        if (p.r === br && p.c === bc) continue;
        const key = `${p.r},${p.c}`;
        if (!userCrosses.has(key)) {
          return {
            type: 'action',
            action: 'cross',
            r: p.r, c: p.c,
            message: `Cell (${p.r + 1}, ${p.c + 1}) is illuminated by the bulb at (${br + 1}, ${bc + 1}), so it cannot contain a bulb. Mark with X.`
          };
        }
      }
    }

    // 7. Illumination requirement: A cell that cannot be lit by any other cell
    for (let r = 0; r < this.h; r++) {
      for (let c = 0; c < this.w; c++) {
        if (this.board[r][c] !== -1) continue;
        const key = `${r},${c}`;
        if (userBulbs.has(key)) continue;

        const hid = this.segH[r][c];
        const vid = this.segV[r][c];
        const hLit = this.hCells[hid].some(p => userBulbs.has(`${p.r},${p.c}`));
        const vLit = this.vCells[vid].some(p => userBulbs.has(`${p.r},${p.c}`));
        if (hLit || vLit) continue;

        // Neither segment is lit
        const canH = this.hCells[hid].filter(p => !userCrosses.has(`${p.r},${p.c}`));
        const canV = this.vCells[vid].filter(p => !userCrosses.has(`${p.r},${p.c}`));

        if (canH.length === 1 && canH[0].r === r && canH[0].c === c &&
            canV.length === 1 && canV[0].r === r && canV[0].c === c) {
          return {
            type: 'action',
            action: 'bulb',
            r, c,
            message: `Cell (${r + 1}, ${c + 1}) cannot be illuminated from any other cell in its row or column. It must be a bulb!`
          };
        }
      }
    }

    // 8. If all else fails, use solver solution to give next step
    const sols = this.solve(1);
    if (sols && sols.length > 0) {
      const solBulbs = new Set(sols[0].map(p => `${p.r},${p.c}`));
      for (const b of sols[0]) {
        const key = `${b.r},${b.c}`;
        if (!userBulbs.has(key)) {
          return {
            type: 'action',
            action: 'bulb',
            r: b.r, c: b.c,
            message: `Look closely at cell (${b.r + 1}, ${b.c + 1}): a bulb belongs here.`
          };
        }
      }
    }

    return { type: 'info', message: 'You are on the right track! Keep lighting up unlit squares.' };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AkariSolver;
} else {
  window.AkariSolver = AkariSolver;
}
