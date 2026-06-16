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
  yield {
    state: rcuGraph('RCU separates the read path from the update path'),
    highlight: { active: ['reader', 'old', 'e-reader-old'], compare: ['copy', 'new'] },
    explanation: 'An RCU reader enters a read-side critical section, loads the current pointer, and walks a stable version. It does not take the writer lock that protects updates.',
    invariant: 'Readers must see either the old version or the new version, never a half-patched structure.',
  };

  yield {
    state: rcuGraph('A writer copies, edits, then publishes one pointer'),
    highlight: { active: ['copy', 'new', 'e-old-copy', 'e-copy-new'], compare: ['reader', 'old'] },
    explanation: 'The writer performs destructive work on a private copy. Publication is the narrow shared step: replace the public pointer so new readers discover the new version.',
  };

  yield {
    state: labelMatrix(
      'Read path versus write path',
      [
        { id: 'read', label: 'reader' },
        { id: 'write', label: 'writer' },
        { id: 'old', label: 'old readers' },
      ],
      [
        { id: 'does', label: 'does' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['load ptr', 'tiny'],
        ['copy+swap', 'larger'],
        ['finish old', 'tracked'],
      ],
    ),
    highlight: { found: ['read:cost'], active: ['write:does'], compare: ['old:does'] },
    explanation: 'RCU is asymmetric by design. It makes the common read path extremely cheap and pushes coordination into the rarer update and reclamation path.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'reader threads', min: 1, max: 64 }, y: { label: 'read overhead', min: 0, max: 100 } },
      series: [
        { id: 'lock', label: 'rw lock', points: [{ x: 1, y: 10 }, { x: 8, y: 28 }, { x: 32, y: 70 }, { x: 64, y: 96 }] },
        { id: 'rcu', label: 'RCU read', points: [{ x: 1, y: 7 }, { x: 8, y: 8 }, { x: 32, y: 10 }, { x: 64, y: 12 }] },
      ],
    }),
    highlight: { found: ['rcu'], compare: ['lock'] },
    explanation: 'The exact numbers depend on implementation, but the shape is the point: RCU is attractive when reads dominate and update latency can absorb copying and grace-period work.',
  };
}

