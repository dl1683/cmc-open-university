// Kubernetes API Priority and Fairness: classify requests, assign flows to
// priority levels, shuffle-shard into queues, and account for seats.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-apf-shuffle-sharding-case-study',
  title: 'Kubernetes API Priority and Fairness Shuffle-Sharding Case Study',
  category: 'Systems',
  summary: 'How API Priority and Fairness classifies API requests with FlowSchemas, maps them to PriorityLevels, shuffle-shards queues, accounts for seats, and protects control-plane latency under overload.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['flow queues', 'overload fairness'], defaultValue: 'flow queues' },
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

function apfGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'req', label: 'req', x: 0.7, y: 4.1, note: notes.req ?? 'API call' },
      { id: 'schema', label: 'FlowSchema', x: 2.5, y: 2.8, note: notes.schema ?? 'match' },
      { id: 'flow', label: 'flow', x: 2.5, y: 5.4, note: notes.flow ?? 'user+verb' },
      { id: 'pl', label: 'PL', x: 4.3, y: 4.1, note: notes.pl ?? 'priority' },
      { id: 'shard', label: 'shard', x: 6.0, y: 2.8, note: notes.shard ?? 'queues' },
      { id: 'queue', label: 'queue', x: 6.0, y: 5.4, note: notes.queue ?? 'wait' },
      { id: 'seat', label: 'seats', x: 7.7, y: 4.1, note: notes.seat ?? 'cost' },
      { id: 'exec', label: 'exec', x: 9.2, y: 4.1, note: notes.exec ?? 'serve' },
    ],
    edges: [
      { id: 'e-req-schema', from: 'req', to: 'schema' },
      { id: 'e-schema-flow', from: 'schema', to: 'flow' },
      { id: 'e-flow-pl', from: 'flow', to: 'pl' },
      { id: 'e-pl-shard', from: 'pl', to: 'shard' },
      { id: 'e-shard-queue', from: 'shard', to: 'queue' },
      { id: 'e-queue-seat', from: 'queue', to: 'seat' },
      { id: 'e-seat-exec', from: 'seat', to: 'exec' },
      { id: 'e-pl-seat', from: 'pl', to: 'seat' },
    ],
  }, { title });
}

function fairnessPlot() {
  return plotState({
    axes: { x: { label: 'load burst', min: 0, max: 10 }, y: { label: 'latency risk', min: 0, max: 100 } },
    series: [
      { id: 'nofair', label: 'no APF', points: [{ x: 0, y: 8 }, { x: 3, y: 34 }, { x: 6, y: 78 }, { x: 10, y: 96 }] },
      { id: 'apf', label: 'APF', points: [{ x: 0, y: 8 }, { x: 3, y: 18 }, { x: 6, y: 30 }, { x: 10, y: 42 }] },
    ],
    markers: [{ id: 'protect', x: 6, y: 30, label: 'protected' }],
  }, { title: 'Fair queues isolate low-volume flows from noisy ones' });
}

function* flowQueues() {
  yield {
    state: apfGraph('APF classifies each API request before execution'),
    highlight: { active: ['req', 'schema', 'flow', 'pl', 'e-req-schema', 'e-schema-flow'], compare: ['exec'] },
    explanation: 'API Priority and Fairness sits in the kube-apiserver request path. It classifies requests with FlowSchemas, assigns a priority level, and decides how the request should queue or execute under load.',
    invariant: 'The API server must protect itself before every controller depends on it.',
  };

  yield {
    state: labelMatrix(
      'Flow classification',
      [
        { id: 'system', label: 'system' },
        { id: 'ctrl', label: 'ctrl' },
        { id: 'tenant', label: 'tenant' },
        { id: 'watch', label: 'watch' },
      ],
      [
        { id: 'match', label: 'match' },
        { id: 'level', label: 'level' },
      ],
      [
        ['SA+verb', 'exempt'],
        ['controller', 'high'],
        ['user+ns', 'fair'],
        ['long read', 'seats'],
      ],
    ),
    highlight: { active: ['system:level', 'ctrl:level', 'tenant:level'], found: ['watch:level'] },
    explanation: 'A flow is not just a URL. It can include user, service account, namespace, verb, resource, and request shape. The classification controls queueing and concurrency budget.',
  };

  yield {
    state: apfGraph('Shuffle sharding assigns a flow to a small hand of queues', { shard: 'hand=3', queue: 'least loaded' }),
    highlight: { active: ['flow', 'pl', 'shard', 'queue', 'e-flow-pl', 'e-pl-shard', 'e-shard-queue'], compare: ['exec'] },
    explanation: 'Shuffle sharding gives each flow a deterministic subset of queues and picks among that subset. A noisy flow mostly collides with its own hand instead of every low-volume flow.',
  };

  yield {
    state: labelMatrix(
      'Queue state',
      [
        { id: 'q0', label: 'q0' },
        { id: 'q1', label: 'q1' },
        { id: 'q2', label: 'q2' },
        { id: 'q3', label: 'q3' },
      ],
      [
        { id: 'flow', label: 'flow' },
        { id: 'depth', label: 'depth' },
        { id: 'pick', label: 'pick' },
      ],
      [
        ['A', '18', 'no'],
        ['B', '2', 'yes'],
        ['A', '22', 'no'],
        ['C', '1', 'other'],
      ],
    ),
    highlight: { active: ['q1:pick'], compare: ['q0:depth', 'q2:depth'], found: ['q3:pick'] },
    explanation: 'The queue data structure records waiting requests by flow, plus dispatch order and concurrency limits. The whole goal is bounded unfairness instead of one global FIFO pile.',
  };
}

