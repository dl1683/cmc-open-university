// Runbook automation approval ledger: propose, prepare, approve, execute,
// verify, and rollback operational actions with durable audit state.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'runbook-automation-approval-ledger-case-study',
  title: 'Runbook Automation Approval Ledger Case Study',
  category: 'Systems',
  summary: 'A guarded incident automation pattern: runbook candidates, approval queues, idempotency keys, canary checks, SLO gates, rollback plans, and audit logs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['approval state', 'rollback guard'], defaultValue: 'approval state' },
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

function runbookGraph(title) {
  return graphState({
    nodes: [
      { id: 'incident', label: 'incident', x: 0.7, y: 3.6, note: 'context' },
      { id: 'suggest', label: 'suggest', x: 2.1, y: 2.0, note: 'ranked' },
      { id: 'prepare', label: 'prepare', x: 2.1, y: 5.2, note: 'dry run' },
      { id: 'approve', label: 'approve', x: 4.0, y: 3.6, note: 'human' },
      { id: 'token', label: 'idem key', x: 5.7, y: 2.0, note: 'once' },
      { id: 'exec', label: 'execute', x: 5.7, y: 5.2, note: 'job' },
      { id: 'canary', label: 'canary', x: 7.3, y: 2.0, note: 'small' },
      { id: 'slo', label: 'SLO gate', x: 7.3, y: 5.2, note: 'verify' },
      { id: 'ledger', label: 'ledger', x: 8.9, y: 3.6, note: 'audit' },
      { id: 'rollback', label: 'rollback', x: 9.7, y: 5.8, note: 'plan' },
    ],
    edges: [
      { id: 'e-incident-suggest', from: 'incident', to: 'suggest' },
      { id: 'e-incident-prepare', from: 'incident', to: 'prepare' },
      { id: 'e-suggest-approve', from: 'suggest', to: 'approve' },
      { id: 'e-prepare-approve', from: 'prepare', to: 'approve' },
      { id: 'e-approve-token', from: 'approve', to: 'token' },
      { id: 'e-token-exec', from: 'token', to: 'exec' },
      { id: 'e-exec-canary', from: 'exec', to: 'canary' },
      { id: 'e-exec-slo', from: 'exec', to: 'slo' },
      { id: 'e-canary-ledger', from: 'canary', to: 'ledger' },
      { id: 'e-slo-ledger', from: 'slo', to: 'ledger' },
      { id: 'e-slo-rollback', from: 'slo', to: 'rollback' },
      { id: 'e-rollback-ledger', from: 'rollback', to: 'ledger' },
    ],
  }, { title });
}

function riskPlot() {
  return plotState({
    axes: {
      x: { label: 'automation level', min: 0, max: 5.5 },
      y: { label: 'blast radius', min: 0, max: 10 },
    },
    series: [
      { id: 'safe', label: 'guarded', points: [{ x: 0, y: 1 }, { x: 1, y: 1.4 }, { x: 2, y: 2.0 }, { x: 3, y: 2.5 }, { x: 4, y: 3.2 }] },
      { id: 'unsafe', label: 'unguarded', points: [{ x: 0, y: 1 }, { x: 1, y: 2.2 }, { x: 2, y: 4.4 }, { x: 3, y: 7.2 }, { x: 4, y: 9.5 }] },
    ],
    markers: [
      { id: 'approval', x: 2, y: 2.0, label: 'approve' },
    ],
  });
}

