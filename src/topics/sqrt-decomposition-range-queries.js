// Square-root decomposition splits an array into blocks and stores one summary
// per block, giving simple O(sqrt n) range queries with cheap point updates.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'sqrt-decomposition-range-queries',
  title: 'Square-Root Decomposition Range Queries',
  category: 'Data Structures',
  summary: 'Split an array into about sqrt(n) blocks, precompute block summaries, and answer range queries by combining edge scans with whole-block answers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['range query', 'point update'], defaultValue: 'range query' },
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

function blocksGraph(title) {
  return graphState({
    nodes: [
      { id: 'array', label: 'array', x: 0.8, y: 3.4, note: 'n values' },
      { id: 'b0', label: 'B0', x: 2.7, y: 1.8, note: '0..3' },
      { id: 'b1', label: 'B1', x: 4.8, y: 1.8, note: '4..7' },
      { id: 'b2', label: 'B2', x: 6.9, y: 1.8, note: '8..11' },
      { id: 'left', label: 'left', x: 3.1, y: 5.0, note: 'edge scan' },
      { id: 'full', label: 'full', x: 5.1, y: 5.0, note: 'block sum' },
      { id: 'right', label: 'right', x: 7.1, y: 5.0, note: 'edge scan' },
      { id: 'ans', label: 'answer', x: 9.0, y: 3.4, note: 'combine' },
    ],
    edges: [
      { id: 'e-array-b0', from: 'array', to: 'b0' },
      { id: 'e-array-b1', from: 'array', to: 'b1' },
      { id: 'e-array-b2', from: 'array', to: 'b2' },
      { id: 'e-b0-left', from: 'b0', to: 'left' },
      { id: 'e-b1-full', from: 'b1', to: 'full' },
      { id: 'e-b2-right', from: 'b2', to: 'right' },
      { id: 'e-left-ans', from: 'left', to: 'ans' },
      { id: 'e-full-ans', from: 'full', to: 'ans' },
      { id: 'e-right-ans', from: 'right', to: 'ans' },
    ],
  }, { title });
}

function updateGraph(title) {
  return graphState({
    nodes: [
      { id: 'idx', label: 'i=6', x: 0.8, y: 3.4, note: 'update' },
      { id: 'old', label: 'old', x: 2.5, y: 1.8, note: 'a[i]' },
      { id: 'new', label: 'new', x: 2.5, y: 5.0, note: 'value' },
      { id: 'delta', label: 'delta', x: 4.6, y: 3.4, note: 'new-old' },
      { id: 'block', label: 'B1', x: 6.6, y: 3.4, note: 'contains i' },
      { id: 'array', label: 'array', x: 8.5, y: 1.8, note: 'write' },
      { id: 'summary', label: 'sum', x: 8.5, y: 5.0, note: 'add delta' },
    ],
    edges: [
      { id: 'e-idx-old', from: 'idx', to: 'old' },
      { id: 'e-idx-new', from: 'idx', to: 'new' },
      { id: 'e-old-delta', from: 'old', to: 'delta' },
      { id: 'e-new-delta', from: 'new', to: 'delta' },
      { id: 'e-delta-block', from: 'delta', to: 'block' },
      { id: 'e-block-array', from: 'block', to: 'array' },
      { id: 'e-block-summary', from: 'block', to: 'summary' },
    ],
  }, { title });
}

