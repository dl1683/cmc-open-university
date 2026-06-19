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
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Runbook Automation Approval Ledger Case Study. A guarded incident automation pattern: runbook candidates, approval queues, idempotency keys, canary checks, SLO gates, rollback plans, and audit logs..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why It Exists',
      paragraphs: [
        'Incident automation exists because responders lose time during the minutes when time is most expensive. They copy commands, find service owners, check prerequisites, ask for approval, start jobs, watch dashboards, and later try to prove what happened. When the same incident class repeats, that manual path becomes slow and error-prone.',
        'Automation can also make an outage worse. A stale command can hit the wrong service. A retry can run the same mutation twice. A broad action can expand blast radius. A missing verification step can make the team believe the system recovered when it did not. A missing audit trail can turn the post-incident review into a search through chat logs.',
        'A runbook automation approval ledger is the control-plane record for operational actions. It tracks suggested mitigations, dry-run output, approvals, idempotency keys, execution jobs, verification checks, rollback decisions, and audit spans so the incident can be replayed from durable state.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The baseline is a wiki runbook plus a chat approval. A responder reads the page, pastes a command, someone replies "approved", and the team hopes the action ran once, in the right scope, against the current incident state. This can work for rare manual actions with clear ownership and low pressure.',
        'The wall is control-plane ambiguity. Production mutations need more than intent. The system must know which incident the action belongs to, which runbook version was used, who approved it, which policy allowed it, whether prerequisites still hold, whether the command already ran, and what metrics decide success or rollback.',
        'Chat is useful for coordination, but it is a weak source of truth for automation. Messages are edited, deleted, missed, pasted across incidents, and hard to connect to job state. If the workflow cannot resume from the approval record itself, approval is outside the system that needs it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat runbook automation as a guarded state machine, not a shortcut from alert to shell command. Suggest, prepare, approve, execute, verify, and rollback are separate states. Each transition has a guard. Each guard leaves evidence.',
        'The invariant is that every production mutation advances only after its guard is satisfied, and every mutation has an idempotency key, a bounded blast radius, a verification gate, and a rollback record. If the ledger cannot prove those facts, the automation is not safe enough for broad use.',
        'This turns runbook automation from a pile of scripts into an operational data structure. The ledger is append-only history. The approval queue is a policy boundary. The job state machine is the execution record. The SLO gate is the outcome check. The rollback plan is part of the action contract, not an afterthought.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The approval-state view shows the action before it becomes a mutation. Incident context feeds both a suggested action and a prepared dry run. Approval is not decoration. It is the gate that allows the workflow to create an idempotency key and start an execution job.',
        'The ledger node is the durable memory of every transition. It should record why an action was suggested, what the dry run produced, who approved it, what job ran, what scope it touched, which checks passed, and why the workflow continued, stopped, or rolled back.',
        'The rollback-guard view shifts attention to the path after execution. Canary scope and SLO checks decide whether the action expands, holds, caps, or rolls back. The risk plot explains the shape of the policy: as automation level rises, blast radius must be bounded by stronger gates.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'The main structures are an incident-context packet, a runbook catalog, an approval queue, an append-only action ledger, an idempotency-key table, a job-state machine, a canary scope descriptor, an SLO verification gate, and a rollback plan pointer. The incident graph and service catalog produce candidate actions; the preparation step turns one candidate into a concrete job plan.',
        'A candidate action should include a service, symptom, proposed mutation, expected effect, required permissions, scope, risk class, prerequisites, dry-run result, verification metric set, rollback action, and expiration time. The preparation step should be side-effect free or explicitly marked as a safe read.',
        'PagerDuty Automation Actions and Rundeck runbook automation describe action and job surfaces. Temporal human-in-the-loop workflows show the durable execution idea: a workflow can pause for approval and resume from state. In this pattern, approval is a recorded transition inside the workflow, not a loose chat event outside it.',
      ],
    },
    {
      heading: 'Ledger Data Model',
      paragraphs: [
        'A useful ledger row is not just "approved." It binds incident id, action id, runbook version, proposed diff, target scope, requester, approver, approval policy, timestamp, expiration, dry-run hash, idempotency key, execution job id, verification result, and rollback result. Those fields make the action replayable.',
        'The row also needs state. Suggested means the system believes the action may help. Prepared means the command or workflow plan exists and prerequisites were checked. Approved means a policy owner accepted the risk for a specific scope and time. Executing means a job is running under an idempotency key. Verified means metrics matched the action contract. Rolled back means a stop or reversal path ran and was recorded.',
        'Append-only history matters because incident review cares about sequence. If approval was granted before a dry run, that is different from approval after a clean dry run. If a scope changed after approval, the system should require a fresh approval or record an explicit override.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness means the workflow mutates the intended system at most once, in the intended scope, under the intended policy. Idempotency keys protect retries. Dry runs protect prerequisites. Canary scopes protect blast radius. SLO gates protect expansion. The append-only ledger protects auditability.',
        'The approval row must bind the approver, role, incident, proposed diff, risk class, expiration time, and runbook version. If approval is stale, the workflow should recheck context or ask again. If execution partially succeeds, the job-state machine must record which steps completed before rollback or retry.',
        'The system should reject silent widening. If a responder approved "restart checkout workers in us-east-1 canary," the job cannot quietly become "restart all checkout workers globally." Scope changes need new approval, a policy rule that allows expansion, or an automatic gate that was already part of the approved action contract.',
      ],
    },
    {
      heading: 'Rollback and Verification',
      paragraphs: [
        'A runbook action is incomplete without a verification rule. The rule should say which metrics define success, how long to watch them, what baseline to compare against, and which failure branch to take. Common checks include error rate, p99 latency, saturation, queue depth, success rate, budget burn, and a business metric tied to the service.',
        'Rollback should be prepared before execution. The workflow should know whether rollback means reverting a feature flag, restoring traffic weights, scaling a pool back down, draining a node, reopening a circuit, or declaring that the action is not safely reversible. If rollback is not available, the approval policy should treat the action as higher risk.',
        'Verification can also decide to hold rather than roll back. A canary may show partial improvement but not enough confidence to expand. Recording "hold" as a first-class decision keeps the ledger honest and prevents responders from treating every non-failure as permission to widen scope.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Checkout version 42 is the leading candidate in a live incident. The system proposes rolling traffic back to version 41. It prepares the feature flag or deployment command, shows the diff, checks that no migration blocks rollback, scopes the first execution to one region, and asks checkout incident command for approval.',
        'The approver sees the incident id, runbook version, target service, proposed scope, dry-run result, expected effect, rollback plan, SLO gate, and expiration time. Approval creates an idempotency key tied to that exact action contract. If the runner retries, it uses the same key and does not create a second rollback job.',
        'After execution, the SLO gate watches p99 latency, 5xx rate, checkout success, queue depth, and error budget burn. If the canary recovers, the workflow expands according to policy. If not, it stops, records that rollback did not mitigate the incident, and preserves the evidence for post-incident review.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Automation trades responder toil for control-plane responsibility. The system must handle stale context, permission boundaries, secret access, runner failures, partial execution, human delay, action drift, and noisy metrics. A weak implementation can add approval ceremony without increasing safety.',
        'The payoff is repeatability under pressure. Low-risk diagnostic actions can become one-click or automatic. Reversible changes can run behind approval, canary, and SLO gates. Dangerous or irreversible mutations should remain manual, or require stronger policy, narrower scope, and named ownership.',
        'The main cost is product and platform work. Teams need a runbook catalog, service ownership data, permissions, metrics contracts, durable workflow state, UI for approvals, audit export, and careful integration with incident tools. The pattern pays off when common actions are frequent enough that safer repetition beats ad hoc heroics.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern wins for common operational actions with known prerequisites and measurable outcomes: restarting a stuck worker group, draining a bad node pool, rolling back a flag, scaling a queue consumer, collecting diagnostics, pausing a risky rollout, or shifting a small slice of traffic.',
        'It is strongest when the action is reversible, starts in a small scope, has clear metrics, and is repeated often enough that humans already follow a stable procedure. It also helps regulated or high-accountability environments because the audit trail is produced as the workflow runs, not assembled afterward.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails for ambiguous incidents that need human diagnosis, actions with hidden side effects, irreversible data changes, and runbooks that have not been decomposed into safe steps. "Has a runbook" does not mean "safe to automate." The runbook must first be split into diagnostics, reversible mutations, and dangerous mutations.',
        'It also fails when approval is treated as a rubber stamp. If responders approve every suggestion because the UI asks them to, the ledger records process but not judgment. Approval screens need enough context for a real decision, and policy should keep high-risk actions out of routine one-click paths.',
      ],
    },
    {
      heading: 'Implementation Guidance',
      paragraphs: [
        'Start with read-only diagnostics and dry-run preparation. That gives responders useful speed without production mutation risk. Then add push-button execution for narrow reversible actions. Fully automatic remediation should be limited to small, well-measured, reversible steps with mature rollback behavior.',
        'Use idempotency keys on every mutation and include the incident id, action id, scope, and runbook version in the key material. Set approval expiration times so stale approvals cannot run after the incident context changes. Store dry-run output and policy evaluation with the approval row.',
        'Build tests around failure, not only success. Simulate stale incident state, duplicate job dispatch, runner crash after partial execution, metric source delay, canary failure, rollback failure, and manual override. The ledger should still explain what happened.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: PagerDuty Automation Actions at https://support.pagerduty.com/main/docs/automation-actions, Rundeck and PagerDuty Runbook Automation at https://docs.rundeck.com/docs/learning/howto/actions-with-rba.html, Temporal Human-in-the-Loop AI Agent at https://docs.temporal.io/ai-cookbook/human-in-the-loop-python, and OpenFeature Evaluation API at https://openfeature.dev/specification/sections/flag-evaluation.',
        'Study AIOps Incident Response, Incident Causal Candidate Graph, Human Approval Interrupt Queue, Temporal Workflow Case Study, Idempotency Keys, Feature Flag Control Plane, Circuit Breakers, SLO Error Budget Burn Rate Alert, and Distributed Tracing next.',
      ],
    },
      {
      heading: 'Why this exists',
      paragraphs: [
        "State the real constraint this topic fixes before introducing the mechanism.",
        "A good opening says what gets too slow, too fragile, or too hard to reason about under baseline behavior.",
        "Without that, every optimization appears decorative.",
      ],
    },

    {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Runbook Automation Approval Ledger Case Study moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};
