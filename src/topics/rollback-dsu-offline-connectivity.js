// Rollback DSU: answer offline dynamic connectivity by undoing unions.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'rollback-dsu-offline-connectivity',
  title: 'Rollback DSU & Offline Connectivity',
  category: 'Data Structures',
  summary: 'Handle edge additions and deletions offline: place edge lifetimes on a time segment tree, DFS through time, union on entry, and rollback on exit.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['time segments', 'rollback dfs'], defaultValue: 'time segments' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function timeGraph(title) {
  return graphState({
    nodes: [
      { id: 'q0', label: 't0 add A-B', x: 0.7, y: 2.0, note: 'edge alive starts' },
      { id: 'q1', label: 't1 add B-C', x: 2.0, y: 2.0, note: 'edge alive starts' },
      { id: 'q2', label: 't2 ask A-C', x: 3.3, y: 2.0, note: 'query' },
      { id: 'q3', label: 't3 remove A-B', x: 4.6, y: 2.0, note: 'edge alive ends' },
      { id: 'q4', label: 't4 ask A-C', x: 5.9, y: 2.0, note: 'query' },
      { id: 'seg', label: 'segment tree over time', x: 3.3, y: 4.2, note: 'edge lifetimes' },
      { id: 'dsu', label: 'rollback DSU', x: 6.8, y: 4.2, note: 'stack of changes' },
      { id: 'answers', label: 'answers', x: 8.7, y: 3.0, note: 'connected?' },
    ],
    edges: [
      { id: 'e-q0-seg', from: 'q0', to: 'seg', weight: 'A-B alive [0,3)' },
      { id: 'e-q1-seg', from: 'q1', to: 'seg', weight: 'B-C alive [1,5)' },
      { id: 'e-seg-dsu', from: 'seg', to: 'dsu', weight: 'DFS add edges' },
      { id: 'e-dsu-ans', from: 'dsu', to: 'answers', weight: 'answer leaves' },
      { id: 'e-q2-ans', from: 'q2', to: 'answers', weight: 'yes' },
      { id: 'e-q4-ans', from: 'q4', to: 'answers', weight: 'no' },
    ],
  }, { title });
}

function* timeSegments() {
  yield {
    state: timeGraph('Convert add/remove events into edge lifetimes'),
    highlight: { active: ['q0', 'q3', 'e-q0-seg'], found: ['seg'], compare: ['q2', 'q4'] },
    explanation: 'Offline dynamic connectivity first reads all operations. Each edge gets a lifetime interval from add time to remove time, or to the end if it is never removed.',
    invariant: 'An edge is active exactly on the time interval assigned to it.',
  };
  yield {
    state: labelMatrix(
      'Edge lifetimes',
      [
        { id: 'ab', label: 'A-B' },
        { id: 'bc', label: 'B-C' },
        { id: 'ask2', label: 'ask t2' },
        { id: 'ask4', label: 'ask t4' },
      ],
      [{ id: 'interval' }, { id: 'meaning' }],
      [
        ['[0,3)', 'active before removal'],
        ['[1,5)', 'active through both queries'],
        ['point 2', 'A-B and B-C active'],
        ['point 4', 'only B-C active'],
      ],
    ),
    highlight: { active: ['ab:interval', 'bc:interval'], found: ['ask2:meaning', 'ask4:meaning'] },
    explanation: 'The problem has deletions in chronological order, but after preprocessing each edge is just an interval on a timeline.',
  };
  yield {
    state: timeGraph('Store each interval in O(log q) segment-tree nodes'),
    highlight: { active: ['seg', 'e-q0-seg', 'e-q1-seg'], compare: ['dsu'] },
    explanation: 'A segment tree over query time covers each lifetime interval with logarithmically many nodes. During DFS, every query leaf sees exactly the active edges on its root-to-leaf path.',
  };
  yield {
    state: labelMatrix(
      'Why offline helps',
      [
        { id: 'online', label: 'online deletion' },
        { id: 'offline', label: 'offline interval' },
        { id: 'segment', label: 'time segment tree' },
        { id: 'rollback', label: 'rollback DSU' },
      ],
      [{ id: 'move' }, { id: 'benefit' }],
      [
        ['hard for normal DSU', 'cannot split components'],
        ['know add/remove pairs', 'turn delete into interval end'],
        ['edge added on DFS entry', 'localized lifetime'],
        ['undo on DFS exit', 'reuse DSU state'],
      ],
    ),
    highlight: { found: ['offline:benefit', 'rollback:benefit'], compare: ['online:benefit'] },
    explanation: 'The trick is changing time order. Normal DSU cannot delete edges, but a DFS over intervals only needs add and undo.',
  };
}