function* rangeQuery() {
  const numBlocks = 3;
  const blockSize = 4;
  const n = numBlocks * blockSize;
  const numNodes = 8;
  const numEdges = 9;

  yield {
    state: blocksGraph('Split the array into sqrt-sized blocks'),
    highlight: { active: ['array', 'b0', 'b1', 'b2', 'e-array-b0', 'e-array-b1', 'e-array-b2'], found: ['full'] },
    explanation: `Square-root decomposition divides the ${n}-element array into ${numBlocks} blocks of length ${blockSize} (about sqrt(${n})). Each block stores a summary such as sum, min, max, count, or a small sorted list.`,
    invariant: `All ${numBlocks} blocks cover the ${n}-element array in order, and each element belongs to exactly one block.`,
  };

  const sumRows = 3;
  const sumCols = 3;
  const blockSums = [10, 9, 18];

  yield {
    state: labelMatrix(
      'Build block sums',
      [
        { id: 'b0', label: 'B0' },
        { id: 'b1', label: 'B1' },
        { id: 'b2', label: 'B2' },
      ],
      [
        { id: 'range', label: 'range' },
        { id: 'values' },
        { id: 'sum' },
      ],
      [
        ['0..3', '3,2,-1,6', '10'],
        ['4..7', '5,4,-3,3', '9'],
        ['8..11', '7,1,2,8', '18'],
      ],
    ),
    highlight: { active: ['b0:sum', 'b1:sum', 'b2:sum'], compare: ['b0:values'] },
    explanation: `Preprocessing scans the array once and builds one summary per block (${sumRows} rows x ${sumCols} columns in the table). For ${n} elements, there are ${numBlocks} blocks, each ${blockSize} wide, with block sums ${blockSums.join(', ')}.`,
  };

  const queryL = 2;
  const queryR = 9;
  const leftTail = '2..3';
  const rightTail = '8..9';

  yield {
    state: blocksGraph('Query range [2, 9]: scan tails, use whole blocks'),
    highlight: { active: ['left', 'full', 'right', 'e-left-ans', 'e-full-ans', 'e-right-ans'], found: ['ans'], compare: ['b1'] },
    explanation: `A range query on [${queryL}, ${queryR}] scans the left tail (${leftTail}), uses the precomputed summary for fully covered block B1, and scans the right tail (${rightTail}).`,
  };

  const decompRows = 4;
  const decompCols = 2;

  yield {
    state: labelMatrix(
      'Range query decomposition',
      [
        { id: 'left', label: 'left tail' },
        { id: 'middle', label: 'full blocks' },
        { id: 'right', label: 'right tail' },
        { id: 'total', label: 'answer' },
      ],
      [
        { id: 'work', label: 'work' },
        { id: 'cost' },
      ],
      [
        ['scan 2..3', 'O(block)'],
        ['read B1', 'O(blocks)'],
        ['scan 8..9', 'O(block)'],
        ['combine', 'O(sqrt n)'],
      ],
    ),
    highlight: { active: ['left:work', 'middle:work', 'right:work'], found: ['total:cost'] },
    explanation: `With block size ${blockSize} near sqrt(${n}), the worst query touches at most ${decompCols} tails of length ${blockSize} plus up to ${numBlocks} full blocks (${decompRows} rows in the decomposition table). That is the balancing point.`,
  };
}

