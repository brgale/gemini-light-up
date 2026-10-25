import random
from test_solver import AkariSolver

def generate_symmetric_walls(w, h, target_ratio=0.20):
    grid = [[-1]*w for _ in range(h)]
    num_walls = int(w * h * target_ratio)
    placed = 0
    attempts = 0
    while placed < num_walls and attempts < 1000:
        attempts += 1
        r = random.randint(0, h - 1)
        c = random.randint(0, w - 1)
        sr, sc = h - 1 - r, w - 1 - c
        if grid[r][c] == -1 and grid[sr][sc] == -1:
            grid[r][c] = -2
            grid[sr][sc] = -2
            placed += (1 if (r == sr and c == sc) else 2)
    return grid

def place_random_bulbs(w, h, grid):
    # Greedily illuminate all white cells without conflicts
    white_cells = [(r, c) for r in range(h) for c in range(w) if grid[r][c] == -1]
    random.shuffle(white_cells)
    
    # We want a set of bulbs that illuminates all cells and no two bulbs see each other
    # Let's use solver logic or randomized greedy with restart
    for attempt in range(50):
        bulbs = set()
        lit = set()
        
        # Build segments
        # Find horizontal and vertical line of sight for each cell
        def get_los(r, c):
            cells = {(r, c)}
            for dc in [-1, 1]:
                nc = c + dc
                while 0 <= nc < w and grid[r][nc] == -1:
                    cells.add((r, nc))
                    nc += dc
            for dr in [-1, 1]:
                nr = r + dr
                while 0 <= nr < h and grid[nr][c] == -1:
                    cells.add((nr, c))
                    nr += dr
            return cells

        los_map = {p: get_los(p[0], p[1]) for p in white_cells}
        
        # Candidates that can take a bulb without seeing existing bulbs
        forbidden = set()
        
        # While unlit cells exist
        unlit = [p for p in white_cells if p not in lit]
        random.shuffle(unlit)
        stuck = False
        
        while unlit:
            # Pick an unlit cell
            target = unlit.pop()
            if target in lit:
                continue
            # Pick a candidate cell in target's LOS that is not forbidden
            candidates = [p for p in los_map[target] if p not in forbidden]
            if not candidates:
                stuck = True
                break
            # Pick a candidate that covers maximum unlit cells
            candidates.sort(key=lambda p: len(los_map[p] - lit), reverse=True)
            chosen = random.choice(candidates[:2]) if len(candidates) >= 2 else candidates[0]
            
            bulbs.add(chosen)
            lit.update(los_map[chosen])
            forbidden.update(los_map[chosen])
            unlit = [p for p in white_cells if p not in lit]
            random.shuffle(unlit)
            
        if not stuck and len(lit) == len(white_cells):
            return bulbs
    return None

def make_puzzle(w, h, target_ratio=0.20):
    for _ in range(20):
        grid = generate_symmetric_walls(w, h, target_ratio)
        bulbs = place_random_bulbs(w, h, grid)
        if not bulbs:
            continue
        
        # Assign numbers to all black cells adjacent to bulbs
        for r in range(h):
            for c in range(w):
                if grid[r][c] == -2:
                    adj_bulbs = 0
                    for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                        nr, nc = r + dr, c + dc
                        if (nr, nc) in bulbs:
                            adj_bulbs += 1
                    grid[r][c] = adj_bulbs
        
        # Check if unique
        s = AkariSolver(w, h, grid)
        sols = s.solve(2)
        if len(sols) == 1:
            # Now prune numbers to increase difficulty or make it cleaner
            clue_positions = [(r, c) for r in range(h) for c in range(w) if grid[r][c] >= 0]
            random.shuffle(clue_positions)
            for r, c in clue_positions:
                old_val = grid[r][c]
                grid[r][c] = -2 # unnumbered black cell
                s_test = AkariSolver(w, h, grid)
                if len(s_test.solve(2)) != 1:
                    grid[r][c] = old_val # revert
            return grid, bulbs
    return None, None

random.seed(42)
grid, bulbs = make_puzzle(7, 7)
print("Generated 7x7 puzzle successfully!")
for r in range(7):
    row_str = []
    for c in range(7):
        if (r, c) in bulbs:
            row_str.append('O')
        elif grid[r][c] == -1:
            row_str.append('.')
        elif grid[r][c] == -2:
            row_str.append('#')
        else:
            row_str.append(str(grid[r][c]))
    print(' '.join(row_str))
