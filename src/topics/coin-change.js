// Coin Change: find the minimum number of coins to make a target amount.
// Classic bottom-up DP — fill dp[0..amount] where dp[i] = fewest coins for i.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'coin-change',
  title: 'Coin Change',
  category: 'Algorithms',
  summary: 'Find the minimum number of coins to make a target amount — the classic DP problem that shows why greedy fails and table-filling wins.',
  controls: [
    { id: 'coins', label: 'Coin denominations', type: 'text', defaultValue: '1 3 4' },
    { id: 'amount', label: 'Target amount', type: 'number', defaultValue: '6' },
  ],
  run,
};

// ---------------------------------------------------------------- parsing

function parseCoins(text) {
  const raw = String(text ?? '').trim().split(/[\s,]+/).filter(Boolean);
  if (raw.length < 1) throw new InputError('Enter at least one coin denomination (e.g. 1 3 4).');
  if (raw.length > 6) throw new InputError('Enter at most 6 denominations so every step stays readable.');
  const coins = raw.map((tok, i) => {
    const v = Number(tok);
    if (!Number.isInteger(v) || v < 1) throw new InputError(`Denomination ${i + 1}: must be a positive integer.`);
    return v;
  });
  if (!coins.includes(1)) throw new InputError('Include denomination 1 so every amount is reachable.');
  return [...new Set(coins)].sort((a, b) => a - b);
}

function parseAmount(text) {
  const v = Number(String(text ?? '').trim());
  if (!Number.isInteger(v) || v < 1 || v > 30) {
    throw new InputError('Amount must be an integer between 1 and 30.');
  }
  return v;
}

// ---------------------------------------------------------------- run

