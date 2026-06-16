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
      heading: 'What it is',
      paragraphs: [
        'An LLM model rollout shadow-canary ledger is the release control plane for changing a model, prompt template, adapter, cache policy, guardrail policy, or runtime setting without betting the whole product on one deploy.',
        'The data structures are concrete: stable cohort keys, percentage split rules, model and prompt version ids, cache-key namespaces, shadow-output diffs, slice-level eval scores, live SLO metrics, stop rules, and rollback records.',
      ],
    },
    {
      heading: 'Canary and feature-flag anchors',
      paragraphs: [
        'KServe supports canary rollouts where a new InferenceService revision receives a configured percentage of traffic through `canaryTrafficPercent`; it tracks latest ready, latest rolled-out, previous rolled-out, and rollback behavior: https://kserve.github.io/website/docs/model-serving/predictive-inference/rollout-strategies/canary.',
        'OpenFeature evaluation context supplies the targeting data used for deterministic percentage rollouts, including the targeting key. OpenFeature tracking connects flag evaluations to KPIs, system performance, and experiments: https://openfeature.dev/docs/reference/concepts/evaluation-context/ and https://openfeature.dev/docs/reference/concepts/tracking/.',
      ],
    },
    {
      heading: 'Shadow evaluation',
      paragraphs: [
        'Shadow traffic is the safer first gate. Real prompts go to the candidate, but the stable answer is served. The system records output diffs, rubric scores, tool-call divergence, latency, token cost, safety verdicts, and cache behavior by slice.',
        'OpenTelemetry GenAI semantic conventions provide a standard direction for model and token telemetry around LLM operations: https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-events/. The important rollout point is governance: model id, prompt version, cohort id, and cache-key version must be visible in spans so later analysis can separate candidate behavior from stable behavior.',
      ],
    },
    {
      heading: 'Complete case study: coding copilot upgrade',
      paragraphs: [
        'A coding copilot upgrades from model v1 to v2 with a new system prompt and a stricter tool policy. Offline golden sets pass globally, but shadow traffic finds a regression on long repository prompts and a latency increase for code-edit agents. The team fixes prompt packing, changes the cache-key namespace, and reruns shadow. Only then does it canary to 1 percent of stable cohorts.',
        'At 10 percent, guardrail denies rise for one enterprise tenant because that tenant has a custom policy pack. The stop rule freezes the rollout, pins that tenant to v1, and keeps v2 canary traffic for nonaffected tenants. Because every span carries model, prompt, policy, cohort, and cache-version fields, the incident is a scoped rollout correction instead of a vague model-quality debate.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not use random per-request assignment for LLM canaries; users and agents need stable cohorts. Do not share cache keys across model or prompt versions unless the cache contract proves it safe. Do not trust one global eval score. Do not let shadow logs capture sensitive prompts without redaction policy. Do not start a canary until rollback is one command and observable.',
        'Study Feature Flag Control Plane, A/B Testing, LLM Evaluation Harness & Golden Sets, LLM Judge Calibration Drift Monitor, LLM Guardrail Policy Engine, Prompt Cache-Key Canonicalization Ledger, LLM Response Cache Safety Ledger, SLO-Aware LLM Request Router, LLM Serving Autoscaling Warm Pool, GenAI Trace Token Cost Ledger, Distributed Tracing, and LLM Unit Economics Ledger Case Study next.',
      ],
    },
  ],
};
