// 0/1 Knapsack: maximize value under a weight budget by filling a DP table
// row by row, then tracing back to find which items were selected.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  title: '0/1 Knapsack',
  slug: 'knapsack',
  category: 'Algorithms',
  summary: 'Maximize value under a weight budget — the classic dynamic programming problem that teaches table-filling, traceback, and pseudo-polynomial time',
  defaultInput: 'items: 60/10 100/20 120/30, capacity: 50',
  controls: [
    { id: 'items', label: 'Items (value/weight)', type: 'text', defaultValue: '60/10 100/20 120/30' },
    { id: 'capacity', label: 'Capacity', type: 'number', defaultValue: '50' },
  ],
  run,
};

// ---------------------------------------------------------------- parsing

function parseItems(text) {
  const raw = String(text ?? '').trim().split(/[\s,]+/).filter(Boolean);
  if (raw.length < 1) throw new InputError('Enter at least one item as value/weight (e.g. 60/10).');
  if (raw.length > 6) throw new InputError('Enter at most 6 items so every step stays readable.');
  return raw.map((tok, i) => {
    const parts = tok.split('/');
    if (parts.length !== 2) throw new InputError(`Item ${i + 1}: use value/weight format (e.g. 60/10).`);
    const value = Number(parts[0]);
    const weight = Number(parts[1]);
    if (!Number.isFinite(value) || value < 0) throw new InputError(`Item ${i + 1}: value must be a non-negative number.`);
    if (!Number.isInteger(weight) || weight < 1) throw new InputError(`Item ${i + 1}: weight must be a positive integer.`);
    return { value, weight, label: `#${i + 1} (v=${value}, w=${weight})` };
  });
}

function parseCapacity(text) {
  const v = Number(String(text ?? '').trim());
  if (!Number.isInteger(v) || v < 1 || v > 100) {
    throw new InputError('Capacity must be an integer between 1 and 100.');
  }
  return v;
}

// ---------------------------------------------------------------- run

