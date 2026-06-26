// Read-copy-update: readers run on stable versions while writers publish a
// replacement and reclaim the old version after a grace period.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'read-copy-update-rcu',
  title: 'Read-Copy-Update (RCU)',
  category: 'Data Structures',
  summary: 'A read-mostly concurrency pattern: readers avoid locks, writers publish a new version, and old versions retire after every old reader exits.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['read path', 'grace period'], defaultValue: 'read path' },
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

function rcuGraph(title) {
  return graphState({
    nodes: [
      { id: 'reader', label: 'reader', x: 0.8, y: 5.3, note: 'enter' },
      { id: 'old', label: 'old v', x: 2.6, y: 5.3, note: 'stable' },
      { id: 'copy', label: 'copy', x: 4.4, y: 5.3, note: 'writer' },
      { id: 'new', label: 'new v', x: 6.2, y: 5.3, note: 'publish' },
      { id: 'retire', label: 'retire', x: 8.2, y: 5.3, note: 'old later' },
    ],
    edges: [
      { id: 'e-reader-old', from: 'reader', to: 'old' },
      { id: 'e-old-copy', from: 'old', to: 'copy' },
      { id: 'e-copy-new', from: 'copy', to: 'new' },
      { id: 'e-new-retire', from: 'new', to: 'retire' },
    ],
  }, { title });
}

function* readPath() {
  const g = rcuGraph('RCU separates the read path from the update path');
  const nodeCount = g.nodes.length;
  const edgeCount = g.edges.length;
  yield {
    state: g,
    highlight: { active: ['reader', 'old', 'e-reader-old'], compare: ['copy', 'new'] },
    explanation: `An RCU reader enters a read-side critical section, loads the current pointer, and walks a stable version across ${nodeCount} pipeline stages connected by ${edgeCount} edges. It does not take the writer lock that protects updates.`,
    invariant: `Readers must see either the '${g.nodes[1].label}' or the '${g.nodes[3].label}', never a half-patched structure.`,
  };

  const g2 = rcuGraph('A writer copies, edits, then publishes one pointer');
  const writerNode = g2.nodes.find(n => n.id === 'copy');
  const publishNode = g2.nodes.find(n => n.id === 'new');
  yield {
    state: g2,
    highlight: { active: ['copy', 'new', 'e-old-copy', 'e-copy-new'], compare: ['reader', 'old'] },
    explanation: `The writer performs destructive work on a private ${writerNode.label} (note: '${writerNode.note}'). Publication is the narrow shared step: replace the public pointer so new readers discover the ${publishNode.label} (note: '${publishNode.note}').`,
  };

  const matRows = [
    { id: 'read', label: 'reader' },
    { id: 'write', label: 'writer' },
    { id: 'old', label: 'old readers' },
  ];
  const matCols = [
    { id: 'does', label: 'does' },
    { id: 'cost', label: 'cost' },
  ];
  yield {
    state: labelMatrix(
      'Read path versus write path',
      matRows,
      matCols,
      [
        ['load ptr', 'tiny'],
        ['copy+swap', 'larger'],
        ['finish old', 'tracked'],
      ],
    ),
    highlight: { found: ['read:cost'], active: ['write:does'], compare: ['old:does'] },
    explanation: `RCU is asymmetric by design. This ${matRows.length}×${matCols.length} matrix shows how the common ${matRows[0].label} path is extremely cheap while coordination is pushed into the rarer ${matRows[1].label} and ${matRows[2].label} paths.`,
  };

  const lockSeries = { id: 'lock', label: 'rw lock', points: [{ x: 1, y: 10 }, { x: 8, y: 28 }, { x: 32, y: 70 }, { x: 64, y: 96 }] };
  const rcuSeries = { id: 'rcu', label: 'RCU read', points: [{ x: 1, y: 7 }, { x: 8, y: 8 }, { x: 32, y: 10 }, { x: 64, y: 12 }] };
  const xMax = 64;
  yield {
    state: plotState({
      axes: { x: { label: 'reader threads', min: 1, max: xMax }, y: { label: 'read overhead', min: 0, max: 100 } },
      series: [lockSeries, rcuSeries],
    }),
    highlight: { found: ['rcu'], compare: ['lock'] },
    explanation: `At ${xMax} reader threads, '${lockSeries.label}' overhead reaches ${lockSeries.points[lockSeries.points.length - 1].y} while '${rcuSeries.label}' stays at ${rcuSeries.points[rcuSeries.points.length - 1].y}. RCU is attractive when reads dominate and update latency can absorb copying and grace-period work.`,
  };
}

