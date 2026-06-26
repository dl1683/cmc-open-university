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
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read each frame as a state transition in an incident workflow. A runbook is a written procedure for responding to an operational event, and automation means software executes some of those steps instead of a person typing them by hand.',
        'The active node is the decision currently being checked. The ledger is the append-only record of requests, approvals, commands, outputs, and rollback decisions, so the animation is showing why each action was allowed.',
        {type:'callout', text:'Safe incident automation is a ledger-backed state machine, not a direct bridge from alert to shell command.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Incident response needs speed, but production systems need control. Restarting a service, scaling a deployment, or disabling a feature flag can fix an outage, but the same action can destroy evidence or widen damage if it is run in the wrong context.',
        'A runbook automation approval ledger exists to keep speed and authority separate. Software can prepare the action, gather evidence, and execute after approval, while the ledger preserves who approved what and which preconditions were true.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to let the alert trigger the repair command directly. If CPU is high, restart the pod; if error rate is high, roll back the deploy; if disk is full, delete old files.',
        'That approach feels efficient because many incidents have repetitive fixes. It works until the same symptom has more than one cause or the repair itself has a higher blast radius than the outage.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is authority under uncertainty. An alert usually says what changed, not which action is safe, who owns the service, what customer impact is acceptable, or whether the same action is already running.',
        'Without a ledger, two responders can approve conflicting repairs, a bot can repeat a destructive command, and auditors cannot reconstruct why production changed. The failure is not only technical; it is a missing control boundary.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat the runbook as a finite state machine, which means a set of allowed states and transitions. A request moves from proposed to evidence-collected to approved to executed to verified or rolled back.',
        'The ledger is the source of truth for those transitions. Automation does not get authority from the alert; it gets authority from a signed approval attached to a specific command, scope, time window, and evidence packet.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The system opens an automation request with incident ID, service, proposed action, scope, risk class, and required approvers. It collects evidence such as recent deploys, error rate, saturation, customer impact, and whether another repair is active.',
        'The approval policy evaluates the request. If the required people or systems approve within the time window, the executor runs the exact command, stores stdout, stderr, exit code, timestamps, and target versions, then starts verification checks.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from binding approval to the exact action. If the command, target, risk class, or time window changes after approval, the request no longer matches the ledger entry and must be re-approved.',
        'The state-machine model prevents illegal skips. A command cannot execute before evidence exists and approval is present, and rollback cannot claim success until the verification state records the post-action measurements.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The direct runtime cost is small: appending ledger records is O(1), and policy checks usually scan a small set of required approvals and active locks. The real cost is workflow design, because every action needs a scope, risk class, ownership rule, and verification rule.',
        'Cost appears as incident behavior. A two-person approval rule may add 3 minutes to a high-risk database failover, but it can prevent a 30-minute outage caused by two bots making opposite changes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits site reliability engineering, security incident response, database failover, feature-flag kill switches, access revocation, cloud quota changes, and emergency deploy rollback. The shared trait is that a fast action changes production state and needs later explanation.',
        'It also helps regulated teams because the approval record is not a screenshot or chat memory. The ledger connects the incident, evidence, human decision, command, output, and verification result in one replayable chain.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The pattern fails when the policy is theater. If approvers click without reading evidence, or if every action is labeled low risk to avoid delay, the ledger records process without improving safety.',
        'It also fails when the executor can drift from the approved command. Shell expansion, mutable scripts, stale credentials, missing idempotency, and manual side channels can all break the claim that the recorded approval caused the recorded action.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An API cluster has 18% errors for 12 minutes after deploy version 42. The runbook proposes rollback to version 41 for service checkout in region us-east-1, and policy requires one service owner plus one incident commander because revenue traffic is affected.',
        'The ledger records evidence at 14:02, approvals at 14:04 and 14:05, command execution at 14:06, and verification at 14:09 when errors fall to 0.8%. If a responder later asks why version 41 is running, the ledger gives the exact causal chain instead of relying on memory.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study the Google SRE books at https://sre.google/books/, NIST incident handling guidance at https://csrc.nist.gov/publications/detail/sp/800-61/rev-2/final, and Kubernetes audit logging at https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/. Study finite state machines, append-only logs, RBAC, idempotent operations, and transactional outbox patterns next.',
      ],
    },
  ],
};
