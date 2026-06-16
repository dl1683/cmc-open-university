// Kubernetes CronJob: a schedule cursor creates Jobs, handles missed starts,
// concurrency policy, suspension, history limits, and time zone behavior.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-cronjob-schedule-backfill-case-study',
  title: 'Kubernetes CronJob Schedule Backfill Case Study',
  category: 'Systems',
  summary: 'How CronJob stores a schedule cursor, creates Jobs, handles missed starts, startingDeadlineSeconds, concurrencyPolicy, suspension, and history cleanup.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['schedule cursor', 'concurrency policy'], defaultValue: 'schedule cursor' },
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

function cronGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'cron', label: 'Cron', x: 0.7, y: 3.8, note: notes.cron ?? '* * * * *' },
      { id: 'cursor', label: 'cursor', x: 2.5, y: 3.8, note: notes.cursor ?? 'last run' },
      { id: 'tick1', label: 't1', x: 4.2, y: 2.1, note: notes.tick1 ?? 'due' },
      { id: 'tick2', label: 't2', x: 4.2, y: 3.8, note: notes.tick2 ?? 'missed' },
      { id: 'tick3', label: 't3', x: 4.2, y: 5.5, note: notes.tick3 ?? 'now' },
      { id: 'policy', label: 'policy', x: 6.2, y: 3.8, note: notes.policy ?? 'allow' },
      { id: 'job', label: 'Job', x: 8.0, y: 3.0, note: notes.job ?? 'create' },
      { id: 'hist', label: 'hist', x: 8.0, y: 5.0, note: notes.hist ?? 'cleanup' },
      { id: 'status', label: 'status', x: 9.5, y: 3.8, note: notes.status ?? 'record' },
    ],
    edges: [
      { id: 'e-cron-cursor', from: 'cron', to: 'cursor' },
      { id: 'e-cursor-tick1', from: 'cursor', to: 'tick1' },
      { id: 'e-cursor-tick2', from: 'cursor', to: 'tick2' },
      { id: 'e-cursor-tick3', from: 'cursor', to: 'tick3' },
      { id: 'e-tick3-policy', from: 'tick3', to: 'policy' },
      { id: 'e-policy-job', from: 'policy', to: 'job' },
      { id: 'e-policy-hist', from: 'policy', to: 'hist' },
      { id: 'e-job-status', from: 'job', to: 'status' },
      { id: 'e-hist-status', from: 'hist', to: 'status' },
    ],
  }, { title });
}

