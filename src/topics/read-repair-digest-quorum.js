// Read repair: quorum reads compare digests, fetch freshest data, and repair stale replicas.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'read-repair-digest-quorum',
  title: 'Read Repair Digest Quorum',
  category: 'Systems',
  summary: 'A quorum read can compare replica digests, detect stale data, repair touched replicas, and return the newest value after repair.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['digest mismatch', 'monotonic quorum'], defaultValue: 'digest mismatch' },
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

function readGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'cli', x: 0.4, y: 4.0, note: 'read k' },
      { id: 'coord', label: 'coord', x: 2.8, y: 4.0, note: 'CL=QUORUM' },
      { id: 'a', label: 'A', x: 5.0, y: 2.0, note: 'v3 data' },
      { id: 'b', label: 'B', x: 5.0, y: 4.0, note: 'v2 digest' },
      { id: 'c', label: 'C', x: 5.0, y: 6.0, note: 'v3 digest' },
      { id: 'resolve', label: 'resolve', x: 7.3, y: 4.0, note: 'newest' },
      { id: 'repair', label: 'repair', x: 9.3, y: 4.0, note: 'write v3' },
    ],
    edges: [
      { id: 'e-client-coord', from: 'client', to: 'coord', weight: '' },
      { id: 'e-coord-a', from: 'coord', to: 'a', weight: '' },
      { id: 'e-coord-b', from: 'coord', to: 'b', weight: '' },
      { id: 'e-coord-c', from: 'coord', to: 'c', weight: '' },
      { id: 'e-a-resolve', from: 'a', to: 'resolve', weight: '' },
      { id: 'e-b-resolve', from: 'b', to: 'resolve', weight: '' },
      { id: 'e-c-resolve', from: 'c', to: 'resolve', weight: '' },
      { id: 'e-resolve-repair', from: 'resolve', to: 'repair', weight: '' },
    ],
  }, { title });
}

function* digestMismatch() {
  const replicaCount = 3;
  const activeNodes = ['client', 'coord', 'a', 'b', 'c', 'e-client-coord', 'e-coord-a', 'e-coord-b', 'e-coord-c'];
  const compareNodes = ['resolve'];
  yield {
    state: readGraph('Coordinator reads data plus replica digests'),
    highlight: { active: activeNodes, compare: compareNodes },
    explanation: `A read coordinator contacts ${replicaCount} replicas via ${activeNodes.length} active elements, requesting full data from one and cheaper digests from the other ${replicaCount - 1}. If digests match, the coordinator can return quickly without involving the ${compareNodes[0]} step. If they differ, at least one touched replica is stale.`,
    invariant: `A digest is a comparison shortcut across ${replicaCount} replicas; a mismatch requires real data resolution.`,
  };

  const rows = [
    { id: 'a', label: 'replica A' },
    { id: 'b', label: 'replica B' },
    { id: 'c', label: 'replica C' },
  ];
  const cols = [
    { id: 'version', label: 'version' },
    { id: 'digest', label: 'digest' },
    { id: 'status', label: 'status' },
  ];
  const digestData = [
    ['v3', 'h3', 'fresh'],
    ['v2', 'h2', 'stale'],
    ['v3', 'h3', 'fresh'],
  ];
  const freshCount = digestData.filter(r => r[2] === 'fresh').length;
  const staleCount = digestData.filter(r => r[2] === 'stale').length;
  yield {
    state: labelMatrix('Digest comparison for key k', rows, cols, digestData),
    highlight: { active: ['b:digest', 'b:status'], found: ['a:status', 'c:status'] },
    explanation: `Among ${rows.length} replicas compared across ${cols.length} columns, ${freshCount} are fresh and ${staleCount} is stale. The mismatch does not by itself tell the whole value. The coordinator fetches enough data to resolve the newest value according to the database timestamp/version rules.`,
  };

  const resolveActive = ['a', 'b', 'c', 'resolve', 'e-a-resolve', 'e-b-resolve', 'e-c-resolve'];
  const resolveFound = ['repair', 'e-resolve-repair'];
  yield {
    state: readGraph('Resolve newest value and repair stale touched replica'),
    highlight: { active: resolveActive, found: resolveFound },
    explanation: `After resolution across ${resolveActive.length} active elements, the coordinator writes the newest value back to the ${staleCount} stale replica involved in the read. In blocking read repair, the client waits for ${resolveFound.length} repair elements to complete before receiving a response.`,
  };

  const outcomeRows = [
    { id: 'match', label: 'digests match' },
    { id: 'mismatch', label: 'digests differ' },
    { id: 'repair', label: 'repair acked' },
    { id: 'missed', label: 'untouched replica' },
  ];
  const outcomeCols = [
    { id: 'client', label: 'client sees' },
    { id: 'replicas', label: 'replica effect' },
  ];
  yield {
    state: labelMatrix(
      'Read-repair outcomes',
      outcomeRows,
      outcomeCols,
      [
        ['fast return', 'no touched repair'],
        ['wait for resolve', 'stale touched replica found'],
        ['newest value', 'touched replicas converge'],
        ['not queried', 'may stay stale'],
      ],
    ),
    highlight: { active: ['mismatch:client', 'repair:replicas'], compare: ['missed:replicas'] },
    explanation: `Read repair covers ${outcomeRows.length} outcome scenarios across ${outcomeCols.length} dimensions. It is scoped to the ${replicaCount} replicas involved in the read; it improves what the coordinator observed but is not a substitute for full anti-entropy repair across every token range.`,
  };

  const finalActive = ['coord', 'resolve', 'repair'];
  const finalCompare = ['b'];
  yield {
    state: readGraph('The read path becomes a small repair workflow'),
    highlight: { active: finalActive, found: ['client'], compare: finalCompare },
    explanation: `This is why read repair belongs on a data-structures site. The ${finalActive.length} active stages (${finalActive.join(', ')}) transform a query path into a compare-and-repair workflow over digests, versions, quorum responses, and durable writebacks targeting stale replica ${finalCompare[0].toUpperCase()}.`,
  };
}

