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
    explanation: 'A CronJob does not run the workload itself. It compares the schedule cursor with current time, applies policy, then creates one-time Jobs from the jobTemplate.',
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
    explanation: 'The schedule and time zone define candidate ticks. The last-schedule cursor prevents repeated creation for the same tick, and name limits matter because generated Jobs and Pods add suffixes.',
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
    explanation: 'The policy is the overlap rule. Allow admits another Job, Forbid records a missed run, Replace trades the old active Job for a fresh one, and suspension stops new Job creation.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a controller comparing a schedule ledger with the current clock. A CronJob is a Kubernetes object that creates Jobs at times described by a cron expression, and a Job is a finite workload that runs Pods until completion. Active ticks are schedule times being considered, compare ticks are missed or stale times, and found nodes are the Job creation, skip, or cleanup result.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many cluster tasks are finite but repeated: backups, reports, cleanup, certificate renewal, and exports. A plain Job can run one occurrence, but it does not remember the next due time or what to do after controller downtime. CronJob adds a schedule cursor, missed-start policy, overlap policy, and history cleanup around those Jobs.',
        {type:'callout', text:'A CronJob is a schedule ledger, not a running loop: each due tick is judged against cursor, deadline, concurrency, and history policy before a Job is created.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to run cron inside a container or put a sleep loop in an application process. That works while the process keeps running, clocks are simple, and no one cares about missed ticks. It fails as soon as the container restarts, a controller is down for an hour, or the previous run is still active when the next tick arrives.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is ambiguity after time has passed. If a 02:00 backup was missed and the controller returns at 03:10, the system needs a policy answer: run late, skip as stale, or record failure for a human. If a previous run is still active, the next tick needs an overlap rule rather than an accident.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that scheduled work is a ledger problem, not a background loop. The controller stores the last scheduled time, computes due times from the cron expression and time zone, filters missed starts through `startingDeadlineSeconds`, applies `concurrencyPolicy`, creates Jobs from a template, and trims history. Each tick is judged against durable Kubernetes state before new work exists.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On each reconciliation, the CronJob controller finds schedule times between the last recorded schedule and now. It discards ticks that are too old under `startingDeadlineSeconds`, stops new creation when `suspend` is true, and applies `Allow`, `Forbid`, or `Replace` when a previous Job is active. It then creates a Job, records status, and uses successful and failed history limits to keep old Job objects bounded.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant is that every candidate tick passes through the same ledger before a Job is created. A tick is either eligible, stale, blocked by active work, replacing active work, suspended, or created as a Job. The design does not promise exactly-once side effects; it promises repeatable controller decisions from stored schedule state and current Job state.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Controller cost grows with the number of CronJobs, missed ticks to inspect, active Jobs, and retained history. A CronJob that runs every minute creates 1,440 opportunities per day, while a nightly CronJob creates one; the control-plane object churn is not the same. Very large deadlines can backfill stale work, while tiny deadlines can miss normal controller polling delay.',
        'The behavioral cost is side-effect risk. If a Job writes to a database and then crashes before Kubernetes observes success, a replacement or manual rerun may repeat the write. CronJob schedules time; the workload still needs idempotent output, unique run ids, checkpoints, or external locks when repeated execution is dangerous.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'CronJob fits time-triggered work with a clear terminal result: backups, billing exports, cleanup passes, report generation, cache warming, and certificate renewal. It is strongest when lateness and overlap have simple business meanings, such as do not overlap backups or skip a report after it is 30 minutes stale. It also gives operators standard Job status and logs instead of a private scheduler hidden inside an application.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'CronJob is a poor fit for exactly-once money movement, dependency graphs, high-frequency event streams, and work whose next step depends on the previous output. A queue or workflow engine is better when the unit of progress is an event, item claim, approval, or dependency edge. CronJob also fails when users treat schedule text as a substitute for retry-safe application code.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A report CronJob runs hourly. The controller last scheduled 10:00 and is unavailable until 12:20, so it sees missed ticks at 11:00 and 12:00. With `startingDeadlineSeconds: 1800`, the 11:00 tick is stale at 80 minutes late, while the 12:00 tick is 20 minutes late and still eligible.',
        'Now set `concurrencyPolicy: Forbid` and assume the 11:00 Job is still active. The 12:00 eligible tick is skipped because overlapping reports would corrupt the output file. With `Replace`, the old Job would be deleted and the 12:00 Job started; with `Allow`, both Jobs would run and the output layer would need dedupe.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Use the official Kubernetes CronJob concept page and automated tasks guide as primary sources. They define cron syntax, time zones, missed schedules, deadlines, concurrency policy, suspension, history limits, and generated Job behavior.',
        'Study Kubernetes Job completion ledgers next because CronJob creates Jobs as its execution unit. Then study queues, workflow engines, resource quotas, and write-ahead logs to understand when a schedule is not enough state.',
      ],
    },
  ],
};