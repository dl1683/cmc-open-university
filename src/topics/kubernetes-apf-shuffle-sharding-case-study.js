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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph as an admission path inside kube-apiserver, the Kubernetes API server. A request first becomes a flow, meaning a class of related API calls such as one user, service account, namespace, verb, or resource pattern. Active nodes show the current admission decision, compare nodes show work that is waiting or competing, and found nodes show a request that has been admitted, queued, rejected, or dispatched.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Every Kubernetes controller, scheduler, operator, and human `kubectl` session depends on kube-apiserver. If one client floods it with expensive calls, unrelated control loops can stop seeing updates or writing decisions. API Priority and Fairness, usually called APF, exists to classify API work before execution so overload degrades by policy instead of arrival order.',
        {type:'callout', text:'API Priority and Fairness protects the control plane by turning each request into classified, budgeted, queueable work before it can consume server capacity.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is one global concurrency limit and one first-in, first-out queue. If 400 requests are already running and the limit is 400, every new request waits until a slot opens. This is simple and fair by arrival time while clients are polite and all requests cost roughly the same.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is head-of-line blocking and false equality. A tenant issuing thousands of large LIST requests can make a quiet controller wait behind work that has nothing to do with it. A single counter also lies about cost because a short GET and a broad LIST can consume very different CPU, memory, serialization, and storage work.',
        'A priority flag alone is too crude. Marking too much traffic as exempt recreates overload, while treating all non-exempt traffic together lets a noisy flow collide with every other flow. The API server needs isolation, admission budgets, and load shedding in the same path.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'APF treats overload as a scheduling problem over named flows. A FlowSchema matches request attributes, a priority level gives the flow a concurrency budget, shuffle sharding maps the flow to a small hand of queues, and seat accounting charges expensive requests more than cheap ones. The key invariant is that no request reaches execution as anonymous work.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'APF checks FlowSchemas in precedence order and picks the first match. That match chooses a PriorityLevelConfiguration, which defines the concurrency share, queue count, queue length, and hand size. If seats are available, the request runs; if not, it enters one queue from its deterministic hand or is rejected when the queue is full.',
        'Shuffle sharding is the data-structure move. Instead of every flow sharing every queue, each flow gets a small subset, such as 8 queues out of 64, and chooses among that subset. A hot flow mostly congests its own hand, while quiet flows that hash to different hands continue to dispatch.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is bounded admission plus collision reduction. Priority levels prevent one class from consuming all concurrency, queue limits prevent unbounded memory growth, and seat accounting prevents expensive calls from hiding as one cheap unit. Shuffle sharding is probabilistic rather than absolute, but it lowers the chance that one hot flow collides with every quiet flow.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'APF adds classification, queue state, dispatch bookkeeping, metrics, and tuning work to every API request. The overhead is usually smaller than executing the request, but it is on the hot path and grows with FlowSchema count, priority levels, queue count, and active waiting requests. If 1,000 requests wait with an average serialized request record of a few hundred bytes plus object overhead, memory is manageable; if queues are made huge to avoid rejections, overload becomes stored latency.',
        'The behavioral cost is explicit failure. During overload, some requests wait and some receive rejection responses so clients must use backoff and jitter. Without that client discipline, APF can turn a server flood into a synchronized retry flood.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'APF fits multi-tenant clusters, managed control planes, and large controller fleets where API traffic is shared by system components and many users. It protects low-volume control traffic from bulk list storms and separates system work from tenant work. It also gives operators metrics for queue length, dispatch, seat use, and rejection rather than one vague API latency graph.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'APF fails when exemptions are too broad, because exempt traffic skips the fairness machinery. It fails when FlowSchemas group unrelated work into one fate or split one abusive workload into many flows that evade fairness. It also fails when seat estimates are too optimistic and expensive requests consume more server work than the priority level can really afford.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose one priority level has 64 queues, a hand size of 8, and a concurrency budget of 100 seats. Tenant A sends 600 LIST Pods requests, each charged 2 seats, while tenant B sends one GET request every second. Tenant A can fill its hand and consume many seats, but tenant B only collides badly if its deterministic hand overlaps enough of A\'s congested queues and the shared seat budget is exhausted.',
        'Now put controller traffic in a higher priority level with 40 reserved seats and tenant traffic in a lower one with 60 seats. Tenant A can still receive rejections and high latency, but node heartbeat updates and Deployment controller writes do not wait behind all 600 tenant requests. The design converts overload from a global queue failure into a policy decision about who waits first.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Use the official Kubernetes API Priority and Fairness concept page and the APF debugging reference as primary sources. They define FlowSchemas, priority levels, shuffle sharding, queues, seats, exempt traffic, and rejection behavior.',
        'Study informers next because efficient watches reduce API load before APF has to shed it. Then study rate limiters, token buckets, load shedding, and tail latency, because APF is one Kubernetes instance of those general overload-control ideas.',
      ],
    },
  ],
};