function* overloadFairness() {
  yield {
    state: apfGraph('Seats account for requests with different execution cost', { seat: '2 seats', exec: 'running' }),
    highlight: { active: ['queue', 'seat', 'exec', 'e-queue-seat', 'e-seat-exec'], found: ['pl'] },
    explanation: 'APF accounts for executing requests with seats. A cheap request and an expensive list or watch should not consume the same control-plane budget if one ties up far more server work.',
  };

  yield {
    state: fairnessPlot(),
    highlight: { active: ['apf', 'protect'], compare: ['nofair'] },
    explanation: 'Under overload, fairness should protect low-volume control traffic from a noisy client. The plot is conceptual, but the design target is concrete: preserve API availability for important flows.',
  };

  yield {
    state: labelMatrix(
      'Priority-level outcomes',
      [
        { id: 'exempt', label: 'exempt' },
        { id: 'lend', label: 'lend' },
        { id: 'queue', label: 'queue' },
        { id: 'reject', label: 'reject' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['skip queues', 'must be tiny'],
        ['borrow seats', 'starve if wrong'],
        ['wait fairly', 'latency'],
        ['shed load', 'client retry'],
      ],
    ),
    highlight: { active: ['queue:meaning', 'reject:meaning'], compare: ['exempt:risk', 'lend:risk'] },
    explanation: 'APF is still a policy system. Exempt too much and overload returns. Queue too much and clients time out. Reject too much and controllers retry-storm. The data needs live tuning.',
  };

  yield {
    state: apfGraph('Complete case: one tenant floods list pods', { req: 'list pods', flow: 'tenant A', queue: 'hot hand', exec: 'bounded' }),
    highlight: { active: ['req', 'flow', 'shard', 'queue', 'seat', 'exec'], found: ['schema', 'pl'] },
    explanation: 'Tenant A sends a storm of expensive list requests. APF maps that flow into its queue hand, limits seats, and preserves controller and low-volume tenant requests in other queues.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'flow queues') yield* flowQueues();
  else if (view === 'overload fairness') yield* overloadFairness();
  else throw new InputError('Pick a Kubernetes APF view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Kubernetes API Priority and Fairness, or APF, is the kube-apiserver overload-control layer. It classifies requests, assigns them to priority levels, optionally queues them, and dispatches them according to concurrency and fairness rules.',
        'The official APF documentation describes FlowSchemas, PriorityLevelConfigurations, shuffle sharding, queues, and how the feature protects low-intensity flows from high-intensity flows: https://kubernetes.io/docs/concepts/cluster-administration/flow-control/. Debugging guidance lives at https://kubernetes.io/docs/reference/debug-cluster/flow-control/.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The main structures are FlowSchema match rules, flow distinguisher, priority level, queue set, shuffle-shard hand, request seats, queue depth, dispatch clock, and rejection decision. Together they replace one global request queue with policy-aware fair queues.',
        'Shuffle sharding is the educational center: each flow maps to a small subset of queues. Heavy flows mostly congest their own subset instead of poisoning every queue in the priority level.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A tenant accidentally loops on list pods across many namespaces. Without APF, the API server request queue can starve controllers and health-critical reads. With APF, that tenant flow maps to a bounded hand of queues and consumes bounded seats. Controller flows and other tenants keep a path through the server.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Fairness is not free. Bad FlowSchema matches can classify traffic into the wrong priority. Overusing exempt levels can bypass protection. Rejected requests can create client retry storms unless clients use backoff.',
        'Study next: Kubernetes Informer DeltaFIFO for controller client behavior, Rate Limiter for retry discipline, Token Bucket for admission budgets, and Tail Latency for why queue isolation matters.',
      ],
    },
  ],
};
