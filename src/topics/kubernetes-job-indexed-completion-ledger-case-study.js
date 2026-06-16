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
    explanation: 'The central fields are completions, parallelism, backoffLimit, and activeDeadlineSeconds. Together they bound how much work can run, retry, and continue.',
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
    explanation: 'A batch import runs 100 chunks with parallelism 10. When 100 chunks complete successfully, the Job stops creating Pods. Completed Pods can remain long enough for logs and diagnostics.',
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
    explanation: 'A production Job design records the shard key, bounded parallelism, output idempotency, cleanup policy, and owner. Otherwise finished batch work becomes control-plane clutter.',
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
      heading: 'What it is',
      paragraphs: [
        'A Kubernetes Job runs finite work to completion. It creates Pods, retries failed execution according to policy, tracks successful completions, and stops when the goal is reached or a failure condition wins.',
        'The official Job documentation says Jobs represent one-off tasks that run to completion, create one or more Pods, retry until enough Pods successfully terminate, and keep status/log evidence after completion: https://kubernetes.io/docs/concepts/workloads/controllers/job/. The Job API reference describes completionMode, including NonIndexed and Indexed, where Pods receive completion indexes: https://kubernetes.io/docs/reference/kubernetes-api/batch/job-v1/.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The data structure is a completion ledger: desired completions, active Pods, succeeded indexes, failed attempts, backoff counters, deadlines, and terminal conditions. NonIndexed mode counts successful Pods. Indexed mode tracks each completion index as its own shard.',
        'That ledger is why Jobs are different from Deployments. A Deployment keeps a desired number of replicas alive. A Job wants a finite set of successes, then it should stop creating more Pods.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A data import has 100 files. An Indexed Job runs with completions 100 and parallelism 10. Each Pod reads its completion index through the downward API, maps it to one file, writes output under the same shard key, and exits. If shard 42 fails, replacement work for index 42 retries the same file. The output table dedupes by shard index so a late duplicate cannot corrupt results.',
        'The operational checks are backoffLimit, activeDeadlineSeconds, cleanup TTL, logs retention, resource requests, and whether retries are safe. Batch work without idempotency can turn a retry into double writes.',
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
