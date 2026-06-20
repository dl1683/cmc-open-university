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
    { title: 'Google SRE Book - Managing Incidents', url: 'https://sre.google/sre-book/managing-incidents/' },
  ],
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation traces the lifecycle of a production runbook action through a guarded state machine. In the "approval state" view, active nodes show the current phase of the action -- incident context feeding suggestion and preparation, the approval gate, idempotency key generation, execution, and ledger recording. Found nodes mark guards that have been satisfied. Compare nodes highlight alternative paths not yet taken.',
        'In the "rollback guard" view, active nodes trace the post-execution verification path. The canary check, SLO gate, and rollback node show the three possible outcomes: expand scope, hold, or roll back. The risk plot shows how blast radius scales with automation level under guarded versus unguarded policies.',
        {
          type: 'note',
          content: 'Watch the matrix frames carefully. Each row in the approval ledger matrix answers three questions: what state is the action in, which guard must be satisfied to advance, and what evidence is recorded for audit. The rollback decision table maps metric conditions to deterministic continue/stop/rollback actions.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Incident response is expensive per minute. Google SRE teams measured that mean time to mitigate (MTTM) for major incidents ranges from 40 minutes to several hours, with the first 10 minutes dominated by orientation -- finding the right runbook, identifying the service owner, checking prerequisites, and getting approval. For incident classes that repeat monthly, those 10 minutes of orientation happen 12 times a year per class, with the same sequence of copy-paste commands and Slack approvals.',
        'Automation can compress that orientation phase to seconds. But unguarded automation can also make an outage worse. A restart command pasted from a stale runbook can hit the wrong service version. A retry can run the same database migration twice. An overbroad scope can turn a single-region degradation into a global outage. A missing verification step can make the team believe recovery happened when latency is still climbing.',
        {
          type: 'quote',
          content: 'The problem is not that incident automation is dangerous. The problem is that incident automation without durable state is dangerous. If you cannot replay the decision chain from a ledger, your automation is a gun without a safety.',
          source: 'Operational automation design principle',
        },
        'A runbook automation approval ledger is the control-plane record for operational actions. It is not a ticket system and not a chat log. It is an append-only data structure that binds incident context, suggested mitigations, dry-run output, human approvals, idempotency keys, execution jobs, verification outcomes, and rollback decisions into a single replayable trace.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is a wiki runbook with chat-based approval. A responder receives an alert, opens the wiki page, reads the steps, pastes the command into a terminal or chatbot, and someone in the incident channel replies "approved" or gives a thumbs-up. The responder executes the command, watches a dashboard, and reports the outcome in the channel.',
        {
          type: 'code',
          language: 'text',
          content: '# Typical chat-based runbook execution\n\n[03:42 AM] alert-bot: checkout-svc p99 > 2s in us-east-1\n[03:44 AM] on-call: looks like v42 regression, going to roll back\n[03:44 AM] on-call: @ic approved to rollback checkout to v41?\n[03:45 AM] ic-lead: approved\n[03:46 AM] on-call: kubectl rollout undo deployment/checkout -n prod\n[03:47 AM] on-call: watching grafana... latency dropping\n[03:52 AM] on-call: looks good, closing',
        },
        'This works for rare incidents with clear ownership and low time pressure. It requires no tooling, no infrastructure, and no permission model beyond "the person in the channel said yes." Early-stage teams operate this way for years without incident because their action frequency is low and their responders know the systems well.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Chat-based approval hits multiple walls as action frequency and team size grow.',
        {
          type: 'table',
          headers: ['Failure mode', 'What happens', 'Why chat cannot fix it'],
          rows: [
            ['Stale context', 'Approval was for v42 rollback; v43 deployed since', 'Chat has no binding between approval text and current system state'],
            ['Duplicate execution', 'Two responders paste the same command 30 seconds apart', 'Chat has no idempotency key; "did this already run?" requires scrolling'],
            ['Scope creep', 'Approved for us-east-1; executed globally', 'Chat approval text is freeform; no machine-readable scope constraint'],
            ['Missing verification', 'Team declares recovery; p99 climbs again 5 minutes later', 'No automated SLO gate; "looks good" is the only check'],
            ['Lost audit trail', 'Post-incident review asks who approved what and when', 'Chat messages are edited, deleted, split across threads, or in DMs'],
            ['Partial execution', 'Runner crashes mid-rollback; half the pods are v41, half v42', 'Chat has no job state machine; retry means re-pasting the command'],
          ],
        },
        'The core invariant that chat violates: approval must be bound to a specific action contract (incident, runbook version, scope, prerequisites, expiration), and that binding must be machine-readable so the execution system can enforce it. A thumbs-up emoji next to freeform text satisfies none of these requirements.',
        'Production mutations need more than intent. The system must know which incident the action belongs to, which runbook version was used, who approved it, which policy allowed it, whether prerequisites still hold, whether the command already ran, and what metrics decide success or rollback. Chat captures intent. A ledger captures contract.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat runbook automation as a guarded state machine, not a shortcut from alert to shell command. Suggest, prepare, approve, execute, verify, and rollback are separate states. Each transition has a guard. Each guard leaves evidence in an append-only ledger.',
        {
          type: 'diagram',
          content: 'Incident Context\n      |\n      +---> Suggest (rank candidates by symptom match)\n      |         |\n      +---> Prepare (dry-run, check prerequisites)\n                |         |\n                +----+----+\n                     |\n                  Approve (human gate, policy check)\n                     |\n                Idempotency Key (hash of incident+action+scope+version)\n                     |\n                  Execute (bounded job under idem key)\n                     |\n              +------+------+\n              |             |\n           Canary        SLO Gate\n           (1% scope)    (metrics vs contract)\n              |             |\n              +------+------+\n                     |\n              +------+------+\n              |      |      |\n           Expand   Hold  Rollback\n              |      |      |\n              +------+------+\n                     |\n                  Ledger (append-only audit record)',
        },
        'The invariant: every production mutation advances only after its guard is satisfied, and every mutation carries an idempotency key, a bounded blast radius, a verification gate, and a rollback record. If the ledger cannot prove those four facts for every action, the automation is not safe for broad use.',
        {
          type: 'note',
          content: 'This turns runbook automation from a pile of scripts into an operational data structure. The ledger is append-only history. The approval queue is a policy boundary. The job state machine is the execution record. The SLO gate is the outcome check. The rollback plan is part of the action contract, not an afterthought bolted on during a post-incident review.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {
          type: 'heading',
          level: 3,
          content: 'Stage 1: Suggest -- ranking candidate actions',
        },
        'When an incident fires, the system matches the alert signature (service, symptom, severity, region) against a runbook catalog. Each runbook entry declares which alert patterns it addresses, what permissions it requires, what risk class it carries, and what prerequisites must hold. The suggestion engine ranks candidates by symptom match confidence and presents the top matches to the responder.',
        'Suggestion is read-only. It does not prepare commands or check live prerequisites. Its output is a ranked list of candidate action IDs with match reasons. The responder picks one or ignores the suggestions entirely.',
        {
          type: 'heading',
          level: 3,
          content: 'Stage 2: Prepare -- dry run and prerequisite check',
        },
        'Preparation turns a candidate into a concrete action plan. The system fetches current service state, checks that prerequisites hold (no blocking migration in progress, no conflicting action running, deployment version matches expected), generates the command or workflow diff, and runs a dry-run pass that must be side-effect-free.',
        {
          type: 'code',
          language: 'json',
          content: '{\n  "action_id": "act-20260620-003",\n  "incident_id": "inc-8842",\n  "runbook_version": "rb-checkout-rollback-v7",\n  "service": "checkout-svc",\n  "proposed_mutation": "rollout undo deployment/checkout",\n  "scope": "us-east-1 canary (1% traffic)",\n  "prerequisites_checked": [\n    {"check": "no_blocking_migration", "result": "pass"},\n    {"check": "v41_image_available", "result": "pass"},\n    {"check": "no_conflicting_action", "result": "pass"}\n  ],\n  "dry_run_hash": "sha256:a4f8c2...",\n  "expected_effect": "p99 latency below 500ms within 5 minutes",\n  "rollback_plan": "rollout undo to v42 (forward re-deploy)",\n  "risk_class": "medium",\n  "expiration": "2026-06-20T04:15:00Z"\n}',
        },
        'The preparation output becomes the action contract. Everything the approver needs to evaluate and everything the executor needs to enforce is in this document. If any field changes after approval, the system must either reject execution or record an explicit override.',
        {
          type: 'heading',
          level: 3,
          content: 'Stage 3: Approve -- human gate with policy binding',
        },
        'Approval is not decoration. It is the gate that binds a human decision to a specific action contract. The approver sees the incident context, proposed mutation, scope, dry-run result, expected effect, rollback plan, risk class, and expiration time. Approval creates a signed record linking the approver identity, role, timestamp, and the exact action contract hash.',
        'Policy determines who can approve. A low-risk diagnostic (collect thread dumps) might auto-approve. A medium-risk reversible action (rollback one region) requires the incident commander. A high-risk irreversible action (drop a database index) requires a named service owner plus a second approver.',
        {
          type: 'table',
          headers: ['Risk class', 'Example action', 'Approval policy', 'Expiration'],
          rows: [
            ['Low', 'Collect diagnostics, read-only queries', 'Auto-approve or any responder', '30 minutes'],
            ['Medium', 'Restart workers, rollback one region, scale consumers', 'Incident commander', '15 minutes'],
            ['High', 'Global rollback, traffic drain, config mutation', 'Service owner + IC', '10 minutes'],
            ['Critical', 'Data migration reversal, schema change, irreversible', 'VP-eng + service owner, no auto-expand', '5 minutes'],
          ],
        },
        {
          type: 'heading',
          level: 3,
          content: 'Stage 4: Execute -- idempotent job under bounded scope',
        },
        'Approval triggers idempotency key generation. The key is a hash of incident ID, action ID, scope, and runbook version. If the runner crashes and retries, it presents the same key. The execution system checks whether a job with that key already ran, is running, or was rolled back. Duplicate submissions are safely rejected.',
        'Execution starts at canary scope -- typically 1% of traffic or a single availability zone. The job runs under the exact parameters in the action contract. Scope widening requires either a pre-approved expansion policy in the contract or a new approval cycle.',
        {
          type: 'heading',
          level: 3,
          content: 'Stage 5: Verify and decide -- SLO gate, canary, rollback',
        },
        'After execution, the SLO gate watches a defined set of metrics against the action contract. Common checks: error rate, p99 latency, success rate, queue depth, error budget burn rate. The gate runs for a configured observation window (typically 5-15 minutes for latency-sensitive services) and produces one of four decisions.',
        {
          type: 'table',
          headers: ['Decision', 'Condition', 'Next step'],
          rows: [
            ['Expand', 'All metrics within contract thresholds', 'Widen scope per expansion policy'],
            ['Hold', 'Partial improvement, insufficient confidence', 'Keep current scope, extend observation'],
            ['Cap', 'Cost or resource limit reached', 'Freeze scope, notify operator'],
            ['Rollback', 'Any metric violates contract threshold', 'Execute rollback plan, record reason'],
          ],
        },
      ],
    },
    {
      heading: 'Ledger data model',
      paragraphs: [
        'The ledger is append-only. Each row records a state transition, not just a final outcome. The sequence matters: approval before a dry run is different from approval after a clean dry run. Scope change after approval must trigger re-approval or an explicit override record.',
        {
          type: 'code',
          language: 'text',
          content: 'Ledger Row Schema\n------------------\nincident_id        string    -- which incident this action belongs to\naction_id          string    -- unique action identifier\nrunbook_version    string    -- exact runbook revision used\nstate              enum      -- suggested | prepared | approved | executing\n                                | verified | rolled_back | expired | failed\ntransition_time    timestamp -- when this state was entered\nactor              string    -- who or what caused the transition\nguard_evidence     object    -- what satisfied the guard for this transition\nproposed_diff      string    -- the mutation command or workflow plan\ntarget_scope       string    -- region, percentage, availability zone\napproval_policy    string    -- which policy authorized this action\nexpiration         timestamp -- when this approval or action expires\ndry_run_hash       string    -- sha256 of dry-run output for binding\nidempotency_key    string    -- hash(incident_id + action_id + scope + version)\nexecution_job_id   string    -- reference to the job runner\nverification       object    -- metric results from the SLO gate\nrollback_result    object    -- what rollback did and whether it succeeded',
        },
        {
          type: 'note',
          content: 'The state field is not a single column that gets overwritten. Each transition appends a new row. The current state of an action is the latest row for that action_id. This preserves the full decision chain: who suggested, what the dry run showed, who approved, what scope was authorized, what metrics the SLO gate observed, and why the system expanded, held, or rolled back.',
        },
        'Six states define the lifecycle. Suggested means the system matched the incident to a runbook. Prepared means the command exists and prerequisites were verified. Approved means a policy owner accepted the risk for a specific scope and expiration window. Executing means a job is running under an idempotency key. Verified means SLO metrics matched the action contract. Rolled back means the reversal path ran and its own outcome was recorded.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on five guards, each protecting a different failure mode.',
        {
          type: 'table',
          headers: ['Guard', 'Protects against', 'Mechanism'],
          rows: [
            ['Dry run', 'Stale prerequisites, wrong target', 'Side-effect-free check; hash binds result to approval'],
            ['Approval binding', 'Unauthorized mutation, scope creep', 'Approval is tied to exact action contract hash'],
            ['Idempotency key', 'Duplicate execution on retry', 'Hash of incident + action + scope + version; reject duplicates'],
            ['Canary scope', 'Blast radius expansion', 'Start at 1%; expansion requires policy or re-approval'],
            ['SLO gate', 'False recovery, undetected regression', 'Metrics vs contract thresholds for observation window'],
          ],
        },
        'The append-only ledger ties these guards together into a provable chain. Post-incident review does not reconstruct decisions from chat logs. It reads the ledger forward and checks: was each guard satisfied before the transition? Was the scope consistent between approval and execution? Did the SLO gate observe metrics for the required window? Did rollback run to completion?',
        'Silent widening is the most dangerous failure this architecture prevents. If a responder approved "restart checkout workers in us-east-1 canary," the execution system rejects any attempt to widen to all regions without either a pre-approved expansion policy in the original contract or a new approval cycle. The idempotency key encodes the scope, so a changed scope generates a different key and triggers the approval gate again.',
        {
          type: 'quote',
          content: 'Approval without scope binding is not approval. It is a wish.',
          source: 'Incident automation design heuristic',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace a checkout service rollback through the full approval ledger pipeline.',
        {
          type: 'code',
          language: 'text',
          content: 'Timeline: Checkout v42 regression in us-east-1\n\nt=0:00  Alert fires: checkout-svc p99 > 2000ms in us-east-1\nt=0:02  Suggest: runbook "checkout-rollback-v7" ranked #1 (symptom: latency spike\n        after deploy, confidence: 0.92)\nt=0:03  Prepare: dry-run checks v41 image available, no blocking migration,\n        no conflicting action. Generates rollout-undo command. Scope: us-east-1\n        canary (1% traffic). dry_run_hash: sha256:a4f8c2...\nt=0:05  Approve: IC-lead approves. Policy: medium-risk requires IC.\n        Approval binds to action contract hash. Expiration: 15 minutes.\nt=0:05  Idempotency key generated: sha256(inc-8842 + act-003 + us-east-1-canary\n        + rb-checkout-rollback-v7) = idem-key-7f3a...\nt=0:06  Execute: job-runner starts rollout undo for 1% canary under idem-key-7f3a\nt=0:08  Runner network timeout. Retry with same idem-key-7f3a.\n        Execution system: key already active, skip duplicate.\nt=0:09  Canary rollout complete. SLO gate starts 5-minute observation.\nt=0:14  SLO gate: p99 dropped from 2100ms to 380ms, 5xx rate 0.1% -> 0.02%,\n        checkout success 94% -> 99.1%. All within contract. Decision: EXPAND.\nt=0:15  Expansion policy: approved contract allows auto-expand to full us-east-1.\n        New idem key for expanded scope. Full region rollout begins.\nt=0:20  SLO gate on full region: all metrics within contract. Decision: HOLD\n        (do not expand to other regions without new approval).\nt=0:21  Ledger records 8 rows: suggested, prepared, approved, executing (canary),\n        verified (canary, expand), executing (full region), verified (region, hold).',
        },
        'Three things to notice. First, the network timeout at t=0:08 was harmless because the idempotency key prevented a second rollout job from starting. Second, expansion from canary to full region used a pre-approved policy in the original contract -- no new approval cycle was needed. Third, the ledger stopped expansion at the region boundary because the contract did not authorize cross-region rollback. A global rollback would require a new approval cycle with a new scope.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Component', 'Build cost', 'Operational cost', 'What drives it'],
          rows: [
            ['Runbook catalog', 'High (months)', 'Medium (maintenance)', 'Service count x action types; version control'],
            ['Approval UI/API', 'Medium (weeks)', 'Low', 'Policy rules per risk class; mobile-friendly for 3 AM'],
            ['Idempotency key store', 'Low (days)', 'Low', 'Key-value store with TTL; O(1) lookup per execution'],
            ['Durable workflow engine', 'High (build) or medium (buy)', 'Medium', 'Temporal/Step Functions; state persistence across failures'],
            ['SLO gate', 'Medium (weeks)', 'Medium', 'Metrics pipeline latency; baseline computation; threshold tuning'],
            ['Append-only ledger', 'Low (days)', 'Low', 'Write-ahead log or event store; query for post-incident review'],
            ['Rollback planner', 'High (per action type)', 'High', 'Each action needs a tested reverse; some are irreversible'],
          ],
        },
        'The dominant cost is not the ledger itself. It is the organizational work: building a runbook catalog with machine-readable action contracts, establishing service ownership data, defining metric contracts per service, and integrating with existing incident management tools. A team that has never formalized its runbooks will spend months on catalog creation before the approval ledger adds value.',
        'The payoff is repeatability under pressure. Without the ledger, a team running 20 incident actions per month relies on 20 ad-hoc chat-based coordination sequences, each with its own failure modes. With the ledger, common actions run through a tested pipeline. Low-risk diagnostics become one-click. Reversible changes run behind approval, canary, and SLO gates. The audit trail is produced as the workflow runs, not assembled afterward from Slack exports.',
        {
          type: 'note',
          content: 'A weak implementation can add approval ceremony without increasing safety. If the approval UI shows a wall of JSON and responders click "approve" reflexively at 3 AM, the ledger records process but not judgment. The approval screen must surface the three things that matter: what will change, how big is the blast radius, and what happens if it fails.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'PagerDuty Automation Actions: integrates runbook execution into the incident timeline. Actions run as jobs on PagerDuty runners with approval gates, execution logs, and incident binding. The action output appears in the incident timeline as a first-class event.',
            'Rundeck / PagerDuty Runbook Automation: provides a job execution engine with access control, logging, key-value storage for idempotency, and webhook triggers from alert systems. Jobs can be scoped to node filters (canary equivalent) and chained with conditional logic.',
            'Temporal durable workflows: a workflow function can pause at a human-approval signal and resume from persisted state hours or days later. The approval is a recorded event in the workflow history, not an external chat message. Retries, timeouts, and compensation (rollback) are built into the programming model.',
            'AWS Systems Manager Automation: runbooks as state machines with approval steps, conditional branching, and CloudWatch metric gates. Supports change calendars that block execution during maintenance windows.',
            'Shoreline.io incident automation: converts runbook wiki pages into executable actions with parameter binding, approval policies, canary execution, and metric-based verification. Targets the "wiki runbook to guarded automation" migration path.',
          ],
        },
        'The pattern fits any operational domain where: actions repeat across incidents, mutations are reversible at small scope, verification metrics exist, and audit trails are required. It is strongest in regulated industries (finance, healthcare, government) where post-incident accountability demands provable decision chains.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Root cause'],
          rows: [
            ['Rubber-stamp approval', 'Every action approved in < 5 seconds', 'Approval UI shows too much or too little context; responders are fatigued'],
            ['Catalog rot', 'Runbook v3 references a service that was renamed 6 months ago', 'No ownership or version-control discipline on the catalog'],
            ['Metric gap', 'SLO gate passes but users still report errors', 'Verification metrics do not cover the user-facing symptom'],
            ['Irreversible action in the pipeline', 'Rollback plan says "not reversible" but action was auto-approved', 'Policy did not gate irreversible actions at a higher risk class'],
            ['Stale approval', 'Approval was for v41 rollback; v43 deployed since approval', 'Expiration window too long; no prerequisite recheck at execution time'],
            ['Over-engineering', 'Simple restart takes 10 approval steps', 'All actions routed through the same heavyweight pipeline regardless of risk'],
          ],
        },
        'The deepest failure is treating "has a runbook" as "safe to automate." A runbook that says "check the logs, use your judgment, then maybe restart" is not automatable. Automation requires the runbook to be decomposed into three categories: read-only diagnostics (always safe), reversible mutations with measurable outcomes (automatable with guards), and irreversible or judgment-heavy actions (keep manual, or require stronger policy and narrower scope).',
        'The pattern also fails when approval becomes a compliance checkbox rather than a decision point. If the approval rate is 100% and the average approval time is under 5 seconds, the gate is not providing safety -- it is providing paperwork. Fix the approval UI to surface only the information needed for a real decision, and use policy to keep high-risk actions out of routine one-click paths.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Start with the lowest-risk tier and expand upward.',
        {
          type: 'bullets',
          items: [
            'Phase 1 -- Read-only diagnostics: collect thread dumps, query dashboards, fetch recent deployments. No production mutation. Auto-approve. This gives responders speed without risk and validates the suggestion engine and catalog.',
            'Phase 2 -- Push-button reversible actions: restart a worker group, rollback a feature flag, scale a queue consumer. Requires IC approval, canary scope, and SLO gate. This validates the approval binding, idempotency key, and verification pipeline.',
            'Phase 3 -- Guarded automatic remediation: for narrow, well-measured, frequently-repeated actions (restart stuck workers when queue depth exceeds threshold). Requires mature rollback behavior, tested metric baselines, and a demonstrated low false-positive rate on the SLO gate.',
            'Phase 4 -- Cross-action orchestration: chained actions where the output of one feeds the input of the next (drain node, then restart service, then restore traffic). Each step has its own guard and ledger entry. Failure at any step triggers rollback of the entire chain.',
          ],
        },
        {
          type: 'heading',
          level: 3,
          content: 'Idempotency key design',
        },
        {
          type: 'code',
          language: 'text',
          content: 'idempotency_key = sha256(\n  incident_id   +  // which incident\n  action_id     +  // which action\n  target_scope  +  // region, percentage, AZ\n  runbook_version  // exact runbook revision\n)\n\n// Scope change -> different key -> requires new approval\n// Runbook update -> different key -> requires re-preparation\n// Same action retried -> same key -> executor rejects duplicate',
        },
        'Set approval expiration times proportional to risk class. A low-risk diagnostic approval can last 30 minutes. A high-risk mutation approval should expire in 5-10 minutes. If the incident context changes between approval and execution (new deployment, scope change, metric shift), the system should either block execution or record an explicit override with the new context.',
        {
          type: 'heading',
          level: 3,
          content: 'Testing the failure path',
        },
        'Build tests around failure, not only success. The ledger must still explain what happened when things go wrong.',
        {
          type: 'bullets',
          items: [
            'Stale context: approve an action, change the deployment version, attempt execution. The system should detect the prerequisite mismatch and block or re-approve.',
            'Duplicate dispatch: submit the same idempotency key twice simultaneously. The system should accept exactly one and reject the other.',
            'Runner crash: start execution, kill the runner mid-job. On restart, the system should detect the partial state from the idempotency key and either resume or rollback -- not start a second job.',
            'Metric source delay: SLO gate cannot fetch metrics for 2 minutes. The system should extend the observation window, not declare success on missing data.',
            'Rollback failure: the rollback action itself fails. The ledger must record the rollback failure and escalate to human intervention.',
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'heading',
          level: 3,
          content: 'Primary sources',
        },
        {
          type: 'bullets',
          items: [
            'PagerDuty Automation Actions documentation: the action and runner model for incident-triggered automation with approval gates and incident timeline binding.',
            'Rundeck / PagerDuty Runbook Automation: job execution engine with access control, node filters (scope), logging, and webhook triggers from alert systems.',
            'Temporal human-in-the-loop workflows: durable execution with approval signals, compensation (rollback), and full workflow history as an audit trail.',
            'Google SRE Book, Chapter 14 (Managing Incidents): the incident command structure, communication protocols, and post-incident review process that this automation pattern formalizes.',
            'OpenFeature Evaluation API: flag evaluation contracts and context binding -- relevant for the feature-flag-rollback variant of runbook actions.',
          ],
        },
        {
          type: 'heading',
          level: 3,
          content: 'Study next',
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: state machines and guard conditions -- the approval ledger is a state machine where each transition requires a guard to be satisfied before advancing.',
            'Prerequisite: idempotency keys and exactly-once semantics -- how to prevent duplicate execution in distributed systems with retries.',
            'Extension: SLO error budget burn rate alerting -- the metric framework that feeds the SLO gate in the verification phase.',
            'Extension: Temporal workflow case study -- the durable execution engine that implements the pause-for-approval-and-resume pattern.',
            'Contrast: feature flag control plane -- a related but different guarded mutation pattern where the "action" is a flag evaluation change and the "canary" is a percentage rollout.',
            'Related case study: circuit breakers -- the automatic rollback mechanism that protects downstream services when error rates exceed thresholds.',
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
            'State the invariant the approval ledger preserves about scope binding in one sentence.',
            'A responder approves an action at t=0. The approval expires at t=15min. At t=12min, a new deployment lands. Should execution proceed? What does the ledger record?',
            'The runner crashes after starting a canary rollback. The runner restarts and retries with the same idempotency key. Trace what the execution system does and what the ledger records.',
            'An SLO gate observes p99 latency improving but 5xx rate flat. The action contract requires both metrics to improve. What decision does the gate produce?',
            'A team approves every action in under 5 seconds with a 100% approval rate. Is the approval gate providing safety? What change would you make?',
          ],
        },
      ],
    },
  ],
};
