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
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'Cassandra repair uses Merkle trees to make replica drift searchable, pruning equal token subranges and streaming only where digests disagree.'},
        'Cassandra chooses availability and partition tolerance over one global synchronous copy of the data. That choice lets replicas accept work during outages, but it also means replicas can drift when a node is down, a partition delays traffic, hinted handoff expires, or reads do not touch every owner of a token range.',
        'Repair is the deliberate anti-entropy path. It is the mechanism that says: for this token range and this replica set, prove which subranges match, find the subranges that do not, and stream the missing or stale rows until the replicas converge.',
      ],
    },
    {
      heading: 'The obvious attempt',
      paragraphs: [
        'The simple repair plan is to have every replica send every row to every other replica and compare values directly. That is easy to reason about for a tiny table: if two replicas list all rows, any missing or stale row is visible.',
        'The wall is scale. A Cassandra table can hold large token ranges, and most rows may already match. Full row-by-row comparison turns a small inconsistency into a large disk, CPU, memory, and network job. It also competes with foreground reads and writes while the cluster is already recovering from trouble.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A Merkle tree turns comparison into pruning. Each replica hashes rows into leaves for a token range and combines those hashes upward. If two subtree hashes match, the whole subrange can be skipped. If they differ, repair descends only into that subrange.',
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/95/Hash_Tree.svg', alt:'Merkle hash tree with data blocks at leaves and combined hashes up to the root', caption:'A Merkle tree summarizes large state with nested hashes; Cassandra repair compares these summaries top down to find only the token subranges that differ. Source: Wikimedia Commons, David Gothberg and Azaghal, CC0.'},
        'The invariant is simple: a matching hash stands for matching contents under that subtree, assuming the hash function does not collide in practice. Repair spends detailed work only where the digest proves that two replicas disagree.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The Merkle-comparison view is about pruning work. A matching root hash means the compared range can stop immediately. A mismatched root does not identify the row by itself; it tells repair where to descend next.',
        'The repair-scheduling view is about operational safety. Building trees is only the detection phase. Streaming rows, throttling traffic, staying inside the tombstone window, and recording completion are what turn detection into restored replica convergence.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A repair coordinator selects token ranges and the replicas responsible for them. Each replica validates its local data by building a Merkle tree for the requested range. The participants compare roots first, then descend through mismatched branches until they know which leaf ranges need data transfer.',
        'After mismatch ranges are identified, replicas stream the needed rows. The tree comparison decides what to stream; the streaming phase actually changes state. A completed repair therefore needs both comparison evidence and stream completion evidence.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Repair works because hash equality is compositional. If every row hash under a subtree is the same on two replicas, the parent hash is the same. If a parent hash differs, at least one descendant differs. That gives the algorithm a safe search rule: skip equal subtrees and refine unequal ones.',
        'The algorithm is useful even though it is probabilistic at the hash level. Production systems treat strong digest collisions as negligible compared with ordinary hardware and operational failures, then use row streaming and normal write reconciliation rules to bring replicas back together.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Repair consumes disk IO to scan data, CPU to hash it, memory to hold comparison state, and network to stream differences. Full repair checks all data in a range. Incremental repair reduces repeated work but adds repair metadata and workflow complexity. Read repair fixes inconsistencies discovered on read paths, but it does not replace planned anti-entropy repair.',
        'The tree shape matters. Coarse trees can make one mismatch stream a large subrange. Very fine trees reduce extra streaming but increase comparison metadata and build cost. Parallel repair can shorten the calendar window while saturating links, disks, and compaction capacity.',
        'Tombstones make cadence part of correctness. If a delete expires before a replica that missed the delete is repaired, old data can reappear. Repair is therefore not just housekeeping; it protects deletion semantics.',
      ],
    },
    {
      heading: 'Repair cadence',
      paragraphs: [
        'A cluster needs a repair schedule that is tied to garbage collection grace, replica availability, and operational load. Running repair too rarely risks expired tombstones and stale replicas. Running it too aggressively can steal disk, compaction, and network capacity from live traffic.',
        'The useful mental model is a maintenance ledger by keyspace, table, token range, replica set, start time, finish time, streamed bytes, and failures. Without that ledger, a team can say repair was launched without being able to prove which ranges actually converged.',
        'That evidence matters after incidents. If a customer reports stale data, the operator should be able to ask which replicas owned the token range, whether repair compared them, whether any stream failed, and whether a later compaction or tombstone expiry changed the safety picture.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Merkle-tree repair wins when replicas are mostly equal and the cluster needs a bounded way to find the few ranges that drifted. It is a good fit for background convergence, node-return catchup after the hint window, and audits that need evidence by token range.',
        'It also teaches a broader systems pattern: summarize large state with a tree of digests, compare summaries top down, and spend expensive work only where the summaries disagree. The same idea appears in Dynamo-style anti-entropy and many storage synchronization systems.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Repair is the wrong first tool for a short missed write when hinted handoff can replay the exact mutation cheaply. It is also a poor fit for an overloaded cluster if the repair job is allowed to compete with foreground traffic without throttles and observability.',
        'It cannot fix a broken failure model by itself. Bad clocks, corrupted data, expired tombstones, incorrect token ownership, or missing completion evidence can still leave the operator with inconsistent data or false confidence.',
        'It also fails when treated as a single global button. Different tables have different sizes, tombstone rates, compaction pressure, and business value. A good repair plan scopes work deliberately instead of asking one cluster-wide job to be safe for every workload.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A replica is down longer than the hint window. Other replicas continue accepting writes. When the node returns, some token ranges are stale and no exact hint queue remains. A repair job scopes the affected token ranges, asks each owner to build a Merkle tree, compares hashes, and streams only the ranges that differ.',
        'The safe operating pattern is concrete: limit the range scope, cap parallelism, watch stream completion, keep repair inside the tombstone safety window, and record which ranges finished. Without that evidence, a cluster can look healthy while some replica ranges remain unrepaired.',
        'The deeper lesson is that repair is both an algorithm and a maintenance contract. The Merkle tree can tell you where replicas disagree, but the organization has to decide how often to run repair, what load it may consume, what evidence proves completion, and how repair status is reported during incident review.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: Apache Cassandra repair documentation, https://cassandra.apache.org/doc/4.0/cassandra/operating/repair.html, Cassandra Dynamo architecture notes, https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html, Cassandra hinted handoff documentation, https://cassandra.apache.org/doc/4.0/cassandra/operating/hints.html, and Cassandra read repair documentation, https://cassandra.apache.org/doc/latest/cassandra/managing/operating/read_repair.html.',
        'Study Hinted Handoff Replica Queue for the short-outage fast path, Read Repair Digest Quorum for repair during reads, LSM Tombstones & Range Deletes for delete safety, Merkle Tree for the digest structure, Dynamo Case Study for anti-entropy lineage, Gossip Protocol and SWIM Failure Detector & Membership for node liveness, Consistent Hashing for token ownership, and S3 Object Storage for another durability-oriented storage design.',
      ],
    },
  ],
};
