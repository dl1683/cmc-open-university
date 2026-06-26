// LLM model rollout: canary and shadow traffic need release ledgers, stable
// targeting, telemetry, eval gates, and rollback proof.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'llm-model-rollout-shadow-canary-ledger-case-study',
  title: 'LLM Model Rollout Shadow Canary Ledger',
  category: 'Systems',
  summary: 'A production LLM rollout case study: stable canary cohorts, shadow traffic, eval slices, cache-version boundaries, guardrail gates, telemetry, and rollback ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['canary gate', 'shadow diff', 'rollback audit'], defaultValue: 'canary gate' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function rolloutGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'flag', label: 'flag', x: 0.7, y: 3.5, note: notes.flag ?? 'cohort' },
      { id: 'split', label: 'split', x: 2.4, y: 3.5, note: notes.split ?? 'pct' },
      { id: 'stable', label: 'stable', x: 4.2, y: 2.0, note: notes.stable ?? 'v1' },
      { id: 'canary', label: 'canary', x: 4.2, y: 3.5, note: notes.canary ?? 'v2' },
      { id: 'shadow', label: 'shadow', x: 4.2, y: 5.0, note: notes.shadow ?? 'no serve' },
      { id: 'tele', label: 'tele', x: 6.2, y: 3.5, note: notes.tele ?? 'spans' },
      { id: 'gate', label: 'gate', x: 7.8, y: 3.5, note: notes.gate ?? 'SLO' },
      { id: 'roll', label: 'roll', x: 9.1, y: 2.5, note: notes.roll ?? 'up' },
      { id: 'back', label: 'back', x: 9.1, y: 4.5, note: notes.back ?? 'undo' },
    ],
    edges: [
      { id: 'e-flag-split', from: 'flag', to: 'split' },
      { id: 'e-split-stable', from: 'split', to: 'stable' },
      { id: 'e-split-canary', from: 'split', to: 'canary' },
      { id: 'e-split-shadow', from: 'split', to: 'shadow' },
      { id: 'e-stable-tele', from: 'stable', to: 'tele' },
      { id: 'e-canary-tele', from: 'canary', to: 'tele' },
      { id: 'e-shadow-tele', from: 'shadow', to: 'tele' },
      { id: 'e-tele-gate', from: 'tele', to: 'gate' },
      { id: 'e-gate-roll', from: 'gate', to: 'roll' },
      { id: 'e-gate-back', from: 'gate', to: 'back' },
    ],
  }, { title });
}

function riskPlot(markers = []) {
  return plotState({
    axes: { x: { label: 'traffic', min: 0, max: 100 }, y: { label: 'risk', min: 0, max: 100 } },
    series: [
      { id: 'blind', label: 'blind', points: [{ x: 1, y: 10 }, { x: 10, y: 25 }, { x: 25, y: 45 }, { x: 50, y: 70 }, { x: 100, y: 100 }] },
      { id: 'gated', label: 'gated', points: [{ x: 1, y: 4 }, { x: 10, y: 8 }, { x: 25, y: 15 }, { x: 50, y: 26 }, { x: 100, y: 40 }] },
      { id: 'shadow', label: 'shadow', points: [{ x: 1, y: 2 }, { x: 10, y: 5 }, { x: 25, y: 9 }, { x: 50, y: 17 }, { x: 100, y: 30 }] },
    ],
    markers,
  });
}

function diffPlot(markers = []) {
  return plotState({
    axes: { x: { label: 'slice', min: 0, max: 6 }, y: { label: 'delta', min: -12, max: 12 } },
    series: [
      { id: 'quality', label: 'quality', points: [{ x: 1, y: 2 }, { x: 2, y: 1 }, { x: 3, y: -5 }, { x: 4, y: 3 }, { x: 5, y: -8 }, { x: 6, y: 1 }] },
      { id: 'latency', label: 'latency', points: [{ x: 1, y: 1 }, { x: 2, y: 3 }, { x: 3, y: 8 }, { x: 4, y: 2 }, { x: 5, y: 10 }, { x: 6, y: 3 }] },
      { id: 'cost', label: 'cost', points: [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 4 }, { x: 4, y: 5 }, { x: 5, y: 7 }, { x: 6, y: 2 }] },
    ],
    markers,
  });
}