function* pointUpdate() {
  const updateIdx = 6;
  const updateBlock = 'B1';
  const graphNodes = 7;
  const graphEdges = 7;

  yield {
    state: updateGraph('A point update touches one array cell and one block summary'),
    highlight: { active: ['idx', 'old', 'new', 'delta', 'e-old-delta', 'e-new-delta'], found: ['block'] },
    explanation: `For sum queries, updating a[${updateIdx}] to a new value is cheap: compute delta, write the array cell, and add delta to containing block ${updateBlock} (${graphNodes} nodes and ${graphEdges} edges in the update graph).`,
    invariant: `Every block summary (like ${updateBlock}) must equal the aggregate of its current array cells after each update.`,
  };

  const exampleRows = 4;
  const exampleCols = 2;
  const variants = ['sum', 'min', 'sorted', 'lazy'];

  yield {
    state: labelMatrix(
      'Update examples',
      [
        { id: 'sum', label: 'sum block' },
        { id: 'min', label: 'min block' },
        { id: 'sorted', label: 'sorted block' },
        { id: 'lazy', label: 'lazy add' },
      ],
      [
        { id: 'update', label: 'update' },
        { id: 'query' },
      ],
      [
        ['O(1) delta', 'O(sqrt n)'],
        ['recompute block', 'O(sqrt n)'],
        ['erase/insert', 'binary + shift'],
        ['tag block', 'push tails'],
      ],
    ),
    highlight: { active: ['sum:update', 'sum:query'], compare: ['min:update', 'sorted:update'], found: ['lazy:update'] },
    explanation: `The technique is flexible because the block summary can change (${exampleRows} variants shown: ${variants.join(', ')}). Sum is simplest with O(1) delta update. Min may require rebuilding one block on update. Sorted blocks support count queries with binary search inside each full block.`,
  };

  yield {
    state: updateGraph('Update the array and patch the block summary'),
    highlight: { active: ['block', 'array', 'summary', 'e-block-array', 'e-block-summary'], found: ['idx'], compare: ['delta'] },
    explanation: `Only block ${updateBlock} (containing index ${updateIdx}) changes its summary. This is the opposite tradeoff of a prefix-sum array, where one update can invalidate every later prefix.`,
  };

  const comparisonStructures = 4;
  const compCols = 2;

  yield {
    state: labelMatrix(
      'Where sqrt decomposition fits',
      [
        { id: 'fenwick', label: 'Fenwick' },
        { id: 'sqrt', label: 'sqrt blocks' },
        { id: 'segment', label: 'segment tree' },
        { id: 'sparse', label: 'sparse table' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'weakness' },
      ],
      [
        ['small code', 'mostly sums'],
        ['flexible blocks', 'sqrt cost'],
        ['general updates', 'more machinery'],
        ['O(1) static RMQ', 'no updates'],
      ],
    ),
    highlight: { active: ['sqrt:strength', 'sqrt:weakness'], compare: ['fenwick:weakness', 'segment:weakness'], found: ['sparse:strength'] },
    explanation: `Compared across ${comparisonStructures} structures (${compCols} columns: strength and weakness), square-root decomposition is not the fastest asymptotically, but it is often the quickest correct structure when block-local brute force plus block summaries match the workload.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'range query') yield* rangeQuery();
  else if (view === 'point update') yield* pointUpdate();
  else throw new InputError('Pick a square-root-decomposition view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: ['Read each query as left edge scan, whole middle blocks, and right edge scan. Active cells are direct work, while found blocks are summaries being reused.', {type: 'image', src: './assets/gifs/sqrt-decomposition-range-queries.gif', alt: 'Animated walkthrough of the sqrt decomposition range queries visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}], },
    { heading: 'Why this exists', paragraphs: ['Range queries repeat work over intervals of an array. Square-root decomposition keeps enough block summaries to skip the middle while leaving edge handling simple.', {type: 'callout', text: 'Square-root decomposition works by making the middle of a range cheap and keeping the messy edges small.'}], },
    { heading: 'The obvious approach', paragraphs: ['The obvious query scans l through r and computes the answer directly. It is correct and update-friendly, but every long query repeats long scans.'], },
    { heading: 'The wall', paragraphs: ['Fifty thousand queries over twenty thousand cells each means about one billion additions. Prefix sums answer static sums, but one point update changes every later prefix.'], },
    { heading: 'The core insight', paragraphs: ['Split the array into blocks of length B and store one summary per block. A query scans at most two partial blocks and reads summaries for aligned middle blocks.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Row_and_column_major_order.svg', alt: 'Row-major and column-major array storage order', caption: 'Block decomposition is a layout decision over a linear array: adjacent cells are grouped so whole blocks can answer part of a query. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Row_and_column_major_order.svg.'}], },
    { heading: 'How it works', paragraphs: ['Precompute each block summary. A point update changes one array cell and repairs only that block summary, while a range query combines edge scans and full-block reads.'], },
    { heading: 'Why it works', paragraphs: ['The invariant is that every cell belongs to one block and every block summary matches its current cells. A query is correct because its left tail, full blocks, and right tail are disjoint and cover the interval.'], },
    { heading: 'Cost and complexity', paragraphs: ['With B near square root of n, a query scans at most about 2B edge cells and reads about n divided by B summaries. Sum preprocessing is O(n), and a sum point update is O(1).'], },
    { heading: 'Real-world uses', paragraphs: ['It fits range-query workloads with occasional updates and custom block summaries. It is common in contest problems, dashboards, and systems where a block-local rebuild is easier to audit than a custom tree.'], },
    { heading: 'Where it fails', paragraphs: ['It loses when a sharper structure matches the operation. Sparse tables win for static idempotent queries, Fenwick trees win for prefix-like updates, and segment trees win for many dynamic associative queries.'], },
    { heading: 'Worked example', paragraphs: ['With 12 values and block size 4, query 2 through 9 scans 2..3, reads block 4..7, and scans 8..9. If edges sum to 19 and the middle block sum is 23, the answer is 42.'], },
    { heading: 'Sources and study next', paragraphs: ['Study CP-Algorithms and USACO Guide on square-root decomposition, then compare Codeforces block variants. Continue with Prefix Sums, Fenwick Tree, Segment Tree, Sparse Table, and Mo Algorithm.'], },
  ],
};