function* gracePeriod() {
  yield {
    state: graphState({
      nodes: [
        { id: 'unlink', label: 'unlink', x: 0.9, y: 5.3, note: 'old' },
        { id: 'wait', label: 'wait', x: 2.8, y: 5.3, note: 'grace' },
        { id: 'q0', label: 'CPU0', x: 4.7, y: 5.3, note: 'quiet' },
        { id: 'q1', label: 'CPU1', x: 6.6, y: 5.3, note: 'quiet' },
        { id: 'free', label: 'free', x: 8.4, y: 5.3, note: 'safe' },
      ],
      edges: [
        { id: 'e-unlink-wait', from: 'unlink', to: 'wait' },
        { id: 'e-wait-q0', from: 'wait', to: 'q0' },
        { id: 'e-q0-q1', from: 'q0', to: 'q1' },
        { id: 'e-q1-free', from: 'q1', to: 'free' },
      ],
    }, { title: 'Grace period: wait until old readers cannot remain' }),
    highlight: { active: ['wait', 'q0', 'q1'], found: ['free'] },
    explanation: 'After publication, old readers may still hold old pointers. A grace period ends only after every pre-existing reader has passed through a quiescent state.',
    invariant: 'Removal and reclamation are separate phases.',
  };

  yield {
    state: labelMatrix(
      'RCU API shape',
      [
        { id: 'lock', label: 'read lock' },
        { id: 'unlock', label: 'read unlock' },
        { id: 'sync', label: 'sync RCU' },
        { id: 'call', label: 'callback' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['mark read', 'too long'],
        ['exit read', 'must happen'],
        ['wait grace', 'blocking'],
        ['free later', 'backlog'],
      ],
    ),
    highlight: { active: ['sync:meaning', 'call:meaning'], compare: ['lock:risk'] },
    explanation: 'The names vary, but the shape is stable: mark read-side sections, publish updates carefully, then synchronize or schedule a callback before freeing old data.',
  };

  yield {
    state: labelMatrix(
      'Where RCU fits',
      [
        { id: 'routing', label: 'routing table' },
        { id: 'config', label: 'config map' },
        { id: 'cache', label: 'cache index' },
      ],
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
    explanation: 'RCU works best when readers greatly outnumber writers and old versions can temporarily coexist. It is a poor fit for heavy write contention or updates that must mutate a single object in place.',
  };

  yield {
    state: labelMatrix(
      'Compare reclamation families',
      [
        { id: 'hp', label: 'hazard ptr' },
        { id: 'epoch', label: 'epoch' },
        { id: 'rcu', label: 'RCU' },
      ],
      [
        { id: 'protect', label: 'protects' },
        { id: 'trade', label: 'tradeoff' },
      ],
      [
        ['one node', 'scan slots'],
        ['epoch group', 'stall growth'],
        ['old version', 'read-mostly'],
      ],
    ),
    highlight: { found: ['rcu:protect', 'rcu:trade'], compare: ['hp:trade', 'epoch:trade'] },
    explanation: 'Hazard pointers protect named nodes, epochs protect groups of retired nodes, and RCU protects old published versions until a grace period proves old readers are gone.',
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
      heading: 'What it is',
      paragraphs: [
        'Read-copy-update, usually called RCU, is a synchronization pattern for read-mostly data structures. Readers run through a short read-side critical section and follow a stable pointer. Writers build a replacement version, publish it with a pointer update, and postpone freeing the old version until no old reader can still be using it.',
        'That split makes RCU feel different from a normal reader-writer lock. It does not make every operation magically lock-free, but it lets the common read path avoid contending on a shared lock in workloads such as routing tables, kernel lookup structures, configuration maps, and read-mostly indexes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The name is literal. Read: a reader enters, loads the current pointer, and reads a coherent version. Copy: the writer creates a new version or replacement node away from readers. Update: the writer publishes the new pointer. Existing readers can finish on the old version while later readers see the new one.',
        'The reclamation rule is the part that links RCU to Hazard Pointers & Epoch Reclamation. Removal and freeing are separate. After the old version is unlinked, the system waits for a grace period: every read-side critical section that could have seen the old pointer must finish. Only then can the old version be safely freed or reused.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'RCU buys cheap reads by making writes and reclamation more complicated. Writers may copy data, keep multiple versions alive, and wait or queue callbacks behind grace periods. A stalled reader can delay reclamation. RCU also demands careful memory-ordering discipline: readers must not see a partially initialized version, and writers must not free storage before old readers are gone.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'The Linux kernel documentation describes RCU as optimized for read-mostly situations, and the mechanism is heavily associated with kernel lookup paths where reads dominate. Userspace RCU libraries bring the same idea to user programs; liburcu describes read-side access that scales with core count and includes RCU-based data structures such as hash tables, queues, stacks, and lists.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'RCU is not a universal replacement for locks. It is a poor fit when writes dominate, when every update must mutate one shared object in place, or when readers can block for arbitrary time. It guarantees memory safety around old versions, not business correctness around conflicting updates. Pair it with Linearizability History Checker, Nonblocking Progress Guarantees, Lock-Free Queue, Logical Clocks, MVCC & Vacuum, and Snapshot Isolation to see how versioning, ordering, and cleanup recur across systems.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux kernel RCU overview at https://docs.kernel.org/RCU/whatisRCU.html, RCU concepts at https://www.kernel.org/doc/html/v5.5/RCU/rcu.html, userspace RCU at https://liburcu.org/, and the original RCU paper PDF at https://www.rdrop.com/users/paulmck/RCU/rclockpdcsproof.pdf. Study Nonblocking Progress Guarantees, Linearizability History Checker, Hazard Pointers & Epoch Reclamation, Lock-Free Queue, MVCC & Vacuum, and Snapshot Isolation next.',
      ],
    },
  ],
};
