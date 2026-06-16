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
  yield {
    state: readGraph('Coordinator reads data plus replica digests'),
    highlight: { active: ['client', 'coord', 'a', 'b', 'c', 'e-client-coord', 'e-coord-a', 'e-coord-b', 'e-coord-c'], compare: ['resolve'] },
    explanation: 'A read coordinator can request full data from one replica and cheaper digests from others. If digests match, the coordinator can return quickly. If they differ, at least one touched replica is stale.',
    invariant: 'A digest is a comparison shortcut; a mismatch requires real data resolution.',
  };

  yield {
    state: labelMatrix(
      'Digest comparison for key k',
      [
        { id: 'a', label: 'replica A' },
        { id: 'b', label: 'replica B' },
        { id: 'c', label: 'replica C' },
      ],
      [
        { id: 'version', label: 'version' },
        { id: 'digest', label: 'digest' },
        { id: 'status', label: 'status' },
      ],
      [
        ['v3', 'h3', 'fresh'],
        ['v2', 'h2', 'stale'],
        ['v3', 'h3', 'fresh'],
      ],
    ),
    highlight: { active: ['b:digest', 'b:status'], found: ['a:status', 'c:status'] },
    explanation: 'The mismatch does not by itself tell the whole value. The coordinator fetches enough data to resolve the newest value according to the database timestamp/version rules.',
  };

  yield {
    state: readGraph('Resolve newest value and repair stale touched replica'),
    highlight: { active: ['a', 'b', 'c', 'resolve', 'e-a-resolve', 'e-b-resolve', 'e-c-resolve'], found: ['repair', 'e-resolve-repair'] },
    explanation: 'After resolution, the coordinator writes the newest value back to stale replicas involved in the read. In blocking read repair, the client waits until the repair completes.',
  };

  yield {
    state: labelMatrix(
      'Read-repair outcomes',
      [
        { id: 'match', label: 'digests match' },
        { id: 'mismatch', label: 'digests differ' },
        { id: 'repair', label: 'repair acked' },
        { id: 'missed', label: 'untouched replica' },
      ],
      [
        { id: 'client', label: 'client sees' },
        { id: 'replicas', label: 'replica effect' },
      ],
      [
        ['fast return', 'no touched repair'],
        ['wait for resolve', 'stale touched replica found'],
        ['newest value', 'touched replicas converge'],
        ['not queried', 'may stay stale'],
      ],
    ),
    highlight: { active: ['mismatch:client', 'repair:replicas'], compare: ['missed:replicas'] },
    explanation: 'Read repair is scoped to the replicas involved in the read. It improves what the coordinator observed; it is not a substitute for full anti-entropy repair across every token range.',
  };

  yield {
    state: readGraph('The read path becomes a small repair workflow'),
    highlight: { active: ['coord', 'resolve', 'repair'], found: ['client'], compare: ['b'] },
    explanation: 'This is why read repair belongs on a data-structures site. A query path becomes a compare-and-repair workflow over digests, versions, quorum responses, and durable writebacks.',
  };
}

