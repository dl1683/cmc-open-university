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
      heading: 'What it is',
      paragraphs: [
        'Grafana Mimir is a horizontally scalable metrics backend that accepts Prometheus-compatible ingestion. A Mimir-style write path receives remote-write traffic at distributors, validates and limits it, hashes each series, and sends it to replicated ingesters selected through a hash ring.',
        'The data-structure lesson is that distributed metrics ingestion is a consistent-hashing and replication problem. A time series has to land on stable owners, survive node churn, respect tenant limits, and eventually flush to durable storage.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A distributor receives a write request, validates labels and samples, checks tenant limits, and hashes the series. In classic Mimir architecture, the distributor uses the ingester hash ring to find the authoritative owner and then replicates the series to additional ingesters according to the replication factor.',
        'Ingesters keep recent samples in memory and participate in the ring. The ring is shared through a key-value or memberlist mechanism, and ring state tells distributors which ingesters are active, joining, leaving, or unhealthy.',
      ],
    },
    {
      heading: 'Complete case study: rolling ingester upgrade',
      paragraphs: [
        'A cluster rolls ingesters during a release. New ingesters join the ring, old ingesters leave, distributors refresh ring views, and incoming series continue to be hashed and replicated. If ring propagation lags or zones become imbalanced, a tenant can see ingestion errors or under-replication.',
        'The operational controls are token balance, zone-aware replication, quorum behavior, per-tenant limits, ring-health alerts, and enough distributor observability to know whether failures are validation, rate limiting, ring churn, or ingester write latency.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'A hash ring is not magic load balancing. Hot tenants, high-cardinality metrics, unbalanced tokens, unhealthy ingesters, and uneven zone placement can still overload part of the cluster. The ring makes ownership deterministic; it does not remove the need for limits and capacity planning.',
        'Another trap is treating service discovery as equivalent to write correctness. Membership state, replication factor, acknowledgments, and ring convergence determine whether a write is safely accepted.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Grafana Mimir hash ring architecture at https://grafana.com/docs/mimir/latest/references/architecture/hash-ring/, Mimir distributor docs at https://grafana.com/docs/mimir/latest/references/architecture/components/distributor/, and Mimir ingester docs at https://grafana.com/docs/mimir/latest/references/architecture/components/ingester/. Study Consistent Hashing, Prometheus Remote Write WAL Shards, Metric Label Cardinality Control, Prometheus TSDB Case Study, Backpressure & Flow Control, and Quorums next.',
      ],
    },
  ],
};