function* scheduleCursor() {
  yield {
    state: cronGraph('A CronJob turns schedule ticks into Jobs'),
    highlight: { active: ['cron', 'cursor', 'tick3', 'policy', 'job', 'e-cron-cursor', 'e-policy-job'], compare: ['hist'] },
    explanation: 'A CronJob is a repeating Job factory. The controller evaluates the schedule, decides which ticks are due, then creates one-time Jobs from the jobTemplate.',
    invariant: 'CronJob correctness is schedule state plus Job creation, not a long-running process.',
  };

  yield {
    state: labelMatrix(
      'Schedule ledger',
      [
        { id: 'sched', label: 'sched' },
        { id: 'zone', label: 'zone' },
        { id: 'last', label: 'last' },
        { id: 'name', label: 'name' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['cron', 'bad'],
        ['TZ', 'drift'],
        ['cursor', 'miss'],
        ['prefix', 'long'],
      ],
    ),
    highlight: { active: ['sched:role', 'last:role'], found: ['name:risk'] },
    explanation: 'The schedule string, time zone, last-schedule cursor, and generated Job name all matter. Kubernetes appends characters to CronJob names, so long names can break generated Pod names.',
  };

  yield {
    state: cronGraph('Missed starts are bounded by deadline policy', { tick1: 'old', tick2: 'miss', tick3: 'due', policy: 'deadline' }),
    highlight: { active: ['tick2', 'tick3', 'policy', 'e-tick3-policy'], compare: ['tick1'] },
    explanation: 'If the controller was down or the CronJob was suspended, several ticks may be missed. startingDeadlineSeconds decides whether a delayed start is still worth creating.',
  };

  yield {
    state: labelMatrix(
      'Complete case: nightly backup',
      [
        { id: 'due', label: 'due' },
        { id: 'late', label: 'late' },
        { id: 'job', label: 'job' },
        { id: 'hist', label: 'hist' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'why', label: 'why' },
      ],
      [
        ['02:00', 'tick'],
        ['03:10', 'skip'],
        ['backup', 'run'],
        ['3 ok', 'keep'],
      ],
    ),
    highlight: { active: ['due:state', 'job:state', 'hist:why'], compare: ['late:why'] },
    explanation: 'A nightly backup CronJob should not launch stale backups all morning after an outage. Deadline and history settings encode how much backfill and retained evidence are acceptable.',
  };
}

function* concurrencyPolicy() {
  yield {
    state: cronGraph('Concurrency policy decides what happens if the prior Job is still active', { policy: 'Forbid?', job: 'maybe' }),
    highlight: { active: ['policy', 'job', 'e-policy-job'], compare: ['tick2', 'tick3'] },
    explanation: 'A slow Job can overlap the next scheduled tick. concurrencyPolicy chooses Allow, Forbid, or Replace rather than leaving the result implicit.',
  };

  yield {
    state: labelMatrix(
      'Concurrency modes',
      [
        { id: 'allow', label: 'Allow' },
        { id: 'forbid', label: 'Forbid' },
        { id: 'replace', label: 'Repl' },
        { id: 'susp', label: 'Susp' },
      ],
      [
        { id: 'act', label: 'act' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['new', 'overlap'],
        ['skip', 'miss'],
        ['kill', 'loss'],
        ['pause', 'backlog'],
      ],
    ),
    highlight: { active: ['allow:act', 'forbid:act', 'replace:act'], compare: ['susp:risk'] },
    explanation: 'Allow can create concurrent Jobs. Forbid skips a run when the prior one is active. Replace stops the old active Job and starts a new one. Suspension pauses creation.',
  };

  yield {
    state: cronGraph('History limits clean old success and failure Jobs', { hist: 'keep 3/1', status: 'bounded' }),
    highlight: { active: ['hist', 'status', 'e-hist-status'], found: ['job'] },
    explanation: 'CronJobs can create unbounded control-plane objects if old Jobs are never cleaned. Successful and failed history limits bound retained evidence.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'slow', label: 'slow' },
        { id: 'ctrl', label: 'ctrl' },
        { id: 'quota', label: 'quota' },
        { id: 'name', label: 'name' },
      ],
      [
        { id: 'sym', label: 'sym' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['overlap', 'policy'],
        ['miss', 'deadln'],
        ['many', 'quota'],
        ['too long', 'short'],
      ],
    ),
    highlight: { active: ['slow:fix', 'quota:fix'], found: ['ctrl:sym'] },
    explanation: 'CronJobs fail operationally through overlap, missed starts, too many retained Jobs, and generated names that exceed limits. The fix is policy, quota, history cleanup, and short names.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'schedule cursor') yield* scheduleCursor();
  else if (view === 'concurrency policy') yield* concurrencyPolicy();
  else throw new InputError('Pick a Kubernetes CronJob view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A Kubernetes CronJob is a repeating Job factory. It stores a cron schedule and a Job template. At each eligible schedule tick, the controller creates a Job that then uses normal Job semantics.',
        'The official CronJob documentation says a CronJob starts one-time Jobs on a repeating schedule, notes limitations around concurrent Jobs and naming, and documents schedule syntax, deadlines, concurrency policy, suspension, history limits, and time zones: https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/. The automated CronJob task page gives the basic run pattern: https://kubernetes.io/docs/tasks/job/automated-tasks-with-cron-jobs/.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The data structure is a schedule cursor plus a Job history ledger. The controller compares current time with the schedule and last run, applies startingDeadlineSeconds, checks concurrencyPolicy, creates or skips a Job, and trims old successes and failures.',
        'This is why CronJob is risky in multi-tenant clusters. A bad schedule, stuck Job, controller outage, or unlimited history can create a thundering herd of Jobs or fill control-plane storage. ResourceQuota documentation explicitly calls out quotas for Jobs as protection against poorly configured CronJobs: https://kubernetes.io/docs/concepts/policy/resource-quotas/.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A nightly backup runs at 02:00 with Forbid concurrency, a one-hour starting deadline, and history limits of three successes and one failure. If the previous backup is still active, the 02:00 run is skipped rather than overlapping against the same database. If the controller restarts at 03:10, the missed 02:00 run is too late and is skipped. The history ledger retains enough Jobs for audit without accumulating forever.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Kubernetes Job Indexed Completion Ledger for the Jobs a CronJob creates, Kubernetes ResourceQuota and LimitRange Admission for namespace caps, Queue and Rate Limiter for controller pacing, and Write-Ahead Log for retry-safe scheduled side effects.',
      ],
    },
  ],
};