function* gracePeriod() {
  const gpNodes = [
    { id: 'unlink', label: 'unlink', x: 0.9, y: 5.3, note: 'old' },
    { id: 'wait', label: 'wait', x: 2.8, y: 5.3, note: 'grace' },
    { id: 'q0', label: 'CPU0', x: 4.7, y: 5.3, note: 'quiet' },
    { id: 'q1', label: 'CPU1', x: 6.6, y: 5.3, note: 'quiet' },
    { id: 'free', label: 'free', x: 8.4, y: 5.3, note: 'safe' },
  ];
  const gpEdges = [
    { id: 'e-unlink-wait', from: 'unlink', to: 'wait' },
    { id: 'e-wait-q0', from: 'wait', to: 'q0' },
    { id: 'e-q0-q1', from: 'q0', to: 'q1' },
    { id: 'e-q1-free', from: 'q1', to: 'free' },
  ];
  const quietNodes = gpNodes.filter(n => n.note === 'quiet');
  yield {
    state: graphState({ nodes: gpNodes, edges: gpEdges }, { title: 'Grace period: wait until old readers cannot remain' }),
    highlight: { active: ['wait', 'q0', 'q1'], found: ['free'] },
    explanation: `After publication, old readers may still hold old pointers. The ${gpNodes.length}-stage pipeline tracks ${quietNodes.length} CPUs that must each reach a quiescent state before the '${gpNodes[gpNodes.length - 1].label}' stage (note: '${gpNodes[gpNodes.length - 1].note}') can proceed.`,
    invariant: `Removal ('${gpNodes[0].label}') and reclamation ('${gpNodes[gpNodes.length - 1].label}') are separate phases separated by ${gpEdges.length} edges.`,
  };

  const apiRows = [
    { id: 'lock', label: 'read lock' },
    { id: 'unlock', label: 'read unlock' },
    { id: 'sync', label: 'sync RCU' },
    { id: 'call', label: 'callback' },
  ];
  const apiCols = [
    { id: 'meaning', label: 'meaning' },
    { id: 'risk', label: 'risk' },
  ];
  yield {
    state: labelMatrix(
      'RCU API shape',
      apiRows,
      apiCols,
      [
        ['mark read', 'too long'],
        ['exit read', 'must happen'],
        ['wait grace', 'blocking'],
        ['free later', 'backlog'],
      ],
    ),
    highlight: { active: ['sync:meaning', 'call:meaning'], compare: ['lock:risk'] },
    explanation: `The names vary, but this ${apiRows.length}-row API shape is stable: '${apiRows[0].label}' and '${apiRows[1].label}' bracket the read section, while '${apiRows[2].label}' and '${apiRows[3].label}' handle reclamation.`,
  };

  const useCaseRows = [
    { id: 'routing', label: 'routing table' },
    { id: 'config', label: 'config map' },
    { id: 'cache', label: 'cache index' },
  ];
  yield {
    state: labelMatrix(
      'Where RCU fits',
      useCaseRows,
      [
        { id: 'read', label: 'reads' },
        { id: 'write', label: 'writes' },
      ],
      [
        ['many', 'rare'],
        ['many', 'bursty'],
        ['many', 'replace'],
      ],
    ),
    highlight: { found: ['routing:read', 'config:read', 'cache:read'], active: ['cache:write'] },
    explanation: `RCU works best when readers greatly outnumber writers. All ${useCaseRows.length} use cases (${useCaseRows.map(r => r.label).join(', ')}) share the pattern of many reads and rare or bursty writes. It is a poor fit for heavy write contention.`,
  };

  const reclaimRows = [
    { id: 'hp', label: 'hazard ptr' },
    { id: 'epoch', label: 'epoch' },
    { id: 'rcu', label: 'RCU' },
  ];
  const reclaimData = [
    ['one node', 'scan slots'],
    ['epoch group', 'stall growth'],
    ['old version', 'read-mostly'],
  ];
  yield {
    state: labelMatrix(
      'Compare reclamation families',
      reclaimRows,
      [
        { id: 'protect', label: 'protects' },
        { id: 'trade', label: 'tradeoff' },
      ],
      reclaimData,
    ),
    highlight: { found: ['rcu:protect', 'rcu:trade'], compare: ['hp:trade', 'epoch:trade'] },
    explanation: `Comparing ${reclaimRows.length} reclamation families: '${reclaimRows[0].label}' protects ${reclaimData[0][0]}, '${reclaimRows[1].label}' protects ${reclaimData[1][0]}, and '${reclaimRows[2].label}' protects ${reclaimData[2][0]} until a grace period proves old readers are gone.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'read path') yield* readPath();
  else if (view === 'grace period') yield* gracePeriod();
  else throw new InputError('Pick an RCU view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a pointer publication protocol for read-copy-update, or RCU. Readers enter a read-side critical section, load a pointer, and walk a stable version while writers prepare a replacement.',
        {type: 'callout', text: 'RCU moves synchronization cost away from readers: readers see a complete version, while writers copy, publish, and wait before reclaiming old memory.'},
        'The safe inference rule is version stability: a reader may see the old version or the new version, but it must not see a half-written structure. Reclamation waits until old readers have passed a quiescent state, which means a point where they can no longer hold the old reference.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'RCU exists for data structures with far more reads than writes. A routing table, configuration pointer, or kernel lookup path may be read millions of times while updates are occasional.',
        'Putting a contended lock on every read makes the common path pay for rare writes. RCU moves most coordination to writers and memory reclamation so readers stay short.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a reader-writer lock. Many readers can hold the lock together, and a writer takes exclusive access before changing the structure.',
        'That is correct and often good enough. The cost appears when read traffic is so hot that lock cache-line bouncing, preemption, or writer waiting becomes visible in latency.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is read-side coordination. Even a cheap read lock still writes shared metadata or participates in scheduler rules, so many cores can fight over the same control state.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Linked_list.svg', alt: 'Linked list nodes connected by pointers', caption: 'Pointer-based structures make RCU concrete: a writer can publish a replacement link while old readers continue along the version they already loaded. Source: https://commons.wikimedia.org/wiki/File:Linked_list.svg.'},
        'Memory freeing creates the second wall. A writer cannot free the old node immediately after publishing a new pointer because a reader may already have loaded the old pointer and still be walking it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is copy, publish, wait, reclaim. A writer builds a new version off to the side, atomically publishes a pointer to it, waits for pre-existing readers to finish, and only then frees the old version.',
        'This turns synchronization into a versioning problem. Readers do not need to block writers because the old version remains valid until the grace period ends.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type: 'image', src: './assets/gifs/read-copy-update-rcu.gif', alt: 'Animated walkthrough of the read copy update rcu visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'A reader marks entry into an RCU read-side section, loads the current pointer with the required memory ordering, reads through that version, and exits. In many kernels the read-side markers are extremely cheap because the scheduler already reports quiescent states.',
        'A writer allocates a replacement node or table, fills it completely, and publishes it with an atomic pointer update. It then waits for a grace period before queuing the old object for reclamation.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness depends on publication ordering and delayed reclamation. Readers see a complete initialized version because the writer fills it before publishing the pointer.',
        'Old readers remain safe because the old version is not freed until every reader that could have seen it has passed through a quiescent state. New readers may use the new version, so both versions can coexist without exposing partial mutation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'RCU makes reads cheap by making writes and reclamation heavier. A write may allocate a copy, serialize with other writers, publish with memory barriers, and wait for a grace period before memory can be reused.',
        'When read volume doubles, the read path mostly scales if cache locality is good. When update volume doubles, callback queues, retained old versions, and grace-period latency can dominate memory behavior.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RCU is used in operating systems and low-level infrastructure for routing tables, file descriptor tables, name caches, and configuration structures. These paths need reads that are predictable under concurrency.',
        'The pattern also appears in userspace as copy-on-write configuration snapshots. A service can publish a new immutable config while existing requests finish on the version they already loaded.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'RCU fails when updates are frequent or objects are large to copy. The system may accumulate old versions faster than grace periods retire them.',
        'It also fails when readers block too long inside read-side sections. A stalled reader can delay reclamation and turn a memory-saving structure into a memory-retention problem.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a routing table pointer starts at version V1 with 1,000 routes, and four readers enter at time 10. A writer builds V2 with 1,001 routes, publishes the V2 pointer at time 12, and leaves V1 allocated.',
        'Readers that entered before time 12 may still finish on V1, while readers entering after publication see V2. If the last old reader exits at time 18, the grace period ends and V1 can be freed safely.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read the Linux kernel RCU documentation, Paul McKenney material on RCU, and userspace RCU documentation. Focus on grace periods, quiescent states, memory ordering, and callback reclamation.',
        'Study reader-writer locks, atomic pointer publication, memory barriers, hazard pointers, epoch reclamation, MVCC, and snapshot isolation next. These topics compare different ways to protect readers from disappearing memory.',
      ],
    },
  ],
};
