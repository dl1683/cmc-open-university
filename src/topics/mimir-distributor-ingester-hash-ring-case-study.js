// Grafana Mimir-style ingestion: distributors validate remote-write traffic,
// hash series, replicate to ingesters in a ring, and survive rolling changes.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'mimir-distributor-ingester-hash-ring-case-study',
  title: 'Mimir Distributor/Ingester Hash Ring Case Study',
  category: 'Systems',
  summary: 'How a Mimir-style metrics backend validates remote-write batches, hashes series onto an ingester ring, replicates writes, and handles ring churn.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['ingest ring', 'churn case'], defaultValue: 'ingest ring' },
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

function ringGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'prom', label: 'Prom', x: 0.7, y: 3.8, note: notes.prom ?? 'remote write' },
      { id: 'dist', label: 'dist', x: 2.4, y: 3.8, note: notes.dist ?? 'validate' },
      { id: 'limits', label: 'limits', x: 2.4, y: 6.0, note: notes.limits ?? 'tenant' },
      { id: 'hash', label: 'hash', x: 4.1, y: 3.8, note: notes.hash ?? 'series' },
      { id: 'ring', label: 'ring', x: 5.8, y: 3.8, note: notes.ring ?? 'tokens' },
      { id: 'ingA', label: 'ingA', x: 7.6, y: 1.7, note: notes.ingA ?? 'ACTIVE' },
      { id: 'ingB', label: 'ingB', x: 8.8, y: 3.8, note: notes.ingB ?? 'ACTIVE' },
      { id: 'ingC', label: 'ingC', x: 7.6, y: 5.9, note: notes.ingC ?? 'ACTIVE' },
      { id: 'store', label: 'store', x: 9.8, y: 3.8, note: notes.store ?? 'blocks' },
    ],
    edges: [
      { id: 'e-prom-dist', from: 'prom', to: 'dist', weight: 'POST' },
      { id: 'e-dist-limits', from: 'dist', to: 'limits', weight: 'check' },
      { id: 'e-dist-hash', from: 'dist', to: 'hash', weight: 'labels' },
      { id: 'e-hash-ring', from: 'hash', to: 'ring', weight: 'token' },
      { id: 'e-ring-ingA', from: 'ring', to: 'ingA', weight: 'RF' },
      { id: 'e-ring-ingB', from: 'ring', to: 'ingB', weight: 'RF' },
      { id: 'e-ring-ingC', from: 'ring', to: 'ingC', weight: 'RF' },
      { id: 'e-ingA-store', from: 'ingA', to: 'store', weight: 'flush' },
      { id: 'e-ingB-store', from: 'ingB', to: 'store', weight: 'flush' },
      { id: 'e-ingC-store', from: 'ingC', to: 'store', weight: 'flush' },
    ],
  }, { title });
}

