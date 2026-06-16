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
    { heading: 'What it is', paragraphs: [
      'Cassandra repair is the anti-entropy process that synchronizes replicas. In an eventually consistent system, replicas can diverge because nodes were unavailable, hints expired, reads did not touch every replica, or network partitions delayed writes. Repair compares replica data for token ranges and streams differences until replicas converge.',
      'Merkle trees make the comparison efficient. Instead of sending every row to every peer, each replica builds a hierarchy of hashes. Equal hashes prune whole subranges; mismatched hashes cause repair to descend until it finds ranges that need streaming.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A repair coordinator selects a token range and the replicas responsible for it. Each replica validates its data by building a Merkle tree. The coordinator or repair participants compare the trees, identify mismatched subranges, and stream the necessary rows between replicas.',
      'This is similar in spirit to Dynamo-style anti-entropy, but the operational context matters. Cassandra tables, token ranges, compaction, tombstones, and consistency settings shape how expensive and how urgent repair is.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Repair consumes disk IO, CPU, memory, and network. Full repair checks all data in the range; incremental repair focuses on data since prior repair but introduces its own state and workflow. Read repair handles inconsistencies seen during reads, but it does not replace planned anti-entropy repair.',
      'The classic operational risk is tombstone resurrection. If deletes expire before replicas that missed the delete are repaired, old data can reappear. That makes repair cadence part of correctness, not only maintenance.',
      'Merkle-tree resolution also controls how much data is streamed. If the tree is too coarse, one mismatch can force a large subrange to stream. If repair is too parallel, the cluster can spend more time repairing than serving foreground traffic.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'Suppose a replica is down long enough that hinted handoff is insufficient. Other replicas continue accepting writes. When the node returns, some token ranges are stale. A repair job builds Merkle trees for those ranges, compares hashes, and streams the differences so the returned node catches up.',
      'The case study links Merkle Tree, Dynamo, and production operations. The data structure identifies divergence efficiently, but safe repair also requires careful scheduling, throttling, observability, and understanding of deletion semantics.',
      'A mature repair plan usually scopes work by token range, watches streaming metrics, and records completion evidence. Without that evidence, a cluster can look healthy while some replica ranges remain unrepaired.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: Apache Cassandra repair documentation, https://cassandra.apache.org/doc/4.0/cassandra/operating/repair.html, Cassandra Dynamo architecture notes, https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html, Cassandra hinted handoff documentation, https://cassandra.apache.org/doc/4.0/cassandra/operating/hints.html, and Cassandra read repair documentation, https://cassandra.apache.org/doc/latest/cassandra/managing/operating/read_repair.html. Study Read Repair Digest Quorum, Hinted Handoff Replica Queue, LSM Tombstones & Range Deletes, Merkle Tree, Dynamo Case Study, Gossip Protocol, SWIM Failure Detector & Membership, Consistent Hashing, and S3 Object Storage next.',
    ] },
  ],
};
