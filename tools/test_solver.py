import random

class AkariSolver:
    def __init__(self, width, height, board):
        """
        board: 2D array of cells:
          -2: unnumbered black cell
          0..4: numbered black cell
          -1: white cell (empty)
        """
        self.w = width
        self.h = height
        self.board = [row[:] for row in board]
        # Segments
        # Horizontal segments: map (r, c) -> seg_h_id
        # Vertical segments: map (r, c) -> seg_v_id
        self.seg_h = [[-1]*width for _ in range(height)]
        self.seg_v = [[-1]*width for _ in range(height)]
        self.h_cells = [] # seg_h_id -> list of (r, c)
        self.v_cells = [] # seg_v_id -> list of (r, c)

        h_count = 0
        for r in range(height):
            c = 0
            while c < width:
                if self.board[r][c] == -1:
                    cells = []
                    while c < width and self.board[r][c] == -1:
                        self.seg_h[r][c] = h_count
                        cells.append((r, c))
                        c += 1
                    self.h_cells.append(cells)
                    h_count += 1
                else:
                    c += 1

        v_count = 0
        for c in range(width):
            r = 0
            while r < height:
                if self.board[r][c] == -1:
                    cells = []
                    while r < height and self.board[r][c] == -1:
                        self.seg_v[r][c] = v_count
                        cells.append((r, c))
                        r += 1
                    self.v_cells.append(cells)
                    v_count += 1
                else:
                    r += 1

        self.num_h = h_count
        self.num_v = v_count

    def solve(self, max_solutions=2):
        """
        Returns list of solutions. Each solution is a set of (r, c) where bulbs are placed.
        Cell states in solver:
          bulb: 1
          no_bulb: 0
          unknown: None
        """
        state = {}
        for r in range(self.h):
            for c in range(self.w):
                if self.board[r][c] == -1:
                    state[(r, c)] = None

        solutions = []

        def get_adj_white(r, c):
            adj = []
            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nr, nc = r + dr, c + dc
                if 0 <= nr < self.h and 0 <= nc < self.w and self.board[nr][nc] == -1:
                    adj.append((nr, nc))
            return adj

        def propagate(st):
            # Returns new st or None if contradiction
            st = dict(st)
            changed = True
            while changed:
                changed = False
                # 1. Numbered walls
                for r in range(self.h):
                    for c in range(self.w):
                        clue = self.board[r][c]
                        if clue >= 0:
                            adj = get_adj_white(r, c)
                            bulbs = sum(1 for p in adj if st[p] == 1)
                            free = [p for p in adj if st[p] is None]
                            if bulbs > clue:
                                return None
                            if bulbs + len(free) < clue:
                                return None
                            if bulbs == clue and free:
                                for p in free:
                                    st[p] = 0
                                changed = True
                            elif bulbs + len(free) == clue and free:
                                for p in free:
                                    st[p] = 1
                                changed = True

                # 2. Segment rules: if a segment has a bulb, all other cells in that segment must be 0
                for h_id, cells in enumerate(self.h_cells):
                    bulbs = [p for p in cells if st[p] == 1]
                    if len(bulbs) > 1:
                        return None
                    if len(bulbs) == 1:
                        for p in cells:
                            if st[p] is None:
                                st[p] = 0
                                changed = True

                for v_id, cells in enumerate(self.v_cells):
                    bulbs = [p for p in cells if st[p] == 1]
                    if len(bulbs) > 1:
                        return None
                    if len(bulbs) == 1:
                        for p in cells:
                            if st[p] is None:
                                st[p] = 0
                                changed = True

                # 3. Illumination coverage rule:
                # Every white cell (r, c) must be illuminated by either its h-segment or its v-segment.
                # If neither segment has a bulb, AND in one segment there are no remaining free cells,
                # then all illumination must come from the other segment.
                # Specifically: if a cell (r, c) cannot be illuminated by any other cell in its h-segment (all others are 0 or none exist)
                # and cannot be illuminated by any other cell in its v-segment, then (r, c) itself MUST be 1.
                # Also, if all cells in h_cells and v_cells that could illuminate (r, c) are 0, contradiction!
                for p, val in st.items():
                    r, c = p
                    hid = self.seg_h[r][c]
                    vid = self.seg_v[r][c]
                    h_has_bulb = any(st[cell] == 1 for cell in self.h_cells[hid])
                    v_has_bulb = any(st[cell] == 1 for cell in self.v_cells[vid])
                    if h_has_bulb or v_has_bulb:
                        continue
                    # Neither segment has a bulb yet
                    possible_h = [cell for cell in self.h_cells[hid] if st[cell] is None]
                    possible_v = [cell for cell in self.v_cells[vid] if st[cell] is None]
                    if not possible_h and not possible_v:
                        # Cell cannot be illuminated!
                        return None
                    # If the only possible cell to illuminate (r, c) is (r, c) itself:
                    if len(possible_h) == 1 and possible_h[0] == p and len(possible_v) == 1 and possible_v[0] == p:
                        if st[p] is None:
                            st[p] = 1
                            changed = True

            return st

        def backtrack(st):
            if len(solutions) >= max_solutions:
                return
            st = propagate(st)
            if st is None:
                return

            # Check if all white cells are illuminated
            unlit = []
            for p, val in st.items():
                r, c = p
                hid = self.seg_h[r][c]
                vid = self.seg_v[r][c]
                h_lit = any(st[cell] == 1 for cell in self.h_cells[hid])
                v_lit = any(st[cell] == 1 for cell in self.v_cells[vid])
                if not h_lit and not v_lit:
                    unlit.append(p)

            if not unlit:
                # All cells are illuminated! Check numbered walls
                valid = True
                for r in range(self.h):
                    for c in range(self.w):
                        clue = self.board[r][c]
                        if clue >= 0:
                            adj = get_adj_white(r, c)
                            if sum(1 for np in adj if st[np] == 1) != clue:
                                valid = False
                                break
                    if not valid:
                        break
                if valid:
                    # Found solution!
                    sol = {p for p, v in st.items() if v == 1}
                    solutions.append(sol)
                return

            # Pick an unassigned cell with minimum remaining options or heuristic
            # Heuristic: pick cell in unlit with fewest candidate positions
            # Or just MRV
            candidates = [p for p in st if st[p] is None]
            if not candidates:
                return

            # Pick a cell from unlit if possible
            choice = None
            for p in unlit:
                if st[p] is None:
                    choice = p
                    break
            if choice is None:
                choice = candidates[0]

            # Try 1 then 0
            st1 = dict(st)
            st1[choice] = 1
            backtrack(st1)
            if len(solutions) >= max_solutions:
                return

            st0 = dict(st)
            st0[choice] = 0
            backtrack(st0)

        backtrack(state)
        return solutions

