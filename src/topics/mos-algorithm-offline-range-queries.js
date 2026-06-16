// Mo's algorithm answers offline range queries by sorting queries into sqrt
// blocks and moving a maintained window with cheap add/remove operations.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'mos-algorithm-offline-range-queries',
  title: "Mo's Algorithm Offline Range Queries",
  category: 'Data Structures',
  summary: 'Sort known range queries by sqrt-sized left blocks and right endpoint order, then move one maintained window with add/remove operations.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['reorder queries', 'distinct count case study'], defaultValue: 'reorder queries' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };

  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function moGraph(title) {
  return graphState({
    nodes: [
      { id: 'queries', label: 'queries', x: 0.8, y: 3.4, note: 'offline' },
      { id: 'block', label: 'L block', x: 2.6, y: 1.8, note: 'sqrt n' },
      { id: 'sortR', label: 'sort R', x: 2.6, y: 5.0, note: 'within block' },
      { id: 'q1', label: 'Q1', x: 4.7, y: 1.7, note: '[1,4]' },
      { id: 'q2', label: 'Q2', x: 4.7, y: 3.4, note: '[2,7]' },
      { id: 'q3', label: 'Q3', x: 4.7, y: 5.1, note: '[5,8]' },
      { id: 'window', label: 'window', x: 6.8, y: 3.4, note: 'current' },
      { id: 'answer', label: 'answer', x: 8.8, y: 3.4, note: 'store by id' },
    ],
    edges: [
      { id: 'e-queries-block', from: 'queries', to: 'block' },
      { id: 'e-queries-sortR', from: 'queries', to: 'sortR' },
      { id: 'e-block-q1', from: 'block', to: 'q1' },
      { id: 'e-sortR-q2', from: 'sortR', to: 'q2' },
      { id: 'e-sortR-q3', from: 'sortR', to: 'q3' },
      { id: 'e-q1-window', from: 'q1', to: 'window' },
      { id: 'e-q2-window', from: 'q2', to: 'window' },
      { id: 'e-q3-window', from: 'q3', to: 'window' },
      { id: 'e-window-answer', from: 'window', to: 'answer' },
    ],
  }, { title });
}

function distinctGraph(title) {
  return graphState({
    nodes: [
      { id: 'window', label: 'window', x: 0.8, y: 3.4, note: '[L,R]' },
      { id: 'addL', label: '+L', x: 2.5, y: 1.8, note: 'extend left' },
      { id: 'addR', label: '+R', x: 2.5, y: 5.0, note: 'extend right' },
      { id: 'freq', label: 'freq', x: 4.6, y: 3.4, note: 'value counts' },
      { id: 'distinct', label: 'distinct', x: 6.6, y: 3.4, note: 'counter' },
      { id: 'remove', label: 'remove', x: 6.6, y: 5.3, note: 'shrink' },
      { id: 'ans', label: 'ans[id]', x: 8.7, y: 3.4, note: 'original order' },
    ],
    edges: [
      { id: 'e-window-addL', from: 'window', to: 'addL' },
      { id: 'e-window-addR', from: 'window', to: 'addR' },
      { id: 'e-addL-freq', from: 'addL', to: 'freq' },
      { id: 'e-addR-freq', from: 'addR', to: 'freq' },
      { id: 'e-freq-distinct', from: 'freq', to: 'distinct' },
      { id: 'e-remove-freq', from: 'remove', to: 'freq' },
      { id: 'e-distinct-ans', from: 'distinct', to: 'ans' },
    ],
  }, { title });
}