export function* run(input) {
  const items = parseItems(input.items);
  const W = parseCapacity(input.capacity);
  const n = items.length;

  // Build row/column headers
  const rows = Array.from({ length: n + 1 }, (_, i) =>
    ({ id: `r${i}`, label: i === 0 ? '0 items' : `${items[i - 1].label}` }));
  const cols = Array.from({ length: W + 1 }, (_, w) =>
    ({ id: `c${w}`, label: String(w) }));

  const UNFILLED = -1;
  const dp = Array.from({ length: n + 1 }, () => new Array(W + 1).fill(UNFILLED));
  const cell = (i, w) => `r${i}:c${w}`;

  const snapshot = (title) => matrixState({
    title,
    rows,
    columns: cols,
    values: dp.map((row) => [...row]),
    format: (v) => (v === UNFILLED ? '·' : String(v)),
  });

  // Step 0: introduction
  const itemList = items.map((it, i) => `item ${i + 1}: value ${it.value}, weight ${it.weight}`).join('; ');
  yield {
    state: snapshot('0/1 Knapsack'),
    highlight: {},
    explanation: `We have ${n} item${n > 1 ? 's' : ''} (${itemList}) and a knapsack with capacity ${W}. Goal: pick a subset that maximizes total value without exceeding the weight limit. Each item is all-or-nothing — no splitting allowed. The table has rows for items 0..${n} and columns for capacities 0..${W}. Cell dp[i][w] will hold the best value achievable using items 1..i with capacity w.`,
  };

  // Step 1: base cases — row 0 (no items)
  for (let w = 0; w <= W; w++) dp[0][w] = 0;
  yield {
    state: snapshot('Base case: 0 items available'),
    highlight: { active: Array.from({ length: W + 1 }, (_, w) => cell(0, w)) },
    explanation: `Row 0: with zero items available, the best value at any capacity is 0. These base cases anchor the entire table — every later row will build on them.`,
  };

  // Step 2–: fill row by row
  for (let i = 1; i <= n; i++) {
    const item = items[i - 1];

    // Fill the whole row, yielding a step for each interesting cell
    for (let w = 0; w <= W; w++) {
      const skip = dp[i - 1][w];
      if (w < item.weight) {
        // Item too heavy
        dp[i][w] = skip;
      } else {
        const take = dp[i - 1][w - item.weight] + item.value;
        dp[i][w] = Math.max(skip, take);
      }
    }

    // Find the most instructive cell to explain (the largest capacity where item fits)
    const exW = Math.min(W, item.weight + Math.floor((W - item.weight) / 2));
    const skipVal = dp[i - 1][exW];
    const canTake = exW >= item.weight;
    const takeVal = canTake ? dp[i - 1][exW - item.weight] + item.value : null;
    const chose = canTake && takeVal > skipVal ? 'take' : 'skip';

    const activeCells = Array.from({ length: W + 1 }, (_, w) => cell(i, w));
    const dependCells = Array.from({ length: W + 1 }, (_, w) => cell(i - 1, w));

    let explanation;
    if (!canTake || W < item.weight) {
      explanation = `Row ${i} (item ${i}: value ${item.value}, weight ${item.weight}): at every capacity below ${item.weight}, the item is too heavy — copy from the row above. For capacity ${exW >= item.weight ? exW : W}: skip = ${skipVal}${canTake ? `, take = dp[${i - 1}][${exW - item.weight}] + ${item.value} = ${takeVal}, ${chose === 'take' ? 'taking is better' : 'skipping is better'}` : ', item too heavy to take'}. Each cell compares two options in O(1).`;
    } else {
      explanation = `Row ${i} (item ${i}: value ${item.value}, weight ${item.weight}): for each capacity w, compare skip (dp[${i - 1}][w] = keep the best without this item) vs take (dp[${i - 1}][w - ${item.weight}] + ${item.value} = best at reduced capacity plus this item's value). Example at w = ${exW}: skip = ${skipVal}, take = ${takeVal}. ${chose === 'take' ? `Taking wins (${takeVal} > ${skipVal})` : `Skipping wins (${skipVal} >= ${takeVal})`}. This is optimal substructure: the best for i items reuses the best for i - 1 items.`;
    }

    yield {
      state: snapshot(`Filling row ${i}: item ${i} (v=${item.value}, w=${item.weight})`),
      highlight: { active: activeCells, visited: dependCells },
      explanation,
      invariant: `After row ${i}, dp[${i}][w] = optimal value using items 1..${i} at capacity w.`,
    };
  }

  // Table is complete — show the answer cell
  const optimal = dp[n][W];
  yield {
    state: snapshot(`Table complete — optimal value: ${optimal}`),
    highlight: { found: [cell(n, W)] },
    explanation: `The bottom-right cell dp[${n}][${W}] = ${optimal}. This is the maximum value achievable with all ${n} items and capacity ${W}. Total work: ${(n + 1) * (W + 1)} cells, each O(1) = O(n × W) overall.`,
  };

  // Traceback: which items were selected?
  const selected = [];
  const traceHighlight = [cell(n, W)];
  let wi = W;
  for (let i = n; i >= 1; i--) {
    if (dp[i][wi] !== dp[i - 1][wi]) {
      selected.unshift(i);
      traceHighlight.push(cell(i - 1, wi - items[i - 1].weight));
      wi -= items[i - 1].weight;
    } else {
      traceHighlight.push(cell(i - 1, wi));
    }
  }

  const selectedDesc = selected.map((i) => `item ${i} (v=${items[i - 1].value}, w=${items[i - 1].weight})`).join(', ');
  const totalWeight = selected.reduce((s, i) => s + items[i - 1].weight, 0);

  yield {
    state: snapshot('Traceback: which items were selected?'),
    highlight: { range: traceHighlight, found: [cell(n, W)] },
    explanation: `Trace back from dp[${n}][${W}]: if dp[i][w] differs from dp[i - 1][w], item i was taken (move up and left by its weight); otherwise it was skipped (move straight up). Selected: ${selectedDesc}. Total value: ${optimal}, total weight: ${totalWeight}/${W}.`,
  };

  // Final summary
  yield {
    state: snapshot(`Optimal: value ${optimal}, weight ${totalWeight}/${W}`),
    highlight: { found: selected.map((i) => cell(i, 0)).concat([cell(n, W)]) },
    explanation: `Optimal value is ${optimal}, selected items: ${selectedDesc}. The table stores every subproblem — no combination is missed, no combination is checked twice. This is why DP beats brute force (2^${n} = ${Math.pow(2, n)} subsets) and why greedy fails: greedy by value/weight ratio would pick differently and can miss the true optimum.`,
  };
}

