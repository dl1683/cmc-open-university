// Kubernetes namespace policy: LimitRange defaults and validates object size,
// ResourceQuota validates aggregate namespace usage before persistence.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-resourcequota-limiterange-admission-case-study',
  title: 'Kubernetes ResourceQuota and LimitRange Admission Case Study',
  category: 'Systems',
  summary: 'How namespace admission applies default requests and limits, validates min/max ratios, checks ResourceQuota hard limits, and records usage ledgers for multi-tenant clusters.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['admission math', 'namespace ledger'], defaultValue: 'admission math' },
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

function quotaGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.7, y: 4.2, note: notes.client ?? 'Pod create' },
      { id: 'api', label: 'API', x: 2.0, y: 4.2, note: notes.api ?? 'admit' },
      { id: 'limit', label: 'LimitRange', x: 3.8, y: 2.8, note: notes.limit ?? 'default/check' },
      { id: 'rq', label: 'Quota', x: 3.8, y: 5.6, note: notes.rq ?? 'hard cap' },
      { id: 'usage', label: 'usage', x: 5.7, y: 5.6, note: notes.usage ?? 'used+new' },
      { id: 'object', label: 'object', x: 5.7, y: 2.8, note: notes.object ?? 'mutated' },
      { id: 'decision', label: 'decision', x: 7.5, y: 4.2, note: notes.decision ?? 'allow/deny' },
      { id: 'etcd', label: 'etcd', x: 9.2, y: 4.2, note: notes.etcd ?? 'persist' },
    ],
    edges: [
      { id: 'e-client-api', from: 'client', to: 'api' },
      { id: 'e-api-limit', from: 'api', to: 'limit' },
      { id: 'e-api-rq', from: 'api', to: 'rq' },
      { id: 'e-limit-object', from: 'limit', to: 'object' },
      { id: 'e-rq-usage', from: 'rq', to: 'usage' },
      { id: 'e-object-decision', from: 'object', to: 'decision' },
      { id: 'e-usage-decision', from: 'usage', to: 'decision' },
      { id: 'e-decision-etcd', from: 'decision', to: 'etcd' },
    ],
  }, { title });
}

function* admissionMath() {
  yield {
    state: quotaGraph('Namespace policy runs inside admission'),
    highlight: { active: ['client', 'api', 'limit', 'rq', 'e-api-limit', 'e-api-rq'], compare: ['etcd'] },
    explanation: 'LimitRange and ResourceQuota are admission-time guardrails. LimitRange can default and validate per-object resource requests. ResourceQuota checks aggregate namespace usage before the new object is persisted.',
    invariant: 'Defaults happen before quota math, because quota needs the final request values.',
  };

  yield {
    state: labelMatrix(
      'LimitRange defaulting',
      [
        { id: 'cpuReq', label: 'cpu req' },
        { id: 'cpuLim', label: 'cpu lim' },
        { id: 'memReq', label: 'mem req' },
        { id: 'ratio', label: 'ratio' },
      ],
      [
        { id: 'before', label: 'before' },
        { id: 'after', label: 'after' },
        { id: 'rule', label: 'rule' },
      ],
      [
        ['empty', '500m', 'default'],
        ['empty', '1', 'default'],
        ['256Mi', '256Mi', 'kept'],
        ['2x', '2x', 'within'],
      ],
    ),
    highlight: { active: ['cpuReq:after', 'cpuLim:after'], found: ['ratio:rule'] },
    explanation: 'A LimitRange can fill missing requests or limits and reject objects outside minimum, maximum, or limit-to-request ratio rules. That makes later scheduling and quota accounting concrete.',
  };

  yield {
    state: labelMatrix(
      'ResourceQuota check',
      [
        { id: 'cpu', label: 'CPU req' },
        { id: 'mem', label: 'mem req' },
        { id: 'pods', label: 'pods' },
        { id: 'svc', label: 'svc' },
      ],
      [
        { id: 'used', label: 'used' },
        { id: 'new', label: 'new' },
        { id: 'hard', label: 'hard' },
        { id: 'ok', label: 'ok' },
      ],
      [
        ['8', '1', '10', 'yes'],
        ['12Gi', '1Gi', '16Gi', 'yes'],
        ['39', '1', '40', 'yes'],
        ['10', '1', '10', 'no'],
      ],
    ),
    highlight: { active: ['svc:ok'], found: ['cpu:ok', 'mem:ok', 'pods:ok'] },
    explanation: 'Quota is aggregate arithmetic over a namespace. If used plus incoming exceeds the hard limit for any constrained resource, admission rejects the write even when other resources still have room.',
  };

  yield {
    state: quotaGraph('Admission returns a precise policy decision', { decision: 'deny svc', etcd: 'no write' }),
    highlight: { active: ['usage', 'decision', 'e-usage-decision'], removed: ['etcd'], found: ['object'] },
    explanation: 'The best error is specific: which quota blocked the request, which resource exceeded hard, what current usage is, and what incoming object would add. Otherwise tenants cannot self-correct.',
  };
}

