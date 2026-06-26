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
  const queryCount = 3;
  yield {
    state: moGraph('Sort offline queries into a cheap movement order'),
    highlight: { active: ['queries', 'block', 'sortR', 'e-queries-block', 'e-queries-sortR'], found: ['q1', 'q2', 'q3'] },
    explanation: `Mo's algorithm works because all ${queryCount} queries are known before answering. Sort them by the block of L, then by R, so the maintained window moves a short total distance.`,
    invariant: `The array is static, and answers for all ${queryCount} queries are stored back under the original query ids.`,
  };

  const totalQueries = 4;
  const blockCount = 2;
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
    explanation: `The ${totalQueries} queries span ${blockCount} L-blocks. The algorithm sorts for cheap movement, records each answer into ans[originalIndex], and prints results later in the requested order.`,
  };

  const fromRange = '[1,4]';
  const toRange = '[2,7]';
  yield {
    state: moGraph('Move one current window using add and remove operations'),
    highlight: { active: ['q1', 'q2', 'window', 'e-q1-window', 'e-q2-window'], found: ['answer'], compare: ['q3'] },
    explanation: `To move from ${fromRange} to ${toRange}, remove index 1 and add indices 5, 6, and 7. The data structure keeps the answer current after every endpoint move.`,
  };

  const conditionCount = 4;
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
    explanation: `Mo's algorithm checks ${conditionCount} conditions and is not a general replacement for segment trees. It is for static offline queries where adding or removing one endpoint can update the answer quickly.`,
  };
}

function* distinctCountCaseStudy() {
  const nodeCount = 7;
  yield {
    state: distinctGraph('Range distinct count is a classic Mo case study'),
    highlight: { active: ['window', 'addL', 'addR', 'freq', 'e-addL-freq', 'e-addR-freq'], found: ['distinct'] },
    explanation: `For each current range in the ${nodeCount}-node pipeline, keep frequency counts of values. Adding a value with count 0 increments the distinct counter. Removing a value whose count becomes 0 decrements it.`,
    invariant: `The maintained counters must exactly match the current [L,R] window at every step.`,
  };

  const moveTypes = 4;
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
    explanation: `The ${moveTypes} move types show the update logic is small and local. That is exactly the property Mo needs: each endpoint movement changes the answer in O(1) or near O(1).`,
  };

  yield {
    state: distinctGraph('Answers are written by original query id'),
    highlight: { active: ['distinct', 'ans', 'e-distinct-ans'], compare: ['window'], found: ['freq'] },
    explanation: `Because queries are processed out of order, each query carries its original id. The final answer array restores the output order after all sorted queries finish.`,
  };

  const variantCount = 4;
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
    explanation: `Mo has ${variantCount} powerful variants, but the core contract remains: sort queries to reduce movement, and maintain the answer through cheap local transitions.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        {type: 'image', src: './assets/gifs/mos-algorithm-offline-range-queries.gif', alt: 'Animated walkthrough of the mos algorithm offline range queries visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Read the animation as one maintained range moving across a static array. Active marks an endpoint move or a query being processed, and found marks the answer written back to that query\'s original id.',
        'The safe inference rule is state equivalence. If the frequency table exactly matches arr[L..R], then the maintained distinct counter is the answer for that range no matter where the query appeared in the input order.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type: 'callout', text: 'The trick is batch freedom: reorder questions so one maintained window can answer them with local edits.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Mo order turns independent queries into a planned route through window states. Source: Wikimedia Commons, David W., public domain.'},
        'Mo\'s algorithm exists for many range queries on a static array when each answer can be updated cheaply as an endpoint moves by one. The queries are offline, meaning all of them are known before answers must be returned.',
        'That offline freedom changes the problem. Instead of answering in user order, the algorithm chooses an order that makes the current range move less.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach answers each query independently. For distinct count over arr[L..R], scan the range, build a set, and return the set size.',
        'That is correct and simple. It wastes work when many ranges overlap because the same elements are counted repeatedly from scratch.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that not every range statistic merges cleanly. Sum and minimum have standard structures, but distinct count cannot combine left and right answers without knowing duplicates across the boundary.',
        'Random query order is another wall. If the current range jumps from [2, 4] to [700, 900], local updates may cost almost as much as rebuilding.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Sort queries by the block of their left endpoint and then by the right endpoint. With block size near sqrt(n), left movement is limited inside a block and right movement becomes more orderly.',
        'The maintained range is the data structure. Moving from one query to the next calls add(index) or remove(index) until curL and curR match the target.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Attach an original id to every query before sorting. Process queries in Mo order, but write each answer into answer[id] so the final output still matches the input order.',
        'For distinct count, add(x) increments freq[arr[x]] and increments distinct only when the count changes from 0 to 1. remove(x) decrements the count and decrements distinct only when the count becomes 0.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness does not come from the sorting rule. It comes from the invariant that the maintained state exactly represents the current range before the answer is recorded.',
        'Sorting changes only the route through ranges. Since every query carries its original id, answering Q2 before Q0 does not change what Q2 asks; it only changes how cheaply the range is reached.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Hilbert-topleft-topright.png/120px-Hilbert-topleft-topright.png', alt: 'Color-coded Hilbert curve construction', caption: 'Hilbert ordering is a common Mo variant because it keeps nearby ranges closer in processing order. Source: Wikimedia Commons, Fredrik Johansson, public domain.'},
        'The common bound is O((n + q) sqrt(n)) endpoint moves plus O(q log q) sorting, assuming add and remove are O(1). Space is O(q) for answers plus the maintained state, such as a frequency table.',
        'Cost behaves as travel distance. If query order makes endpoints walk a short path, the batch is fast; if add or remove is expensive, the same ordering gives little benefit.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Data_Queue.svg/250px-Data_Queue.svg.png', alt: 'FIFO queue diagram with input and output ends', caption: 'Mo is not a queue algorithm, but the visual reinforces the key operation: move one maintained frontier instead of rebuilding every range. Source: Wikimedia Commons, Everaldo Coelho and YellowIcon, LGPL.'},
        'Mo\'s algorithm fits offline distinct counts, frequency statistics, some mode-like queries, and tree-path queries after an Euler tour turns paths into ranges. The access pattern is many known queries over data that does not change.',
        'It is useful in contest and analytics settings where total batch time matters more than immediate per-query latency. The method trades response order for less repeated work.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails for online queries because the algorithm needs the whole batch before sorting. It also fails for frequent updates unless a more advanced variant explicitly handles time as another dimension.',
        'It is the wrong tool when a simpler exact structure exists. Static range minimum belongs to sparse table, and dynamic sums usually belong to Fenwick tree or segment tree.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Let arr = [1, 2, 1, 3, 2, 4] and queries Q0=[0,2], Q1=[2,5], Q2=[1,3]. With block size 2, Mo order is Q0, Q2, Q1.',
        'For Q0, frequencies are 1:2 and 2:1, so distinct = 2. Moving to Q2 removes index 0 and adds index 3, giving values [2,1,3] and distinct = 3. Moving to Q1 removes index 1 and adds indexes 4 and 5, giving [1,3,2,4] and distinct = 4.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study square-root decomposition, Mo\'s algorithm notes from competitive-programming references, and Hilbert-order variants. Focus on the add/remove contract before memorizing the sort comparator.',
        'Next study Sliding Window for local endpoint movement, Sparse Table for static idempotent queries, Segment Tree and Fenwick Tree for online aggregates, and Rollback DSU for another offline reordering technique.',
      ],
    },
  ],
};