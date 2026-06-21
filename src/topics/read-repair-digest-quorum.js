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
      heading: 'Why this exists',
      paragraphs: [
        `A replicated database stores the same logical row on several machines because one machine can fail, pause, lose a disk, fall behind, or be separated by a network partition. The price of that availability is disagreement. A write may reach replica A and replica C but time out before replica B stores the same version. Later, a client can ask for the key and receive answers from replicas that do not all describe the same value.`,
        `Read repair exists because a read is not only a lookup. In a quorum database, the read coordinator is already contacting several replicas. That gives it a chance to notice stale copies while the inconsistency is still local to the replicas involved in the request. Instead of waiting for a scheduled full-range repair job, the read path can compare responses, choose the value that wins under the database conflict rules, and write that winning value back to stale replicas touched by the read.`,
        `The scope is deliberately narrow. Read repair does not mean every replica in the cluster is now correct. It means the replicas that participated in this read were compared, the client received the resolved value, and stale participants may have been repaired before the response returned. That narrow scope is why the mechanism is useful and also why it cannot replace anti-entropy repair.`,
        {type: `callout`, text: `Read repair turns a quorum read into a local audit: compare participants, resolve disagreement, and repair only the stale replicas the read actually touched.`}
      ],
    },
    {
      heading: 'The reasonable first attempt',
      paragraphs: [
        `The simplest read path asks one replica for the full value and returns it. That is attractive because it is fast, cheap, and easy to reason about. If the system is healthy and replicas usually agree, a single-replica read avoids extra network hops and avoids doing reconciliation work on the critical path.`,
        `The next simple design asks every replica for the full value on every read. That catches disagreement directly. The coordinator can compare versions, pick the newest value, and know which replicas are stale. This design is also easy to explain because it never uses a shortcut. Every read carries enough data to reconcile the whole replica set for that key.`,
        `Both designs are reasonable in small systems. The first optimizes for latency but can return stale data even when a newer value exists on another replica. The second optimizes for detection but wastes bandwidth and tail latency on the common case where all replicas already agree. Real distributed stores need a middle path: cheap agreement checks when values match, full resolution only when the shortcut proves disagreement.`
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is that inconsistency is sparse but expensive to ignore. Most reads should not pay the cost of moving every full value from every replica. Some reads must detect that a value has split across replicas. A failed quorum write is the classic case: the newest version may be present on only a minority of replicas, yet a later quorum read can still encounter it because quorums overlap in useful ways.`,
        `A single stale read is not the only problem. If a quorum read first returns version 3 because it contacted a fresh replica, then a later quorum read returns version 2 because it contacted two stale replicas, the client experiences time moving backward. Cassandra documentation describes blocking read repair as a way to preserve monotonic quorum reads in that kind of partial-write scenario.`,
        `There is also a data-shape wall. Multi-row or partition-level writes can be read back with narrower SELECT statements. Repairing only the rows that were read can improve monotonic reads while weakening partition-level write atomicity. This is not a bug in the idea. It is the cost of doing repair on the read path with only the data the read observed.`
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `A digest is a cheap comparison handle for a value. Instead of asking every replica to ship full data, the coordinator can ask one replica for the data and ask other replicas for hashes of what they would return. Matching digests mean the touched replicas agree on the value representation being compared. A mismatch means the shortcut is no longer enough.`,
        `The core insight is to split the read into two modes. In the fast mode, the coordinator gathers a quorum, compares digests, and returns without full reconciliation when the responses agree. In the repair mode, a mismatch triggers extra data fetches, conflict resolution, and a writeback to stale replicas involved in the read. The digest is not the value and does not decide the winner. It only decides whether the coordinator can stay on the cheap path.`,
        `The invariant is local agreement among the participants. After a blocking read repair completes, stale replicas that participated in the read have been moved to the resolved winning value. Untouched replicas may still be stale. That invariant is strong enough to help future quorum reads that overlap the repaired set, but it is not a cluster-wide convergence proof.`
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A client sends a read to a coordinator at a consistency level such as QUORUM. For a replication factor of three, a quorum read usually needs responses from two replicas. The coordinator chooses replicas, sends read requests, and may ask one replica for full data while asking others for digests. The exact implementation details vary, but the teaching model is stable: gather enough responses, compare what they imply, and escalate only when agreement is uncertain.`,
        `If the full-data response and the digests agree, the coordinator can return the value. The matching digest responses act like witnesses that the touched replicas would return the same data. If one digest differs, the coordinator fetches full data from enough replicas to resolve the conflict. Resolution is done by the database rules, such as timestamps, deletion markers, and other metadata. The digest does not say which version is newer; it only proves that at least one participant disagrees.`,
        `After resolution, blocking read repair writes the winning value back to stale replicas that were part of the read. The coordinator waits for those repair writes before returning to the client. With read repair disabled or configured differently, the coordinator may still resolve the client response but may not block on repairing participants. That changes both latency and consistency behavior.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg`, alt: `Rows of server racks in a data center`, caption: `Replicated storage turns one logical read into coordinated requests across machines; read repair uses that fanout to find stale replicas. Source: https://commons.wikimedia.org/wiki/File:Wikimedia_Foundation_Servers-8055_35.jpg.`}
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The first correctness argument comes from quorum intersection. If writes and reads use quorum consistency in a stable replica set, a later quorum read is likely to overlap the replicas that acknowledged a successful quorum write. Partial failures complicate the story, but the overlap idea explains why contacting several replicas is better than trusting one. A read that sees both fresh and stale answers can choose the winner instead of returning whichever replica answered first.`,
        `The second argument comes from digest escalation. A digest match is useful only because it is tied to the same value representation the replica would return. When digests match across the touched replicas, the coordinator has evidence that full values are the same. When they differ, the coordinator refuses to guess and fetches real data. That preserves correctness because hashes are used as a shortcut for equality, not as a replacement for conflict resolution.`,
        `Blocking repair strengthens future quorum reads over the repaired set. Suppose A has v3, B has v2, and C has v2 after a write reached only A. A quorum read touches A and B, sees the mismatch, resolves v3, and repairs B before returning. A later quorum read over B and C can now see v3 through B. C is still stale, but the repaired overlap prevents the client from moving backward in that common sequence.`
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Start with replicas A, B, and C. Version 2 is stored everywhere. A client writes version 3, but the write reaches only A before the operation times out or fails to reach a quorum. The cluster now contains one fresh replica and two stale replicas. No background repair has run yet.`,
        `A client later issues a quorum read. The coordinator contacts A and B. A returns full data for v3, while B returns a digest for v2. The digest mismatch tells the coordinator that the cheap path failed. The coordinator fetches enough full data to compare real versions, applies the conflict rules, and chooses v3. Because B participated and is stale, a blocking read repair writes v3 to B before the coordinator returns v3 to the client.`,
        `The next quorum read touches B and C. Without the first repair, B and C could both have returned v2 and the client would move backward. With blocking repair, B now carries v3, so the coordinator can again resolve toward the newer value. C may remain stale until it participates in a repair or a scheduled anti-entropy process fixes the range.`
      ],
    },
    {
      heading: 'What the animation shows',
      paragraphs: [
        `The digest-mismatch view shows the read path as a compare-and-repair workflow. The client reaches a coordinator, the coordinator contacts replicas, the matrix shows one stale digest, and the graph moves through resolve and repair. The important teaching point is the branch: matching digests keep the read cheap, while a mismatch forces real value resolution.`,
        `The monotonic-quorum view shows why blocking repair changes later reads. One replica starts fresh and another starts stale. After the first quorum read repairs the stale participant, the second quorum read has a repaired overlap that can carry the newer version forward. The final tradeoff table is not decoration. It names the choice between monotonic quorum reads and partition-level write atomicity in cases where partial read repair would expose only part of a wider write.`
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `A clean read pays for normal replica requests and digest comparison. A dirty read pays more. It may need extra full-data fetches, conflict resolution, repair writes, and repair acknowledgments before the client receives a response. That cost lands on user-facing latency when repair is blocking.`,
        `Space overhead is small for the read itself, but the operational cost is not small. The system must maintain metadata that lets versions be resolved correctly. It must handle tombstones carefully. It must keep enough repair discipline that deleted data is not resurrected after garbage collection. Digest comparison reduces bandwidth in the common case, but it does not remove the need for a correct storage engine and repair strategy.`,
        `The key tradeoff is which invariant you want most. Blocking read repair improves monotonic behavior for quorum reads. Disabling read repair can preserve partition-level write atomicity when applications write multiple rows together and later read only a subset. A database setting that sounds like a performance knob is really a consistency knob.`
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Read repair wins for hot keys because reads are frequent enough to discover and correct drift quickly. If a stale replica would otherwise be hit repeatedly, repairing it during a read turns a recurring client-visible problem into a one-time reconciliation cost. The mechanism also fits systems where monotonic read behavior matters more than keeping every read as low-latency as possible.`,
        `It also wins when most replicas agree. Digest requests let the coordinator avoid transferring full values from every participant on every read. That is the practical reason the digest exists: it keeps the common case cheap while preserving a path to full reconciliation when the comparison fails.`
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Read repair fails as a complete convergence plan. Cold ranges may never be read. Replicas not contacted by a specific read remain outside that repair. A node that was down during many writes needs more than opportunistic cleanup from later client reads. Scheduled anti-entropy repair still matters for full token ranges, tombstone safety, and long-lived replica health.`,
        `It also fails when the read path cannot afford repair latency. Low-latency systems may prefer to resolve the client response and move repair to a background process. That gives up some blocking consistency guarantees but protects tail latency. Read repair is also dangerous if teams treat digest agreement as a substitute for understanding conflict resolution, clock behavior, tombstones, and partial writes.`
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The first failure mode is under-repair. A cluster looks healthy for hot keys while cold ranges remain divergent. The second is overconfidence in quorums. A quorum read gives a useful intersection property, but topology changes, failed writes, timeouts, and consistency-level choices still matter. The third is semantic surprise: repairing only the selected rows can make a multi-row write appear partially applied to later readers.`,
        `Operationally, watch read latency spikes, digest mismatch rates, repair write failures, tombstone age, and scheduled repair coverage. A high mismatch rate means the read path is doing cleanup work that may belong in anti-entropy repair. Repair failures mean the client may receive a resolved value while stale replicas remain stale.`
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Apache Cassandra read repair documentation at https://cassandra.apache.org/doc/latest/cassandra/managing/operating/read_repair.html and Cassandra repair documentation at https://cassandra.apache.org/doc/4.0/cassandra/operating/repair.html.`,
        `Study Quorums for the intersection argument, Hinted Handoff Replica Queue for short-outage write-path repair, Cassandra Repair Case Study for anti-entropy over token ranges, Version Vectors and Dotted Version Vectors for causality metadata, Dynamo Case Study for the lineage of sloppy quorum systems, and Session Guarantees and Replica Lag for the user-facing problem of preventing one client from moving backward.`
      ],
    },
  ],
};
