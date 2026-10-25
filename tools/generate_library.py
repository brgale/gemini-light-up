import json
import random
from test_solver import AkariSolver
from test_generator import make_puzzle

def encode_task(grid, w, h):
    flat = [grid[r][c] for r in range(h) for c in range(w)]
    out = []
    run = 0
    for val in flat:
        if val == -1:
            run += 1
            if run == 26:
                out.append('z')
                run = 0
        else:
            if run > 0:
                out.append(chr(ord('a') + run - 1))
                run = 0
            if val == -2:
                out.append('B')
            else:
                out.append(str(val))
    if run > 0:
        out.append(chr(ord('a') + run - 1))
    return ''.join(out)

# Let's generate a batch of puzzles for each size
sizes = [
    ("7x7", 7, 7, 6),
    ("10x10", 10, 10, 6),
    ("14x14", 14, 14, 4),
    ("25x25", 25, 25, 2)
]

library = {}
random.seed(1337)

for label, w, h, count in sizes:
    library[label] = { "easy": [], "normal": [], "hard": [] }
    print(f"Generating for {label}...")
    for diff in ["easy", "normal", "hard"]:
        target_ratio = 0.18 if diff == "easy" else (0.21 if diff == "normal" else 0.23)
        collected = 0
        tries = 0
        while collected < count and tries < 50:
            tries += 1
            grid, bulbs = make_puzzle(w, h, target_ratio)
            if grid is not None:
                # If hard, prune more clues
                # If easy, keep more clues
                task_code = encode_task(grid, w, h)
                library[label][diff].append({
                    "task": task_code,
                    "w": w,
                    "h": h,
                    "diff": diff,
                    "id": f"{label}-{diff}-{collected+1}"
                })
                collected += 1
                print(f"  [{label} {diff}] generated {collected}/{count}")

with open("puzzles_library.json", "w") as f:
    json.dump(library, f, indent=2)

print("Saved puzzles_library.json successfully!")