function* monotonicQuorum() {
  yield {
    state: labelMatrix(
      'Failed quorum write leaves one fresh replica',
      [
        { id: 'a', label: 'replica A' },
        { id: 'b', label: 'replica B' },
        { id: 'c', label: 'replica C' },
      ],
      [
        { id: 'before', label: 'before read' },
        { id: 'after', label: 'after blocking repair' },
      ],
      [
        ['v3', 'v3'],
        ['v2', 'v3'],
        ['v2', 'v2 if not touched'],
      ],
    ),
    highlight: { active: ['a:before', 'b:before'], found: ['b:after'], compare: ['c:after'] },
    explanation: 'Cassandra documentation describes blocking read repair as preserving monotonic quorum reads. If a quorum read sees the newer value on one replica, it repairs stale replicas involved in that read before returning.',
    invariant: 'The next quorum read should not move backward for the repaired replica set.',
  };

  yield {
    state: readGraph('First quorum read touches A and B'),
    highlight: { active: ['client', 'coord', 'a', 'b', 'resolve', 'repair'], found: ['e-resolve-repair'], compare: ['c'] },
    explanation: 'A first quorum read that includes A and B sees v3 from A and stale v2 from B. Blocking repair writes v3 to B before the coordinator returns v3 to the client.',
  };

  yield {
    state: labelMatrix(
      'Second quorum read behavior',
      [
        { id: 'with', label: 'with blocking repair' },
        { id: 'none', label: 'without repair' },
        { id: 'full', label: 'anti-entropy later' },
      ],
      [
        { id: 'BplusC', label: 'read B+C' },
        { id: 'client', label: 'client risk' },
      ],
      [
        ['B has v3, C has v2', 'returns v3'],
        ['B may still be v2', 'can move backward'],
        ['range repair fixes C', 'eventual convergence'],
      ],
    ),
    highlight: { active: ['with:BplusC', 'with:client'], compare: ['none:client'] },
    explanation: 'Blocking repair can make successive quorum reads monotonic for the replicas it touches. It does not instantly repair every replica; background repair still matters for full convergence.',
  };

  yield {
    state: labelMatrix(
      'Tradeoff: monotonic reads vs partition-level atomicity',
      [
        { id: 'blocking', label: 'blocking repair' },
        { id: 'none', label: 'repair none' },
        { id: 'anti', label: 'anti-entropy' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['monotonic quorum reads', 'read latency'],
        ['partition atomicity', 'stale quorum risk'],
        ['eventual convergence', 'scheduled work'],
      ],
    ),
    highlight: { active: ['blocking:strength', 'blocking:cost'], found: ['anti:strength'] },
    explanation: 'Cassandra exposes a real tradeoff. Blocking read repair can preserve monotonic quorum reads, while disabling it can preserve partition-level write atomicity for multi-row operations. The right choice depends on the invariant.',
  };

  yield {
    state: readGraph('Complete case: compare, resolve, repair, return'),
    highlight: { active: ['coord', 'a', 'b', 'c', 'resolve', 'repair'], found: ['client'] },
    explanation: 'The complete read-repair loop is: gather quorum responses, compare digests or data, fetch enough data to resolve, write the newest value to stale touched replicas, then return the resolved value.',
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
      heading: 'What it is',
      paragraphs: [
        'Read repair is a convergence mechanism in eventually consistent replicated databases. During a read, the coordinator compares responses from replicas. If some touched replicas are stale, the coordinator repairs them by writing the newest value back.',
        'Digest comparison makes this cheaper. A replica can send a hash of the value instead of the full value. Matching digests let the coordinator avoid extra work; mismatching digests trigger full data resolution and repair.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A coordinator receives a client read at a consistency level such as QUORUM. It sends requests to replicas, often mixing a full data request with digest requests. If all digests agree, it can return the value. If a mismatch appears, it fetches enough data to identify the newest value according to timestamp/version rules.',
        'In blocking read repair, the coordinator writes the newest value back to stale replicas involved in the read and waits for that repair before returning. This protects monotonic quorum reads: a later quorum read should not return an older value than an earlier quorum read that already saw and repaired the newer value.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Read repair moves some repair cost onto user reads. That can improve freshness but increase tail latency, because a read that discovers inconsistency must perform extra fetches and writes before responding.',
        'The repair is also partial. It repairs replicas involved in the read, not necessarily every replica that owns the token range. Anti-entropy repair is still needed for full convergence, tombstone safety, and ranges that are rarely read.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A failed quorum write leaves A at version 3 while B and C remain at version 2. A quorum read touches A and B. The coordinator detects a digest mismatch, resolves version 3 as newest, repairs B, and returns version 3. A later quorum read touching B and C can now see version 3 from B rather than moving backward to version 2.',
        'This case study explains why the feature is a tradeoff rather than a free win. The read path gets stronger monotonic behavior, but it can block on repair writes and still does not repair untouched replicas such as C.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Apache Cassandra read repair documentation: https://cassandra.apache.org/doc/latest/cassandra/managing/operating/read_repair.html. Cassandra repair documentation: https://cassandra.apache.org/doc/4.0/cassandra/operating/repair.html. Study Read/Write Quorums, Hinted Handoff Replica Queue, Cassandra Repair Case Study, Version Vectors & Dotted Version Vectors, and Amazon Dynamo Case Study next.',
        'Session Guarantees & Replica Lag is the user-facing complement: read repair can improve touched replicas, while session tokens keep one client from moving backward when traffic lands on a lagging replica.',
      ],
    },
  ],
};
