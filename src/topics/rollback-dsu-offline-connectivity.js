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
    { heading: 'Why this exists', paragraphs: [
      'Normal Union-Find is excellent when edges only get added. It is not built to split a component when an edge is removed.',
      'Rollback DSU exists for the common compromise: all operations are known in advance. If you can process the timeline offline, deletions become edge lifetime intervals and the data structure only needs add and undo.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is to replay the graph from scratch for every query: apply all adds and removes up to time t, then run BFS, DFS, or rebuild DSU. That is easy to reason about and much too slow for large logs.',
      'Another tempting approach is to ask normal DSU to delete an edge. That fails because DSU stores components, not the internal edge structure needed to split a component safely.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is deletion. Removing one edge may or may not split a component depending on alternate paths. DSU has deliberately forgotten that internal structure, which is why it is so fast for additions.',
      'The second wall is arbitrary history. Rollback can undo recent changes in stack order, but it cannot remove an old union while keeping newer unrelated unions unless the traversal is arranged to make that edge local.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Change the processing order. Read all operations first, convert every edge into the time interval where it is alive, and place that interval on a segment tree over time.',
      'During DFS through the time tree, every root-to-leaf path contains exactly the edges alive at that time. The DSU only needs union on entry and rollback on exit.',
    ] },
    { heading: 'Data structures', paragraphs: [
      'The algorithm uses three structures: a map from edge to add time, a segment tree whose nodes store edge lifetimes, and a rollback DSU with a stack of parent and size changes.',
      'The edge-key map must normalize undirected edges, handle repeated add/remove pairs, and close still-live edges at the end of the operation log. Most bugs live in this bookkeeping, not in the union operation.',
    ] },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "In the time-segments view, read each edge as a lifetime interval. The segment tree is not storing graph structure for its own sake; it is decomposing the interval into time ranges where the edge is guaranteed to be alive for every query underneath that node.",
        "In the rollback-DFS view, the highlighted stack size is the safety handle. The algorithm saves the current DSU history before entering a time segment, unions the edges that are alive for that segment, answers deeper queries, and then rolls the DSU back to the saved point.",
        "A useful question after each frame is: which edge lifetimes are active for every leaf below this node? If the answer is clear, the DSU state at each query leaf is not magic. It is exactly the union of edge intervals covering that timestamp.",
      ],
    },
    { heading: 'Worked example', paragraphs: [
      'Suppose the log is: add A-B at time 1, add B-C at time 2, query A-C at time 3, remove B-C at time 4, query A-C at time 5. The edge A-B has lifetime [1, end). The edge B-C has lifetime [2, 4). Those intervals are inserted into a segment tree over operation indexes.',
      'During DFS, the path to time 3 includes both A-B and B-C, so the DSU says A and C are connected. The path to time 5 includes A-B but not B-C, so A and C are disconnected. No deletion happens inside DSU. The traversal order ensures that the union for B-C is present only while the DFS is inside the time ranges where B-C is alive.',
      'This example is the whole trick. Offline processing lets you convert "delete this old edge" into "leave the time segment where that edge was active." Rollback only has to undo recent changes because the DFS arranges time into a stack-shaped computation.',
    ] },
    { heading: 'How it works', paragraphs: [
      'For every edge, pair add and remove events to form an active interval. Insert that interval into O(log q) segment-tree nodes. Then DFS the segment tree. On entry, union all edges stored at the node. At leaves, answer connectivity queries. On exit, rollback to the saved stack size.',
      'Rollback DSU stores parent and size mutations on a stack. It uses union by size or rank, but typically avoids path compression because compression changes many parent pointers and would require many undo records.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'It works because interval placement makes time local. A query leaf inherits exactly the active edges from the segment-tree nodes on its path, so the DSU state at that leaf matches the graph at that timestamp.',
      'Rollback restores the invariant for siblings. When DFS leaves a segment-tree node, every union done for that node is popped, so the next branch starts from the correct earlier state.',
      'The method depends on not using ordinary path compression. Path compression rewrites many parent pointers during find operations, which makes rollback bookkeeping much larger and easier to get wrong. Union by size keeps the tree height controlled while preserving a small, explicit mutation log.',
    ] },
    { heading: 'Cost and behavior', paragraphs: [
      'Each edge lifetime is stored in O(log q) segment-tree nodes. Each stored edge causes one union on a DFS entry and one rollback on exit. A common practical bound is near O((m log q) log n) with union by size and no path compression, though exact notation depends on implementation details.',
      'Memory includes the segment-tree buckets and the rollback stack. The stack depth follows the active unions on the current DFS path and shrinks exactly when recursion returns.',
      'The hidden cost is interval construction. The algorithm is only as correct as the edge lifetime ledger. Normalize undirected edge keys, decide how to handle duplicate adds, close open intervals at the end, and assign query indexes consistently before the segment tree is built.',
    ] },
    { heading: 'Implementation guidance', paragraphs: [
      'A rollback DSU should expose snapshots. A snapshot is usually the current history-stack length. To rollback, pop changes until the stack returns to that length, restoring parent and size values. If a union finds both vertices already in the same component, record a no-op marker only if your rollback code expects one pop per attempted union.',
      'Keep query answering separate from interval construction. First build a clean event ledger. Then insert intervals into the time tree. Then run DFS. Mixing those phases makes it much harder to audit why a specific query answer was produced.',
    ] },
    { heading: 'Where it wins', paragraphs: [
      'Rollback DSU wins for offline graph analytics, contest dynamic connectivity, temporal network analysis, versioned component queries, and simulations where all changes are known before answers are needed.',
      'A complete case study is a maintenance log. Links go up and down across a day, and analysts ask whether two sites were connected at specific timestamps. Offline processing answers all queries without rebuilding the graph from scratch.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It fails when answers must be returned immediately as operations arrive. In that case you need batching, a different product contract, or a harder online dynamic connectivity structure.',
      'It also fails if the operation log is dirty: duplicate adds, missing removes, directed-edge ambiguity, or inconsistent timestamps can place lifetimes incorrectly and make every later answer look plausible but wrong.',
      'It is also not a general replacement for dynamic graph algorithms. It answers questions that can be expressed over connectivity under a known timeline. If the next operation depends on the previous answer, or if updates arrive forever, the offline assumption has disappeared.',
    ] },
    { heading: 'Study next', paragraphs: [
      'Sources: CP-Algorithms deleting from a data structure in O(T(n) log n) at https://cp-algorithms.com/data_structures/deleting_in_log_n.html and USACO Guide Offline Deletion at https://usaco.guide/adv/offline-del. Study Union-Find, Segment Tree, Euler Tour Tree, Link-Cut Tree, and Persistent Segment Tree next.',
    ] },
  ],
};
