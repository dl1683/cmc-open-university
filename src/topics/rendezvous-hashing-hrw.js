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
  yield {
    state: graphState({
      nodes: [
        { id: 'key', label: 'key', x: 0.8, y: 4.0, note: 'photo42' },
        { id: 'scoreA', label: 'A:72', x: 2.6, y: 4.0, note: 'hash' },
        { id: 'scoreB', label: 'B:91', x: 4.4, y: 4.0, note: 'hash' },
        { id: 'scoreC', label: 'C:37', x: 6.2, y: 4.0, note: 'hash' },
        { id: 'winner', label: 'B wins', x: 8.3, y: 4.0, note: 'max' },
      ],
      edges: [
        { id: 'e-key-a', from: 'key', to: 'scoreA' },
        { id: 'e-a-b', from: 'scoreA', to: 'scoreB' },
        { id: 'e-b-c', from: 'scoreB', to: 'scoreC' },
        { id: 'e-c-winner', from: 'scoreC', to: 'winner' },
      ],
    }, { title: 'For each key, hash the key with every node and pick max' }),
    highlight: { active: ['scoreA', 'scoreB', 'scoreC'], found: ['winner'] },
    explanation: 'Rendezvous hashing, also called highest-random-weight hashing, gives each node a score for the key. Every client that knows the same node set picks the same highest-scoring node.',
    invariant: 'Distributed agreement comes from deterministic scoring, not a coordinator.',
  };

  yield {
    state: labelMatrix(
      'One key, four nodes',
      [
        { id: 'A', label: 'node A' },
        { id: 'B', label: 'node B' },
        { id: 'C', label: 'node C' },
        { id: 'D', label: 'node D' },
      ],
      [
        { id: 'score', label: 'score' },
        { id: 'rank', label: 'rank' },
      ],
      [
        ['72', '2'],
        ['91', '1 owner'],
        ['37', '4'],
        ['69', '3'],
      ],
    ),
    highlight: { found: ['B:rank'], active: ['A:rank', 'D:rank'] },
    explanation: 'The full ranking is useful. The highest score owns the key; the next scores can be replicas or failover targets without adding a ring or virtual-node table.',
  };

  yield {
    state: labelMatrix(
      'Compare placement methods',
      [
        { id: 'mod', label: 'key mod N' },
        { id: 'ring', label: 'ring hash' },
        { id: 'hrw', label: 'HRW' },
        { id: 'maglev', label: 'Maglev' },
      ],
      [
        { id: 'state', label: 'metadata' },
        { id: 'churn', label: 'membership churn' },
      ],
      [
        ['none', 'huge remap'],
        ['tokens', 'small remap'],
        ['node list', 'small remap'],
        ['lookup table', 'small remap'],
      ],
    ),
    highlight: { found: ['hrw:state', 'hrw:churn'], compare: ['mod:churn', 'ring:state'] },
    explanation: 'HRW is often simpler than ring hashing: no token circle, no virtual-node metadata. The tradeoff is scoring each candidate node unless you add extra acceleration techniques.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'nodes', min: 1, max: 1000 }, y: { label: 'lookup work', min: 0, max: 100 } },
      series: [
        { id: 'hrw', label: 'basic HRW O(n)', points: [{ x: 1, y: 1 }, { x: 50, y: 10 }, { x: 250, y: 40 }, { x: 1000, y: 95 }] },
        { id: 'ring', label: 'ring O(log tokens)', points: [{ x: 1, y: 2 }, { x: 50, y: 8 }, { x: 250, y: 16 }, { x: 1000, y: 28 }] },
      ],
    }),
    highlight: { active: ['hrw'], compare: ['ring'] },
    explanation: 'The basic algorithm scores every node per lookup. That is fine for small or moderate node sets, but large fleets may need weighted HRW variants, candidate windows, or table-based schemes such as Maglev.',
  };
}

