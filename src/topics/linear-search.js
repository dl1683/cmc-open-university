// Linear search: check every element until the target appears.
// The simplest search, and the honest baseline every other search beats.

import { arrayState, parseNumberList, parseNumber } from '../core/state.js';

export const topic = {
  id: 'linear-search',
  title: 'Linear Search',
  category: 'Searching',
  summary: 'Walk the array one element at a time until you find the target.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '7, 3, 15, 9, 4, 11' },
    { id: 'target', label: 'Search for', type: 'number', defaultValue: '9' },
  ],
  run,
};

export function* run(input) {
  const values = parseNumberList(input.values);
  const target = parseNumber(input.target, { label: 'a target' });

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `We are looking for ${target}. This array gives us no order, index, or hash table, so every unchecked slot could still be the answer.`,
  };

  for (let index = 0; index < values.length; index += 1) {
    const visited = values.slice(0, index).map((_, i) => `i${i}`);
    const isMatch = values[index] === target;
    yield {
      state: arrayState(values),
      highlight: { active: [`i${index}`], visited },
      explanation: `At position ${index}, the value ${values[index]} ${isMatch ? `matches ${target}, so the search can stop after proving this exact slot is the answer.` : `does not match ${target}. Only this position has been ruled out, so the cursor must move one step right.`}`,
      invariant: 'Everything to the left of the current position has been checked and ruled out.',
    };
    if (isMatch) {
      yield {
        state: arrayState(values),
        highlight: { found: [`i${index}`], visited },
        explanation: `Found ${target} at position ${index} after ${index + 1} comparison${index === 0 ? '' : 's'}. Early exit is the best part of linear search; the worst case still checks every element.`,
      };
      return;
    }
  }

  yield {
    state: arrayState(values),
    highlight: { visited: values.map((_, i) => `i${i}`) },
    explanation: `All ${values.length} elements were checked, so ${target} is not here. Absence is proven only by exhaustion because the data had no structure to skip work.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The active cell is the only value being tested against the target. Visited cells are not guesses; they are positions already proven unequal by direct comparison. The found marker means equality succeeded at that exact index.',
        'The key inference is small but complete. After checking index i and failing, only index i has been ruled out. Without sorted order, a hash table, or another index, the comparison says nothing about the remaining cells.',
        {type: 'callout', text: 'Linear search is the honest baseline: without reusable structure, each failed comparison can rule out only the item it just checked.'},
        {type: 'image', src: './assets/gifs/linear-search.gif', alt: 'Animated walkthrough of the linear search visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Linear search exists for data with no reusable structure. The values may be unsorted, streaming from a file, changing constantly, or too small to justify building an index. In that setting, every unchecked item could still be the target.',
        'It is also the baseline that makes faster searches honest. Binary search buys speed with sorted random-access data. Hash-table lookup buys speed with hashing and extra memory. Linear search needs only a way to read the next item.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/40/1D_array_diagram.svg', alt: 'One-dimensional array diagram with indexed cells.', caption: 'A scan walks a sequence one cell at a time because ordinary index positions alone do not prove anything about the next value. Source: Wikimedia Commons, Tropwine, CC BY 4.0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is the algorithm itself: compare the first item, then the next, and stop when the target appears or the input ends. It is not a weak idea for small or one-time data. The code is short, branch behavior is predictable, and no setup work is required.',
        'For an array of 12 menu options or a one-pass log file, scanning can be the right engineering choice. Building an index would add memory, code, and setup time that the workload may never repay. The simplicity is part of the design, not an accident.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when n grows or when the same collection is searched many times. A match at index 0 costs one comparison. A missing target costs n comparisons. A target at the last index also costs n comparisons.',
        'Repeated scans multiply that cost. Searching 10000 records once is 10000 comparisons in the worst case. Searching the same records 5000 times can become 50000000 comparisons. The data has no structure that lets one failed comparison eliminate more than one position.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The invariant is the checked prefix. Everything before the cursor has been compared and rejected. Everything at or after the cursor remains possible.',
        'That invariant explains both correctness and cost. The algorithm earns certainty one item at a time. It works on almost any iterable input because it asks for no promise except being able to inspect the current item and move forward.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Keep a cursor, usually an index. Compare the current value with the target or predicate. If it matches, return the current position or value. If it does not match, advance the cursor.',
        'If the cursor passes the end, return the chosen absence signal, such as -1 for an index search or null for an object lookup. If the task is to collect every match, do not stop at the first hit. Continue scanning and append each matching position.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'At the start, the checked prefix is empty, so the invariant is true. Each failed comparison adds exactly one item to the checked prefix, and that item is proven not to be the target. No unchecked item is altered or skipped.',
        'If the algorithm returns a match, the equality or predicate test succeeded at that position, so the returned result is valid. If the scan reaches the end, the checked prefix is the whole input. Every possible position has been tested, so absence is proven.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Best case is O(1) when the first item matches. Worst case is O(n) when the target is missing or last. If the target exists and is equally likely to be anywhere, the expected number of comparisons is (n + 1) / 2. Extra space is O(1).',
        'When n doubles, the worst-case work doubles. The constant can be excellent on small contiguous arrays because the CPU streams memory efficiently. The same O(n) scan over pointer-heavy structures can be slower because each step may miss cache.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Linear search is common in tiny tables, command dispatch lists, configuration arrays, and one-off file scans. It fits when the data is small, unsorted, or consumed once. The access pattern is a simple pass with no future reuse to amortize an index.',
        'It also appears after stronger filters. A database index may narrow candidates, then a short scan applies a complex predicate. A Bloom filter may reject many absent values, while possible hits still need exact verification against real records.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails for large collections under repeated exact lookup. Scanning 8 values is fine; scanning 8000000 values for every web request is usually the wrong structure. The missing ingredient is reusable information such as sorted order, hashing, or an index.',
        'It also fails when the comparison itself is wrong. Searching strings may need case folding or Unicode normalization. Searching floating-point values may need tolerance. The loop can be correct while the predicate gives the wrong notion of equality.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Search [4, 2, 7, 1, 9, 3] for 9. Compare 4, 2, 7, and 1, rejecting four positions. Compare 9 at index 4 and return 4. The search used 5 comparisons.',
        'Search the same array for 8. The algorithm compares all 6 values and returns not found. If this lookup happens once, 6 comparisons are harmless. If it happens 100000 times on changing data, the worst case becomes 600000 comparisons per 100000 searches and may justify a different structure.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Knuth, The Art of Computer Programming, Volume 3, Section 6.1, Sequential Searching. Study sentinel search there for the version that removes a loop-bound check by placing a guaranteed match at the end.',
        'Study next: binary search for sorted arrays, hash tables for repeated exact lookup, Bloom filters for fast negative membership tests, and self-organizing lists for scans that adapt to repeated hot items.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Binary_Search_Depiction.svg/250px-Binary_Search_Depiction.svg.png', alt: 'Binary search narrowing a sorted array by testing the midpoint.', caption: 'Binary search is the contrast case: sorted order lets one comparison remove a whole interval instead of one item. Source: Wikimedia Commons.'},
      ],
    },
  ],
};
