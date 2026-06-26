// Rendezvous / highest-random-weight hashing: score every node for a key and
// choose the highest scoring node or top-k nodes.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'rendezvous-hashing-hrw',
  title: 'Rendezvous Hashing (HRW)',
  category: 'Systems',
  summary: 'A simple distributed placement rule: score each node with hash(key, node), pick the highest score, and use the next scores for replicas or failover.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['winner selection', 'churn and replicas'], defaultValue: 'winner selection' },
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

function* winnerSelection() {
  const scoreNodes = [
    { id: 'scoreA', label: 'A:72', x: 2.6, y: 4.0, note: 'hash' },
    { id: 'scoreB', label: 'B:91', x: 4.4, y: 4.0, note: 'hash' },
    { id: 'scoreC', label: 'C:37', x: 6.2, y: 4.0, note: 'hash' },
  ];
  const winnerLabel = 'B wins';
  const nodes = [
    { id: 'key', label: 'key', x: 0.8, y: 4.0, note: 'photo42' },
    ...scoreNodes,
    { id: 'winner', label: winnerLabel, x: 8.3, y: 4.0, note: 'max' },
  ];
  const edges = [
    { id: 'e-key-a', from: 'key', to: 'scoreA' },
    { id: 'e-a-b', from: 'scoreA', to: 'scoreB' },
    { id: 'e-b-c', from: 'scoreB', to: 'scoreC' },
    { id: 'e-c-winner', from: 'scoreC', to: 'winner' },
  ];
  yield {
    state: graphState({ nodes, edges }, { title: 'For each key, hash the key with every node and pick max' }),
    highlight: { active: ['scoreA', 'scoreB', 'scoreC'], found: ['winner'] },
    explanation: `Rendezvous hashing, also called highest-random-weight hashing, gives each of ${scoreNodes.length} nodes a score for the key. Every client that knows the same node set picks the same highest-scoring node (${winnerLabel}).`,
    invariant: `Distributed agreement among ${nodes.length} participants comes from deterministic scoring, not a coordinator.`,
  };

  const matrixRows = [
    { id: 'A', label: 'node A' },
    { id: 'B', label: 'node B' },
    { id: 'C', label: 'node C' },
    { id: 'D', label: 'node D' },
  ];
  const scores = ['72', '91', '37', '69'];
  const ownerScore = scores[1];
  yield {
    state: labelMatrix(
      'One key, four nodes',
      matrixRows,
      [
        { id: 'score', label: 'score' },
        { id: 'rank', label: 'rank' },
      ],
      [
        [scores[0], '2'],
        [scores[1], '1 owner'],
        [scores[2], '4'],
        [scores[3], '3'],
      ],
    ),
    highlight: { found: ['B:rank'], active: ['A:rank', 'D:rank'] },
    explanation: `The full ranking across ${matrixRows.length} nodes is useful. The highest score (${ownerScore}) owns the key; the next scores can be replicas or failover targets without adding a ring or virtual-node table.`,
  };

  const methods = [
    { id: 'mod', label: 'key mod N' },
    { id: 'ring', label: 'ring hash' },
    { id: 'hrw', label: 'HRW' },
    { id: 'maglev', label: 'Maglev' },
  ];
  const hrwMeta = 'node list';
  yield {
    state: labelMatrix(
      'Compare placement methods',
      methods,
      [
        { id: 'state', label: 'metadata' },
        { id: 'churn', label: 'membership churn' },
      ],
      [
        ['none', 'huge remap'],
        ['tokens', 'small remap'],
        [hrwMeta, 'small remap'],
        ['lookup table', 'small remap'],
      ],
    ),
    highlight: { found: ['hrw:state', 'hrw:churn'], compare: ['mod:churn', 'ring:state'] },
    explanation: `Comparing ${methods.length} placement methods, HRW needs only a ${hrwMeta} — no token circle, no virtual-node metadata. The tradeoff is scoring each candidate node unless you add extra acceleration techniques.`,
  };

  const maxNodes = 1000;
  const series = [
    { id: 'hrw', label: 'basic HRW O(n)', points: [{ x: 1, y: 1 }, { x: 50, y: 10 }, { x: 250, y: 40 }, { x: 1000, y: 95 }] },
    { id: 'ring', label: 'ring O(log tokens)', points: [{ x: 1, y: 2 }, { x: 50, y: 8 }, { x: 250, y: 16 }, { x: 1000, y: 28 }] },
  ];
  yield {
    state: plotState({
      axes: { x: { label: 'nodes', min: 1, max: maxNodes }, y: { label: 'lookup work', min: 0, max: 100 } },
      series,
    }),
    highlight: { active: ['hrw'], compare: ['ring'] },
    explanation: `The basic algorithm scores every node per lookup, comparing ${series.length} strategies up to ${maxNodes} nodes. That is fine for small or moderate node sets, but large fleets may need weighted HRW variants, candidate windows, or table-based schemes such as Maglev.`,
  };
}