function* churnAndReplicas() {
  yield {
    state: graphState({
      nodes: [
        { id: 'rank1', label: 'B', x: 0.8, y: 4.0, note: 'rank 1' },
        { id: 'rank2', label: 'A', x: 2.7, y: 4.0, note: 'rank 2' },
        { id: 'rank3', label: 'D', x: 4.6, y: 4.0, note: 'rank 3' },
        { id: 'rank4', label: 'C', x: 6.5, y: 4.0, note: 'rank 4' },
        { id: 'replicas', label: 'top 3', x: 8.4, y: 4.0, note: 'replicas' },
      ],
      edges: [
        { id: 'e-r1-r2', from: 'rank1', to: 'rank2' },
        { id: 'e-r2-r3', from: 'rank2', to: 'rank3' },
        { id: 'e-r3-r4', from: 'rank3', to: 'rank4' },
        { id: 'e-r4-replicas', from: 'rank4', to: 'replicas' },
      ],
    }, { title: 'Top-k scores give replicas and failover order' }),
    highlight: { found: ['rank1', 'rank2', 'rank3', 'replicas'], compare: ['rank4'] },
    explanation: 'For replication factor k, take the top k nodes by score. If the owner is down, the next highest score is already the deterministic failover target.',
    invariant: 'A single ranking answers owner, replica, and fallback questions.',
  };

  yield {
    state: labelMatrix(
      'Removing a node',
      [
        { id: 'onB', label: 'keys owned by B' },
        { id: 'onA', label: 'keys owned by A' },
        { id: 'onC', label: 'keys owned by C' },
        { id: 'onD', label: 'keys owned by D' },
      ],
      [
        { id: 'afterBDown', label: 'after B down' },
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
    explanation: 'Only keys whose winning node disappeared need a new owner. Everyone else recomputes the same top score and stays put.',
  };

  yield {
    state: labelMatrix(
      'Weighted HRW idea',
      [
        { id: 'small', label: 'small node' },
        { id: 'medium', label: 'medium node' },
        { id: 'large', label: 'large node' },
      ],
      [
        { id: 'capacity', label: 'capacity' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['1x', 'normal odds'],
        ['2x', 'more wins'],
        ['4x', 'many wins'],
      ],
    ),
    highlight: { found: ['large:effect'], compare: ['small:effect'] },
    explanation: 'Real clusters are rarely identical. Weighted variants adjust scores so larger nodes win proportionally more keys while keeping deterministic agreement.',
  };

  yield {
    state: labelMatrix(
      'When HRW is a good fit',
      [
        { id: 'cache', label: 'cache shard' },
        { id: 'replica', label: 'replica set' },
        { id: 'publisher', label: 'pub/sub' },
        { id: 'huge', label: 'huge fleet' },
      ],
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
    explanation: 'HRW is strongest when the candidate set is manageable and deterministic top-k agreement matters. Massive node sets may prefer rings, tables, or optimized HRW variants.',
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
      heading: 'What it is',
      paragraphs: [
        'Rendezvous hashing, also called highest-random-weight or HRW hashing, is a distributed placement rule. For a key and a set of nodes, compute score = hash(key, node) for each node and choose the node with the highest score. Every client that knows the same node list and hash function reaches the same answer independently.',
        'This solves the same broad problem as Consistent Hashing: place keys across changing servers while minimizing disruption. The design is often simpler because there is no token ring or virtual-node table. The full score ranking also naturally gives replica order and failover order.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For one owner, rank all candidate nodes by hash(key, node) and pick rank one. For replication factor k, pick the top k. If a node leaves, only keys that had that node in their selected set need to move. A key owned by a surviving highest-scoring node remains mapped to the same node because the relative scores of surviving nodes do not change.',
        'Weighted HRW variants adjust the scoring rule so high-capacity nodes win more often. That matters when servers have different CPU, memory, disk, or network capacity. The algorithm still depends on all participants having the same membership and weight view; split-brain membership creates split-brain placement.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Basic HRW scores every node on every lookup, so lookup cost is O(n) in the number of candidates. That is acceptable for many cache and shard sets, but not for every large fleet. Ring hashing does a binary search over tokens, and Maglev uses a precomputed lookup table for very fast packet balancing. HRW spends per-lookup CPU to avoid ring metadata and make top-k agreement simple.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'Thaler and Ravishankar introduced highest-random-weight mapping as a name-based mapping method for increasing cache hit rates. HRW-style algorithms appear in distributed caches, load balancers, pub/sub systems, databases, and storage placement designs. IETF work on weighted HRW describes its use in load balancing and designated-forwarder election contexts where uniformity, weights, and minimal disruption matter.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'HRW is not always cheaper than consistent hashing. Its simplicity can become expensive when the candidate set is huge or when lookups sit on a very hot packet path. It also does not solve membership consensus. If two clients disagree about which nodes are alive, they may assign the same key differently. Treat the membership source as part of the data structure contract.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Thaler and Ravishankar HRW paper PDF at https://www.microsoft.com/en-us/research/wp-content/uploads/2017/02/HRW98.pdf, IEEE/ACM listing at https://www.computer.org/csdl/journal/nt/1998/01/00663936/13rRUxcKzTG, and IETF weighted HRW draft at https://www.ietf.org/archive/id/draft-ietf-bess-weighted-hrw-00.html. Study Consistent Hashing for token rings, Jump Consistent Hash Case Study for the constant-memory numbered-bucket variant, Load Balancer for routing policy, Maglev Load Balancer Case Study for table-based packet balancing, Sharding & Partitioning for logical ownership, and Hash Table for the key-scoring foundation.',
      ],
    },
  ],
};
