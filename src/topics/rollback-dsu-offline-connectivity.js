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
  const edgeAB = 'A-B';
  const edgeBC = 'B-C';
  const intervalAB = '[0,3)';
  const intervalBC = '[1,5)';
  const queryCount = 2;
  const timeSlots = 5;

  yield {
    state: timeGraph('Convert add/remove events into edge lifetimes'),
    highlight: { active: ['q0', 'q3', 'e-q0-seg'], found: ['seg'], compare: ['q2', 'q4'] },
    explanation: `Offline dynamic connectivity first reads all operations. Each edge gets a lifetime interval from add time to remove time, or to the end if it is never removed. Here edge ${edgeAB} lives on ${intervalAB} and edge ${edgeBC} lives on ${intervalBC}.`,
    invariant: `An edge is active exactly on the time interval assigned to it — ${queryCount} queries check connectivity at specific points within ${timeSlots} time slots.`,
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
    explanation: `The problem has deletions in chronological order, but after preprocessing each edge is just an interval on a timeline. Edge ${edgeAB} is active on ${intervalAB} and edge ${edgeBC} on ${intervalBC}.`,
  };
  yield {
    state: timeGraph('Store each interval in O(log q) segment-tree nodes'),
    highlight: { active: ['seg', 'e-q0-seg', 'e-q1-seg'], compare: ['dsu'] },
    explanation: `A segment tree over ${timeSlots} time slots covers each lifetime interval with logarithmically many nodes. During DFS, every query leaf sees exactly the active edges on its root-to-leaf path — ${queryCount} queries will each inherit a different set of live edges.`,
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
    explanation: `The trick is changing time order. Normal DSU cannot delete edges, but a DFS over intervals only needs add and undo — edges like ${edgeAB} and ${edgeBC} are unioned on entry and rolled back on exit.`,
  };
}