function* churnAndReplicas() {
  const rankedNodes = [
    { id: 'rank1', label: 'B', x: 0.8, y: 4.0, note: 'rank 1' },
    { id: 'rank2', label: 'A', x: 2.7, y: 4.0, note: 'rank 2' },
    { id: 'rank3', label: 'D', x: 4.6, y: 4.0, note: 'rank 3' },
    { id: 'rank4', label: 'C', x: 6.5, y: 4.0, note: 'rank 4' },
  ];
  const replicaCount = 3;
  const churnNodes = [
    ...rankedNodes,
    { id: 'replicas', label: `top ${replicaCount}`, x: 8.4, y: 4.0, note: 'replicas' },
  ];
  const churnEdges = [
    { id: 'e-r1-r2', from: 'rank1', to: 'rank2' },
    { id: 'e-r2-r3', from: 'rank2', to: 'rank3' },
    { id: 'e-r3-r4', from: 'rank3', to: 'rank4' },
    { id: 'e-r4-replicas', from: 'rank4', to: 'replicas' },
  ];
  yield {
    state: graphState({ nodes: churnNodes, edges: churnEdges }, { title: 'Top-k scores give replicas and failover order' }),
    highlight: { found: ['rank1', 'rank2', 'rank3', 'replicas'], compare: ['rank4'] },
    explanation: `For replication factor k, take the top k nodes by score. With ${rankedNodes.length} ranked candidates and k=${replicaCount}, if the owner is down, the next highest score is already the deterministic failover target.`,
    invariant: `A single ranking of ${rankedNodes.length} nodes answers owner, replica, and fallback questions.`,
  };

  const removalRows = [
    { id: 'onB', label: 'keys owned by B' },
    { id: 'onA', label: 'keys owned by A' },
    { id: 'onC', label: 'keys owned by C' },
    { id: 'onD', label: 'keys owned by D' },
  ];
  const removedNode = 'B';
  const survivorCount = removalRows.length - 1;
  yield {
    state: labelMatrix(
      'Removing a node',
      removalRows,
      [
        { id: 'afterBDown', label: `after ${removedNode} down` },
        { id: 'movement', label: 'movement' },
      ],
      [
        ['next best', 'move'],
        ['stay A', 'none'],
        ['stay C', 'none'],
        ['stay D', 'none'],
      ],
    ),
    highlight: { active: ['onB:movement'], found: ['onA:movement', 'onC:movement', 'onD:movement'] },
    explanation: `Only keys whose winning node (${removedNode}) disappeared need a new owner. The other ${survivorCount} owners recompute the same top score and stay put.`,
  };

  const weightTiers = [
    { id: 'small', label: 'small node' },
    { id: 'medium', label: 'medium node' },
    { id: 'large', label: 'large node' },
  ];
  const largestCapacity = '4x';
  yield {
    state: labelMatrix(
      'Weighted HRW idea',
      weightTiers,
      [
        { id: 'capacity', label: 'capacity' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['1x', 'normal odds'],
        ['2x', 'more wins'],
        [largestCapacity, 'many wins'],
      ],
    ),
    highlight: { found: ['large:effect'], compare: ['small:effect'] },
    explanation: `Real clusters are rarely identical. Across ${weightTiers.length} capacity tiers (up to ${largestCapacity}), weighted variants adjust scores so larger nodes win proportionally more keys while keeping deterministic agreement.`,
  };

  const useCases = [
    { id: 'cache', label: 'cache shard' },
    { id: 'replica', label: 'replica set' },
    { id: 'publisher', label: 'pub/sub' },
    { id: 'huge', label: 'huge fleet' },
  ];
  const goodFitCount = 3;
  yield {
    state: labelMatrix(
      'When HRW is a good fit',
      useCases,
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['good', 'simple owner'],
        ['good', 'top-k order'],
        ['good', 'agreement'],
        ['careful', 'O(n) scoring'],
      ],
    ),
    highlight: { found: ['cache:fit', 'replica:fit', 'publisher:fit'], compare: ['huge:reason'] },
    explanation: `Of ${useCases.length} use cases examined, ${goodFitCount} are a good fit for HRW where the candidate set is manageable and deterministic top-k agreement matters. Massive node sets may prefer rings, tables, or optimized HRW variants.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'winner selection') yield* winnerSelection();
  else if (view === 'churn and replicas') yield* churnAndReplicas();
  else throw new InputError('Pick a rendezvous hashing view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read each row as one key choosing among candidate nodes. The score beside each node is a stable hash of the pair (key, node). The winner is the node with the highest score for that key.',
        'When a node disappears, only keys that ranked that node first must move. Every other key keeps the same winner because its score order among surviving nodes did not change.',
        {type: 'image', src: './assets/gifs/rendezvous-hashing-hrw.gif', alt: 'Animated walkthrough of the rendezvous hashing hrw visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Distributed systems need to assign keys to nodes. A cache key needs a cache server, an object needs a storage shard, and a replica set needs an ordered preference list. The assignment should be stable when the cluster changes.',
        'Rendezvous hashing, also called highest-random-weight hashing, gives each key an independent ranking of all nodes. The top node owns the key, and the next nodes form natural failover or replica choices.',
        {type: 'callout', text: 'HRW assigns a key by ranking every candidate with a stable score, so failover and replication fall out of the same ordered list.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is key_hash % node_count. It is simple, fast, and gives a roughly even spread when the node count is fixed. Many learners meet sharding this way first.',
        'That rule breaks when the node count changes. Adding one node changes the modulus, so most keys get a different owner. A cache cluster using modulo can lose most of its warm data after a single scale-out.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is remapping cost. A good assignment rule should move only the keys that truly need to move when a node joins or leaves. Modulo hashing changes the coordinate system for every key.',
        'Consistent hashing rings reduce remapping, but they introduce token placement and ring-walk metadata. Rendezvous hashing takes a different route: score every candidate for the key and choose the best score.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The key does not need a global ring position. It needs a stable preference order over nodes. Hashing the pair (key, node) gives each node a deterministic random-looking score for that key.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/71/Consistent_Hashing_Sample_Illustration.png', alt: 'Consistent hashing ring with servers placed around a circle', caption: 'A ring is the common contrast: rendezvous hashing avoids token-circle metadata by scoring each candidate for the key directly. Source: https://commons.wikimedia.org/wiki/File:Consistent_Hashing_Sample_Illustration.png.'},
        'Because the score for an unchanged node does not change, adding a new node only affects keys where the newcomer scores highest. Removing a node only affects keys that had that node as winner.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a key K and each node N, compute score = hash(K, N). Pick the node with the largest score. For replication factor r, sort nodes by score and take the top r.',
        'Weighted HRW changes the score calculation so larger nodes win more often. The key idea stays the same: the ordered list is computed from stable pairwise scores, not from mutable cluster position.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness for lookup is deterministic. Every client with the same key, node list, hash function, and tie-break rule computes the same scores and picks the same winner. No shared routing table is needed beyond membership.',
        'Minimal movement follows from score stability. Removing node X cannot change the relative order of A, B, and C, so keys owned by A, B, or C stay there. Only keys whose top score belonged to X need a new owner.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A naive lookup scores every node, so time is O(n) per key and memory is O(1) beyond the membership list. Replication by full sorting costs O(n log n), though selecting top r can be done in O(n log r).',
        'When node count doubles, per-key scoring work roughly doubles. That is the main tax compared with ring hashing. In return, HRW avoids virtual-node tables and gives replica order directly.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'HRW fits distributed caches, object storage placement, service routing, and leader selection for partitioned work. It is useful when all clients can know the candidate set and need the same answer without a central coordinator.',
        'It also works well for failover. If the first node is down, the client tries the next highest-scoring node for the same key. That preserves a stable preference order instead of choosing a random backup each time.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'HRW is expensive when the candidate set is huge and every lookup must be microsecond-fast. Scoring 10,000 nodes per key may be too much for a hot path. Ring methods or hierarchical placement can reduce the candidate count.',
        'It also depends on consistent membership. If two clients disagree about which nodes exist, they can route the same key to different owners. Weight changes can move many keys, so capacity changes should be rolled out carefully.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use key user:42 and nodes A, B, C. Suppose hash(user:42, A) = 0.72, hash(user:42, B) = 0.19, and hash(user:42, C) = 0.88. C wins because 0.88 is highest.',
        'For two replicas, the order is C, A, B. If C fails, A becomes the owner without recomputing any global table. If new node D joins with score 0.41 for this key, the winner stays C because 0.41 is not highest.',
        'For another key, D might score 0.97 and become owner. That key moves to D, but keys where D does not beat the old winner stay put. The remapping is selective rather than global.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Thaler and Ravishankar, Using Name-Based Mappings to Increase Hit Rates, 1998, which introduced rendezvous hashing. Study related production material on consistent hashing and distributed cache placement.',
        'Study next: hash functions for pair scoring, consistent hashing for ring-based placement, load balancing for capacity weights, and distributed membership protocols for keeping clients in agreement.',
      ],
    },
  ],
};