function* rollbackDfs() {
  yield {
    state: labelMatrix(
      'Rollback DSU change stack',
      [
        { id: 'find', label: 'find root' },
        { id: 'union', label: 'union roots' },
        { id: 'push', label: 'push old state' },
        { id: 'rollback', label: 'rollback snapshot' },
      ],
      [{ id: 'detail' }, { id: 'constraint' }],
      [
        ['no path compression', 'rollback must be simple'],
        ['union by size/rank', 'height controlled'],
        ['parent and size before change', 'undo record'],
        ['pop until stack size', 'restore entry state'],
      ],
    ),
    highlight: { active: ['push:detail', 'rollback:detail'], compare: ['find:constraint'] },
    explanation: 'Rollback DSU records every parent/size mutation on a stack. It usually avoids path compression because compression changes many parents that would all need undo records.',
    invariant: 'After rollback to a snapshot, DSU state is exactly as it was at that snapshot.',
  };
  yield {
    state: timeGraph('DFS through time: add edges, answer leaves, rollback'),
    highlight: { active: ['seg', 'dsu', 'answers', 'e-seg-dsu', 'e-dsu-ans'], found: ['q2', 'q4'] },
    explanation: 'When DFS enters a segment-tree node, it unions all edges stored at that node. At leaf nodes it answers queries. When DFS exits, it rolls back to the previous stack size.',
  };
  yield {
    state: labelMatrix(
      'Query answers',
      [
        { id: 't2', label: 't2 ask A-C' },
        { id: 'state2', label: 'active edges t2' },
        { id: 't4', label: 't4 ask A-C' },
        { id: 'state4', label: 'active edges t4' },
      ],
      [{ id: 'dsuState' }, { id: 'answer' }],
      [
        ['A-B, B-C', 'connected'],
        ['A-B-C component', 'yes'],
        ['B-C only', 'not connected'],
        ['A isolated', 'no'],
      ],
    ),
    highlight: { found: ['t2:answer', 't4:answer'], active: ['state2:dsuState'] },
    explanation: 'Each leaf sees a different DSU state because the DFS path contains exactly the edge intervals active at that time.',
  };
  yield {
    state: labelMatrix(
      'Where this technique fits',
      [
        { id: 'dsu', label: 'normal DSU' },
        { id: 'rollback', label: 'rollback DSU' },
        { id: 'ett', label: 'Euler Tour Tree' },
        { id: 'lct', label: 'Link-Cut Tree' },
      ],
      [{ id: 'mode' }, { id: 'tradeoff' }],
      [
        ['online additions only', 'very simple'],
        ['offline add/remove', 'needs all queries first'],
        ['online forests', 'more complex'],
        ['online dynamic trees', 'path aggregates'],
      ],
    ),
    highlight: { found: ['rollback:mode', 'rollback:tradeoff'], compare: ['ett:mode'] },
    explanation: 'Rollback DSU is the pragmatic choice when queries can be processed offline. It avoids much harder fully dynamic connectivity machinery.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'time segments') yield* timeSegments();
  else if (view === 'rollback dfs') yield* rollbackDfs();
  else throw new InputError('Pick a rollback-DSU view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: [
      'Rollback DSU is a variant of Union-Find that can undo recent unions. Combined with a segment tree over time, it solves offline dynamic connectivity with edge additions, removals, and connectivity queries.',
      'The key word is offline. The algorithm first reads every operation, converts each edge into the time interval where it is alive, and then processes a time segment tree with reversible DSU state.',
      'This is a direct extension of Union-Find and a conceptual neighbor of Euler Tour Tree and Link-Cut Tree. It solves a dynamic problem by changing the processing order rather than by supporting true online deletion.',
    ] },
    { heading: 'How it works', paragraphs: [
      'For every edge, pair add and remove events to form an active interval. Insert that interval into O(log q) nodes of a segment tree over query time. Then DFS the segment tree. On entry, union all edges stored at the node. At leaves, answer queries. On exit, rollback to the saved stack size.',
      'Rollback DSU stores parent and size changes on a stack. It uses union by size or rank, but typically avoids path compression because path compression mutates many parent pointers and complicates undo.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Each edge lifetime is stored in O(log q) segment-tree nodes. Each union and rollback costs near logarithmic or inverse-Ackermann-like time depending on the DSU variant without compression. The total complexity is usually O((m log q) log n) or similar practical bounds.',
      'The implementation details are in interval bookkeeping: repeated add/remove of the same edge, normalizing undirected edge keys, open edges at the end, and snapshot stack sizes before recursive descent.',
      'Because the traversal is recursive over time, memory usage includes both the segment-tree buckets and the rollback stack. The stack depth follows the active unions on the current DFS path, then shrinks exactly when the recursion returns.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Rollback DSU is used in offline graph analytics, contest dynamic connectivity, temporal network analysis, versioned component queries, and simulations where all changes are known before answering.',
      'A complete case study is a maintenance simulation. Network links go up and down across a day, and analysts ask whether two sites were connected at specific timestamps. Offline processing answers all queries without recomputing components from scratch.',
    ] },
    { heading: 'Pitfalls and misconceptions', paragraphs: [
      'Rollback DSU is not an online dynamic connectivity data structure. If queries must be answered immediately as operations arrive, this technique does not apply unless you can batch or delay answers. It also supports undoing in stack order, not arbitrary historical deletion.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: CP-Algorithms deleting from a data structure in O(T(n) log n) at https://cp-algorithms.com/data_structures/deleting_in_log_n.html and USACO Guide Offline Deletion at https://usaco.guide/adv/offline-del. Study Union-Find, Segment Tree, Euler Tour Tree, Link-Cut Tree, and Persistent Segment Tree next.',
    ] },
  ],
};