export function* run(input) {
  const coins = parseCoins(input.coins);
  const amount = parseAmount(input.amount);
  const INF = amount + 1; // sentinel for "impossible"

  // Single-row matrix: columns are amounts 0..amount
  const rows = [{ id: 'r0', label: 'dp' }];
  const cols = Array.from({ length: amount + 1 }, (_, i) => ({ id: `c${i}`, label: String(i) }));
  const dp = new Array(amount + 1).fill(INF);
  const choice = new Array(amount + 1).fill(-1); // which coin was used
  const cell = (w) => `r0:c${w}`;

  const snapshot = (title) => matrixState({
    title,
    rows,
    columns: cols,
    values: [dp.map((v) => v)],
    format: (v) => (v >= INF ? '∞' : String(v)),
  });

  // Step 0: introduction
  yield {
    state: snapshot('Coin Change'),
    highlight: {},
    explanation: `Coins: [${coins.join(', ')}]. Target amount: ${amount}. Goal: find the fewest coins that sum to exactly ${amount}. We build a table dp[0..${amount}] where dp[i] = minimum coins needed to make amount i. Every cell starts at ∞ (unreachable) except dp[0] = 0 (zero coins make zero).`,
  };

  // Step 1: base case
  dp[0] = 0;
  yield {
    state: snapshot('Base case: dp[0] = 0'),
    highlight: { found: [cell(0)] },
    explanation: `dp[0] = 0. Making amount 0 requires zero coins. This anchors the recurrence: every other cell will build on smaller amounts that ultimately trace back to this base case.`,
  };

  // Step 2+: fill dp[1..amount]
  for (let i = 1; i <= amount; i++) {
    let bestCoin = -1;
    const candidates = [];

    for (const c of coins) {
      if (c <= i && dp[i - c] + 1 < dp[i]) {
        dp[i] = dp[i - c] + 1;
        bestCoin = c;
      }
      if (c <= i) {
        candidates.push(`dp[${i}-${c}]+1 = dp[${i - c}]+1 = ${dp[i - c] === INF ? '∞' : dp[i - c] + 1}`);
      }
    }
    choice[i] = bestCoin;

    const deps = coins.filter((c) => c <= i).map((c) => cell(i - c));
    const candidateStr = candidates.join(', ');

    yield {
      state: snapshot(`Filling dp[${i}]`),
      highlight: { active: [cell(i)], visited: deps },
      explanation: `dp[${i}]: try each coin c ≤ ${i}. ${candidateStr}. Minimum is ${dp[i] === INF ? '∞ (unreachable)' : dp[i]}${bestCoin > 0 ? ` using coin ${bestCoin}` : ''}. Each cell looks back at already-solved smaller amounts — one comparison per coin denomination.`,
      invariant: `After this step, dp[${i}] = ${dp[i] === INF ? '∞' : dp[i]}: the fewest coins to make amount ${i}.`,
    };
  }

  // Table complete
  const answer = dp[amount];
  yield {
    state: snapshot(`Table complete — answer: ${answer === INF ? '∞' : answer}`),
    highlight: { found: [cell(amount)] },
    explanation: `dp[${amount}] = ${answer === INF ? '∞ (impossible)' : answer}. This is the minimum number of coins to make ${amount}. The table filled ${amount} cells, each checking ${coins.length} coin${coins.length > 1 ? 's' : ''} = O(amount × |coins|) total work.`,
  };

  // Traceback: which coins were used?
  if (answer < INF) {
    const usedCoins = [];
    const traceCells = [cell(amount)];
    let rem = amount;
    while (rem > 0) {
      const c = choice[rem];
      usedCoins.push(c);
      rem -= c;
      traceCells.push(cell(rem));
    }

    yield {
      state: snapshot(`Solution: ${usedCoins.join(' + ')} = ${amount}`),
      highlight: { range: traceCells, found: [cell(amount)] },
      explanation: `Trace back from dp[${amount}]: at each amount, the coin chosen was recorded during the fill. ${usedCoins.map((c, idx) => `Use coin ${c} → remaining ${amount - usedCoins.slice(0, idx + 1).reduce((s, x) => s + x, 0)}`).join('. ')}. Solution: ${usedCoins.join(' + ')} = ${amount} (${answer} coin${answer > 1 ? 's' : ''}).`,
    };

    // Greedy comparison
    const greedyCoins = [];
    let greedyRem = amount;
    const sortedDesc = [...coins].sort((a, b) => b - a);
    while (greedyRem > 0) {
      const c = sortedDesc.find((d) => d <= greedyRem);
      if (!c) break;
      greedyCoins.push(c);
      greedyRem -= c;
    }
    const greedyWorks = greedyRem === 0;
    const greedyCount = greedyWorks ? greedyCoins.length : Infinity;

    yield {
      state: snapshot(`DP: ${answer} coins vs Greedy: ${greedyWorks ? greedyCount : '∞'} coins`),
      highlight: { found: [cell(amount)] },
      explanation: `Greedy (always pick the largest coin that fits): ${greedyWorks ? greedyCoins.join(' + ') + ' = ' + amount + ' (' + greedyCount + ' coin' + (greedyCount > 1 ? 's' : '') + ')' : 'fails to make ' + amount}. DP: ${usedCoins.join(' + ')} = ${amount} (${answer} coin${answer > 1 ? 's' : ''}). ${greedyCount <= answer ? 'Greedy matches DP here.' : 'Greedy uses more coins — it commits to the largest denomination without considering that smaller coins can combine better. DP checks every option and guarantees the minimum.'}`,
    };
  }
}

