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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a finite-work ledger. A Kubernetes Job creates Pods until a success target is reached or a failure policy wins, and indexed mode assigns stable numbers to work shards. Active Pods are attempts, compare Pods are failed or waiting attempts, and found nodes are completed work or terminal status.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some cluster work has a finish line: imports, migrations, reports, test shards, image transforms, and model evaluations. A Deployment keeps replicas running forever, which is the wrong shape when success is a count. A Job records completions, retries bounded failures, and stops when finite work is done.',
        {type:'callout', text:'A Job is a completion ledger for finite work: it advances on successful units, retries bounded failures, and stops before duplicate output.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to run a script manually, create one Pod, or use a Deployment and watch logs. That works for a one-step task where a human can retry safely. It breaks when work has many chunks, nodes fail, retries happen, or success must be recorded without duplicating output.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the difference between attempts and completed work. A failed Pod might mean retry this shard, fail the whole run, or ignore a transient node problem. A controller needs a ledger that distinguishes active attempts, successful completions, failed attempts, retry budget, deadline, and terminal status.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is monotonic completion. In NonIndexed mode, each successful Pod advances a count until the target is reached. In Indexed mode, each success records a stable index, so retrying index 42 means retrying shard 42 rather than choosing random new work.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Job spec sets completions, parallelism, restart policy, backoff limits, deadline, and optional completion mode. The controller creates Pods up to the parallelism cap, watches their phases, increments success state, creates replacements for failed attempts while policy allows, and sets Complete or Failed conditions. Indexed Jobs expose the completion index to each Pod so the workload can map an index to a file, partition, prompt, or database range.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is that success only moves forward and creation stops at the target. A completed count or completed index does not need another Pod, while a failed attempt can be replaced only inside backoff and deadline policy. Indexed identity lets the external output layer dedupe by shard key, which is the missing link between Kubernetes retry behavior and real side effects.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Work cost grows with completions, while burst cost is capped by parallelism. A Job with 10,000 completions and parallelism 100 can run at most 100 Pods at once, but it still creates up to 10,000 successful Pod records plus failures unless cleanup removes them. Retained Jobs and Pods consume etcd storage, list bandwidth, logs, scheduler work, and quota.',
        'Failure policy is behavior, not decoration. A high backoff limit can hide a permanently bad shard for hours, while a low limit can fail the run on one flaky node. A cleanup TTL saves control-plane storage, but deleting history too early can remove the evidence needed to debug a failed batch.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Jobs fit finite, retryable work with a visible success condition: database imports, report generation, batch transforms, CI test shards, model-evaluation slices, and one-shot maintenance. Indexed Jobs fit work with natural partition identity, such as file number, shard range, simulation seed, or prompt index. NonIndexed Jobs fit interchangeable work when a queue or external system owns item claiming.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A Job is the wrong tool for steady services, open-ended queues, and workflows with branching dependencies. It also fails when side effects are not idempotent. If a Pod writes output and crashes before Kubernetes records success, a replacement may repeat the same shard, so the output system needs idempotency keys, transactions, or shard-level completion markers.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A benchmark suite has 1,000 test cases. An Indexed Job uses `completions: 1000` and `parallelism: 50`, so at most 50 Pods run at once and each Pod maps its completion index to one test case. Pod index 317 writes result key `run-9/317`, and a replacement for index 317 writes the same key if the first attempt fails.',
        'If each test takes 2 minutes and the cluster can sustain 50 Pods, the happy path takes about 40 minutes because 1,000 / 50 = 20 waves. If 20 shards fail once and retry, those retries add another partial wave plus backoff delay. The ledger prevents the controller from creating more Pods after all 1,000 indexes have succeeded.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Use the official Kubernetes Job concept page and batch/v1 Job API reference as primary sources. They define completions, parallelism, Indexed and NonIndexed modes, backoff limits, deadlines, terminal conditions, and cleanup behavior.',
        'Study CronJobs next because they create Jobs on a schedule. Then study queues, workflow engines, resource quotas, write-ahead logs, and idempotency keys, because finite-work correctness depends on both the Kubernetes ledger and the external output ledger.',
      ],
    },
  ],
};