# Let's test solving the 7x7 puzzle we retrieved from the website!
task = 'b2a0f0bBBd1g3d00bBf1a2b'
cells = []
for ch in task:
    if 'a' <= ch <= 'z':
        cells.extend([-1] * (ord(ch) - ord('a') + 1))
    elif ch == 'B':
        cells.append(-2)
    elif ch in '01234':
        cells.append(int(ch))

grid = [cells[r*7:(r+1)*7] for r in range(7)]
solver = AkariSolver(7, 7, grid)
sols = solver.solve()
print("Solutions found for website 7x7 puzzle:", len(sols))
if sols:
    sol = sols[0]
    for r in range(7):
        line = []
        for c in range(7):
            if (r, c) in sol:
                line.append('O')
            elif grid[r][c] == -1:
                line.append('.')
            elif grid[r][c] == -2:
                line.append('#')
            else:
                line.append(str(grid[r][c]))
        print(' '.join(line))

task10 = 'bBBg2c2b0jBd1dBaBd1f2d0a1dBd2j2bBc3gBBb'
cells10 = []
for ch in task10:
    if 'a' <= ch <= 'z':
        cells10.extend([-1] * (ord(ch) - ord('a') + 1))
    elif ch == 'B':
        cells10.append(-2)
    elif ch in '01234':
        cells10.append(int(ch))

grid10 = [cells10[r*10:(r+1)*10] for r in range(10)]
s10 = AkariSolver(10, 10, grid10)
sols10 = s10.solve()
print("Solutions found for website 10x10 puzzle:", len(sols10))