// ---------------------------------------------------------------- article

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The row of cells is the DP table dp[0..amount]. Column i holds the fewest coins needed to make amount i. A cell showing ∞ means that amount is unsolved. A cell showing a number is the current best answer for that amount.',
        'The bright cell is the amount being solved right now. The dimmer cells behind it are the subproblems the algorithm consults — one lookup per coin denomination. For each coin c that fits, the algorithm reads dp[i − c], adds one, and keeps the smallest result.',
        'After the table is full, the traceback lights the path from dp[amount] back to dp[0], subtracting one coin at each step. That path is the actual solution: which coins, in what combination, achieve the minimum.',
        {type: 'callout', text: 'Coin change is the smallest DP problem where a locally best coin can block the globally best path.'},
      
        {type: 'image', src: './assets/gifs/coin-change.gif', alt: 'Animated walkthrough of the coin change visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Given a set of coin denominations and a target amount, find the fewest coins that sum to exactly that amount. Vending machines returning change, ATMs dispensing bills, and payment systems splitting transactions all solve variants of this problem.',
        'With US coins (1, 5, 10, 25 cents) the answer seems obvious: always grab the largest coin that fits. That works — but only because US denominations were designed so it would. The coin change problem is the simplest setting where that greedy instinct breaks, and the simplest place to learn why dynamic programming exists.',
        'It is also an unbounded knapsack variant. Each denomination is an item type with unlimited supply and unit weight equal to its face value. Minimizing coin count is minimizing the number of items that fill the knapsack to exact capacity.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Greedy: sort denominations largest-first, repeatedly pick the biggest coin that fits, subtract it, repeat. For US coins making 30 cents: take a quarter (25), then a nickel (5). Two coins, done.',
        'This is fast — one pass through the sorted denominations — and correct for canonical coin systems. A coin system is canonical when greedy always yields the minimum count. The US, Euro, and most national currencies are canonical by design.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Coins [1, 3, 4], amount 6. Greedy picks 4 (the largest that fits), leaving 2. No coin larger than 1 fits 2, so greedy adds 1 + 1. Result: 4 + 1 + 1 = 3 coins. But 3 + 3 = 6 uses only 2 coins.',
        'Greedy failed because it locked in 4 without considering that skipping 4 entirely and using two 3s is cheaper. The decision is irrevocable: once 4 is chosen, no later step can undo it. Tie-breaking rules and short lookahead do not help — the problem requires comparing paths that diverge from the very first choice.',
        'Brute force does explore all paths: try every coin as the first coin, recurse on the remainder, take the minimum. But the recursion tree branches by the number of denominations at each level and can reach depth amount/1 = amount. For k denominations and target n, the worst case is O(k^n) — exponential and useless for any non-toy input.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Every optimal solution ends with some coin c. Remove that coin and you are left with amount i − c, which must itself be solved optimally (if it were not, substituting a better sub-solution would improve the whole). So dp[i] = min over all valid coins c of (dp[i − c] + 1).',
        'The recursion overlaps massively: dp[6] might query dp[3] via coin 3 and dp[2] via coin 4, while dp[5] also queries dp[2] via coin 3. A table that solves each amount once, left to right, eliminates every redundant computation. That is the entire idea of bottom-up DP.',
        {type: 'image', src: 'https://avikdas.com/assets/images/2019-04-15-visual-introduction-to-dynamic-programming/change-making-dag-01-desired-solution.png', alt: 'Change making dynamic programming grid with desired solution cell', caption: 'The change-making DAG lays out subproblems by denomination and remaining target, making the recurrence visible as graph dependencies. Source: Avik Das, https://avikdas.com/2019/04/15/a-graphical-introduction-to-dynamic-programming.html.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Allocate an array dp of length amount + 1. Set dp[0] = 0 (zero coins make zero). Fill every other slot with ∞ (unsolved sentinel).',
        'For i = 1 to amount: scan every coin c. If c ≤ i and dp[i − c] + 1 < dp[i], set dp[i] = dp[i − c] + 1 and record c as the coin used at amount i. After all coins are checked, dp[i] is final.',
        'To reconstruct the solution, start at amount and repeatedly subtract the recorded coin until you reach 0. The sequence of subtracted coins is the optimal combination.',
        {type: 'image', src: 'https://avikdas.com/assets/images/2019-04-15-visual-introduction-to-dynamic-programming/change-making-dag.png', alt: 'Full change-making subproblem DAG with arrows between grid cells', caption: 'The full subproblem graph shows why memoization and bottom-up fill avoid repeated recursive work. Source: Avik Das, https://avikdas.com/2019/04/15/a-graphical-introduction-to-dynamic-programming.html.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Induction on i. Base: dp[0] = 0 is correct — zero coins make zero. Inductive step: assume dp[0] through dp[i − 1] are all correct. For amount i, every optimal solution must use some last coin c. The cost of that solution is 1 + (optimal cost for i − c). The recurrence checks every denomination, so it finds the minimum over all possible last coins. The minimum of correct sub-answers is correct.',
        'This argument relies on unlimited coin supply. Using coin c at amount i does not reduce the coins available for amount i − c. If each coin could be used only once, dp[i − c] might be invalid because that subproblem assumed the same coin was still available. Bounded supply requires a second table dimension tracking which coins remain — the 0/1 knapsack structure.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(n × k), where n is the target amount and k is the number of denominations. The table has n + 1 cells; filling each cell scans k coins. Double the target, double the work. Add a denomination, add one comparison per cell.',
        'Space: O(n) for the dp array plus O(n) for the choice array used in traceback. No second dimension is needed because each cell depends only on earlier cells in the same row.',
        'Compare to brute-force recursion: O(k^n). For coins [1, 3, 4] and amount 30, brute force explores up to 4^30 ≈ 10^18 paths. The DP table fills 31 cells, checking 3 coins each: 93 operations.',
        'A subtlety: this is pseudo-polynomial. The input size is log(n) bits, not n. A 30-bit amount encodes a target of roughly one billion, meaning a billion table entries. The problem reduces from subset sum and is NP-hard when amount is exponential in the input length. For practical amounts that fit in memory, the DP is fast.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Any change-making scenario with non-canonical denominations. Some historical and foreign coin systems are non-canonical; most contest and puzzle settings use non-canonical sets deliberately.',
        'Resource allocation with fixed batch sizes: a factory packs items in boxes of 6, 9, and 20 — find the fewest boxes to ship exactly 50 items. Tiling a board of length n with tiles of fixed sizes using the fewest tiles. Postage: pay an exact amount with the fewest stamps from a limited set of face values.',
        'The coin change recurrence is a gateway to the entire DP family. Replacing min with sum counts the number of distinct ways to make change — a standard combinatorics problem. Replacing min with max finds the most coins. The 1D table structure reappears in rod cutting, word break, and climbing stairs. Learning coin change teaches the pattern that unlocks all of them.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'When greedy already works, DP is wasted effort. Real currency systems are designed to be canonical precisely so that cashiers, ATMs, and vending machines can use the greedy algorithm in constant time. If your denominations are canonical (and most are), skip the table.',
        'Very large amounts blow up the table. dp[1,000,000,000] requires a billion entries. For such cases, mathematical decomposition — cover most of the amount with the largest coin, then DP over the small remainder — or BFS from amount down to 0 can help.',
        'Bounded supply (each coin used at most once) breaks the single-row recurrence. dp[i − c] was computed assuming coin c is still available, but if it was already spent, the answer is wrong. Bounded supply requires either a 2D table (amount × coin index, like 0/1 knapsack) or a careful right-to-left fill order that prevents reuse within a single pass.',
        'Counting the number of distinct combinations is a different recurrence (dp[i] += dp[i − c], no +1, no min). Confusing minimization with counting is one of the most common DP bugs.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Coins [1, 3, 4], target 6. dp = [0, ∞, ∞, ∞, ∞, ∞, ∞].',
        'dp[1]: coin 1 fits → dp[0] + 1 = 1. Coins 3, 4 too large. dp[1] = 1.',
        'dp[2]: coin 1 → dp[1] + 1 = 2. Coins 3, 4 too large. dp[2] = 2.',
        'dp[3]: coin 1 → dp[2] + 1 = 3. Coin 3 → dp[0] + 1 = 1. Coin 4 too large. dp[3] = 1.',
        'dp[4]: coin 1 → dp[3] + 1 = 2. Coin 3 → dp[1] + 1 = 2. Coin 4 → dp[0] + 1 = 1. dp[4] = 1.',
        'dp[5]: coin 1 → dp[4] + 1 = 2. Coin 3 → dp[2] + 1 = 3. Coin 4 → dp[1] + 1 = 2. dp[5] = 2.',
        'dp[6]: coin 1 → dp[5] + 1 = 3. Coin 3 → dp[3] + 1 = 2. Coin 4 → dp[2] + 1 = 3. dp[6] = 2.',
        'Traceback from dp[6]: coin 3 was used, go to dp[3]. Coin 3 was used again, go to dp[0]. Solution: 3 + 3 = 6, two coins. Greedy would have chosen 4 + 1 + 1 = 6, three coins — one coin worse.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Bellman, Dynamic Programming (1957) — introduced the table-filling framework this recurrence uses. Cormen, Leiserson, Rivest, and Stein (CLRS), Chapter 15 — treats coin change as an exercise in DP formulation alongside rod cutting and matrix chain multiplication.',
        'Prerequisites: arrays and iteration (the table is a 1D array filled left to right), recursion (to see how the top-down memoized version maps onto this bottom-up table), Big-O notation (to parse the pseudo-polynomial distinction).',
        'Extensions: 0/1 knapsack (bounded supply — each item used at most once, adding a second table dimension), unbounded knapsack (generalized to items with different weights and values), subset sum (the decision problem: does any combination hit target S exactly?).',
        'Related DP problems: edit distance (a 2D table where each cell depends on three neighbors), longest common subsequence (another 2D recurrence), climbing stairs (the same 1D structure with a counting recurrence instead of minimization).',
        'Contrasting approach: greedy algorithms — study when and why greedy is provably optimal (canonical coin systems, activity selection, Huffman coding) to understand the boundary where DP becomes necessary.',
      ],
    },
  ],
};
