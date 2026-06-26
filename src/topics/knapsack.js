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
        'Read each table cell dp[i][w] as the best value possible using the first i items with capacity w. Active cells are being filled, visited cells are dependencies from the row above, and the final traceback marks which decisions made the optimum.',
        { type: 'callout', text: '0/1 knapsack works because every item decision reduces to two already-solved subproblems: skip it, or take it and spend its capacity.' },
        'The safe inference rule is binary: item i is either absent or present. If it is absent, copy dp[i-1][w]; if it is present, add value_i to dp[i-1][w - weight_i] and take the larger result.',
        {type: 'image', src: './assets/gifs/knapsack.gif', alt: 'Animated walkthrough of the knapsack visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        '0/1 knapsack models a budgeted choice: each item has a weight cost and value payoff, and each item can be taken at most once. The goal is the highest total value without exceeding capacity.',
        'The problem appears in cargo loading, project selection, feature selection, and resource allocation. It matters because the best answer often comes from a combination that no single greedy rule sees.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious exact method tries every subset. With n items there are 2^n subsets, and each subset can be checked for total weight and total value.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c6/Knapsack_greedy.svg', alt: 'Greedy knapsack illustration with boxes and backpack capacity', caption: 'The greedy picture is useful because it also shows the trap: density sorting is correct for fractional knapsack, not for 0/1 knapsack. Source: https://commons.wikimedia.org/wiki/File:Knapsack_greedy.svg.' },
        'A tempting shortcut sorts by value per weight and takes the best ratios first. That is correct for fractional knapsack, where items can be split, but it can fail when each item is all-or-nothing.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is exponential growth. Each new item doubles the number of subsets, so 50 items produce over one quadrillion candidate subsets.',
        'The search tree also repeats subproblems. Many branches ask the same question: what is the best value using the first i items with capacity w?',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Every optimal solution either skips the current item or takes it. Those two cases reduce the current cell to two smaller cells from the previous row.',
        'Dynamic programming stores each smaller answer once. The table replaces repeated subset enumeration with one pass over item count and capacity.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Create a table with n + 1 rows and W + 1 columns. Row 0 is all zero because no value can be earned when no items are available.',
        'For item i and capacity w, first copy skip = dp[i-1][w]. If weight_i <= w, compute take = dp[i-1][w - weight_i] + value_i; otherwise taking is impossible.',
        'Store max(skip, take) in dp[i][w]. After the last row, dp[n][W] is the optimal value, and traceback recovers the item set by comparing each cell with the cell above it.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows by induction on rows. Row 0 is correct, and if row i-1 is correct, then row i checks both possible states of item i using correct smaller answers.',
        'No other case exists for 0/1 knapsack. Since every feasible solution either includes or excludes item i, the larger of those two cases is exactly optimal for dp[i][w].',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The table has (n + 1)(W + 1) cells, and each cell costs O(1), so time is O(nW). Full-table space is O(nW), or O(W) if only the optimal value is needed.',
        'The cost is pseudo-polynomial because W is a number, not the number of bits used to write it. Doubling capacity doubles the columns, even if the input text only gained one binary digit at a power of two boundary.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Knapsack fits capital budgeting when projects have costs and expected returns. It also fits scheduling or cloud placement when workloads have resource demands and priority scores.',
        'Subset-sum and feature-selection variants use the same recurrence shape. The access pattern is small-to-medium integer capacity where exact optimality is worth the table cost.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The DP fails when capacity is huge. A capacity of one billion creates one billion columns per row, even if there are only a few dozen items.',
        'It also changes when the model changes. Fractional knapsack needs greedy ratio sorting, unbounded knapsack iterates capacities forward, and multiple constraints multiply the table dimensions.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use items #1 weight 2 value 3, #2 weight 4 value 4, #3 weight 3 value 5, and #4 weight 5 value 6. Capacity W is 7.',
        'Row 1 gives value 3 for capacities 2 through 7 because item #1 fits there. Row 2 gives [0,0,3,3,4,4,7,7], since capacity 6 or 7 can hold items #1 and #2 for value 7.',
        'Row 3 considers item #3. At capacity 7, skip is 7 and take is dp[2][4] + 5 = 4 + 5 = 9, so dp[3][7] becomes 9.',
        'Row 4 considers item #4. At capacity 7, skip is 9 and take is dp[3][2] + 6 = 3 + 6 = 9, so the optimum remains 9; traceback can return items #2 and #3 with weight 7 and value 9.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Bellman, Dynamic Programming, 1957, for the recurrence method; Karp, Reducibility Among Combinatorial Problems, 1972, for NP-completeness context. Dantzig also framed knapsack in modern optimization language in the 1950s.',
        'Study memoization as the top-down version of the same recurrence, then coin change, subset sum, and longest increasing subsequence. Study branch and bound or FPTAS methods when W is too large for the table.',
      ],
    },
  ],
};
