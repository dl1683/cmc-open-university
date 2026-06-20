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
        'The animation has three views. "Canary gate" traces a governed traffic split from cohort flag through percentage ramp, telemetry collection, eval gates, and promotion-or-rollback decisions. "Shadow diff" shows how forked traffic produces per-slice quality, latency, and cost deltas without serving the candidate answer. "Rollback audit" walks the evidence chain that proves a bad revision is no longer receiving traffic.',
        {type: 'bullets', items: [
          'Active (highlighted): the current rollout decision point -- a split percentage, a gate check, a rollback pin.',
          'Found (green): a result the ledger has committed -- a passing eval slice, a promoted packet, a proven rollback.',
          'Compare (blue): a contrast path that clarifies the decision -- shadow traffic shown against live canary, or blind deploy risk shown against gated risk.',
          'Removed (red): a path blocked by a failed gate -- a rollback triggered, a promotion denied, a cache namespace purged.',
        ]},
        {type: 'note', text: 'The key visual contrast across views is between measurement (shadow) and exposure (canary). Shadow mode lets the candidate fail without harming users. Canary mode bounds harm to a small, stable cohort. Rollback proves the system returned to known-good state. All three depend on the same release ledger.'},
        'At each frame, ask: what evidence supports this rollout decision, and could you reconstruct the full state of every user cohort from the ledger alone?',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An LLM release is a behavioral change, not a binary deploy. A new model checkpoint can alter answer quality, latency, token cost, refusal behavior, tool-call shape, cache hit rate, and tenant-specific policy compliance simultaneously. A prompt template edit can have the same impact even when the weights stay fixed. An adapter swap, decoding configuration change, retrieval policy update, guardrail revision, or serving runtime migration can each shift the user-visible system in ways that only surface on specific workloads.',
        {type: 'quote', text: 'We have seen multiple cases where a model upgrade improved average quality metrics while causing silent regressions in code generation, long-context faithfulness, or specific enterprise policy compliance -- regressions invisible in aggregate dashboards.', attribution: 'Anyscale engineering blog on LLM serving (2024)'},
        'The production constraint is learning from real traffic without giving the candidate model unlimited blast radius. Traditional web canary releases watch error rate and p99 latency for a stateless HTTP endpoint. LLM traffic is stateful (conversations, agent loops, cached KV blocks), high-variance (a coding task and a chat reply exercise different model capabilities), and expensive enough per request that even small regressions cost real money.',
        {type: 'note', text: 'The rollout system must answer four questions at every step: exactly what changed, who saw the change, whether the change passed the right evidence gates, and how to return to the last known good state. A release ledger tied to stable cohort assignment is the data structure that makes those questions answerable.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The standard canary playbook from web services: deploy model v2 behind a load balancer, route one percent of requests to it, watch error rate and p99 latency on a dashboard, then ramp to ten, twenty-five, and one hundred percent if the numbers look normal. Add a few offline evals and a smoke test, and the process looks responsible.',
        {type: 'table', headers: ['Step', 'Traffic', 'Gate', 'Decision'], rows: [
          ['Deploy', '0%', 'Smoke test passes', 'Proceed to 1%'],
          ['Canary', '1%', 'Error rate < 0.5%, p99 < 800ms', 'Proceed to 10%'],
          ['Ramp', '10%', 'Same metrics hold', 'Proceed to 25%'],
          ['Widen', '25%', 'Same metrics hold', 'Proceed to 100%'],
          ['Full', '100%', 'Monitor for 24h', 'Done'],
        ]},
        'This plan is better than a blind deploy. But it is too weak for LLM systems because it aggregates over workload types, assigns traffic randomly per request, and keys all telemetry and cache state on a single route name. Global metrics can stay flat while code-generation requests regress, long-context prompts become slower, tool-using agents call the wrong tool, or one enterprise tenant receives outputs that violate its policy pack.',
        'Random per-request assignment introduces a second problem: a single user can see different model behavior across requests within one conversation or agent loop. That corrupts both user experience and measurement. The user perceives inconsistency; the evaluator cannot attribute a session outcome to a single model version.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'LLM failures are conditional. A candidate may be better at short chat and worse at repository-scale code edits. It may reduce average cost while increasing cost for tool agents because it triggers more tool retries. It may pass a general preference eval while failing faithfulness on retrieval-heavy questions. It may be safe under the default guardrail policy and unsafe under a tenant override that relaxes content restrictions.',
        {type: 'table', headers: ['Slice', 'Global metric', 'Slice metric', 'Verdict'], rows: [
          ['Short chat', 'Quality +3%', 'Quality +5%', 'Pass'],
          ['Code edit (small file)', 'Quality +3%', 'Quality +2%', 'Pass'],
          ['Code edit (large repo)', 'Quality +3%', 'Quality -12%', 'FAIL'],
          ['RAG faithfulness', 'Quality +3%', 'Hallucination rate +8%', 'FAIL'],
          ['Agent tool calls', 'Quality +3%', 'Wrong-tool rate +15%', 'FAIL'],
          ['Enterprise tenant X', 'Quality +3%', 'Policy violation rate 2x', 'FAIL'],
        ]},
        {type: 'note', text: 'The wall is not that canary releases are wrong. The wall is that LLM canary releases need different evidence than web canary releases. A 200 OK with low latency proves nothing about whether the model answered correctly, followed policy, or used tools properly.'},
        'Cache boundaries make the wall steeper. If v2 reuses prompt-cache, response-cache, or KV-cache entries whose keys were designed for v1, the canary is not measuring v2 cleanly -- it is measuring a hybrid of cached v1 behavior and fresh v2 behavior. If telemetry records only route name and HTTP status, the team cannot later separate model behavior from prompt version, guardrail version, cache namespace, cohort, retrieval index, or tenant policy. Without versioned evidence, the rollout can pass or fail for reasons nobody can prove after the fact.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat rollout as a ledgered state machine. The release packet binds every field that can change behavior into a single versioned identity:',
        {type: 'code', text: '// Release packet: the atomic unit of rollout identity\n{\n  "packet_id":        "rel-2026-06-19-v2a",\n  "model_id":         "code-v2",\n  "prompt_template":  "repo-edit-template-17",\n  "adapter_id":       "lora-code-v2",\n  "decoding_policy":  "greedy-with-fallback",\n  "retrieval_config": "repo-index-2026-06",\n  "cache_namespace":  "code-v2-ns",\n  "guardrail_policy": "policy-9",\n  "eval_bundle":      "code-golden-v4",\n  "slice_thresholds": {\n    "chat":       { "quality_min": 0.85 },\n    "code_edit":  { "quality_min": 0.80, "p99_max_ms": 2000 },\n    "long_repo":  { "quality_min": 0.75, "p99_max_ms": 5000 },\n    "tool_calls": { "wrong_tool_max": 0.02 },\n    "safety":     { "violation_max": 0.001 }\n  },\n  "rollout_pct":      1,\n  "stop_rules":       ["slo_breach", "safety_regression", "cache_leak"],\n  "rollback_target":  "rel-2026-06-12-v1"\n}', language: 'json'},
        'The cohort map binds users, tenants, workspaces, or sessions to a release decision in a stable way. Stability means that user X always hits the same release packet for the duration of a rollout step, so session-level behavior is attributable to a single model configuration.',
        {type: 'diagram', text: '  Invariant: version isolation\n\n  release_packet  -->  cache_namespace\n                  -->  eval_label\n                  -->  telemetry_tag\n                  -->  route_target\n\n  If any two packets share a cache namespace, eval label,\n  telemetry tag, or route target by accident:\n\n    - cache: new model inherits old behavior\n    - eval:  gate approves the wrong artifact\n    - tele:  slice analysis mixes two populations\n    - route: rollback cannot isolate the bad version\n\n  The ledger makes these boundaries explicit and auditable.', label: 'Version isolation: every behavioral field keys its own namespace'},
        'The invariant is version isolation. Cache, evaluation, telemetry, and routing state must be keyed by the fields that can change outputs. If two releases share a cache namespace by accident, the new model inherits old answers. If two releases share an eval label by accident, a gate can approve the wrong artifact. The ledger makes those boundaries explicit.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A safe LLM rollout runs three phases: shadow, canary, and promotion. Each phase has its own evidence requirements, and the release ledger records the state transition at every boundary.',
        {type: 'diagram', text: '  Phase 1: Shadow              Phase 2: Canary           Phase 3: Promote\n  +-----------------+         +------------------+       +---------------+\n  | Fork real        |         | Route stable      |       | Route all     |\n  | prompts to v2   |  pass   | cohort (1-25%)   | pass  | traffic to v2 |\n  | Serve v1 answer |-------->| to v2, serve v2  |------>| Archive v1    |\n  | Record diff     |         | Record live SLOs |       | Retain ledger |\n  +-----------------+         +------------------+       +---------------+\n        |                           |                           |\n      fail                        fail                       drift\n        |                           |                           |\n        v                           v                           v\n   Block promotion            Pin cohort to v1          Trigger re-eval\n   Fix model/prompt           Continue shadow           Alert on-call', label: 'The three-phase rollout state machine'},
        'Phase 1: Shadow traffic. The stable model serves every user. The candidate receives a forked copy of real prompts. The system records the candidate output, latency, token use, tool calls, safety verdict, retrieval citations, cache behavior, and slice labels. Shadow mode costs extra inference but lets the candidate fail before any user sees its answers.',
        {type: 'code', text: '# Shadow traffic forking (pseudocode)\nasync def handle_request(prompt, user, tenant):\n  # Always serve the stable answer\n  stable_resp = await serve(stable_packet, prompt)\n\n  # Fork to candidate in background (no user impact)\n  if shadow_sampler.should_fork(user, tenant):\n    shadow_resp = await serve(candidate_packet, prompt,\n                              tool_policy="block_side_effects")\n    diff_row = {\n      "input_hash":    hash(prompt),\n      "stable_output": score(stable_resp),\n      "shadow_output": score(shadow_resp),\n      "latency_delta": shadow_resp.latency - stable_resp.latency,\n      "token_delta":   shadow_resp.tokens - stable_resp.tokens,\n      "tool_diff":     diff_tool_calls(stable_resp, shadow_resp),\n      "safety":        check_policy(shadow_resp, tenant.policy),\n      "slice":         classify_slice(prompt),\n      "packet_id":     candidate_packet.id,\n    }\n    ledger.record_shadow(diff_row)\n\n  return stable_resp', language: 'python'},
        'Phase 2: Canary traffic. A deterministic targeting key (tenant id, workspace id, account id, or agent-session id) assigns a small cohort to the candidate. The assignment is stable: a user does not bounce between model versions during one task. The canary gate compares live SLOs, guardrail outcomes, cost, and task-quality slices against thresholds in the release packet.',
        'Phase 3: Promotion or rollback. Rollback is not just setting traffic percentage to zero. It may need to pin the old prompt template, old cache namespace, old guardrail policy, old adapter, and old routing target. The ledger stores the rollback target before the rollout starts, then records proof that traffic and cache reads stopped hitting the bad revision.',
        {type: 'note', text: 'Shadow tool calls must be blocked, mocked, or sandboxed. If the candidate model calls a production API during shadow mode, the measurement path becomes a mutation path. The shadow forker should intercept tool-use requests and return synthetic responses or block them entirely.'},
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A team replaces model v1 with v2 for a coding assistant. The release packet binds model=v2, prompt=repo-edit-template-17, guardrail=policy-9, cache namespace=code-v2, retrieval index=repo-index-2026-06, rollback target=v1 packet, and per-slice promotion gates.',
        {type: 'table', headers: ['Phase', 'Traffic', 'Duration', 'Evidence collected', 'Outcome'], rows: [
          ['Shadow', '5% fork', '72h', 'Per-slice quality, latency, cost, tool-call diff', 'Long-repo regression found (-12% quality)'],
          ['Fix + re-shadow', '5% fork', '48h', 'Same metrics after prompt-packing fix', 'Long-repo regression shrinks to -2%'],
          ['Canary 1%', '1% live', '24h', 'Live SLOs, safety, user-facing error rate', 'All slices pass'],
          ['Canary 10%', '10% live', '48h', 'Slice quality, cost per task, tenant policy', 'Enterprise tenant X fails policy gate'],
          ['Partial rollback', 'Tenant X to v1', 'Immediate', 'Cohort traffic proof, cache purge for X', 'Tenant X isolated on v1'],
          ['Resume canary 10%', '10% (minus X)', '48h', 'Remaining slices pass', 'Proceed to 25%'],
          ['Canary 25%', '25% live', '72h', 'Full slice matrix, cost, guardrail, eval', 'All gates pass'],
          ['Promote', '100%', 'Ongoing', 'Drift monitoring, eval re-runs', 'v2 is now stable'],
        ]},
        'Shadow traffic runs first. Global quality improves, but the long-repository slice shows more failed edits and higher latency. The diff rows reveal that v2 requests larger context windows and triggers more tool retries. The team adjusts prompt packing, reruns shadow, and sees the long-context regression shrink. Only then does the canary start at one percent.',
        'At ten percent, an enterprise tenant slice fails a policy gate. The rollout state machine does not need a meeting. It pins that tenant cohort to v1, keeps shadow traffic for diagnosis if the tenant policy allows logging, and prevents promotion to twenty-five percent until the policy issue is resolved or the tenant is excluded. The incident is bounded because the ledger knows the cohort, packet, stop rule, and rollback target.',
        {type: 'code', text: '# Automatic stop-rule evaluation (runs on every batch)\ndef evaluate_stop_rules(packet, metrics_batch):\n  for rule in packet.stop_rules:\n    if rule == "slo_breach":\n      for slice_name, thresholds in packet.slice_thresholds.items():\n        slice_metrics = metrics_batch.filter(slice=slice_name)\n        if slice_metrics.p99_latency > thresholds.get("p99_max_ms", inf):\n          return StopAction(rule, slice_name, "rollback", evidence=slice_metrics)\n        if slice_metrics.quality < thresholds.get("quality_min", 0):\n          return StopAction(rule, slice_name, "rollback", evidence=slice_metrics)\n\n    elif rule == "safety_regression":\n      for slice_name, thresholds in packet.slice_thresholds.items():\n        slice_metrics = metrics_batch.filter(slice=slice_name)\n        if slice_metrics.violation_rate > thresholds.get("violation_max", 0):\n          return StopAction(rule, slice_name, "block", evidence=slice_metrics)\n\n    elif rule == "cache_leak":\n      cross_ns = metrics_batch.cache_reads_outside_namespace(packet.cache_namespace)\n      if cross_ns > 0:\n        return StopAction(rule, "cache", "purge", evidence=cross_ns)\n\n  return None  # all gates pass', language: 'python'},
      ],
    },
    {
      heading: 'What the animation shows',
      paragraphs: [
        'The canary-gate view shows the rollout as a governed traffic split. The flag and split nodes represent the cohort function and percentage schedule. The release-packet matrix shows why a model id alone is not a release identity -- prompt, cache, guardrail, and eval fields are all part of the version boundary because each one can independently change behavior.',
        'The shadow-diff view shows why average metrics are weak. The per-slice plot can show a global improvement while one slice carries a negative quality delta and a positive latency delta. The slice ledger turns those signals into a decision table: RAG faithfulness, code test pass rate, agent tool accuracy, tenant policy compliance, and token cost each get their own gate with their own threshold.',
        'The rollback-audit view shows the release as a reversible operation. A failed gate routes live traffic back to a known-good packet and produces proof. The key learning is that rollback keys are data, not tribal knowledge. Route, flag, prompt, cache, guardrail, and eval references must all be recoverable from the ledger without manual archaeology.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Three properties make this rollout pattern correct under the right conditions.',
        {type: 'bullets', items: [
          'Shadow separation: measurement is decoupled from exposure. The candidate sees realistic prompts and traffic shape, but the user receives only the stable answer. Real-distribution evidence is available before real-distribution harm.',
          'Stable cohort attribution: deterministic assignment means every request in a user session hits the same release packet. Session-level outcomes (task success, tool-call chains, multi-turn quality) are attributable to a single model configuration, not a random mixture.',
          'Version-isolated telemetry: every span is tagged with the full release packet id. Sliced analysis can ask "which workload regressed under this exact configuration?" instead of "did the release feel worse overall?" The join key is the packet id, not a route name.',
        ]},
        'Rollback works because the old path remains explicit. The ledger stores the rollback target -- the last known-good release packet -- before the rollout begins. Triggering rollback is a state transition in the ledger, not a reconstruction from memory. The system can prove that traffic and cache reads stopped hitting the bad revision by querying telemetry for spans tagged with the rolled-back packet id.',
        {type: 'quote', text: 'If you cannot name your rollback target as a versioned artifact before you start the rollout, you are not doing controlled release -- you are doing hope with dashboards.', attribution: 'Google SRE practices on safe release methodology'},
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {type: 'table', headers: ['Cost', 'Magnitude', 'Mitigation'], rows: [
          ['Shadow inference', '2x compute for sampled requests', 'Sample by slice, cap shadow budget, stop when evidence is sufficient'],
          ['Release packet ownership', 'Engineering time per release', 'Automate packet generation from CI/CD; template common fields'],
          ['Cache namespace proliferation', '1 namespace per active packet', 'Garbage-collect namespaces after rollback window expires'],
          ['Telemetry cardinality', 'One tag dimension per packet field', 'Use packet_id as the primary key; join to packet metadata offline'],
          ['Eval compute', 'Run eval bundle per slice per phase', 'Cache eval results keyed by (packet_id, eval_bundle, slice)'],
          ['Slower ramp', 'Days vs. hours per rollout', 'The cost of a missed regression at full traffic is higher than the cost of a slow ramp'],
        ]},
        'The dominant practical cost is duplicate inference during shadow. LLM inference is expensive enough that shadowing all traffic is rarely affordable. Teams typically shadow 1-10% of traffic, stratified by slice, and stop shadowing once per-slice sample sizes reach statistical power. A shadow budget of 5% of production compute usually provides enough evidence for the critical slices within 48-72 hours.',
        'The second cost is operational complexity. Release packets, cohort functions, telemetry schemas, eval bundles, cache namespaces, and rollback playbooks all need ownership. A small team may be tempted to skip the ledger and rely on dashboards. That saves setup time but increases incident cost when the release fails in a narrow slice that dashboards do not show.',
        {type: 'note', text: 'The third cost is slower experimentation velocity. Stable cohorts reduce random mixing, and slice-level gates require enough data per slice before they can pass. The benefit is that results are interpretable. Fast, noisy rollout decisions are cheap only until they approve the wrong model for a slice that matters.'},
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {type: 'table', headers: ['Change type', 'Shadow evidence', 'Canary evidence', 'Why the ledger matters'], rows: [
          ['Model checkpoint upgrade', 'Per-slice quality, latency, cost delta', 'Live SLO, user-facing error rate', 'Cache namespace must change; old KV blocks are invalid for new weights'],
          ['Prompt template rewrite', 'Output diff, tool-call shape change', 'Task success rate, safety verdicts', 'Same model weights, different behavior -- template id must be in the packet'],
          ['Adapter (LoRA) swap', 'Quality on adapter-targeted slices', 'Latency regression from adapter load', 'Adapter id keys the cache; wrong adapter + right base model = wrong answers'],
          ['Guardrail policy update', 'Refusal rate delta, false-positive rate', 'Tenant policy compliance', 'Policy version must be in the packet; same model under different policy = different safety'],
          ['Retrieval index rebuild', 'Faithfulness, citation accuracy', 'RAG slice quality', 'Index version keys cache; stale index + new model = hallucinated citations'],
          ['Serving runtime migration', 'Latency distribution, numerical parity', 'Cost per token, throughput', 'Runtime can change numerical behavior (quantization, attention kernel); output diff catches it'],
        ]},
        'The pattern is strongest when the product has clear slices: tenants, task types, prompt lengths, languages, tools, policy packs, price tiers, and traffic classes. Each slice can fail independently, so each slice needs its own gate.',
        'It is also valuable when public trust or contractual obligations matter. If an enterprise customer asks whether its traffic saw a bad model for a two-hour window, a ledgered rollout answers with cohort and span evidence. If a safety issue appears in one policy slice, the team can block that slice without freezing every unrelated improvement.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {type: 'table', headers: ['Failure mode', 'Symptom', 'Consequence'], rows: [
          ['Shadow logs contain PII', 'Prompts and outputs stored without redaction', 'Privacy violation; compliance incident; legal liability'],
          ['Shadow tool calls hit production', 'Candidate calls APIs with side effects', 'Measurement path becomes mutation path; production state corrupted'],
          ['Unstable cohort key', 'Per-request randomization splits a conversation', 'User sees inconsistent behavior; session outcome not attributable'],
          ['Global-only gates', 'Only average quality and latency checked', 'Slice regression hidden by strong slices; bad model approved'],
          ['Shared cache namespace', 'v2 reads v1 cached responses', 'Canary measures hybrid behavior; evidence is about neither v1 nor v2'],
          ['Untested rollback', 'Rollback is manual dashboard archaeology', 'Incident response is slow; bad revision serves traffic for hours'],
          ['Evaluator drift', 'Same LLM judge or weak rubric approves every release', 'Gates become ceremony; quality degrades gradually'],
        ]},
        'The privacy failure is the most common blocker. Shadow logging records candidate outputs for real user prompts. Without a redaction policy -- stripping PII, credentials, and sensitive content before storage -- shadow mode can violate GDPR, HIPAA, or enterprise data agreements. Some organizations cannot shadow at all for certain tenant classes.',
        'The subtlest failure is evaluator drift. If the same LLM judge or weak rubric approves every release, the rollout system becomes ceremony. Gates need calibration against human judgments, slice ownership (someone must care when a specific slice regresses), and occasional human review for high-risk changes.',
        {type: 'note', text: 'A rollout system that has never actually rolled back is untested. Run a rollback drill before the first real canary. Verify that the old prompt template, old cache namespace, old guardrail policy, and old routing target are all recoverable from the ledger, and that telemetry proves requests stopped hitting the rolled-back revision.'},
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        {type: 'bullets', items: [
          'Generate the release packet from CI/CD, not by hand. The packet should be an immutable artifact produced by the build pipeline, with a content hash as its id. Manual packet creation invites field omissions.',
          'Use a deterministic cohort function: hash(tenant_id + rollout_id) mod 100 < rollout_pct. This is stable (same tenant always gets the same assignment for a given rollout) and adjustable (changing rollout_pct is a ledger state transition, not a code change).',
          'Key every cache namespace on the packet id or on the specific fields that affect output (model_id + prompt_template + adapter_id at minimum). Never share a cache namespace across release packets.',
          'Tag every telemetry span with the packet_id. Slice analysis joins spans to packet metadata offline. Avoid putting every packet field into the span tags -- that creates cardinality explosion. Use packet_id as the foreign key.',
          'Run eval bundles per slice, not per release. A passing chat eval does not prove code-edit quality. Each slice threshold in the packet should name the eval that checks it.',
          'Store the rollback target in the packet before the rollout starts. Rollback is a ledger state transition: set rollout_pct to 0, pin all cohorts to the rollback target, purge the candidate cache namespace, and record proof spans.',
          'Test rollback before the first canary. Deploy the candidate at 0% traffic, trigger a simulated stop rule, verify that the rollback path executes correctly, and check that telemetry shows zero spans for the candidate packet after rollback.',
        ]},
        {type: 'code', text: '// Cohort assignment: stable, deterministic, adjustable\nfunction assignCohort(tenantId, rolloutId, rolloutPct) {\n  // FNV-1a hash for speed and distribution\n  const hash = fnv1a(`${tenantId}:${rolloutId}`);\n  const bucket = hash % 100;  // 0-99\n\n  if (bucket < rolloutPct) {\n    return "candidate";  // this tenant sees the new packet\n  }\n  return "stable";       // this tenant stays on the old packet\n}\n\n// Rollback: a ledger state transition, not a code change\nfunction triggerRollback(ledger, rolloutId, reason, evidence) {\n  ledger.transition(rolloutId, {\n    new_state:        "rolled_back",\n    rollout_pct:      0,\n    rollback_target:  ledger.getPacket(rolloutId).rollback_target,\n    cache_action:     "purge_candidate_namespace",\n    reason:           reason,\n    evidence:         evidence,\n    timestamp:        Date.now(),\n  });\n}', language: 'javascript'},
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {type: 'bullets', items: [
          'Google SRE Book, Chapter 8: "Release Engineering." Defines the release-as-artifact principle, hermetic builds, and safe rollback. The release packet concept in this case study extends Google release engineering to LLM-specific fields (model id, prompt template, cache namespace, guardrail policy). https://sre.google/sre-book/release-engineering/',
          'Uber Engineering, "Intelligent Canary Analysis at Uber" (2018). Describes automated canary analysis with per-metric confidence intervals and automatic rollback. The LLM extension adds slice-level analysis and multi-field release identity. https://eng.uber.com/canary-analysis/',
          'Anyscale, "LLM Serving and Deployment Patterns" (2024). Covers shadow traffic, model versioning, and cache isolation for LLM inference workloads.',
          'LaunchDarkly feature flag documentation. Covers stable targeting (percentage rollouts with sticky cohorts), flag-based release management, and gradual rollout mechanics. https://docs.launchdarkly.com/',
        ]},
        'Study next by role:',
        {type: 'bullets', items: [
          'Prerequisite: Feature Flag Control Plane (stable targeting mechanics, cohort assignment), A/B Testing (experiment design, statistical power, slice analysis).',
          'Cache boundaries: Prompt Cache-Key Canonicalization Ledger (version-keyed cache namespaces), LLM Response Cache Safety Ledger (preventing cross-version cache contamination).',
          'Eval and safety gates: LLM Evaluation Runners and Golden Sets (offline eval bundles), LLM Judge Calibration Drift Monitor (detecting evaluator degradation), LLM Guardrail Policy Engine (policy slices and tenant overrides).',
          'Cost and observability: GenAI Trace Token Cost Ledger (per-request cost attribution), LLM Unit Economics Ledger Case Study (dollars-per-useful-task promotion gates), Distributed Tracing (span joins across release boundaries), SLO-Aware LLM Request Router (release-aware routing decisions).',
        ]},
      ],
    },
  ],
};