function* approvalState() {
  yield {
    state: runbookGraph('Runbook automation is a state machine with audit'),
    highlight: { active: ['incident', 'suggest', 'prepare', 'approve', 'ledger', 'e-incident-suggest', 'e-incident-prepare', 'e-suggest-approve', 'e-prepare-approve'], found: ['token'] },
    explanation: 'A mature runbook system does not jump from alert to mutation. It suggests a candidate, prepares the command or workflow, asks for approval when risk is nontrivial, then records every transition.',
    invariant: 'Incident automation should be replayable as a ledger, not reconstructed from chat logs.',
  };

  yield {
    state: labelMatrix(
      'Approval ledger rows',
      [
        { id: 'suggest', label: 'suggest' },
        { id: 'dry', label: 'dry run' },
        { id: 'approve', label: 'approve' },
        { id: 'exec', label: 'execute' },
        { id: 'verify', label: 'verify' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'guard', label: 'guard' },
        { id: 'record', label: 'record' },
      ],
      [
        ['ready', 'ranked cause', 'why'],
        ['clean', 'no side effect', 'diff'],
        ['human', 'risk owner', 'who'],
        ['once', 'idem key', 'job id'],
        ['pass/fail', 'SLO gate', 'result'],
      ],
    ),
    highlight: { active: ['approve:guard', 'exec:guard', 'verify:guard'], found: ['suggest:record', 'dry:record'] },
    explanation: 'Each row answers three questions: what state is the action in, which guard allows it to advance, and what evidence would let a post-incident review audit the decision.',
  };

  yield {
    state: runbookGraph('Idempotency keys make retries safe'),
    highlight: { active: ['approve', 'token', 'exec', 'ledger', 'e-approve-token', 'e-token-exec'], found: ['slo'], compare: ['rollback'] },
    explanation: 'Incident workflows retry because networks, runners, and humans fail. Idempotency keys prevent duplicate restarts, duplicate scale-ups, duplicate rollback attempts, and duplicate ticket updates.',
  };

  yield {
    state: labelMatrix(
      'Automation maturity',
      [
        { id: 'hint', label: 'hint' },
        { id: 'prep', label: 'prepare' },
        { id: 'push', label: 'push btn' },
        { id: 'auto', label: 'auto' },
      ],
      [
        { id: 'does', label: 'does' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['rank cause', 'none'],
        ['draft job', 'dry run'],
        ['run job', 'approval'],
        ['small fix', 'SLO+canary'],
      ],
    ),
    highlight: { active: ['hint:does', 'prep:gate', 'push:gate'], compare: ['auto:gate'] },
    explanation: 'The ladder matters. Recommending a runbook is low risk. Preparing a command is moderate risk. Executing it needs approval and guardrails. Fully automatic remediation should start only with narrow, reversible actions.',
  };
}

function* rollbackGuard() {
  yield {
    state: runbookGraph('Execution must have a verification and rollback path'),
    highlight: { active: ['exec', 'canary', 'slo', 'rollback', 'ledger', 'e-exec-canary', 'e-exec-slo', 'e-slo-rollback', 'e-rollback-ledger'] },
    explanation: 'A runbook action is incomplete until the system knows how to verify success and what to do if verification fails. Canary scope and SLO gates keep automation from expanding a bad mitigation.',
  };

  yield {
    state: riskPlot(),
    highlight: { active: ['safe', 'unsafe', 'approval'] },
    explanation: 'Guardrails flatten the blast-radius curve. The more automated the action becomes, the more the system needs bounded scope, idempotency, canary checks, approval policy, and rollback state.',
  };

  yield {
    state: labelMatrix(
      'Rollback decision table',
      [
        { id: 'canary', label: 'canary' },
        { id: 'slo', label: 'SLO' },
        { id: 'err', label: 'errors' },
        { id: 'cost', label: 'cost' },
      ],
      [
        { id: 'measure', label: 'measure' },
        { id: 'ok', label: 'ok' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['1% scope', 'expand', 'stop'],
        ['burn down', 'continue', 'rollback'],
        ['5xx flat', 'hold', 'rollback'],
        ['budget ok', 'keep', 'cap'],
      ],
    ),
    highlight: { active: ['canary:fail', 'slo:fail', 'err:fail'], found: ['cost:fail'], compare: ['canary:ok'] },
    explanation: 'The rollback guard should be deterministic enough for responders to trust. It compares current metrics against the action contract and records the reason for continue, stop, cap, or rollback.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'stale', label: 'stale ctx' },
        { id: 'dup', label: 'dup exec' },
        { id: 'wide', label: 'wide scope' },
        { id: 'manual', label: 'no audit' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['old incident', 'recheck'],
        ['two jobs', 'idem key'],
        ['bad blast', 'canary'],
        ['lost why', 'ledger'],
      ],
    ),
    highlight: { active: ['stale:symptom', 'dup:symptom', 'wide:symptom'], found: ['dup:fix', 'manual:fix'] },
    explanation: 'Most runbook automation bugs are control-plane bugs: stale context, duplicate execution, overbroad scope, hidden manual changes, and missing rollback evidence.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'approval state') yield* approvalState();
  else if (view === 'rollback guard') yield* rollbackGuard();
  else throw new InputError('Pick a runbook automation view.');
}

export const article = {
  references: [
    { title: 'PagerDuty Automation Actions', url: 'https://support.pagerduty.com/main/docs/automation-actions' },
    { title: 'Rundeck and PagerDuty Runbook Automation', url: 'https://docs.rundeck.com/docs/learning/howto/actions-with-rba.html' },
    { title: 'Temporal Human-in-the-Loop AI Agent', url: 'https://docs.temporal.io/ai-cookbook/human-in-the-loop-python' },
    { title: 'OpenFeature Evaluation API', url: 'https://openfeature.dev/specification/sections/flag-evaluation' },
  ],
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A runbook automation approval ledger is the control-plane record for operational actions during an incident. It tracks suggested mitigations, dry-run output, approvals, idempotency keys, execution jobs, verification checks, rollback decisions, and audit spans.',
        'This topic connects incident response to durable workflows. The value is not only faster execution. The value is that the system can explain who approved what, which guard allowed it, what changed, whether it worked, and how rollback would happen.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The main structures are an incident-context packet, a runbook catalog, an approval queue, an append-only action ledger, an idempotency-key table, a job-state machine, a canary scope descriptor, an SLO verification gate, and a rollback plan pointer.',
        'PagerDuty Automation Actions describes responders getting access to defined diagnostic or remediation actions, while Rundeck runbook automation provides the job execution surface: https://support.pagerduty.com/main/docs/automation-actions and https://docs.rundeck.com/docs/learning/howto/actions-with-rba.html. The ledger is the glue that makes those actions safe during live incidents.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The incident system proposes a runbook based on the incident graph and known service catalog. The automation layer prepares a dry run, validates prerequisites, checks blast radius, creates an idempotency key, and asks for approval when policy requires it. After execution, canary and SLO checks decide whether to expand, hold, cap, or rollback.',
        'Temporal human-in-the-loop examples show a workflow pausing for approval and resuming from durable state: https://docs.temporal.io/ai-cookbook/human-in-the-loop-python. The same idea fits runbook automation: approval is a state transition inside the workflow, not a message lost outside the system.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Checkout version 42 is the leading candidate in a live incident. The system proposes rolling traffic back to version 41. It prepares the feature flag or deployment command, shows a diff, confirms the rollback target, checks that no migration makes rollback unsafe, requests approval from checkout incident command, then executes for one region first.',
        'The SLO gate watches p99 latency, 5xx rate, checkout success, queue depth, and error budget burn. If canary recovery is visible, the workflow expands. If not, it stops and records that rollback did not mitigate the incident. In both cases the ledger preserves the evidence for postmortem review.',
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        'Automation trades toil for control-plane responsibility. The system must handle stale context, retries, partial execution, human delay, permissions, secret access, runner failures, and action drift. Every side effect should be idempotent or explicitly non-retryable.',
        'Feature flags are a common rollback surface. OpenFeature defines a vendor-neutral evaluation API for feature flags: https://openfeature.dev/specification/sections/flag-evaluation. A production runbook should still record which flag changed, which provider resolved it, which variant was served, and how the action was verified.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not treat "has a runbook" as "safe to automate." A manual runbook may assume human judgment, local context, or irreversible steps. Before automation, split each step into read-only diagnostics, reversible mutations, and dangerous mutations.',
        'Avoid unaudited chat approvals. If approval lives only in a chat message, the workflow cannot reliably resume, retry, or prove authorization. Put approvals, rejections, stale-state checks, and overrides in the ledger.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study AIOps Incident Response, Incident Causal Candidate Graph, Human Approval Interrupt Queue, Temporal Workflow Case Study, Idempotency Keys, Feature Flag Control Plane, Circuit Breakers, and SLO Error Budget Burn Rate Alert next.',
      ],
    },
  ],
};