// ---------------------------------------------------------------- article

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The table has one row per item (plus row 0 for "no items") and one column per integer capacity from 0 to W. Rows represent the set of items under consideration: row i means "items 1 through i are available." Columns represent remaining capacity. Cell dp[i][w] holds the maximum profit achievable using items 1..i with capacity w.',
        'Active cells (highlighted) are the row being filled. Visited cells (dimmed) are the row above, which the current row consults. Each cell makes one binary decision about the current item: skip it (copy the value straight down from dp[i-1][w]) or take it (look up dp[i-1][w - weight_i], add the item\'s value, compare). The larger result wins.',
        'After every row is filled, the traceback walks from dp[n][W] upward. Where dp[i][w] differs from dp[i-1][w], item i was included and the path shifts left by that item\'s weight. Where they match, the item was skipped and the path moves straight up. The traced path identifies the optimal subset.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'You have a fixed budget and a list of options, each with a cost and a payoff. You want the combination that maximizes total payoff without exceeding the budget. That is the knapsack problem -- one of the most fundamental optimization problems in computer science.',
        'Dantzig formalized it in 1957. Bellman supplied the dynamic-programming recurrence the same year. Karp proved it NP-complete in 1972. The structure appears everywhere: resource allocation (which projects to fund under a capital cap), budget optimization (which features to ship under a time cap), cargo loading (which packages to load under a weight limit), cutting stock (which patterns to cut from raw material of fixed length), and feature selection in machine learning (which features to keep under a complexity budget).',
        'The "0/1" variant means each item is all-or-nothing: you take it or leave it, no splitting allowed.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Try every subset. With n items there are 2^n subsets. For each one, sum the weights, discard it if the sum exceeds W, and track the best total value seen. This is correct and easy to implement.',
        'For 10 items that is 1,024 subsets -- manageable. For 20, about a million. For 30, a billion. For 50, over a quadrillion. The approach is honest but it grows exponentially.',
        'A tempting shortcut: sort by value-to-weight ratio, greedily take the highest-ratio items until the bag is full. This is optimal for fractional knapsack (where you can split items), but it fails for 0/1 knapsack. Greedy locks in early choices it cannot undo, and a different combination may pack the capacity better.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Brute force dies to exponential growth. Each additional item doubles the subset count. No constant-factor speedup fixes 2^n.',
        'But the exponential tree hides massive redundancy. The subproblem "best value using items 1..i with capacity w" gets recomputed across many branches. If two branches both ask "what is the best value for items 1..3 at capacity 5?", they do the same work independently. These overlapping subproblems are the opening for dynamic programming.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build a 2D table dp with (n+1) rows and (W+1) columns. Row i means "only items 1 through i are available." Column w means "the knapsack has capacity w."',
        'Base case -- row 0: every cell is 0. No items available means no value at any capacity.',
        'For each row i from 1 to n, fill every column w from 0 to W. The recurrence has two cases. If item i is too heavy (weight_i > w), it cannot fit: dp[i][w] = dp[i-1][w]. If it fits (weight_i <= w), compare two options: skip the item and keep dp[i-1][w], or take it and get dp[i-1][w - weight_i] + value_i. The cell stores the maximum: dp[i][w] = max(dp[i-1][w], dp[i-1][w - weight_i] + value_i).',
        'After every row is filled, dp[n][W] holds the answer: maximum value using all n items within capacity W.',
        'To recover which items were selected, trace backward from dp[n][W]. At row i, compare dp[i][w] with dp[i-1][w]. If they differ, item i was included: subtract its weight from w and step to row i-1. If they match, item i was skipped: step to row i-1 with w unchanged. Continue until row 0. The items flagged as "taken" form the optimal subset.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Optimal substructure: any optimal solution for i items at capacity w either includes item i or excludes it. If it includes item i, removing that item leaves a solution for i-1 items at capacity w - weight_i, and that leftover must itself be optimal -- otherwise replacing it with the true optimum for that subproblem would improve the whole solution. The same exchange argument applies when item i is excluded. The best answer for i items is therefore the better of two already-solved subproblems.',
        'Overlapping subproblems: many branches of the brute-force recursion tree ask the same (i, w) question. The table computes each pair exactly once and reuses it. This is what converts exponential enumeration into an nW-cell table fill.',
        'Correctness by induction. Base case: dp[0][w] = 0 for all w (no items, no value). Inductive step: assume every cell in row i-1 is correct. Then dp[i][w] evaluates both possibilities for item i using correct subsolutions, so it is correct. After n rows, dp[n][W] is the global optimum.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(nW). The table has (n+1)(W+1) cells, each filled in O(1). Double the items, double the work. Double the capacity, double the work. Traceback adds O(n).',
        'Space: O(nW) for the full table. If you only need the optimal value (not the item list), you can compress to a single 1D array of length W+1. The key: iterate capacity backwards, from W down to weight_i. When filling dp[w], the value dp[w - weight_i] has not yet been overwritten this round, so it still holds the previous row\'s value. Iterating forwards would let an item be counted twice (its own update would feed back into a later cell), which is the unbounded-knapsack recurrence, not the 0/1 recurrence. Backwards iteration preserves the 0/1 constraint in O(W) space.',
        'The catch: O(nW) is pseudo-polynomial. W is a numeric value, not the number of bits needed to encode it. If the capacity is written in b bits, W can be as large as 2^b. A 30-bit capacity means a billion columns. This is why knapsack is NP-hard: no known algorithm runs in time polynomial in the input size (n + b).',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Capital budgeting: a firm has a fixed investment cap and a list of projects with expected returns. Each project is funded or not. Maximizing return within the cap is 0/1 knapsack.',
        'Cloud resource allocation: a cluster has a memory or CPU budget. Workloads have resource demands and priority scores. Scheduling the highest-priority set that fits is the same structure.',
        'Cargo and container loading: a shipping container has a weight limit. Packages have revenue and weight. Selecting packages to maximize loaded revenue is knapsack.',
        'Cutting stock: raw material has a fixed length. Each cutting pattern has a yield and a waste cost. Selecting patterns that maximize yield is a knapsack variant.',
        'Feature selection: a model has a complexity budget. Each candidate feature has predictive value and a training cost. Choosing the best feature set under the budget is knapsack.',
        'Cryptography: subset sum ("does a subset summing to exactly S exist?") is the decision version of knapsack where value equals weight. It underlies several lattice-based cryptosystems.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Pseudo-polynomial blowup: when W is in the millions or billions, the DP table is too large to build. A 30-bit capacity means a billion columns per row. For these cases, branch-and-bound with LP relaxation bounds often finds the optimum faster in practice, and FPTAS (fully polynomial-time approximation scheme) guarantees a (1-epsilon) approximation in time polynomial in n and 1/epsilon.',
        'Fractional knapsack: if items can be split, greedy by value-to-weight ratio is optimal in O(n log n). No table needed. The 0/1 constraint is precisely what forces DP.',
        'Unbounded knapsack: if multiple copies of each item are allowed, the recurrence simplifies. dp[w] = max over all items i where weight_i <= w of (dp[w - weight_i] + value_i). Capacity iterates forwards (not backwards), and the single-row approach is the natural formulation.',
        'Multiple constraints: adding a second constraint (e.g., both weight and volume) adds a table dimension, making it O(n * W * V). Each additional constraint multiplies the table size. Three or four constraints make DP impractical; integer linear programming or heuristics take over.',
        'Dependent values: the standard model treats each item\'s value as fixed. In practice, selecting item A may change item B\'s value through synergy or substitution. Modeling these dependencies requires quadratic or higher-order extensions.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Items: #1 (weight 2, value 3), #2 (weight 4, value 4), #3 (weight 3, value 5), #4 (weight 5, value 6). Capacity W = 7. The table has 5 rows (0 through 4) and 8 columns (capacity 0 through 7).',
        'Row 0: all zeros. No items, no value.',
        'Row 1 (item 1: w=2, v=3): columns 0-1 cannot fit item 1, copy 0 from above. At w=2: skip = dp[0][2] = 0, take = dp[0][0] + 3 = 3. Take wins. Columns 2-7 all get 3. Row 1: [0, 0, 3, 3, 3, 3, 3, 3].',
        'Row 2 (item 2: w=4, v=4): columns 0-3 copy row 1 (item 2 too heavy). At w=4: skip = 3, take = dp[1][0] + 4 = 4. Take: 4. At w=5: skip = 3, take = dp[1][1] + 4 = 4. Take: 4. At w=6: skip = 3, take = dp[1][2] + 4 = 7. Take: 7 (both items fit). At w=7: skip = 3, take = dp[1][3] + 4 = 7. Take: 7. Row 2: [0, 0, 3, 3, 4, 4, 7, 7].',
        'Row 3 (item 3: w=3, v=5): columns 0-2 copy row 2. At w=3: skip = 3, take = dp[2][0] + 5 = 5. Take: 5. At w=4: skip = 4, take = dp[2][1] + 5 = 5. Take: 5. At w=5: skip = 4, take = dp[2][2] + 5 = 8. Take: 8 (items 1 and 3 together). At w=6: skip = 7, take = dp[2][3] + 5 = 8. Take: 8. At w=7: skip = 7, take = dp[2][4] + 5 = 9. Take: 9. Row 3: [0, 0, 3, 5, 5, 8, 8, 9].',
        'Row 4 (item 4: w=5, v=6): columns 0-4 copy row 3. At w=5: skip = 8, take = dp[3][0] + 6 = 6. Skip wins: 8. At w=6: skip = 8, take = dp[3][1] + 6 = 6. Skip: 8. At w=7: skip = 9, take = dp[3][2] + 6 = 9. Tie, either works: 9. Row 4: [0, 0, 3, 5, 5, 8, 8, 9].',
        'The answer is dp[4][7] = 9.',
        'Traceback from dp[4][7] = 9. Compare with dp[3][7] = 9: same, skip item 4. Move to dp[3][7] = 9. Compare with dp[2][7] = 7: different, so item 3 was taken. Subtract weight 3, move to dp[2][4] = 4. Compare with dp[1][4] = 3: different, so item 2 was taken. Subtract weight 4, move to dp[1][0] = 0. Compare with dp[0][0] = 0: same, skip item 1. Done.',
        'Selected: items 2 and 3. Total value: 4 + 5 = 9. Total weight: 4 + 3 = 7, exactly at capacity. Note that items 1 and 3 (value 3 + 5 = 8, weight 2 + 3 = 5) leave capacity unused. The DP found the tighter packing that squeezes out one more unit of value.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'George Dantzig (1957) formulated the knapsack problem in its modern optimization form. Richard Bellman (1957) supplied the dynamic-programming recurrence framework. Richard Karp (1972) proved knapsack NP-complete in his landmark list of 21 problems.',
        'Prerequisites: memoization (the top-down perspective on the same subproblem structure) and arrays (the table is a 2D array indexed by item count and capacity).',
        'Extensions: coin change (unbounded knapsack variant -- minimize coins to hit a target sum), longest increasing subsequence (a different 1D DP with binary-search optimization), and subset sum (knapsack where value equals weight, the core NP-complete decision problem).',
        'Alternatives: branch and bound (prune the search tree using LP relaxation bounds -- often faster in practice for large W), greedy algorithms (optimal for fractional knapsack in O(n log n)), and FPTAS approximation (guaranteed (1-epsilon) factor in polynomial time).',
      ],
    },
  ],
};
