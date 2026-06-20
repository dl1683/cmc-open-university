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
      heading: 'Why this exists',
      paragraphs: [
        'A long-term metrics backend has to accept high-rate Prometheus remote-write traffic without putting every sample on one machine. It also has to survive node churn, tenant bursts, and rolling upgrades while keeping recent samples available.',
        'A Mimir-style write path exists to split that problem cleanly. Distributors validate and shard incoming series. Ingesters own recent series state. A hash ring decides which ingesters receive each series.',
        {type:'callout', text:'A Mimir-style ring maps each series key to replicated ingester owners, but write safety depends on membership state and acknowledgments.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The naive design is to load-balance batches randomly across ingestion nodes. That spreads requests, but it does not give a time series a stable owner. Recent samples, ordering assumptions, and flush behavior become messy.',
        'Another naive design is to route by tenant only. That protects tenant isolation, but hot tenants can overload a small set of nodes and high-cardinality tenants still need sharding inside the tenant.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Metrics ingestion is stateful even when the front door looks stateless. Recent samples live in ingesters before they are flushed to durable storage. If ownership changes carelessly, writes can be under-replicated, rejected, or sent to nodes that are not ready.',
        'Cardinality is the other wall. A few tenants or label sets can dominate memory, CPU, and network. The ring gives deterministic ownership, but it does not remove the need for limits and capacity planning.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat each series identity as a key and map it through a hash ring to a small replicated owner set. Distributors can stay mostly stateless in the hot path because the ring tells them where to send writes.',
        'The ring is not just service discovery. Token ranges, lifecycle states, replication factor, health, zone awareness, and acknowledgments are part of write correctness.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        "In the ingest-ring view, follow one time series key. The distributor validates the remote-write batch, hashes the series identity, finds the owning token range, and sends replicas to the selected ingesters.",
        "In the churn-case view, watch lifecycle state. Joining, active, leaving, and unhealthy ingesters are not interchangeable. A write is safe only if the ring state and replication policy say enough valid owners accepted it.",
        "The highlighted replication set is the control-plane answer to a data-plane question: where should this series live right now, and how many independent ingesters must acknowledge it?",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A remote-write request contains samples for `http_requests_total{tenant="acme", job="api", instance="a"}`. The distributor checks tenant limits and label validity, hashes the normalized series identity, and uses the ring to choose three ingesters across zones. The request succeeds only when the configured write condition is met.',
        'During a rolling upgrade, one ingester is leaving and another is joining. The ring should prevent the joining node from receiving traffic before it is ready and should let the leaving node drain safely. If distributors disagree about ring state, writes may scatter, fail, or become under-replicated. That is why ring convergence is part of correctness, not merely discovery.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A distributor receives a write request, validates labels and samples, checks tenant limits, and hashes the series. It uses the ingester hash ring to find the authoritative owner and then replicates the series to additional ingesters according to the replication factor.',
        'Ingesters keep recent samples in memory and participate in the ring. The ring is shared through a key-value or memberlist mechanism. Ring state tells distributors which ingesters are active, joining, leaving, or unhealthy.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Consistent hashing makes ownership stable enough that most series keep landing on the same ingesters as the cluster changes. Replication protects recent in-memory samples while ingesters eventually flush blocks or chunks to durable object storage.',
        'Tenant limits keep the front door honest. They stop a noisy tenant from turning the ring into an unbounded memory and cardinality sink.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Replication improves availability but multiplies write work and memory. More ingesters add capacity but also add ring churn during scaling events. More tokens can improve balance but make ring state larger and operationally noisier.',
        'Zone-aware replication, quorum behavior, and ring convergence decide whether writes remain safe during failures. A cluster can be up in a Kubernetes sense and still be unsafe for ingestion if ring state is stale or too many owners are unhealthy.',
        'Cardinality dominates many costs. Each distinct series consumes memory, index work, and eventual storage. A perfect ring cannot save a tenant that creates millions of label combinations without limits, sampling, or better instrumentation discipline.',
      ],
    },
    {
      heading: 'Operational review',
      paragraphs: [
        'Review the write path as a ledger: tenant id, sample count, label validation, rate-limit decision, series hash, ring version, chosen ingesters, acknowledgments, and failure reason. That ledger is how an operator distinguishes bad client data from ring churn or ingester overload.',
        'Useful alerts separate validation failures, limit rejections, distributor queueing, ring health, ingester append latency, replication failures, and object-store flush lag. A single ingestion-error graph is too blunt for a system whose correctness depends on several layers.',
      ],
    },
    {
      heading: 'Capacity planning',
      paragraphs: [
        'Plan capacity around active series, samples per second, tenants, replication factor, flush bandwidth, and query pressure on recent data. The ring spreads ownership, but each ingester still has finite memory and CPU for active series. A tenant with explosive labels can create more pressure than a much larger tenant with disciplined cardinality.',
        'Scale events should be treated as control-plane events. Adding ingesters changes token ownership, replication sets, and failure domains. Rolling upgrades should watch ring convergence and write success, not just Kubernetes pod readiness.',
        'A practical review also asks what happens to recent data when an ingester dies before flushing. Replication and quorum policy define how much recent state survives, while object storage protects only data that has already been persisted.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This design wins for horizontally scalable metrics ingestion where many distributors can accept remote-write traffic and many ingesters can own recent series state. It fits multi-tenant Prometheus-compatible storage systems such as Mimir-style architectures.',
        'It is also a useful teaching example because the moving parts are concrete: tenant ledgers, series hashes, token ranges, ring membership, replication sets, lifecycle states, and flush paths.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A hash ring is not magic load balancing. Hot tenants, high-cardinality metrics, unbalanced tokens, unhealthy ingesters, and uneven zone placement can still overload part of the cluster.',
        'Another trap is treating service discovery as equivalent to write correctness. Membership state, replication factor, acknowledgments, and ring convergence determine whether a write is safely accepted.',
        'It also fails when local operational policy is missing. Without tenant limits, cardinality controls, and clear onboarding rules, the ring becomes a fair way to distribute an unfair workload.',
        'Do not overextend the model into the query path. The write ring explains where recent samples should be accepted, but historical query performance depends on block storage, compactors, store gateways, indexes, caches, and query splitting. A learner should keep those concerns separate before studying how they meet in a real incident.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A cluster rolls ingesters during a release. New ingesters join the ring, old ingesters leave, distributors refresh ring views, and incoming series continue to be hashed and replicated. If ring propagation lags or zones become imbalanced, a tenant can see ingestion errors or under-replication.',
        'The operational controls are token balance, zone-aware replication, quorum behavior, per-tenant limits, ring-health alerts, and distributor observability that separates validation failures, rate limiting, ring churn, and ingester write latency.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Grafana Mimir hash ring architecture at https://grafana.com/docs/mimir/latest/references/architecture/hash-ring/, Mimir distributor docs at https://grafana.com/docs/mimir/latest/references/architecture/components/distributor/, and Mimir ingester docs at https://grafana.com/docs/mimir/latest/references/architecture/components/ingester/.',
        'Study Consistent Hashing for ownership, Prometheus Remote Write WAL Shards for the sender side, Metric Label Cardinality Control for tenant pressure, Prometheus TSDB Case Study for local sample storage, Backpressure & Flow Control for bounded ingestion, and Quorums for replicated write safety.',
      ],
    },
  ],
};
