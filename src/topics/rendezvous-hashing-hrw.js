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
      heading: 'Why rendezvous hashing exists',
      paragraphs: [
        'A distributed cache, shard map, or load balancer often needs every client to choose the same owner for a key without consulting a central table. The owner should change only when the winning node leaves or a stronger candidate joins.',
        'Rendezvous hashing, also called highest-random-weight hashing, solves that placement problem with scoring instead of a ring. It is especially useful when the full ranked list of owners matters for replication or failover.',
        {type: 'callout', text: 'HRW assigns a key by ranking every candidate with a stable score, so failover and replication fall out of the same ordered list.'},
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is `hash(key) mod N`. It is simple and stateless, but when N changes most keys move. That is unacceptable for caches and storage systems because membership churn causes large migrations and cache misses.',
        'Consistent hashing rings improve churn by placing nodes on a token circle, but rings need token metadata, virtual nodes, and extra care around replica choice and capacity weighting.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/71/Consistent_Hashing_Sample_Illustration.png', alt: 'Consistent hashing ring with servers placed around a circle', caption: 'A ring is the common contrast: rendezvous hashing avoids token-circle metadata by scoring each candidate for the key directly. Source: https://commons.wikimedia.org/wiki/File:Consistent_Hashing_Sample_Illustration.png.'},
        'Rendezvous hashing attacks the problem from another angle: rank every candidate for the key. The top rank owns it. The next ranks are deterministic backups. There is no ring to walk and no per-key table to store.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'For each key, compute score = hash(key, node) for every candidate node. The highest score owns the key. The next highest scores are already the deterministic replica and failover order.',
        'The invariant is score stability. Removing one node does not change the scores of surviving nodes, so a key whose winner survives keeps the same owner. Only keys that chose the removed node have to move.',
        'Adding a node is similarly local. Existing keys move only if the new node scores higher than their current winner. That gives the minimum-disruption behavior people want from consistent placement.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The winner-selection view turns placement into a ranked election. The key is combined with each node identity, each combination receives a deterministic score, and the maximum score wins. There is no token circle, no probe sequence, and no stored owner row for the key.',
        'The score table is also a replica table. Rank one is primary. Rank two and rank three are backups. This is why HRW is useful when the system needs a stable top-k order, not just one bucket.',
        'The churn view isolates the important movement rule. Scores for surviving nodes do not change when one node disappears, so only keys that had the missing node at rank one need a new primary. The same ranking immediately gives the failover target.',
        'The lookup-work plot shows the main tradeoff. Basic HRW spends almost no memory on metadata, but it pays by scoring the candidate set during lookup. That is acceptable for many storage and cache systems and too expensive for some packet-level paths.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each participant must know the same node set, weights, and hash function. For one owner, score all candidates and take rank one. For replication factor k, take the top k distinct nodes. If the highest-ranked node is down, the next rank is the agreed failover target.',
        'Weighted HRW variants change the score calculation so larger nodes win proportionally more keys. The placement rule is still local and deterministic, but membership and weights must come from a trustworthy source.',
        'The node identity used in the hash must be stable. A node should not change identity because it restarts, changes IP address, or receives a new connection count. If identity churn is too frequent, HRW will move keys even when the underlying capacity did not really change.',
        'The hash output should be wide and uniform enough that ties are effectively impossible. If ties still matter, use a deterministic tie-breaker such as node id order. Never let two clients break ties differently, because that turns a rare hash event into split ownership.',
      ],
    },
    {
      heading: 'Membership and weights',
      paragraphs: [
        'Rendezvous hashing is deterministic only after membership is agreed. If client A thinks nodes are A, B, C and client B thinks nodes are A, C, D, they can make different placement decisions for the same key. The membership source is therefore part of the algorithm, not an external detail.',
        'Weights express capacity. A node with twice the memory or bandwidth should receive roughly twice as many keys, but the exact method matters. Some weighted HRW formulas transform the random score by weight; others create multiple logical identities per physical node. Both need tests for skew, movement, and failure behavior.',
        'Health should usually be layered carefully. Removing an unhealthy node from the candidate set gives immediate failover, but flapping health checks can cause needless movement. Many systems distinguish hard removal, temporary avoidance, and background rebalancing so that placement does not oscillate during partial outages.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proof is direct. A key is assigned to the maximum score among the current candidates. If a non-winning node disappears, the maximum is unchanged. If the winning node disappears, the maximum among survivors becomes the next highest score. No surviving pair changed relative order.',
        'That same ranking explains replica order. The top k scores are deterministic, so independent clients agree on primary, backup, and fallback without storing a ring or per-key table.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'For key `photo42`, suppose nodes score A=72, B=91, C=37, D=69. B owns the key. If replication factor is three, the replica order is B, A, D. If B disappears, A becomes primary and D stays a replica. C does not suddenly receive the key because its score was already lower than A and D.',
        'Now add node E. Only keys where E scores higher than their current winner move to E. The rest of the keyspace remains stable because their old winner still has the highest score among old and new candidates.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Basic HRW is O(n) per lookup because it scores every candidate node. Memory is small because there is no token table. This is a good trade when n is modest and deterministic top-k placement is valuable.',
        'For very large fleets or very hot packet paths, O(n) scoring can be too expensive. Ring hashing uses O(log T) token lookup, Jump uses little metadata for numbered buckets, and Maglev spends memory on a precomputed table to make lookup extremely cheap.',
        'The movement cost is the reason HRW is attractive. Removing one node moves only the keys that ranked that node first. Adding one node moves only the keys for which the newcomer outranks the previous winner. That is the same practical promise as consistent hashing: capacity changes should not reshuffle the whole keyspace.',
        'Replica selection has a cost benefit too. A ring often needs extra rules to avoid placing replicas on the same failure domain. HRW can rank eligible candidates after filtering by rack, zone, tenant, or shard group. The ranking remains deterministic as long as every participant applies the same filter.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'HRW fits distributed caches, storage placement, pub/sub partition ownership, and designated-forwarder election where every participant must independently reach the same ranked answer. It is easier to explain and operate than a token ring when the candidate set is not huge.',
        'It is especially clean for replication factor k: take the top k scores. The algorithm gives primary and backup order in one pass.',
        'It also fits systems that need auditable placement decisions. Given the key, membership list, weights, hash function, and policy filters, an operator can recompute the ranking and explain exactly why a node was chosen.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Version the placement inputs. A useful debug record includes the key or key hash, membership version, node ids, weights, exclusion policy, hash function version, and winning rank. Without those fields, a placement dispute becomes guesswork.',
        'Test churn directly. For a sample keyspace, remove each node, add a new node, change weights, and measure how many keys move. The movement should match the expected capacity change. Large unexpected movement usually means identity, membership, tie-breaking, or weight handling is unstable.',
        'Separate ownership from live load balancing. HRW chooses where a key belongs. It does not know queue depth, CPU saturation, or tail latency unless those signals are deliberately folded into eligibility. For request routing, many systems combine stable affinity from HRW with a second-stage load-balancing rule inside the eligible set.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'HRW does not solve membership consensus. If two clients disagree about which nodes are alive, they may assign the same key differently. Treat the membership source as part of the data structure contract.',
        'It also does not make heterogeneous capacity automatic. Weighting must be designed into the score rule, and bad weights can create skew even when the hash function is uniform.',
        'It can also be the wrong choice when lookup must be constant-time across thousands of candidates on a very hot path. In that setting, a precomputed table, a ring with many tokens, or Jump-style bucket assignment may fit the latency budget better.',
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
