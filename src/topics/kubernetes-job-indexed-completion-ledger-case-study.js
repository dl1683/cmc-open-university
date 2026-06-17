// Kubernetes Job: a completion ledger tracks one-off work, retries, indexed
// shards, backoff limits, deadlines, and terminal status.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-job-indexed-completion-ledger-case-study',
  title: 'Kubernetes Job Indexed Completion Ledger Case Study',
  category: 'Systems',
  summary: 'How Jobs create Pods until completions succeed, track indexed or non-indexed work, apply backoffLimit and activeDeadlineSeconds, and preserve logs after completion.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['completion ledger', 'indexed shards'], defaultValue: 'completion ledger' },
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

function jobGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'job', label: 'Job', x: 0.8, y: 3.8, note: notes.job ?? 'spec' },
      { id: 'ctrl', label: 'ctrl', x: 2.4, y: 3.8, note: notes.ctrl ?? 'reconcile' },
      { id: 'pod0', label: 'pod-0', x: 4.3, y: 2.2, note: notes.pod0 ?? 'run' },
      { id: 'pod1', label: 'pod-1', x: 4.3, y: 3.8, note: notes.pod1 ?? 'run' },
      { id: 'pod2', label: 'pod-2', x: 4.3, y: 5.4, note: notes.pod2 ?? 'retry' },
      { id: 'succ', label: 'succ', x: 6.2, y: 2.8, note: notes.succ ?? 'count' },
      { id: 'fail', label: 'fail', x: 6.2, y: 5.0, note: notes.fail ?? 'backoff' },
      { id: 'status', label: 'status', x: 8.1, y: 3.8, note: notes.status ?? 'active' },
      { id: 'logs', label: 'logs', x: 9.5, y: 3.8, note: notes.logs ?? 'kept' },
    ],
    edges: [
      { id: 'e-job-ctrl', from: 'job', to: 'ctrl' },
      { id: 'e-ctrl-pod0', from: 'ctrl', to: 'pod0' },
      { id: 'e-ctrl-pod1', from: 'ctrl', to: 'pod1' },
      { id: 'e-ctrl-pod2', from: 'ctrl', to: 'pod2' },
      { id: 'e-pod0-succ', from: 'pod0', to: 'succ' },
      { id: 'e-pod1-succ', from: 'pod1', to: 'succ' },
      { id: 'e-pod2-fail', from: 'pod2', to: 'fail' },
      { id: 'e-succ-status', from: 'succ', to: 'status' },
      { id: 'e-fail-status', from: 'fail', to: 'status' },
      { id: 'e-status-logs', from: 'status', to: 'logs' },
    ],
  }, { title });
}