function* rollbackDfs() {
  const dsuOps = 4;
  const answerT2 = 'connected';
  const answerT4 = 'not connected';
  const alternativeCount = 3;

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
    explanation: `Rollback DSU records every parent/size mutation on a stack. It supports ${dsuOps} operations — find, union, push, and rollback — but usually avoids path compression because compression changes many parents that would all need undo records.`,
    invariant: `After rollback to a snapshot, DSU state is exactly as it was at that snapshot — pop until the stack returns to the saved size using ${dsuOps} supported operations.`,
  };
  yield {
    state: timeGraph('DFS through time: add edges, answer leaves, rollback'),
    highlight: { active: ['seg', 'dsu', 'answers', 'e-seg-dsu', 'e-dsu-ans'], found: ['q2', 'q4'] },
    explanation: `When DFS enters a segment-tree node, it unions all edges stored at that node. At leaf nodes it answers queries — expecting "${answerT2}" or "${answerT4}". When DFS exits, it rolls back to the previous stack size so sibling subtrees start from a clean state.`,
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
    explanation: `Each leaf sees a different DSU state because the DFS path contains exactly the edge intervals active at that time. At t2 A-C is ${answerT2} (both edges alive), but at t4 A-C is ${answerT4} (only B-C remains).`,
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
    explanation: `Rollback DSU is the pragmatic choice when queries can be processed offline. It avoids ${alternativeCount} harder alternatives — normal DSU (no deletion), Euler Tour Trees, and Link-Cut Trees — by requiring all queries upfront.`,
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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a timeline of graph operations. A graph is a set of vertices connected by edges, and a connectivity query asks whether two vertices are in the same connected component.',
        {type: 'image', src: './assets/gifs/rollback-dsu-offline-connectivity.gif', alt: 'Animated walkthrough of the rollback dsu offline connectivity visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Active frames show entering a segment of time where some edges are alive. When the traversal leaves that segment, rollback removes exactly the unions created for it.',
        'Read each leaf as one time instant. The safe inference is that the DSU state at a leaf contains exactly the edges whose lifetimes cover that time.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
        type: 'callout',
        text: 'Rollback DSU makes deletion manageable by changing the traversal so every union can be undone in stack order.',
      },
        'Dynamic connectivity asks whether vertices are connected while edges are added and removed over time. Plain DSU is excellent for additions, but it has no cheap way to split a component after deletion.',
        {
        type: 'image',
        src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg',
        alt: 'Small directed graph with labeled vertices and edges.',
        caption: 'Connectivity is a graph question, but rollback DSU answers it by replaying only the edge intervals active at a time leaf. Source: https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg',
      },
        'Rollback DSU exists for the offline version, where the whole operation list is known before answering. Knowing the future lets deletions become time intervals, and intervals can be processed with add and undo instead of true split.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to run a graph search for every query. For each connectivity question, use BFS or DFS from one endpoint and see whether the other endpoint is reachable.',
        'That is simple and correct for small histories. It becomes expensive when there are q operations and many queries, because each query can scan a large part of the graph again.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Plain DSU cannot delete edges because union destroys information. Once two components are merged, the parent array no longer remembers which edge made the merge necessary.',
        'Path compression makes rollback harder too. It changes many parent pointers during find, so undo would need to record every compressed pointer mutation, not just successful unions.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Turn each edge into a lifetime interval. If edge (u, v) is added at time 2 and removed at time 7, it is active on the interval [2, 7).',
        {
        type: 'image',
        src: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Binary_tree.svg',
        alt: 'Binary tree diagram with one root and several levels of children.',
        caption: 'A segment tree over time has the same branching shape: each edge lifetime is stored on the few nodes fully covered by its interval. Source: https://commons.wikimedia.org/wiki/File:Binary_tree.svg',
      },
        'Store each interval on a segment tree over time. During a depth-first traversal, add edges when entering a node and undo them when leaving, so rollback order is stack order.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First read all operations and match each edge add with its remove. Edges that remain alive until the end get an interval ending at q, the number of operations.',
        {
        type: 'image',
        src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Data_Queue.svg/250px-Data_Queue.svg.png',
        alt: 'Queue diagram showing ordered data items moving through a buffer.',
        caption: 'The operation log is first turned into ordered edge lifetimes before DFS begins. Source: https://commons.wikimedia.org/wiki/File:Data_Queue.svg',
      },
        'Insert each active interval into O(log q) segment-tree nodes that fully cover pieces of that interval. Then run DFS over the segment tree, unioning all edges stored at a node on entry.',
        'Before entering a node, save the size of the rollback stack. After finishing its children, roll back to that saved size, which removes all unions created for that node and restores the parent and size arrays.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The segment tree decomposes every edge lifetime into disjoint nodes whose time ranges exactly cover the lifetime. Therefore an edge is added on precisely the root-to-leaf paths for times when it is alive.',
        'The DSU invariant at a leaf is that all currently active edges have been unioned and no inactive edge remains. Connectivity queries at that leaf are therefore answered by checking whether the two endpoints have the same DSU root.',
        'Rollback is correct because DFS exits nodes in reverse order of entry. Every mutation made after the saved stack size belongs to that subtree, so undoing back to the saved size restores the previous state exactly.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Each edge lifetime is stored in O(log q) segment-tree nodes. If there are m edge lifetimes and q operations, the traversal performs O(m log q) union attempts plus O(q) leaf visits.',
        'Rollback DSU with union by size gives near-logarithmic worst-case find depth without path compression. In practice, each union records a small stack entry containing the changed parent, size, and component count.',
        'Cost behaves like replayed history rather than online deletion. Doubling the operation timeline increases the segment tree height by about one, while doubling the number of edge lifetimes roughly doubles the number of stored interval pieces.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Rollback DSU is used in offline graph problems where all updates are known before answering. Competitive programming examples include dynamic connectivity, bipartiteness over time, and component-count queries with deletions.',
        'The technique also appears in divide-and-conquer over time for algorithms that can add state cheaply and undo it cheaply. The fit is strongest when online answers are not required and state changes can be logged compactly.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when queries must be answered online before future operations are known. The segment-tree interval construction depends on seeing add and remove pairs in advance.',
        'It also fails when the state update is hard to undo. If an operation mutates many hidden structures without logging them, rollback becomes as expensive as rebuilding.',
        'Path compression is usually avoided. That makes finds less aggressively optimized than normal DSU, but it keeps rollback records small and predictable.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose q = 6 operations: add AB at 0, add BC at 1, query AC at 2, remove AB at 3, query AC at 4, remove BC at 5. Edge AB is alive on [0, 3), and BC is alive on [1, 5).',
        'At time 2, the root-to-leaf path contains both AB and BC, so rollback DSU unions A-B and B-C. A and C share a root, so the answer is connected.',
        'At time 4, AB has been rolled back because its interval ended before this leaf, while BC is still active. A is alone and C is with B, so the answer is not connected.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: classic DSU rollback technique in offline dynamic connectivity; Tarjan-style union-find foundations; segment tree interval decomposition used in divide-and-conquer over time.',
        'Study next by dependency. Read Disjoint Set Union for union and find, Segment Tree for interval decomposition, DFS for traversal order, Offline Algorithms for the future-known assumption, and Fully Dynamic Connectivity for online alternatives.',
      ],
    },
  ],
};