function* reorderQueries() {
  yield {
    state: moGraph('Sort offline queries into a cheap movement order'),
    highlight: { active: ['queries', 'block', 'sortR', 'e-queries-block', 'e-queries-sortR'], found: ['q1', 'q2', 'q3'] },
    explanation: "Mo's algorithm works because all queries are known before answering. Sort them by the block of L, then by R, so the maintained window moves a short total distance.",
    invariant: 'The array is static, and answers are stored back under the original query ids.',
  };

  yield {
    state: labelMatrix(
      'Mo order example',
      [
        { id: 'q0', label: 'Q0' },
        { id: 'q1', label: 'Q1' },
        { id: 'q2', label: 'Q2' },
        { id: 'q3', label: 'Q3' },
      ],
      [
        { id: 'range', label: 'range' },
        { id: 'lblock', label: 'L block' },
        { id: 'order', label: 'Mo order' },
      ],
      [
        ['[6,9]', '1', '4th'],
        ['[1,4]', '0', '1st'],
        ['[2,7]', '0', '2nd'],
        ['[5,8]', '1', '3rd'],
      ],
    ),
    highlight: { active: ['q1:order', 'q2:order'], found: ['q3:order', 'q0:order'], compare: ['q0:range'] },
    explanation: 'The query order is no longer the input order. The algorithm sorts for cheap movement, records each answer into ans[originalIndex], and prints results later in the requested order.',
  };

  yield {
    state: moGraph('Move one current window using add and remove operations'),
    highlight: { active: ['q1', 'q2', 'window', 'e-q1-window', 'e-q2-window'], found: ['answer'], compare: ['q3'] },
    explanation: 'To move from [1,4] to [2,7], remove index 1 and add indices 5, 6, and 7. The data structure keeps the answer current after every endpoint move.',
  };

  yield {
    state: labelMatrix(
      'When Mo applies',
      [
        { id: 'static', label: 'static array' },
        { id: 'offline', label: 'known queries' },
        { id: 'local', label: 'add/remove' },
        { id: 'online', label: 'online updates' },
      ],
      [
        { id: 'condition', label: 'condition' },
        { id: 'result' },
      ],
      [
        ['yes', 'eligible'],
        ['yes', 'sort queries'],
        ['cheap', 'maintain answer'],
        ['no', 'use another structure'],
      ],
    ),
    highlight: { active: ['static:result', 'offline:result', 'local:result'], removed: ['online:result'] },
    explanation: "Mo's algorithm is not a general replacement for segment trees. It is for static offline queries where adding or removing one endpoint can update the answer quickly.",
  };
}

