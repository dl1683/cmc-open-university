// Cassandra repair case study: Merkle-tree comparison and streaming repair for
// eventually consistent replicas.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'cassandra-repair-case-study',
  title: 'Cassandra Repair Case Study',
  category: 'Systems',
  summary: 'Anti-entropy repair in Cassandra: compare replica Merkle trees for token ranges, then stream only out-of-sync data.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['merkle comparison', 'repair scheduling'], defaultValue: 'merkle comparison' },
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

function repairGraph(title) {
  return graphState({
    nodes: [
      { id: 'coord', label: 'repair coordinator', x: 0.8, y: 4.0, note: 'token range' },
      { id: 'r1', label: 'replica A', x: 3.0, y: 2.1, note: 'build tree' },
      { id: 'r2', label: 'replica B', x: 3.0, y: 4.0, note: 'build tree' },
      { id: 'r3', label: 'replica C', x: 3.0, y: 5.9, note: 'build tree' },
      { id: 'm1', label: 'Merkle A', x: 5.3, y: 2.1, note: 'hash ranges' },
      { id: 'm2', label: 'Merkle B', x: 5.3, y: 4.0, note: 'hash ranges' },
      { id: 'm3', label: 'Merkle C', x: 5.3, y: 5.9, note: 'hash ranges' },
      { id: 'stream', label: 'stream diffs', x: 8.2, y: 4.0, note: 'repair data' },
    ],
    edges: [
      { id: 'e-coord-r1', from: 'coord', to: 'r1', weight: 'validate' },
      { id: 'e-coord-r2', from: 'coord', to: 'r2', weight: 'validate' },
      { id: 'e-coord-r3', from: 'coord', to: 'r3', weight: 'validate' },
      { id: 'e-r1-m1', from: 'r1', to: 'm1', weight: 'hash' },
      { id: 'e-r2-m2', from: 'r2', to: 'm2', weight: 'hash' },
      { id: 'e-r3-m3', from: 'r3', to: 'm3', weight: 'hash' },
      { id: 'e-m1-stream', from: 'm1', to: 'stream', weight: 'compare' },
      { id: 'e-m2-stream', from: 'm2', to: 'stream', weight: 'compare' },
      { id: 'e-m3-stream', from: 'm3', to: 'stream', weight: 'compare' },
    ],
  }, { title });
}

function* merkleComparison() {
  yield {
    state: repairGraph('Repair targets a token range and its replicas'),
    highlight: { active: ['coord', 'r1', 'r2', 'r3'], compare: ['stream'] },
    explanation: 'Cassandra is eventually consistent. If writes miss some replicas or hints expire, anti-entropy repair compares replicas for a token range and streams missing or stale data.',
    invariant: 'Repair is scoped by token ranges and replica sets.',
  };

  yield {
    state: repairGraph('Each replica builds a Merkle tree'),
    highlight: { active: ['r1', 'r2', 'r3', 'm1', 'm2', 'm3', 'e-r1-m1', 'e-r2-m2', 'e-r3-m3'] },
    explanation: 'A Merkle tree hashes rows into leaves and combines hashes upward. Equal roots suggest the range matches. Different roots let repair descend into smaller subranges instead of comparing every row.',
  };

  yield {
    state: labelMatrix(
      'Compare hash ranges',
      [
        { id: 'root', label: 'root hash' },
        { id: 'left', label: 'left half' },
        { id: 'right', label: 'right half' },
        { id: 'leaf', label: 'leaf range' },
      ],
      [{ id: 'comparison', label: 'comparison' }, { id: 'action' }],
      [
        ['A != B', 'descend'],
        ['A == B', 'skip entire half'],
        ['A != B', 'descend'],
        ['row hashes differ', 'stream data'],
      ],
    ),
    highlight: { active: ['root:action', 'right:action'], found: ['left:action', 'leaf:action'] },
    explanation: 'Merkle comparison is a pruning structure. Matching subtrees are skipped; mismatching subtrees are refined until repair knows what data to stream.',
  };

  yield {
    state: repairGraph('Stream differences to converge replicas'),
    highlight: { active: ['m1', 'm2', 'm3', 'stream', 'e-m1-stream', 'e-m2-stream', 'e-m3-stream'], found: ['stream'] },
    explanation: 'After the mismatched ranges are known, replicas stream the necessary rows. The repair job consumes disk, CPU, and network, which is why scheduling matters.',
  };
}

