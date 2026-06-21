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
      heading: 'Why this exists',
      paragraphs: [
        {type: 'callout', text: 'The trick is batch freedom: reorder questions so one maintained window can answer them with local edits.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Mo order turns independent queries into a planned route through window states. Source: Wikimedia Commons, David W., public domain.'},
        "Mo's algorithm exists for static range-query problems where each query is expensive from scratch, but the answer can be updated cheaply when one endpoint moves by one position.",
        'It uses an unusual freedom: if all queries are known before answering, input order is not sacred. You can reorder the batch so one maintained window moves a small total distance.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first approach is to answer every range independently. For distinct count, scan `arr[L..R]`, rebuild a set, and return its size. That is simple and correct, but overlapping queries repeat the same work again and again.',
        'The second approach is a segment tree or sparse table. Those are excellent when two adjacent answers merge cleanly. Sum, min, max, and gcd work. Distinct count does not merge cleanly because the same value can appear in both halves and should be counted once.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is endpoint movement. If the maintained range jumps randomly from one query to the next, updating state can cost as much as rebuilding it. The algorithm needs a route through query space, not just a data structure for one query.',
        'The second wall is the offline contract. Basic Mo only works because queries can wait. If answers must be returned immediately, or if the array changes between queries, the standard version loses its main advantage.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Sort queries by the block containing `L`, then by `R` inside that block. With block size near `sqrt(n)`, the left endpoint is constrained within a small block while the right endpoint moves in a more orderly sweep.',
        'The current window is the state. To move from one query to the next, shift `curL` and `curR` until they match the target range. Each shift calls `add(index)` or `remove(index)`. The answer is always the maintained value for the current `[curL, curR]`.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Attach the original index to every query. Sort by `floor(L / blockSize)` and then by `R`, often reversing the `R` order on alternating blocks to reduce backtracking. Process the sorted list, but write each result into `answer[originalIndex]`.',
        'The `add` and `remove` functions are the problem-specific layer. For range distinct count, keep a frequency table and a `distinct` counter. Adding a value whose count changes from 0 to 1 increments `distinct`. Removing a value whose count changes from 1 to 0 decrements it.',
        'The array must be static for the basic form. The algorithm reuses a maintained view over the same data; it is not designed for arbitrary updates interleaved with queries.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the reorder-queries view, the important state change is the loss of input order. Queries are grouped by the left endpoint block, then ordered by the right endpoint so the window has a cheaper route.',
        'When the window moves from one range to another, every endpoint step is work. Removing index 1 and adding 5, 6, and 7 is not a caption; it is the whole cost model. Mo wins only when those small endpoint moves are cheaper than rebuilding the answer.',
        'In the distinct-count view, watch the frequency table instead of the range boundary. The invariant is that the frequency table exactly matches the current window. The answer is valid only because every add and remove preserves that invariant.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Mo works because it bounds total movement across the batch. Inside one left block, the left endpoint can move only within that block, while the right endpoint is processed in an orderly direction. Across all blocks, the total endpoint travel is far smaller than arbitrary query order.',
        'The correctness invariant is simple: before answering a query, the maintained state must exactly represent the current window. Sorting only changes processing order. Storing results by original id restores output order without changing the answer to any query.',
        'The algorithm does not make an individual range query cheaper by itself. It makes a batch cheaper by turning many independent rebuilds into a controlled sequence of local edits.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the array is static and the queries are Q0=[6,9], Q1=[1,4], Q2=[2,7], and Q3=[5,8]. With block size 4, Q1 and Q2 are in left block 0, while Q3 and Q0 are in left block 1. Mo order becomes Q1, Q2, Q3, Q0.',
        'Start at Q1=[1,4]. For Q2=[2,7], remove index 1 and add indices 5, 6, and 7. For distinct count, each add or remove updates one frequency count and possibly the distinct counter. The answer for Q2 is written to `answer[2]`, not to the next output slot.',
        'That last detail prevents a common bug. Processing order is optimized for movement; answer order belongs to the user. The query id is the bridge between those two orders.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Hilbert-topleft-topright.png/120px-Hilbert-topleft-topright.png', alt: 'Color-coded Hilbert curve construction', caption: 'Hilbert ordering is a common Mo variant because it keeps nearby ranges closer in processing order. Source: Wikimedia Commons, Fredrik Johansson, public domain.'},
        'With the standard square-root ordering, the movement cost is usually taught as O((n + q) * sqrt(n)) endpoint changes, multiplied by the cost of `add` or `remove`. Sorting costs O(q log q). Space is O(q) for answers plus whatever maintained state the problem needs.',
        'If `add` and `remove` are O(1), the method is strong. If each transition is expensive, Mo loses quickly. Block size also matters; `sqrt(n)` is the common default, but workloads with very different `n` and `q` may need tuning.',
        'Odd-even ordering and Hilbert order can reduce movement and improve cache locality. They do not change the core contract: static data, offline queries, and cheap local transitions.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Data_Queue.svg/250px-Data_Queue.svg.png', alt: 'FIFO queue diagram with input and output ends', caption: 'Mo is not a queue algorithm, but the visual reinforces the key operation: move one maintained frontier instead of rebuilding every range. Source: Wikimedia Commons, Everaldo Coelho and YellowIcon, LGPL.'},
        'Mo wins for offline distinct counts, frequency-based statistics, some mode-like queries, range properties that are cheap to update locally, and tree-path variants after an Euler tour transformation.',
        'It is useful when a segment tree cannot merge the statistic naturally, but a current-window data structure can be patched one element at a time.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'Mo is the wrong tool for online queries, frequent updates, expensive endpoint transitions, and problems with simpler exact structures. Static range minimum belongs to Sparse Table. Dynamic range sum belongs to Fenwick Tree or Segment Tree.',
        'It is also a poor fit when memory for the maintained state is too large, when query latency matters more than total batch time, or when the implementation risk is not worth the constant-factor win.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The common correctness bug is stale state. If one endpoint move forgets to update the frequency table, every later answer can be wrong. Add and remove must be exact inverses for the maintained statistic.',
        'The common output bug is losing original ids. The sorted order is not the answer order. Every query must carry its original index, and every result must be written back to that index.',
        'The common performance bug is choosing Mo when the statistic has a better structure. If a Fenwick tree, segment tree, sparse table, prefix sum, or offline sweep solves the problem directly, use that instead.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'For many queries asking "how many distinct values are in `arr[L..R]`?", scan-per-query rebuilds a set every time. Mo reads all queries, sorts them, and sweeps one window through the sorted query list.',
        'The maintained state is a frequency table plus one integer. Add a new value and increment its frequency. If the frequency was zero, increment `distinct`. Remove a value and decrement its frequency. If the frequency becomes zero, decrement `distinct`.',
        'The final answer array restores input order. This batch-oriented shape is the point: the algorithm trades immediate answers for much less repeated work across the whole query set.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        "Primary sources: CP-Algorithms sqrt decomposition and Mo's algorithm at https://cp-algorithms.com/data_structures/sqrt_decomposition.html, USACO Guide sqrt decomposition and Mo variants at https://usaco.guide/plat/sqrt, HackerEarth Mo's Algorithm note at https://www.hackerearth.com/practice/notes/mos-algorithm/, and Codeforces square-root decomposition applications at https://codeforces.com/blog/entry/83248.",
        'Study Square-Root Decomposition for the block idea, Sliding Window for local endpoint movement, Sparse Table for static idempotent range queries, Segment Tree and Fenwick Tree for online aggregates, and Rollback DSU for another offline technique that changes processing order.',
      ],
    },
  ],
};