function* distinctCountCaseStudy() {
  yield {
    state: distinctGraph('Range distinct count is a classic Mo case study'),
    highlight: { active: ['window', 'addL', 'addR', 'freq', 'e-addL-freq', 'e-addR-freq'], found: ['distinct'] },
    explanation: 'For each current range, keep frequency counts of values. Adding a value with count 0 increments the distinct counter. Removing a value whose count becomes 0 decrements it.',
    invariant: 'The maintained counters must exactly match the current window.',
  };

  yield {
    state: labelMatrix(
      'Endpoint moves',
      [
        { id: 'addNew', label: 'add new value' },
        { id: 'addSeen', label: 'add seen value' },
        { id: 'removeLast', label: 'remove last copy' },
        { id: 'removeMore', label: 'remove duplicate' },
      ],
      [
        { id: 'freq', label: 'freq change' },
        { id: 'distinct' },
      ],
      [
        ['0 -> 1', '+1'],
        ['k -> k+1', 'same'],
        ['1 -> 0', '-1'],
        ['k -> k-1', 'same'],
      ],
    ),
    highlight: { active: ['addNew:distinct', 'removeLast:distinct'], found: ['addSeen:freq'], compare: ['removeMore:distinct'] },
    explanation: 'The update logic is small and local. That is exactly the property Mo needs: each endpoint movement changes the answer in O(1) or near O(1).',
  };

  yield {
    state: distinctGraph('Answers are written by original query id'),
    highlight: { active: ['distinct', 'ans', 'e-distinct-ans'], compare: ['window'], found: ['freq'] },
    explanation: 'Because queries are processed out of order, each query carries its original id. The final answer array restores the output order after all sorted queries finish.',
  };

  yield {
    state: labelMatrix(
      'Variants and limits',
      [
        { id: 'hilbert', label: 'Hilbert order' },
        { id: 'tree', label: 'tree paths' },
        { id: 'updates', label: 'with updates' },
        { id: 'bad', label: 'bad add/remove' },
      ],
      [
        { id: 'idea', label: 'idea' },
        { id: 'warning' },
      ],
      [
        ['better locality', 'more complex sort'],
        ['Euler tour', 'toggle nodes'],
        ['third dimension', 'harder'],
        ['slow transition', 'Mo loses'],
      ],
    ),
    highlight: { active: ['hilbert:idea', 'tree:idea'], compare: ['updates:warning'], removed: ['bad:warning'] },
    explanation: 'Mo has powerful variants, but the core contract remains: sort queries to reduce movement, and maintain the answer through cheap local transitions.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'reorder queries') yield* reorderQueries();
  else if (view === 'distinct count case study') yield* distinctCountCaseStudy();
  else throw new InputError("Pick a Mo's algorithm view.");
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        "Mo's algorithm is an offline range-query technique. It takes all queries first, sorts them into a square-root block order, and answers them by moving one maintained current range [L, R]. Each movement adds or removes one array element at an endpoint, and a small auxiliary structure updates the current answer.",
        'This topic builds on Square-Root Decomposition, Sliding Window, Hash Table, Sparse Table, and Segment Tree. The mental model is a sliding window that is allowed to answer queries out of input order. Sorting the queries is the data structure: it turns random range jumps into a route with bounded total endpoint movement.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose a block size near sqrt(n). Sort queries by floor(L / blockSize), then by R inside each L block. Maintain current endpoints moLeft and moRight. For the next query, move moLeft and moRight until they match the requested [L, R], calling add(index) when an element enters the window and remove(index) when an element leaves. Then read getAnswer() and store it under the query original id.',
        'The add/remove functions are problem-specific. For range distinct count, keep value frequencies and a distinct counter. For sum, add and subtract values. For more complex statistics, the maintained state might include buckets, counts of counts, or other small structures. Mo only controls query order and endpoint movement; the answer state is still your job.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With the standard ordering, total endpoint movement is O((n + q) * sqrt(n)) up to constants, multiplied by the cost of add/remove. If add and remove are O(1), the algorithm is often fast enough for n and q around 100,000 in contest-style settings. Sorting the queries costs O(q log q). Space is O(q) for answers plus whatever the maintained state needs.',
        'Mo is not online. If queries must be answered immediately, sorting them is impossible. If the array changes between queries, basic Mo no longer applies without more advanced variants. If add/remove is expensive, the saved movement may not compensate. It is a sharp tool for static offline query batches, not a universal range-query structure.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider many queries asking for the number of distinct values in arr[L..R]. A sparse table cannot help because distinct count is not idempotent in the needed way. A Fenwick tree does not maintain arbitrary subarray distinct counts without offline tricks. Mo works because moving one endpoint changes the answer locally: update a frequency table and adjust the distinct counter only when a value count crosses zero.',
        'The workflow is batch-oriented. Read all queries, attach ids, sort in Mo order, sweep the current range through the sorted list, store ans[id] after each query, then print answers in original order. This shape also appears in tree-path variants after an Euler tour flattens tree visits into an array-like sequence.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        "The first mistake is using Mo when a simpler structure fits. Static range minimum belongs to Sparse Table. Dynamic range sum belongs to Fenwick or Segment Tree. Mo is for cases where the answer is hard to merge from two halves but easy to update when one endpoint moves.",
        'The second mistake is losing original query order. Since processing order changes, every query needs an id. Another common bug is mismatched inclusive ranges: decide whether the maintained window is [L, R], [L, R), empty as [0, -1], or something else, and make every add/remove loop obey that convention.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        "Primary sources: CP-Algorithms sqrt decomposition and Mo's algorithm at https://cp-algorithms.com/data_structures/sqrt_decomposition.html, USACO Guide sqrt decomposition and Mo variants at https://usaco.guide/plat/sqrt, HackerEarth Mo's Algorithm note at https://www.hackerearth.com/practice/notes/mos-algorithm/, and Codeforces square-root decomposition applications at https://codeforces.com/blog/entry/83248. Study Square-Root Decomposition, Sliding Window, Sparse Table, Segment Tree, and Rollback DSU next.",
      ],
    },
  ],
};