function* canaryGate() {
  yield {
    state: rolloutGraph('A rollout is a governed traffic split'),
    highlight: { active: ['flag', 'split', 'stable', 'canary', 'e-flag-split', 'e-split-canary'], compare: ['shadow'] },
    explanation: 'Canary release is not a boolean deploy. A flag or serving control plane maps stable cohorts to a small percentage of the candidate model while the old model remains the default.',
  };

  yield {
    state: labelMatrix(
      'Release packet',
      [
        { id: 'model', label: 'model' },
        { id: 'prompt', label: 'prompt' },
        { id: 'cache', label: 'cache' },
        { id: 'guard', label: 'guard' },
        { id: 'eval', label: 'eval' },
      ],
      [
        { id: 'id', label: 'id' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['v2', 'slices'],
        ['tmpl', 'diff'],
        ['key', 'no mix'],
        ['policy', 'deny'],
        ['gold', 'pass'],
      ],
    ),
    highlight: { active: ['model:gate', 'cache:gate', 'guard:gate', 'eval:gate'], found: ['prompt:id'] },
    explanation: 'The release packet should bind model version, prompt template version, cache-key version, guardrail policy, and evaluation evidence. Without versioned keys, a canary can reuse unsafe stable-cache state.',
    invariant: 'Never mix cache, eval, or telemetry across model and prompt versions without an explicit key.',
  };

  yield {
    state: riskPlot([
      { id: 'step', x: 10, y: 8, label: '10%' },
      { id: 'hold', x: 25, y: 15, label: 'hold' },
    ]),
    highlight: { active: ['gated', 'step', 'hold'], compare: ['blind'], found: ['shadow'] },
    explanation: 'The percentage schedule is a risk curve. Small cohorts find obvious regressions. Larger cohorts need slice-level proof because rare tenants, long prompts, and tool calls may not appear at 1 percent.',
  };

  yield {
    state: labelMatrix(
      'Canary steps',
      [
        { id: 's0', label: '0%' },
        { id: 's1', label: '1%' },
        { id: 's10', label: '10%' },
        { id: 's25', label: '25%' },
        { id: 's100', label: '100%' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'stop', label: 'stop' },
      ],
      [
        ['shadow', 'crash'],
        ['SLO', 'p99'],
        ['slice', 'quality'],
        ['cost', 'guard'],
        ['proof', 'drift'],
      ],
    ),
    highlight: { active: ['s0:need', 's1:need', 's10:need', 's25:need'], compare: ['s100:stop'] },
    explanation: 'Each ramp step needs a different gate: shadow parity first, then live SLO, then quality slices, then cost and guardrail checks before full promotion.',
  };

  yield {
    state: rolloutGraph('Promotion requires both telemetry and rollback', { gate: 'pass?', roll: 'promote', back: 'pin v1' }),
    highlight: { active: ['tele', 'gate', 'roll', 'back', 'e-tele-gate'], found: ['e-gate-roll'], removed: ['e-gate-back'] },
    explanation: 'A rollout is ready when the evidence packet says promote and the rollback path is already tested. If rollback is manual archaeology, the canary is not safe yet.',
  };
}

function* shadowDiff() {
  yield {
    state: rolloutGraph('Shadow traffic compares without serving the answer', { stable: 'serves', canary: 'maybe', shadow: 'fork', tele: 'diff' }),
    highlight: { active: ['stable', 'shadow', 'tele', 'e-split-shadow', 'e-shadow-tele'], compare: ['canary'] },
    explanation: 'Shadow mode forks real prompts to the candidate, records the output, and serves the stable answer to the user. It is a measurement path, not a production path.',
  };

  yield {
    state: labelMatrix(
      'Shadow diff row',
      [
        { id: 'input', label: 'input' },
        { id: 'out', label: 'output' },
        { id: 'tools', label: 'tools' },
        { id: 'safe', label: 'safety' },
        { id: 'cost', label: 'cost' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'check', label: 'check' },
      ],
      [
        ['hash', 'same'],
        ['score', 'slice'],
        ['calls', 'deny'],
        ['policy', 'pass'],
        ['tokens', 'cap'],
      ],
    ),
    highlight: { active: ['input:field', 'out:check', 'safe:check', 'cost:check'], compare: ['tools:check'] },
    explanation: 'Shadow comparison needs a row per prompt: input hash, output score, tool-call diff, safety verdict, token cost, latency, model id, prompt version, and cache-key version.',
  };

  yield {
    state: diffPlot([
      { id: 'code', x: 3, y: -5, label: 'code' },
      { id: 'long', x: 5, y: -8, label: 'long' },
    ]),
    highlight: { active: ['quality', 'latency', 'code', 'long'], compare: ['cost'] },
    explanation: 'Average quality can look fine while code or long-context slices regress. Shadow traffic is useful because it preserves real distribution shape before users see the candidate output.',
  };

  yield {
    state: labelMatrix(
      'Slice ledger',
      [
        { id: 'chat', label: 'chat' },
        { id: 'rag', label: 'RAG' },
        { id: 'code', label: 'code' },
        { id: 'agent', label: 'agent' },
        { id: 'tenant', label: 'tenant' },
      ],
      [
        { id: 'sample', label: 'sample' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['10k', 'SLO'],
        ['5k', 'faith'],
        ['2k', 'tests'],
        ['1k', 'tools'],
        ['min', 'policy'],
      ],
    ),
    highlight: { active: ['code:gate', 'agent:gate', 'tenant:gate'], found: ['rag:gate'] },
    explanation: 'Rollout gates should be sliced by workload, not just global traffic. RAG faithfulness, code tests, agent tool behavior, and tenant policy can fail independently.',
  };

  yield {
    state: rolloutGraph('Candidate output can be blocked before canary', { shadow: 'diff', gate: 'eval', back: 'block' }),
    highlight: { active: ['shadow', 'tele', 'gate', 'back', 'e-shadow-tele', 'e-tele-gate', 'e-gate-back'], compare: ['roll'] },
    explanation: 'The best failure is a shadow failure. It blocks promotion before the candidate serves real answers, and it leaves enough diff evidence to fix the model, prompt, or policy.',
  };
}

function* rollbackAudit() {
  yield {
    state: labelMatrix(
      'Rollback keys',
      [
        { id: 'flag', label: 'flag' },
        { id: 'route', label: 'route' },
        { id: 'cache', label: 'cache' },
        { id: 'prompt', label: 'prompt' },
        { id: 'eval', label: 'eval' },
      ],
      [
        { id: 'pin', label: 'pin' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['v1', 'cohort'],
        ['stable', 'span'],
        ['v1 key', 'purge'],
        ['tmpl1', 'hash'],
        ['old ok', 'diff'],
      ],
    ),
    highlight: { active: ['flag:pin', 'route:pin', 'cache:pin', 'prompt:pin'], found: ['eval:proof'] },
    explanation: 'Rollback is more than sending traffic to v1. It may need old prompt templates, stable cache keys, guardrail policy pins, and telemetry that proves requests stopped hitting the bad revision.',
  };

  yield {
    state: rolloutGraph('Rollback pins traffic and cache boundaries', { split: '0%', canary: 'off', shadow: 'keep?', gate: 'fail', back: 'v1 only' }),
    highlight: { active: ['split', 'canary', 'gate', 'back', 'e-gate-back'], compare: ['roll'], found: ['stable'] },
    explanation: 'When a gate fails, route live traffic back to the last known good revision and decide separately whether shadow traffic should continue for diagnosis.',
  };

  yield {
    state: labelMatrix(
      'Stop rules',
      [
        { id: 'slo', label: 'SLO' },
        { id: 'safe', label: 'safe' },
        { id: 'cost', label: 'cost' },
        { id: 'cache', label: 'cache' },
        { id: 'eval', label: 'eval' },
      ],
      [
        { id: 'metric', label: 'metric' },
        { id: 'act', label: 'act' },
      ],
      [
        ['p99', 'back'],
        ['deny', 'block'],
        ['$/tok', 'hold'],
        ['leak', 'purge'],
        ['slice', 'fail'],
      ],
    ),
    highlight: { active: ['slo:act', 'safe:act', 'cache:act'], compare: ['cost:act'], found: ['eval:act'] },
    explanation: 'Stop rules must be machine-readable. A p99 spike, safety regression, cache-key leak, or critical eval slice failure should stop the rollout without waiting for a meeting.',
  };

  yield {
    state: riskPlot([
      { id: 'abort', x: 25, y: 15, label: 'abort' },
    ]),
    highlight: { active: ['gated', 'abort'], compare: ['blind'] },
    explanation: 'Rollback converts a rising risk curve into a bounded blast radius. The earlier the stop rule fires, the smaller the incident surface.',
  };

  yield {
    state: labelMatrix(
      'Ship checklist',
      [
        { id: 'cohort', label: 'cohort' },
        { id: 'shadow', label: 'shadow' },
        { id: 'cache', label: 'cache' },
        { id: 'gate', label: 'gate' },
        { id: 'undo', label: 'undo' },
      ],
      [
        { id: 'prove', label: 'prove' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['stable', 'hash'],
        ['diff', 'PII'],
        ['version', 'purge'],
        ['slice', 'auto'],
        ['pin v1', 'trace'],
      ],
    ),
    highlight: { active: ['cohort:prove', 'shadow:prove', 'cache:guard', 'undo:prove'], compare: ['gate:guard'] },
    explanation: 'Before shipping, prove stable cohort assignment, privacy-safe shadow logging, versioned caches, automatic stop gates, and rollback traces that show the bad revision is no longer serving.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'canary gate') yield* canaryGate();
  else if (view === 'shadow diff') yield* shadowDiff();
  else if (view === 'rollback audit') yield* rollbackAudit();
  else throw new InputError('Pick an LLM rollout view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as the state machine for LLM model rollout shadow canary ledger. Active items are the current decision point, found items are committed results, and removed items are paths ruled out by the invariant. The first safe inference is to name what state changed and why that move is legal.',
        {type: 'callout', text: 'A model rollout is safe only when exposure, measurement, versioned cache boundaries, and rollback proof share one release ledger.'},
        'This topic is a case study, so the visual is not decoration. It shows which records, counters, queues, maps, or gates must agree before the system can return a trustworthy result.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'LLM model rollout shadow canary ledger exists because a simple implementation works on a small example but fails when scale, latency, privacy, or correctness constraints arrive. The system needs a data structure that keeps the useful fast path without hiding the boundary conditions.',
        'The practical problem is not only speed. Cost, auditability, rollback, freshness, and slice-level behavior all affect whether the design is usable in production.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep one global rule, one score, one cache, one dashboard, or one list. That is easy to build and easy to explain. It often works until traffic shape or correctness requirements become more specific.',
        'The next obvious approach is to add capacity or widen the search. That may improve the average case, but it usually fails to encode the rule that decides which work is allowed, fresh, fair, or safe.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the missing boundary. A system can look correct globally while a narrow slice is wrong, stale, unfair, or too expensive. Once the boundary is missing, more throughput can make the failure faster.',
        'The concrete failure is usually visible as mixed state: one version reads another version cache, one user receives another user answer, one queue loses priority, or one metric hides a failing slice. The design needs an invariant that prevents that mixture.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make the boundary a first-class data structure in LLM model rollout shadow canary ledger. Keys, clocks, queues, ledgers, folds, or gates are not metadata; they are the mechanism that preserves correctness.',
        'The invariant should be checkable from stored state. If an operator cannot reconstruct why a result was allowed, denied, filled, scored, or rolled back, the system is relying on memory instead of design.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The mechanism starts by normalizing the input into records with stable identities. It then routes those records through the smallest structure that can answer the current decision: a map lookup, ordered queue, version gate, slice table, or witness search.',
        'Each step writes enough state for the next step to be local. Local means a cancel finds one order id, a cache gate checks one record, a rollout query joins one packet id, or a checker advances one legal candidate. That locality is what turns a broad problem into an executable workflow.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is preservation. Before a step, the invariant names which records may interact. The step reads only allowed state, writes the result, and leaves the invariant true for the next step.',
        'This is stronger than a dashboard claim. A dashboard can show an average after the fact; the invariant prevents an illegal result from being served in the first place. When the invariant fails, the system should produce a denial, rollback, miss, or counterexample instead of a quiet answer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is extra state. Maps, ledgers, clocks, slice tags, fold maps, queues, and audit rows consume memory and engineering time. The payoff is that expensive work becomes targeted instead of global.',
        'Cost behaves with the number of records, versions, slices, or live candidates. Doubling traffic does not only double compute; it can double cache pressure, queue length, audit rows, or search width. The dominant operation is the one on the hot path for the real workload.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LLM model rollout shadow canary ledger fits systems where correctness is operational, not just mathematical. Fraud models, retrieval systems, matching engines, model-serving stacks, evaluation gates, and rollout systems all need stored evidence for why one result was chosen.',
        'The access pattern determines fit. Repeated decisions benefit from maps and caches, ordered fairness needs queues and sequence numbers, release safety needs ledgers, and concurrent correctness needs histories that can be searched.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the boundary is chosen for convenience instead of the product promise. Random folds fail for time-forward prediction, global canaries fail for slice-specific regressions, and similarity search fails when authorization is the real question.',
        'It also fails when evidence is not versioned. A stale record can be more dangerous than a miss because it looks supported. The design needs no-store, deny, rollback, or human-review paths for cases outside the invariant.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A coding assistant moves from v1 to v2. Shadow samples 5% of traffic for 72 hours and collects 20000 cases. Global quality is up 3%, but large-repository edits are down 12% and tool retries are up 18% on that slice.',
        'The team changes prompt packing, reruns shadow for 48 hours, and the large-repository regression shrinks to 2%. Canary starts at 1% for 24 hours, then 10% for 48 hours. At 10%, enterprise tenant X fails a policy gate with violation rate 0.4% against a threshold of 0.1%.',
        'The ledger pins tenant X to v1, purges the v2 cache namespace for that tenant, and keeps the remaining cohort at 10%. The release can continue for slices that passed while the failing slice stays isolated. Rollback is a state transition, not a meeting.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Google SRE Book Release Engineering at https://sre.google/sre-book/release-engineering/, Uber Intelligent Canary Analysis at https://eng.uber.com/canary-analysis/, LaunchDarkly rollout documentation at https://docs.launchdarkly.com/, and LLM serving deployment discussions from Anyscale. Study Feature Flag Control Plane, A/B Testing, Prompt Cache-Key Canonicalization Ledger, LLM Response Cache Safety Ledger, LLM Judge Calibration Drift Monitor, Distributed Tracing, and SLO-Aware LLM Request Router next.',
      ],
    },
  ],
};
