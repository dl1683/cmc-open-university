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

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A shared Kubernetes cluster needs a budget before the object is stored. If the API server accepts every Pod, Service, ConfigMap, or PersistentVolumeClaim, one namespace can consume control-plane objects, requested CPU, memory, storage, or scarce extended resources before other teams notice.',
        'The scheduler cannot be the first policy boundary. Scheduling answers "can this Pod fit on some node?" Namespace policy answers "is this team allowed to create this object at this cost?" That second question must be answered on the write path, before etcd records the object as desired state.',
        'ResourceQuota sets hard namespace limits for aggregate resource use and object counts. LimitRange sets per-object defaults and min/max rules. Together they turn a vague create request into an accountable object and then decide whether the namespace can afford it.',
        {type:'callout', text:'LimitRange and ResourceQuota move tenant fairness onto the API write path, where object shape and namespace budget can be checked before desired state is stored.'},
      ],
    },
    {
      heading: 'The obvious approach and its wall',
      paragraphs: [
        'The first approach is to let teams create objects freely and rely on the scheduler, kubelet limits, and human cleanup. That feels reasonable in a small cluster because the failure is visible: Pods go Pending, workloads get throttled, and a person can delete the mistake.',
        'That breaks in a multi-tenant cluster. A Pod with no request has no clear admission cost. A namespace can create thousands of small API objects even when CPU is fine. A Deployment can ask for more Pods than the team should own. The API object already exists by the time the scheduler says it cannot place the Pod.',
        'Late failure also makes accounting bad. Owners see desired objects that never run, platform teams see noisy pending queues, and cost reports cannot distinguish "allowed but waiting for capacity" from "should never have been accepted."',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Kubernetes splits the decision into object shape and namespace budget. LimitRange looks at one object and asks whether its requests, limits, and ratios are acceptable. It can also fill in missing requests or limits so later components do not have to guess.',
        'ResourceQuota looks at the namespace ledger. For each constrained resource, it compares current usage plus the incoming object against the hard limit. One failed comparison vetoes the write.',
        'The order matters. Defaulting must happen before quota math, because quota needs final request values. After admission, the scheduler should see a Pod that already has an accountable shape and already fits the namespace policy.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A create or update request reaches the API server after authentication and authorization. Mutating admission can add defaults. Validating admission can reject the request. LimitRange participates in this admission phase for namespaced objects.',
        'For a Pod, LimitRange can default missing CPU or memory requests and limits, then check minimums, maximums, and limit-to-request ratios. The result is not just a nicer manifest. It is the cost basis ResourceQuota will charge to the namespace.',
        'ResourceQuota then evaluates all relevant hard limits. CPU requests, memory requests, object counts, storage requests, and other scoped resources are checked as used plus incoming. If every constrained value stays within hard, the object can be persisted and the quota ledger can reflect the new usage. If any value crosses hard, the API server rejects the write.',
        'Quota is local to the namespace. Team A spending 39 of 40 Pods does not consume Team B budget. That local accounting is the point: it lets a platform share one control plane without letting one tenant silently spend another tenant admission budget.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the admission-math view, follow the request from client to API server, then watch the branch to LimitRange and ResourceQuota. The important state change is not the arrow movement. It is the moment the Pod changes from "missing request" to "500m CPU request and 1 core limit." Once that value exists, quota can charge it.',
        'The ResourceQuota table should be read as a set of veto checks. CPU, memory, and Pod count may all pass, but the Service count row fails because used plus incoming exceeds hard. Admission is all-or-nothing: one over-budget resource rejects the object before etcd sees it.',
        'In the namespace-ledger view, compare namespace rows instead of global cluster capacity. The ledger is deliberately scoped. It shows why object-count quotas protect the API server, why ResourceQuota is different from scheduling, and why a namespace can pass quota yet still have a Pending Pod later.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is simple: every accepted namespaced object has passed per-object shape rules, and every accepted namespace ledger update stays within hard quota. The API server does not need to predict future scheduling. It only needs to reject writes that would violate the namespace contract now.',
        'Defaulting before quota preserves that invariant. Without defaults, an omitted request could be treated as free by quota and expensive by the scheduler. With defaults, admission, scheduling, and reporting use the same resource request.',
        'The quota comparison is monotonic for the write being admitted. If current used plus incoming exceeds hard for any constrained resource, adding the object cannot make the namespace more compliant. Rejecting that write is safe even if other resources still have room.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A team namespace has hard limits of 10 requested CPU cores, 16 GiB requested memory, 40 Pods, and 10 Services. Current usage is 8 CPU, 12 GiB, 39 Pods, and 10 Services.',
        'A developer creates a Pod without a CPU request. LimitRange defaults the request to 500m and the limit to 1 core, keeps the memory request at 256 MiB, and checks that the limit-to-request ratio is allowed. ResourceQuota then computes 8.5 CPU, about 12.25 GiB memory, and 40 Pods. Those rows still fit, so the Pod can be admitted.',
        'If the same request also creates a new Service, the Service count becomes 11 of 10. That one row rejects the write even though CPU, memory, and Pod count are fine. The error should name the quota, the resource, current usage, hard limit, and requested addition so the tenant can fix the right constraint.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost sits on the API write path. Admission must inspect the object, apply defaults, validate shape, read or update quota usage, and compare every constrained resource. More namespaces mostly means more ledgers. More constrained resource types means more comparisons per write.',
        'High churn can make quota bookkeeping visible as latency or conflicts. Object-count quotas are cheap to understand but can surprise users because a ConfigMap, Service, or PVC may be blocked while compute quota is still available.',
        'Quota is not a reservation system. A namespace can be under quota and still fail to schedule because no node has the right free capacity, affinity, taints, topology, storage, or device resources. It can also be over-promised at the cluster level if administrators set namespace quotas whose sum exceeds real capacity.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This pattern wins in shared clusters: internal platforms, student clusters, CI clusters, ML platforms, and any environment where teams need self-service without unlimited spend.',
        'LimitRange is useful when teams omit requests or set extreme limits. It gives the platform a default shape and keeps one object from being far outside the namespace policy.',
        'ResourceQuota is useful when the scarce thing is aggregate budget: requested CPU, requested memory, storage, Pods, Services, PVCs, ConfigMaps, Secrets, or extended resources such as GPUs. It also protects the control plane from object floods, not just worker nodes from compute exhaustion.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'Do not use quota as a substitute for scheduling, autoscaling, priority, preemption, runtime limits, or node isolation. It controls what a namespace may ask for, not where a Pod will run or how it behaves after it starts.',
        'Do not use one namespace quota to express organization-wide fairness across many namespaces. That needs a higher-level platform policy, custom admission, chargeback, or scheduler integration.',
        'Do not rely on LimitRange defaults as a performance model. Defaults are policy guesses. Real workloads still need measured requests and limits.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Bad defaults become hidden tax. If default CPU is too high, small Pods waste quota and fragment the namespace budget. If defaults are too low, workloads may schedule with misleading requests and later suffer throttling or eviction pressure.',
        'Existing objects are not repaired just because a new policy appears. Admission policy affects future writes. A cluster can contain old objects that do not match the policy shape unless they are updated or recreated.',
        'Multiple policies can make ownership unclear. If teams do not know whether a rejection came from LimitRange shape, ResourceQuota aggregate budget, or the scheduler, they will change the wrong thing. Good error messages and documentation are part of the system.',
      ],
    },
    {
      heading: 'Primary references',
      paragraphs: [
        'Kubernetes ResourceQuota documentation: https://kubernetes.io/docs/concepts/policy/resource-quotas/.',
        'Kubernetes LimitRange documentation: https://kubernetes.io/docs/concepts/policy/limit-range/.',
        'Kubernetes admission controller documentation: https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Kubernetes Admission Policy Gate next if you want the broader write-path model. Study Kubernetes Scheduler Priority Queue and Preemption next if you want the placement side that quota deliberately does not solve.',
        'Study Borg Cluster Scheduler for a production history of quota and priority as cluster policy. Study GPU Cloud Capacity Reservation Orderbook for a contrasting capacity ledger outside Kubernetes.',
      ],
    },
  ],
};