function* namespaceLedger() {
  yield {
    state: labelMatrix(
      'Namespace ledger',
      [
        { id: 'teamA', label: 'team A' },
        { id: 'teamB', label: 'team B' },
        { id: 'batch', label: 'batch' },
        { id: 'sys', label: 'system' },
      ],
      [
        { id: 'cpu', label: 'cpu' },
        { id: 'mem', label: 'mem' },
        { id: 'pods', label: 'pods' },
      ],
      [
        ['8/10', '12/16', '39/40'],
        ['3/8', '5/12', '12/25'],
        ['20/24', '40/48', '80/100'],
        ['skip', 'skip', 'skip'],
      ],
    ),
    highlight: { active: ['teamA:pods', 'batch:cpu'], compare: ['sys:cpu'] },
    explanation: 'The invariant is local accounting: each namespace spends against its own hard limits, so one tenant cannot silently consume another tenant admission budget.',
  };

  yield {
    state: quotaGraph('Object-count quotas protect API resources too', { rq: 'count/*', usage: 'object count', decision: 'cap' }),
    highlight: { active: ['rq', 'usage', 'decision', 'e-rq-usage', 'e-usage-decision'], compare: ['limit'] },
    explanation: 'Quota is not only CPU and memory. Kubernetes can limit counts of API objects such as Pods, Services, ConfigMaps, PersistentVolumeClaims, and other namespaced resources.',
  };

  yield {
    state: labelMatrix(
      'Policy layering',
      [
        { id: 'limit', label: 'LimitRange' },
        { id: 'quota', label: 'Quota' },
        { id: 'admit', label: 'Admission' },
        { id: 'sched', label: 'Scheduler' },
      ],
      [
        { id: 'scope', label: 'scope' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['one object', 'bad shape'],
        ['namespace sum', 'over cap'],
        ['write path', 'reject'],
        ['node fit', 'pending'],
      ],
    ),
    highlight: { active: ['limit:scope', 'quota:scope'], found: ['sched:failure'] },
    explanation: 'These layers answer different questions. LimitRange asks whether this object is shaped correctly. ResourceQuota asks whether the namespace can afford it. The scheduler later asks whether some node can run it.',
  };

  yield {
    state: labelMatrix(
      'Complete case: team namespace',
      [
        { id: 'default', label: 'default' },
        { id: 'validate', label: 'validate' },
        { id: 'quota', label: 'quota' },
        { id: 'status', label: 'status' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'outcome', label: 'outcome' },
      ],
      [
        ['add reqs', 'accountable'],
        ['max 2 CPU', 'safe'],
        ['used+new<=hard', 'allow'],
        ['ledger update', 'visible'],
      ],
    ),
    highlight: { active: ['default:outcome', 'quota:outcome', 'status:outcome'], found: ['validate:outcome'] },
    explanation: 'A team creates a Pod without CPU requests. LimitRange defaults requests and limits. ResourceQuota checks the updated request against namespace hard limits. If it fits, the Pod persists and quota usage becomes visible.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'admission math') yield* admissionMath();
  else if (view === 'namespace ledger') yield* namespaceLedger();
  else throw new InputError('Pick a Kubernetes quota view.');
}