function* completionLedger() {
  yield {
    state: jobGraph('A Job creates Pods until enough completions succeed'),
    highlight: { active: ['job', 'ctrl', 'pod0', 'pod1', 'e-job-ctrl', 'e-ctrl-pod0'], compare: ['status'] },
    explanation: 'A Job is a run-to-completion controller. It creates Pods, observes success and failure, retries according to policy, and stops creating Pods when the completion target is met.',
    invariant: 'A Job tracks completed work, not a steady replica count.',
  };

  yield {
    state: labelMatrix(
      'Job fields',
      [
        { id: 'comp', label: 'comp' },
        { id: 'par', label: 'par' },
        { id: 'back', label: 'back' },
        { id: 'dead', label: 'dead' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['goal', 'never'],
        ['fanout', 'burst'],
        ['retry', 'loop'],
        ['cap', 'kill'],
      ],
    ),
    highlight: { active: ['comp:role', 'par:role', 'back:role'], found: ['dead:risk'] },
    explanation: 'completions is the success target, parallelism is the in-flight cap, backoffLimit caps retries, and activeDeadlineSeconds caps wall-clock time. The controller may create Pods only inside those bounds.',
  };

  yield {
    state: jobGraph('Failures increase backoff and may mark the Job failed', { pod2: 'error', fail: 'limit?', status: 'maybe Failed' }),
    highlight: { active: ['pod2', 'fail', 'status', 'e-pod2-fail', 'e-fail-status'], compare: ['succ'] },
    explanation: 'A failed Pod is not automatically the end of the Job. The controller can create replacements until retry policy or deadline says the work should fail.',
  };

  yield {
    state: labelMatrix(
      'Complete case: batch import',
      [
        { id: 'spec', label: 'spec' },
        { id: 'pods', label: 'pods' },
        { id: 'ok', label: 'ok' },
        { id: 'done', label: 'done' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'note', label: 'note' },
      ],
      [
        ['100', 'goal'],
        ['10', 'par'],
        ['100', 'stop'],
        ['True', 'logs'],
      ],
    ),
    highlight: { active: ['spec:state', 'ok:state', 'done:state'], compare: ['pods:note'] },
    explanation: 'The success count is monotonic. Once 100 chunks have succeeded, new Pods would only create duplicate work, so the controller stops and leaves completion evidence for debugging.',
  };
}

function* indexedShards() {
  yield {
    state: jobGraph('Indexed mode assigns each shard a stable completion index', { pod0: 'idx 0', pod1: 'idx 1', pod2: 'idx 2' }),
    highlight: { active: ['pod0', 'pod1', 'pod2', 'ctrl'], found: ['succ'] },
    explanation: 'Indexed Jobs give each completion a stable index. Workers can map index 0, 1, 2, and so on to deterministic input shards without an external queue.',
  };

  yield {
    state: labelMatrix(
      'Indexed shard table',
      [
        { id: 'i0', label: '0' },
        { id: 'i1', label: '1' },
        { id: 'i2', label: '2' },
        { id: 'i3', label: '3' },
      ],
      [
        { id: 'file', label: 'file' },
        { id: 'state', label: 'state' },
      ],
      [
        ['A', 'done'],
        ['B', 'run'],
        ['C', 'retry'],
        ['D', 'wait'],
      ],
    ),
    highlight: { active: ['i0:state', 'i2:state'], compare: ['i3:state'] },
    explanation: 'The index becomes a work-shard key. It can choose a file, range, partition, or model-evaluation slice. Retrying index 2 should retry shard C, not pick random new work.',
  };

  yield {
    state: jobGraph('Duplicate workers for one index need idempotent output', { pod2: 'idx 2', fail: 'dupe?', logs: 'dedupe' }),
    highlight: { active: ['pod2', 'fail', 'logs'], compare: ['pod0', 'pod1'] },
    explanation: 'Distributed systems still leak duplicates and late results. Indexed completion makes the key explicit, but the work output should still be idempotent or deduped by index.',
  };

  yield {
    state: labelMatrix(
      'Design ledger',
      [
        { id: 'idx', label: 'idx' },
        { id: 'io', label: 'I/O' },
        { id: 'out', label: 'out' },
        { id: 'ttl', label: 'ttl' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'why', label: 'why' },
      ],
      [
        ['stable', 'shard'],
        ['bounded', 'fair'],
        ['dedupe', 'safe'],
        ['clean', 'etcd'],
      ],
    ),
    highlight: { active: ['idx:rule', 'out:rule'], found: ['ttl:why'] },
    explanation: 'The shard key and cleanup policy make the ledger usable after the run. Without bounded parallelism, idempotent output, and TTL cleanup, retries can corrupt data and finished Jobs can fill the control plane.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'completion ledger') yield* completionLedger();
  else if (view === 'indexed shards') yield* indexedShards();
  else throw new InputError('Pick a Kubernetes Job view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some cluster work has a finish line. A data import, migration, report, model evaluation, or image-processing batch should run until enough units succeed, then stop. A steady workload controller is the wrong shape because success is a count, not a desired replica level.',
        'A Job gives finite work a controller-owned ledger. It creates Pods, observes success and failure, retries inside policy, records terminal status, and stops when either the completion target or a failure condition wins.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simple approach is to run a script by hand, launch a Pod, or use a Deployment with restart policy and watch the logs. That works while the task is tiny, the operator is present, and one failed attempt is easy to reason about.',
        'It breaks when the work has many chunks, nodes fail, the controller restarts, or retries must not duplicate output. A Deployment tries to keep Pods running. It does not know that 100 successful chunks means the work is finished.',
      ],
    },
    {
      heading: 'The core mechanism',
      paragraphs: [
        'The data structure is a completion ledger: desired completions, active Pods, succeeded count or succeeded indexes, failed attempts, backoff counters, deadlines, and terminal conditions. NonIndexed mode treats each successful Pod as interchangeable. Indexed mode gives each completion a stable index in the range 0 through completions minus one.',
        'The official Job documentation describes one-off tasks, parallel Jobs with fixed completion counts, retry backoff, activeDeadlineSeconds, terminal conditions, and retained Pods for logs: https://kubernetes.io/docs/concepts/workloads/controllers/job/. The API reference defines completionMode, including NonIndexed and Indexed: https://kubernetes.io/docs/reference/kubernetes-api/batch/job-v1/.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "In the completion-ledger view, track counts as controller state. Active Pods are attempts, succeeded Pods advance the ledger, failed Pods consume retry budget, and terminal conditions decide whether the Job is complete or failed.",
        "In the indexed-shards view, the index is the identity of the work unit. A retry for index 42 is not a random replacement Pod; it is another attempt to complete shard 42. That stable identity is what lets external outputs dedupe safely.",
        "The useful reading question is: what would make more Pods duplicate work? Once the completion target is satisfied, the controller should stop creating Pods because the finite task has reached its finish line.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A benchmark run has 1,000 test cases. An Indexed Job uses completions 1,000 and parallelism 50. Pod index 317 runs test case 317, writes results under key `run_id/317`, and exits. If the node dies, the replacement Pod for index 317 writes to the same key, so the result store can overwrite or reject duplicates deterministically.',
        'In NonIndexed mode, the controller only cares that 1,000 Pods succeed. That is fine for interchangeable work such as "process any item from a queue" if the queue provides its own claiming semantics. It is weaker for fixed shards because the Job controller does not know which logical unit each successful Pod completed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is monotonic progress plus bounded replacement. A succeeded completion is recorded and does not need to run again. A failed attempt can be replaced only while backoff and deadline policy still allow it. When the ledger reaches the target, more Pods would be duplicate work, so the controller stops creating them.',
        'Indexed mode adds a stronger invariant: retrying index 42 means retrying shard 42. The index is the identity of the work unit, so the output store can dedupe late duplicates by shard key instead of guessing which result belongs to which input.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Work cost grows with completions. Control-plane cost grows with active Pods, completed Pods retained for evidence, and status updates. parallelism caps how many Pods can run at once, so increasing completions increases total work without necessarily increasing burst size.',
        'Failures are intentionally not free. backoffLimit and backoffLimitPerIndex prevent infinite retry loops. activeDeadlineSeconds caps elapsed time across all attempts. A cleanup TTL can remove finished Jobs after the audit window, which keeps etcd and list operations from accumulating old batch objects.',
        'Large Jobs should be reviewed as control-plane load too. Thousands of Pods create scheduling work, status writes, logs, image pulls, and quota pressure. The right parallelism is the amount the cluster and downstream systems can absorb, not simply the number of shards available.',
      ],
    },
    {
      heading: 'Failure semantics',
      paragraphs: [
        'A failed Pod is not automatically a failed Job. The controller compares failures with retry policy, deadlines, and per-index limits. That distinction is why Jobs are useful: transient node loss can produce another attempt, while repeated failure for the same shard can eventually mark the run failed rather than spin forever.',
        'The external side effect still needs its own ledger. If a Pod writes output and then crashes before Kubernetes observes success, a replacement may repeat the shard. Indexed identity makes that repeat manageable, but the storage layer still needs idempotent writes, transactional commit, or a shard-level completion marker.',
      ],
    },
    {
      heading: 'Choosing Indexed or NonIndexed',
      paragraphs: [
        'Use Indexed mode when the work already has stable partition identity: test case number, file id, shard range, simulation seed, model-evaluation prompt index, or database key range. The Pod can derive its input from the completion index, and every retry has the same logical target.',
        'Use NonIndexed mode when the work is interchangeable or claimed elsewhere. For example, each Pod might pull the next item from a queue that owns locking and dedupe. In that design, Kubernetes tracks how many workers succeeded, while the queue tracks which business items are done. Mixing those responsibilities is where duplicate or missing work often appears.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Jobs fit finite, retryable work with a clear success condition: imports, migrations, exports, test shards, model evaluations, image transforms, and one-shot maintenance. Indexed Jobs fit work that already has a deterministic partition key, such as file number, database range, or evaluation shard.',
        'The best Job workloads are idempotent or deduped. If a replacement Pod repeats a shard, the external system should accept the same result once, overwrite by shard key, or reject a duplicate safely.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A Job is the wrong tool for a service that should keep serving traffic, a queue with open-ended work arrival, or a workflow that needs branching dependencies between steps. Use Deployments for steady replicas, queue workers for unbounded streams, and workflow engines when the dependency graph matters.',
        'The dangerous case is non-idempotent side effects. If a failed or late Pod can charge a card, send an email, or append a row twice, the Job ledger is not enough. The external system also needs idempotency keys, transactions, or write-ahead recovery.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A data import has 100 files. An Indexed Job runs with completions 100 and parallelism 10. Each Pod reads its completion index through the downward API, maps it to one file, writes output under the same shard key, and exits. If shard 42 fails, replacement work for index 42 retries the same file. The output table dedupes by shard index so a late duplicate cannot corrupt results.',
        'The review checklist is small but strict: retry policy, deadline, cleanup TTL, logs retention, resource requests, shard idempotency, and whether failed indexes should fail the whole run or be reported for repair.',
        'For curriculum design, this page should make one idea unavoidable: a Kubernetes Job is not just a Pod launcher. It is a controller-maintained progress ledger for finite work. Once learners see that ledger, CronJobs, workflow engines, queues, and retry-safe output systems become easier to compare.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Kubernetes CronJob Schedule Backfill for repeated Jobs, Kubernetes Scheduler PriorityQueue & Preemption for placement, Kubernetes ResourceQuota and LimitRange Admission for namespace caps, Write-Ahead Log for retry-safe output, and Queue for the general work-ledger shape.',
      ],
    },
  ],
};