function* monotonicQuorum() {
  const replicaCount = 3;
  const newerVersion = 'v3';
  const olderVersion = 'v2';
  const mqRows = [
    { id: 'a', label: 'replica A' },
    { id: 'b', label: 'replica B' },
    { id: 'c', label: 'replica C' },
  ];
  const mqCols = [
    { id: 'before', label: 'before read' },
    { id: 'after', label: 'after blocking repair' },
  ];
  const mqData = [
    [newerVersion, newerVersion],
    [olderVersion, newerVersion],
    [olderVersion, `${olderVersion} if not touched`],
  ];
  const freshBefore = mqData.filter(r => r[0] === newerVersion).length;
  const staleBefore = mqData.filter(r => r[0] === olderVersion).length;
  yield {
    state: labelMatrix('Failed quorum write leaves one fresh replica', mqRows, mqCols, mqData),
    highlight: { active: ['a:before', 'b:before'], found: ['b:after'], compare: ['c:after'] },
    explanation: `Among ${replicaCount} replicas shown in ${mqCols.length} columns, ${freshBefore} starts at ${newerVersion} and ${staleBefore} remain at ${olderVersion} before the read. Cassandra documentation describes blocking read repair as preserving monotonic quorum reads: if a quorum read sees the newer ${newerVersion} on one replica, it repairs stale replicas involved in that read before returning.`,
    invariant: `The next quorum read should not move backward from ${newerVersion} to ${olderVersion} for the repaired replica set.`,
  };

  const firstReadActive = ['client', 'coord', 'a', 'b', 'resolve', 'repair'];
  const untouchedReplica = 'c';
  yield {
    state: readGraph('First quorum read touches A and B'),
    highlight: { active: firstReadActive, compare: [untouchedReplica], found: ['e-resolve-repair'] },
    explanation: `A first quorum read across ${firstReadActive.length} active elements includes A and B: A returns ${newerVersion} while B has stale ${olderVersion}. Blocking repair writes ${newerVersion} to B before the coordinator returns ${newerVersion} to the client, leaving replica ${untouchedReplica.toUpperCase()} untouched.`,
  };

  const secondRows = [
    { id: 'with', label: 'with blocking repair' },
    { id: 'none', label: 'without repair' },
    { id: 'full', label: 'anti-entropy later' },
  ];
  const secondCols = [
    { id: 'BplusC', label: 'read B+C' },
    { id: 'client', label: 'client risk' },
  ];
  yield {
    state: labelMatrix(
      'Second quorum read behavior',
      secondRows,
      secondCols,
      [
        [`B has ${newerVersion}, C has ${olderVersion}`, `returns ${newerVersion}`],
        [`B may still be ${olderVersion}`, 'can move backward'],
        ['range repair fixes C', 'eventual convergence'],
      ],
    ),
    highlight: { active: ['with:BplusC', 'with:client'], compare: ['none:client'] },
    explanation: `Across ${secondRows.length} scenarios and ${secondCols.length} dimensions, blocking repair makes successive quorum reads monotonic for the replicas it touches. Without repair, B may still hold ${olderVersion} and the client can move backward. Background repair still matters for full convergence across all ${replicaCount} replicas.`,
  };

  const tradeoffRows = [
    { id: 'blocking', label: 'blocking repair' },
    { id: 'none', label: 'repair none' },
    { id: 'anti', label: 'anti-entropy' },
  ];
  const tradeoffCols = [
    { id: 'strength', label: 'strength' },
    { id: 'cost', label: 'cost' },
  ];
  yield {
    state: labelMatrix(
      'Tradeoff: monotonic reads vs partition-level atomicity',
      tradeoffRows,
      tradeoffCols,
      [
        ['monotonic quorum reads', 'read latency'],
        ['partition atomicity', 'stale quorum risk'],
        ['eventual convergence', 'scheduled work'],
      ],
    ),
    highlight: { active: ['blocking:strength', 'blocking:cost'], found: ['anti:strength'] },
    explanation: `Cassandra exposes ${tradeoffRows.length} repair strategies across ${tradeoffCols.length} dimensions. Blocking read repair preserves monotonic quorum reads at the cost of read latency, while disabling it preserves partition-level write atomicity for multi-row operations. The right choice depends on the invariant.`,
  };

  const completeActive = ['coord', 'a', 'b', 'c', 'resolve', 'repair'];
  yield {
    state: readGraph('Complete case: compare, resolve, repair, return'),
    highlight: { active: completeActive, found: ['client'] },
    explanation: `The complete read-repair loop across ${completeActive.length} active elements and ${replicaCount} replicas is: gather quorum responses, compare digests or data, fetch enough data to resolve from ${olderVersion} to ${newerVersion}, write the newest value to stale touched replicas, then return the resolved value.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'digest mismatch') yield* digestMismatch();
  else if (view === 'monotonic quorum') yield* monotonicQuorum();
  else throw new InputError('Pick a read repair view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a quorum read in a replicated database. A quorum is enough replicas to overlap other quorum operations, and a digest is a hash-like summary used to compare values cheaply.',
        {type: 'image', src: './assets/gifs/read-repair-digest-quorum.gif', alt: 'Animated walkthrough of the read repair digest quorum visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference rule is that a digest match can keep the read cheap, but a digest mismatch cannot choose the winner. A mismatch only says the coordinator must fetch real data and apply the database conflict rules.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Replicated databases keep copies of the same logical row on several machines so the system can survive failure. The cost is drift: one replica may miss a write because of timeout, crash, disk trouble, or network partition.',
        {type: `callout`, text: `Read repair turns a quorum read into a local audit: compare participants, resolve disagreement, and repair only the stale replicas the read actually touched.`},
        'Read repair exists because a read coordinator is already contacting replicas. It can compare what they know, return the resolved value, and repair stale participants while the inconsistency is still local.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to read one replica and return its value. That is fast and cheap, but it can return stale data even when a newer value exists elsewhere.',
        'The opposite approach is to fetch full values from every replica on every read. That detects disagreement directly, but it wastes bandwidth and tail latency when replicas already agree.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that disagreement is sparse but dangerous. Most reads should not ship every full value, yet a stale quorum read can make a client observe time moving backward.',
        'Partial writes create the common case. Version 3 may reach replica A and miss replicas B and C, so a later read must detect whether it touched A or only stale copies.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is a two-mode read. In the cheap mode, the coordinator requests one full value and one or more digests; in the repair mode, a digest mismatch triggers full data fetch, conflict resolution, and writeback.',
        'The invariant after blocking read repair is local, not global. Participants in that read are moved to the resolved value, while replicas outside the read may still be stale.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A client sends a read to a coordinator at a consistency level such as QUORUM. With replication factor three, a quorum commonly means responses from two replicas.',
        'The coordinator asks one replica for full data and another for a digest. If they agree, it returns the value; if they differ, it fetches enough full data to resolve the winner and writes the winner back to stale participants.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg`, alt: `Rows of server racks in a data center`, caption: `Replicated storage turns one logical read into coordinated requests across machines; read repair uses that fanout to find stale replicas. Source: https://commons.wikimedia.org/wiki/File:Wikimedia_Foundation_Servers-8055_35.jpg.`},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from refusing to let the digest decide value order. The digest is only an equality shortcut, so disagreement forces real metadata and values into the resolution path.',
        'Blocking repair improves monotonic quorum reads because repaired participants carry the newer value into later overlapping quorums. It does not prove the whole cluster has converged because untouched replicas remain outside the operation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A clean read pays for replica requests and digest comparison. A dirty read pays for extra full-data fetches, conflict resolution, repair writes, and waiting for repair acknowledgments if repair is blocking.',
        'When value size grows from 1 KB to 1 MB, digest comparison saves much more bandwidth on clean reads. When mismatch rate rises, that saving disappears and the read path starts doing repair work that may belong in scheduled anti-entropy repair.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Read repair fits quorum-style distributed stores where hot keys are read often enough to clean up their own stale participants. It is useful when monotonic read behavior matters more than the lowest possible tail latency.',
        'It also reduces common-case bandwidth. Digests let the coordinator test agreement without moving every full value across the network on every read.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Read repair fails as a complete convergence plan. Cold ranges may never be read, and replicas not contacted by a read are not repaired by that read.',
        'It can also surprise applications that write multiple rows and later read only part of the partition. Repairing only the selected rows can improve monotonic reads while weakening the appearance of partition-level write atomicity.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with replicas A, B, and C all storing v2. A write for v3 reaches only A before timeout, so A has v3 while B and C still have v2.',
        'A quorum read contacts A and B. A returns full v3, B returns a digest for v2, the coordinator detects mismatch, fetches real data, chooses v3 by the conflict rules, repairs B to v3, and returns v3; a later quorum over B and C now intersects the repaired value.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Apache Cassandra documentation on read repair and repair, then compare the behavior to Dynamo-style quorum replication. Focus on blocking repair, monotonic quorum reads, digest mismatch handling, and anti-entropy repair.',
        'Study quorum systems, hinted handoff, Merkle-tree repair, version vectors, tombstones, replica lag, and session guarantees next. These topics show why local read repair is useful but not enough for full convergence.',
      ],
    },
  ],
};
