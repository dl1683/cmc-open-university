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
      heading: 'Why this exists',
      paragraphs: [
        'The Kubernetes API server is the shared doorway to the cluster. Every controller, scheduler, operator, kubectl user, and workload automation path depends on it. If a noisy client fills that doorway, unrelated control loops stop making progress.',
        'API Priority and Fairness exists because overload is a control-plane correctness problem, not just a latency problem. A tenant that loops on expensive list requests can delay node heartbeats, deployment rollouts, admission decisions, and cleanup controllers unless the API server has a fair way to queue, reject, and dispatch requests.',
        {type:'callout', text:'API Priority and Fairness protects the control plane by turning each request into classified, budgeted, queueable work before it can consume server capacity.'},
      ],
    },
    {
      heading: 'The baseline approach',
      paragraphs: [
        'A simple API server can use one global in-flight limit and one queue. Requests arrive, wait in order, and run when capacity opens. This works while traffic is small, clients are polite, and every request has roughly the same cost.',
        'Kubernetes does not get that traffic shape. Watches can stay open. Large list calls can consume much more server work than a small get. Controllers retry after timeouts. Human users, system components, and tenants all share the same server but should not all receive the same failure behavior under stress.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A global queue has head-of-line blocking. If tenant A fills it with expensive calls, a low-volume request from tenant B waits behind work that has nothing to do with B. The API server has preserved arrival order, but it has lost service isolation.',
        'A single priority flag is also too crude. System traffic needs protection, but exempting too much traffic recreates overload. Treating every request as one unit also lies about cost: one short read and one expensive list do not consume the same server capacity.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'APF treats overload as a scheduling problem with named boundaries. The key invariant is that a request is not admitted as anonymous work. It is classified into a flow, placed under a priority-level budget, mapped to a limited queue hand, and charged for the seats it consumes.',
        'That structure gives operators separate levers for separate problems. FlowSchemas define who should share fate. Priority levels define which classes of work should be protected. Shuffle-sharded queues reduce noisy-neighbor collisions. Seat accounting keeps expensive requests from hiding behind the same count as cheap ones.',
      ],
    },
    {
      heading: 'The core data model',
      paragraphs: [
        'APF turns an incoming request into a scheduling record. A FlowSchema matches request attributes such as user, group, service account, verb, resource, namespace, and non-resource URL. The first matching FlowSchema assigns the request to a priority level and defines how to distinguish flows inside that level.',
        'A PriorityLevelConfiguration supplies the concurrency policy. Exempt priority levels bypass normal queueing and must stay tiny. Limited priority levels have a concurrency budget, queue count, hand size, queue length, and rejection behavior. Seats represent approximate execution cost, so a request can consume more than one unit of concurrency.',
        'Shuffle sharding is the data-structure move. Each flow maps deterministically to a small hand of queues instead of sharing every queue in the priority level. The dispatcher chooses among that hand, usually preferring the least loaded queue.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The flow-queues view should be read as a control-plane admission path. The request is still ordinary Kubernetes API work, but APF inserts a policy decision before execution. The important transition is from request attributes to a flow identity, because that is the moment unrelated clients either become isolated or accidentally share one queueing fate.',
        'The overload-fairness view shows why the system has more than one queue. The graph is not promising that latency stays low under every burst. It is showing which state decides degradation: priority level, queue hand, queue depth, seat budget, and rejection. If those fields are wrong, the animation still runs, but the cluster policy is wrong.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A request enters kube-apiserver before normal execution. APF checks FlowSchemas in precedence order. The match chooses the priority level and flow distinguisher. That flow is mapped to a queue hand inside the priority level.',
        'If the priority level has enough seats, the request can run. If seats are unavailable, the request enters one of its hand queues. If the selected queue is full, APF rejects the request so the server sheds load instead of accepting unbounded work.',
        'When running requests finish and seats open, APF dispatches queued requests according to the priority level policy. The important state is small and explicit: classified flow, queue hand, queue depth, seats in use, seats available, and reject count.',
      ],
    },
    {
      heading: 'Concrete example',
      paragraphs: [
        "Tenant A deploys a broken script that repeatedly lists every Pod in a namespace. Those requests match a tenant FlowSchema, land in a limited priority level, map to tenant A's queue hand, and consume seats while they run.",
        'At the same time, controller traffic matches a different FlowSchema with a higher priority level. A quiet tenant B maps to a different queue hand. Tenant A can still hurt its own latency and may receive rejections, but it should not fill every queue that controller traffic and tenant B need.',
      ],
    },
    {
      heading: 'Why it is reliable',
      paragraphs: [
        'The reliability argument is isolation plus bounded admission. FlowSchemas make classification deterministic. Priority levels reserve different concurrency budgets. Queue length limits prevent the API server from storing infinite waiting work.',
        'Shuffle sharding limits collision. A heavy flow can congest the queues in its hand, but it is unlikely to collide with every quiet flow when queue count and hand size are configured well. The guarantee is probabilistic, not magical: it reduces blast radius instead of proving that collisions never happen.',
        'Seat accounting protects the concurrency budget from the worst lie in a FIFO design: that every request costs the same. It is an approximation, but even an approximate cost model is better than letting long or expensive requests hide behind a count of one.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Request classification costs a scan through FlowSchemas until the first match. Queue choice and dispatch are small compared with API execution, but APF still adds policy evaluation, queue memory, metrics, and operational tuning.',
        'The behavior under load is deliberate. Some requests wait. Some requests are rejected. Latency becomes less uniform but more controlled. The point is not to make overload disappear; it is to decide which work degrades first.',
        'The hidden cost is client behavior. Rejections are only useful when clients use backoff and jitter. If every rejected controller retries immediately, APF turns a flood into a retry storm.',
      ],
    },
    {
      heading: 'Production uses',
      paragraphs: [
        'APF matters most in shared clusters, managed Kubernetes control planes, large controller fleets, and clusters where many automation systems talk to the API server at once.',
        'Operators use it to protect low-volume critical flows from bulk traffic, to keep tenant traffic from starving system controllers, and to make overload visible through queue, dispatch, seat, and rejection metrics.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Broad exemptions are the fastest way to defeat APF. Exempt traffic skips the fairness machinery, so exempting controllers, operators, or tenants because they feel important can bring back the original overload path.',
        'Bad FlowSchemas protect the wrong boundary. A flow distinguisher that groups too much work together can make unrelated clients share a fate. A distinguisher that splits work too finely can weaken fairness by spreading one workload across many flows.',
        'Small queues reject too early. Large queues hide overload until clients time out. Wrong seat estimates let expensive requests consume more work than the priority level was meant to allow. APF still needs API server capacity, efficient watches, good list usage, and client-side rate limits.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Kubernetes API Priority and Fairness at https://kubernetes.io/docs/concepts/cluster-administration/flow-control/ and debugging APF at https://kubernetes.io/docs/reference/debug-cluster/flow-control/.',
        'Study Kubernetes Informer DeltaFIFO for controller watch behavior, Rate Limiter for retry discipline, Token Bucket for admission budgets, Tail Latency for queue isolation, and Load Shedding for overload policy.',
      ],
    },
  ],
};