function* repairScheduling() {
  yield {
    state: labelMatrix(
      'Repair modes',
      [
        { id: 'full', label: 'full repair' },
        { id: 'incremental', label: 'incremental repair' },
        { id: 'preview', label: 'preview/validate' },
        { id: 'read', label: 'read repair' },
      ],
      [{ id: 'scope', label: 'scope' }, { id: 'tradeoff' }],
      [
        ['all data in range', 'expensive but complete'],
        ['data since last repair', 'less work, more metadata'],
        ['check consistency', 'no normal streaming'],
        ['during reads', 'only touched replicas'],
      ],
    ),
    highlight: { active: ['full:tradeoff', 'incremental:tradeoff'], found: ['read:scope'] },
    explanation: 'Cassandra has several convergence mechanisms. Anti-entropy repair is the deliberate operator-driven one; read repair fixes inconsistencies discovered on read paths.',
  };

  yield {
    state: repairGraph('Repair must be scheduled like heavy maintenance'),
    highlight: { active: ['coord', 'r1', 'r2', 'r3'], compare: ['stream'] },
    explanation: 'Repair is not free background magic. Building Merkle trees reads data, comparing trees uses memory, and streaming differences competes with foreground traffic.',
  };

  yield {
    state: labelMatrix(
      'Case study: node was down past hint window',
      [
        { id: 'down', label: 'node down' },
        { id: 'miss', label: 'missed writes' },
        { id: 'hint', label: 'hints expire' },
        { id: 'repair', label: 'repair' },
      ],
      [{ id: 'event', label: 'event' }, { id: 'result' }],
      [
        ['replica unavailable', 'other replicas accept writes'],
        ['some ranges diverge', 'eventual inconsistency'],
        ['hinted handoff not enough', 'manual convergence needed'],
        ['Merkle compare + stream', 'replicas converge'],
      ],
    ),
    highlight: { active: ['miss:result', 'hint:result'], found: ['repair:result'] },
    explanation: 'This is the complete operational reason repair exists. Eventual consistency needs a way to converge after failures that outlast fast-path mechanisms.',
  };

  yield {
    state: labelMatrix(
      'Operational guardrails',
      [
        { id: 'range', label: 'range scope' },
        { id: 'parallel', label: 'parallelism' },
        { id: 'gc', label: 'gc grace' },
        { id: 'metrics', label: 'metrics' },
      ],
      [{ id: 'question', label: 'question' }, { id: 'risk' }],
      [
        ['which token ranges?', 'too much work at once'],
        ['how many jobs?', 'network saturation'],
        ['repair before tombstones expire?', 'deleted data resurrection risk'],
        ['did streams finish?', 'false confidence'],
      ],
    ),
    highlight: { active: ['gc:risk', 'parallel:risk'], found: ['metrics:question'] },
    explanation: 'Repair is a data-structure case study and an operations case study. The Merkle tree identifies differences; the operator must still control blast radius.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'merkle comparison') yield* merkleComparison();
  else if (view === 'repair scheduling') yield* repairScheduling();
  else throw new InputError('Pick a Cassandra repair view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      {type:'callout', text:'Cassandra repair uses Merkle trees to make replica drift searchable, pruning equal token subranges and streaming only where digests disagree.'},
      {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/95/Hash_Tree.svg', alt:'Merkle hash tree with data blocks at leaves and combined hashes up to the root', caption:'A Merkle tree summarizes large state with nested hashes; Cassandra repair compares these summaries top down to find only the token subranges that differ. Source: Wikimedia Commons, David Gothberg and Azaghal, CC0.'},
      'Read a token range as a slice of the Cassandra keyspace owned by a replica set. Active nodes build or compare trees, and found nodes mark ranges that can be skipped or streamed. The safe inference rule is hash pruning: equal subtree digests let repair skip the whole subrange.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Cassandra is eventually consistent, so replicas can drift when a node is down, a partition delays traffic, hints expire, or reads do not touch every replica. Repair is the deliberate anti-entropy path. Anti-entropy means comparing replicas and fixing drift until a token range converges.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious repair is row-by-row comparison. Every replica sends every row in the range to every other replica, and mismatches are fixed directly. That is simple for a tiny table but wasteful when almost all rows already match.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is comparison cost plus tombstone safety. Repair must read enough data to prove agreement, but it should not ship every row just to find a few stale partitions. If a delete marker expires before the replica that missed it is repaired, old data can reappear.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Summarize each token range with a Merkle tree. Leaves hash smaller row ranges, and parents hash child digests. Equal parents are skipped; unequal parents tell repair where to descend next.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A repair coordinator selects token ranges and replicas. Each replica scans local data for the range and builds a Merkle tree. Participants compare roots, descend through mismatched branches, then stream rows or partitions for leaf ranges whose digests disagree.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'Hash equality is compositional. If every descendant row range is the same, the parent digest is the same; if a parent digest differs, at least one descendant differs, assuming practical collision resistance. The tree locates where detailed reconciliation is needed, while Cassandra timestamps and tombstones decide which value wins.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Repair costs disk IO to scan data, CPU to hash, memory to compare trees, and network to stream differences. When a token range doubles, validation scan work roughly doubles even if stream bytes stay small. Parallel repair shortens the calendar window by spending more disk and network capacity at once.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Cassandra repair is used after long node outages, missed hints, topology changes, and periodic consistency maintenance. The same digest-tree pattern appears in Dynamo-style anti-entropy, file synchronization, block verification, Git object transfer, and distributed backup systems.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Repair fails when it is treated as one safe global button. Tables differ in size, tombstone rate, compaction pressure, and business value. Running too late risks expired tombstones; running too aggressively steals IO, compaction capacity, and network from foreground traffic.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A range has replication factor 3, and replica C is down for 5 hours while A and B accept 1,000 writes. Hints replay 700 writes, so 300 mutations still require repair. Merkle comparison skips the matching left half, descends into the mismatching right half, finds three leaf ranges, and streams only those ranges to C.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Apache Cassandra repair documentation at https://cassandra.apache.org/doc/stable/cassandra/managing/operating/repair.html, hinted handoff at https://cassandra.apache.org/doc/stable/cassandra/managing/operating/hints.html, read repair at https://cassandra.apache.org/doc/stable/cassandra/managing/operating/read_repair.html, and Dynamo at https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf.',
      'Study Merkle Tree, Consistent Hashing, Dynamo Case Study, Hinted Handoff Replica Queue, Read Repair Digest Quorum, LSM Tombstones and Range Deletes, Gossip Protocol, and SWIM Failure Detector and Membership.',
    ] },
  ],
};
