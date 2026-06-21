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
      heading: 'Why this exists',
      paragraphs: [
        'Read-mostly data structures punish ordinary locking. A reader-writer lock lets many readers share access, but readers still touch synchronization state, and writers still have to exclude them. On a hot lookup path, even that read-side coordination can be too expensive.',
        'The naive alternative is to update the object in place and hope readers see a consistent state. That fails because a reader can observe half of an update or follow a pointer that the writer frees too soon.',
        'RCU exists for workloads where lookups dominate and the cost of making readers wait is larger than the cost of making writers do extra work. Kernel routing tables, file descriptor tables, configuration maps, and shared indexes often have this shape: many readers need a stable view, while updates are comparatively rare.',
        {type: 'callout', text: 'RCU moves synchronization cost away from readers: readers see a complete version, while writers copy, publish, and wait before reclaiming old memory.'},
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The hard part is not only publishing a new pointer. It is keeping the old version alive long enough for readers that already loaded it. Removal and reclamation are different events.',
        'RCU solves this by allowing old and new versions to coexist. Readers get a stable version; writers publish a replacement; reclamation waits for a grace period proving old readers are gone.',
        'This is a memory-reclamation problem as much as a concurrency-control problem. A writer can remove an object from the public structure quickly, but freeing that object too early creates a use-after-free for readers that already held the old pointer.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The name is literal. Read: readers enter a read-side critical section and follow the current pointer. Copy: writers build a replacement away from readers. Update: writers publish the replacement with a pointer update.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Linked_list.svg', alt: 'Linked list nodes connected by pointers', caption: 'Pointer-based structures make RCU concrete: a writer can publish a replacement link while old readers continue along the version they already loaded. Source: https://commons.wikimedia.org/wiki/File:Linked_list.svg.'},
        'The invariant is version stability. A reader may see the old version or the new version, but it must not see a half-patched structure. The old version remains reclaimable only after every pre-existing reader has passed through a quiescent state.',
        'The design is intentionally asymmetric. Readers do almost no coordination. Writers pay for copying, publication ordering, writer serialization, callback queues, and grace-period waiting. That bargain is good only when cheap reads are the dominant product requirement.',
      ],
    },
    {
      heading: 'How to read the animation',
      paragraphs: [
        'In the read-path view, the reader follows a stable pointer without taking the writer lock. The writer does not patch that structure in place for active readers; it builds or edits a replacement, then publishes a pointer to the new version.',
        'In the grace-period view, unlinking and freeing are deliberately separated. A removed version may no longer be reachable by new readers, but old readers can still hold it. The grace period is the proof that those old readers have exited before memory is reclaimed.',
      
        {type: 'image', src: './assets/gifs/read-copy-update-rcu.gif', alt: 'Animated walkthrough of the read copy update rcu visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A reader marks entry, loads the current pointer, reads the version, and exits. The exact read-side mechanism depends on the environment, but the goal is tiny overhead on the common path.',
        'A writer serializes with other writers as needed, creates or patches a private replacement, publishes it with the right ordering, then retires the old version. It may call a synchronize operation or queue a callback that runs after the grace period.',
        'A quiescent state is an execution point where a thread cannot still be inside an older read-side critical section. Different environments define it differently. In a kernel, context switches, user-mode transitions, or idle states may matter. In userspace libraries, explicit read locks and unlocks often define the protected region.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Publication is safe because readers only discover fully initialized versions. Reclamation is safe because the grace period waits out any reader that could have loaded the retired pointer before it was replaced.',
        'RCU is related to Hazard Pointers & Epoch Reclamation. Hazard pointers protect named nodes, epochs protect time ranges, and RCU protects old published versions until quiescent states prove that old readers cannot remain.',
        'The idea works because read-side critical sections are constrained. If readers can block forever inside them, memory reclamation can also wait forever. Practical RCU systems define what counts as a quiescent state and monitor callback backlog.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A routing table is read on every packet and updated occasionally. A reader enters an RCU read section, loads the current table pointer, and performs lookup. A writer builds a new table with one route changed, then publishes the new pointer.',
        'New readers see the new table. Readers that already loaded the old table finish safely because the old table remains allocated. Only after the grace period can the old table be freed. That is the read-copy-update contract in one cycle.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'RCU buys cheap reads by making writes and cleanup more complicated. Writers may copy data, keep multiple versions alive, serialize with other writers, and wait or queue callbacks behind grace periods.',
        'A stalled reader can delay reclamation and grow callback backlog. RCU also needs memory-ordering discipline: readers must not see partially initialized data, and writers must not free storage before old readers are gone.',
        'The common performance win is not that RCU has no cost. The win is where the cost is placed. Read latency and reader scalability improve, while update latency, memory pressure, and operational observability become more important.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RCU fits routing tables, kernel lookup structures, configuration maps, caches, and read-mostly indexes where reads dominate and old versions can temporarily coexist.',
        'The Linux kernel documentation describes RCU as optimized for read-mostly situations, especially kernel lookup paths. Userspace RCU libraries bring the same idea to programs and include RCU-based structures such as hash tables, queues, stacks, and lists.',
        'It is also useful when readers need predictable behavior under high concurrency. A lookup path that only enters an RCU read section and follows stable pointers avoids the lock convoy and cache-line bouncing that can appear with shared reader counters or coarse locks.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'RCU is not a universal replacement for locks. It is a poor fit when writes dominate, when each update must mutate one shared object in place, or when readers can block for arbitrary time inside read-side sections.',
        'It guarantees memory safety around old versions, not business correctness around conflicting updates. Pair it with Linearizability History Checker, Nonblocking Progress Guarantees, Lock-Free Queue, Logical Clocks, MVCC & Vacuum, and Snapshot Isolation to see how versioning, ordering, and cleanup recur across systems.',
        'A common mistake is assuming RCU makes compound read-modify-write logic safe. It does not. RCU can let a reader inspect a consistent version, and it can let a writer publish a new version, but conflict detection, uniqueness constraints, and transaction semantics still need separate design.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Keep the read-side critical section short, explicit, and free of unbounded blocking. Make publication order obvious: initialize the replacement fully, publish it with the required memory ordering, then retire the old version only through the RCU reclamation path.',
        'Instrument callback backlog, grace-period latency, and memory retained by retired versions. Many RCU failures do not first appear as incorrect answers; they appear as growing memory, delayed cleanup, or rare crashes under scheduler and timing pressure.',
      ],
    },
    {
      heading: 'Worked example (2)',
      paragraphs: [
        'A routing table is the classic example. Every packet needs a lookup, so putting a contended lock on the read path harms throughput. With RCU, the reader enters a read section, loads the current table pointer, and walks a stable structure. A writer builds a replacement table or node, publishes it, and waits before freeing the old one.',
        'The result is not free updates. The writer must handle copying cost and delayed reclamation. The benefit is that the packet path is short, predictable, and mostly independent of other readers.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Linux kernel RCU overview at https://docs.kernel.org/RCU/whatisRCU.html, RCU concepts at https://www.kernel.org/doc/html/v5.5/RCU/rcu.html, userspace RCU at https://liburcu.org/, and the original RCU paper PDF at https://www.rdrop.com/users/paulmck/RCU/rclockpdcsproof.pdf. Study Nonblocking Progress Guarantees, Linearizability History Checker, Hazard Pointers & Epoch Reclamation, Lock-Free Queue, MVCC & Vacuum, and Snapshot Isolation next.',
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Read-Copy-Update (RCU) moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};