function* ingestRing() {
  yield {
    state: ringGraph('Distributors receive remote-write traffic for tenants'),
    highlight: { active: ['prom', 'dist', 'limits', 'e-prom-dist', 'e-dist-limits'], compare: ['ingA', 'ingB', 'ingC'] },
    explanation: 'A Mimir-style backend starts with distributors. They receive remote-write requests, validate samples and labels, enforce tenant limits, and prepare series for sharding.',
    invariant: 'Distributors are stateless in the hot path; ingesters own recent series state.',
  };

  yield {
    state: ringGraph('A series hash chooses owners in the ingester ring', { hash: 'fnv32a', ring: 'token lookup' }),
    highlight: { active: ['dist', 'hash', 'ring', 'e-dist-hash', 'e-hash-ring'], found: ['ingA', 'ingB', 'ingC'] },
    explanation: 'The distributor hashes the series identity and looks that token up in the ingester hash ring. The ring maps token ranges to ingesters so series ownership is stable enough for high-rate ingestion.',
  };

  yield {
    state: ringGraph('Replication sends each series to several ingesters', { ring: 'RF=3', ingA: 'owner 1', ingB: 'owner 2', ingC: 'owner 3' }),
    highlight: { active: ['ring', 'ingA', 'ingB', 'ingC', 'e-ring-ingA', 'e-ring-ingB', 'e-ring-ingC'], compare: ['store'] },
    explanation: 'With replication, a write goes to the primary owner and additional ring successors. Replication protects recent in-memory samples while ingesters later flush blocks or chunks to durable object storage.',
  };

  yield {
    state: labelMatrix(
      'Ingest path objects',
      [
        { id: 'tenant', label: 'tenant' },
        { id: 'series', label: 'series' },
        { id: 'token', label: 'token' },
        { id: 'ring', label: 'ring' },
        { id: 'rf', label: 'RF' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['limits', 'abuse'],
        ['hash key', 'card'],
        ['position', 'skew'],
        ['owners', 'churn'],
        ['copies', 'cost'],
      ],
    ),
    highlight: { active: ['series:role', 'token:role', 'ring:role'], compare: ['rf:risk'] },
    explanation: 'The core data structures are tenant limit ledgers, series hashes, token ranges, ring membership, and replication sets. Cardinality and churn are the operational enemies.',
  };
}

function* churnCase() {
  yield {
    state: ringGraph('A new ingester joins the ring before owning traffic', { ingC: 'JOINING', ring: 'token update' }),
    highlight: { active: ['ring', 'ingC', 'e-ring-ingC'], compare: ['ingA', 'ingB'] },
    explanation: 'Ring members move through lifecycle states. A joining ingester should become visible safely before it receives full ownership of series traffic.',
    invariant: 'Membership state is part of correctness, not just service discovery.',
  };

  yield {
    state: labelMatrix(
      'Ring state ledger',
      [
        { id: 'join', label: 'JOIN' },
        { id: 'active', label: 'ACTIVE' },
        { id: 'leave', label: 'LEAVE' },
        { id: 'unhealthy', label: 'BAD' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['warm', 'miss'],
        ['own', 'load'],
        ['handoff', 'gap'],
        ['skip', 'quorum'],
      ],
    ),
    highlight: { active: ['join:meaning', 'active:meaning', 'leave:meaning'], compare: ['unhealthy:risk'] },
    explanation: 'The ring is a live data structure. Join, active, leave, and unhealthy states change which ingesters are selected and whether writes can achieve the required acknowledgments.',
  };

  yield {
    state: ringGraph('A distributor must see enough healthy owners', { ingA: 'ACTIVE', ingB: 'UNHEALTHY', ingC: 'ACTIVE', dist: 'need quorum' }),
    highlight: { active: ['dist', 'ring', 'ingA', 'ingC', 'e-ring-ingA', 'e-ring-ingC'], removed: ['ingB'], compare: ['limits'] },
    explanation: 'If one replica is unhealthy, writes may still succeed when enough owners acknowledge. If too many replicas are unavailable or ring views diverge, ingestion must fail rather than silently under-replicate.',
  };

  yield {
    state: labelMatrix(
      'Operational controls',
      [
        { id: 'tokens', label: 'tokens' },
        { id: 'kv', label: 'KV' },
        { id: 'limits', label: 'limits' },
        { id: 'zone', label: 'zone' },
        { id: 'alert', label: 'alert' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'bad', label: 'if bad' },
      ],
      [
        ['balanced', 'skew'],
        ['healthy', 'split'],
        ['per tenant', 'noisy'],
        ['spread', 'blast'],
        ['ring lag', 'stale'],
      ],
    ),
    highlight: { active: ['tokens:check', 'kv:check', 'zone:check'], compare: ['alert:bad'] },
    explanation: 'A production ring needs balanced tokens, reliable KV/memberlist propagation, tenant limits, zone-aware replication, and alerts for unhealthy members or ring disagreement.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'ingest ring') yield* ingestRing();
  else if (view === 'churn case') yield* churnCase();
  else throw new InputError('Pick a Mimir hash-ring view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The ingest-ring view follows one Prometheus remote-write series from distributor to ingesters. A series identity is the metric name plus labels for one tenant. Active nodes are handling the write now, found nodes are selected owners, and compare nodes check lifecycle state, zone placement, and acknowledgments.',
        'The churn-case view shows why membership is part of correctness. Joining, active, leaving, and unhealthy ingesters are not equal write targets. The safe inference is that a write is accepted only when enough valid owners for that series acknowledge it under the current ring policy.',
        {type:'callout', text:'A Mimir-style ring maps each series key to replicated ingester owners, but write safety depends on membership state and acknowledgments.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A long-term metrics backend must accept high-rate remote-write traffic from many tenants. Recent samples cannot all land on one machine, and the system must survive rolling upgrades, node failures, and tenant bursts. The write path needs deterministic sharding plus replication.',
        'Mimir splits the work between distributors and ingesters. Distributors receive and validate writes, while ingesters own recent in-memory series before data is flushed to durable storage. A hash ring tells distributors which ingesters own each series right now.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is random load balancing across ingestion nodes. It spreads HTTP requests and looks stateless at the front door. It fails to give one time series a stable owner for recent samples, ordering checks, and flush behavior.',
        'Another reasonable approach is tenant-level routing. That keeps a tenant together, but one large tenant can overload a small set of machines. High-cardinality tenants still need sharding inside the tenant because millions of series cannot be one ownership unit.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Metrics ingestion is stateful even when requests arrive through stateless distributors. Ingesters hold recent samples in memory, enforce ordering, and later flush blocks or chunks. If ownership changes carelessly, writes can be lost, duplicated, under-replicated, or sent to nodes that are not ready.',
        'Cardinality is the second wall. A tenant that creates millions of label combinations consumes memory and CPU on whichever ingesters own those series. A hash ring can spread work, but it cannot make an unbounded label schema cheap.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Map each tenant series key through a hash ring to a replicated owner set. The distributor can stay mostly stateless because the ring is the shared ownership map. Replication means recent in-memory samples survive individual ingester failures.',
        'The ring is more than service discovery. Token ranges, ingester lifecycle state, zone awareness, replication factor, health, and acknowledgments define whether the write is safe. A node being present is not enough; it must be a valid owner for the current write.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A distributor validates a remote-write batch, checks tenant limits, normalizes the series identity, and hashes it. It walks the ring to find the ingester that owns the hash range, then chooses additional replicas according to the replication factor and zone policy. It sends the samples and waits for the required acknowledgments.',
        'Ingesters participate in the ring and store recent samples for their assigned series. Ring state is shared through a key-value store or gossip-style membership. During scale-up or rolling upgrades, lifecycle states control when a node can receive writes and when an old node can drain.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant is deterministic ownership for a series at a ring version. If distributors agree on the ring, the same tenant series maps to the same replica set. Replication then protects recent data because the write is accepted only after enough owners have stored it.',
        'Churn is safe only if lifecycle transitions preserve coverage. A joining ingester should not receive traffic before it is ready, and a leaving ingester should not drop ownership before replacements can accept writes. The ring must converge quickly enough that distributors do not route the same series to incompatible owner sets for long.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Replication multiplies write work. With replication factor 3, 100,000 incoming samples per second become up to 300,000 ingester appends before acknowledgments. Doubling the replication factor improves failure tolerance but directly raises network, CPU, and memory pressure.',
        'Ring size and cardinality drive behavior. More tokens can improve balance but increase membership state and churn work. More active series increase ingester memory even if sample rate is modest, so label discipline and tenant limits are part of capacity planning, not optional policy.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This design fits horizontally scalable Prometheus-compatible storage such as Grafana Mimir. It is useful when many distributors must accept writes while many ingesters own recent tenant series state. The access pattern is append-heavy ingestion with deterministic ownership and replicated recent data.',
        'The same pattern appears in distributed caches, sharded queues, and time-series systems that need stable key ownership under node churn. The lesson is to separate the request front door from the state owner map. The front door can scale freely only if it follows a shared ownership contract.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A hash ring is not magic load balancing. Hot tenants, unbalanced tokens, bad zone placement, unhealthy ingesters, and explosive metric labels can still overload part of the cluster. The ring distributes the workload it is given; it does not make that workload fair.',
        'It also fails when service discovery is confused with write safety. A live pod is not necessarily a valid ingester for a series. Membership state, replication policy, quorum behavior, and acknowledgment handling decide whether accepting the write is correct.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A tenant sends samples for http_requests_total{job="api", instance="a"}. The distributor hashes tenant acme plus the normalized series identity to token 72,140 on a ring with 3 zones and replication factor 3. The ring chooses ingesters i-4, i-9, and i-15 in separate zones.',
        'If the write batch has 1,000 samples and the quorum is 2 of 3, the distributor can return success after any 2 valid ingesters acknowledge. If i-9 is leaving and not a valid target, the distributor must choose the next valid owner rather than count i-9 as safe. The numeric success condition is about acknowledged replicas, not just sent HTTP requests.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are Grafana Mimir hash ring architecture at https://grafana.com/docs/mimir/latest/references/architecture/hash-ring/, distributor docs at https://grafana.com/docs/mimir/latest/references/architecture/components/distributor/, and ingester docs at https://grafana.com/docs/mimir/latest/references/architecture/components/ingester/. Use these sources for mechanism claims before relying on secondary summaries.',
        'Study Consistent Hashing for ownership, Quorums for replicated writes, Prometheus Remote Write WAL Shards for the sender side, Metric Label Cardinality Control for tenant pressure, Prometheus TSDB for local storage, and Backpressure for bounded ingestion. Start with the topic that explains the data shape, then move to the production system.',
      ],
    },
  ],
};