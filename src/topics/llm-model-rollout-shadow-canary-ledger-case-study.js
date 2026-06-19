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
        "Read the animation as the execution trace for LLM Model Rollout Shadow Canary Ledger. A production LLM rollout case study: stable canary cohorts, shadow traffic, eval slices, cache-version boundaries, guardrail gates, telemetry, and rollback ledgers..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Problem',
      paragraphs: [
        'An LLM release is a behavioral change, not just a binary deploy. A new model checkpoint can alter answer quality, latency, token cost, refusal behavior, tool-call shape, cache hit rate, and tenant-specific policy compliance at the same time. A prompt template edit can have the same effect even when the weights do not change. A new adapter, decoding configuration, retrieval policy, guardrail, or serving runtime can also change the user-visible system. Treating all of those as ordinary version bumps hides the real risk.',
        'The production problem is to learn from real traffic without giving the candidate model unlimited blast radius. The rollout system must answer four questions at every step: exactly what changed, who saw the change, whether the change passed the right evidence gates, and how to return to the last known good state. The data structure that makes those questions answerable is a release ledger tied to stable cohort assignment.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious rollout is simple: deploy model v2, route one percent of requests to it, watch error rate and p99 latency, then ramp to ten percent, twenty-five percent, and one hundred percent if the dashboards look normal. Add a few offline evals and a smoke test, and the process looks responsible.',
        'That plan is better than a blind deploy, but it is still too weak for LLM systems. Global metrics can stay flat while code-generation requests regress, long-context prompts become slower, tool-using agents start calling the wrong tool, or one enterprise tenant receives outputs that violate its policy pack. Random per-request assignment can also make one user see different model behavior inside one workflow, which corrupts both user experience and measurement.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that LLM failures are usually conditional. A candidate may be better at short chat and worse at repository-scale code edits. It may reduce average cost while increasing cost for tool agents because it asks for more tool retries. It may pass a general preference eval while failing faithfulness on retrieval-heavy questions. It may be safe under the default policy and unsafe under a tenant override.',
        'Cache boundaries make the wall steeper. If v2 reuses prompt-cache, response-cache, or KV-cache entries whose keys were designed for v1, the canary is not measuring v2 cleanly. If telemetry records only route name and status code, the team cannot later separate model behavior from prompt version, guardrail version, cache namespace, cohort, retrieval index, or tenant policy. Without versioned evidence, the rollout can pass or fail for reasons nobody can prove.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to treat rollout as a ledgered state machine. The release packet binds every field that can change behavior: model id, prompt template id, adapter id, decoding policy, retrieval configuration, cache-key namespace, guardrail policy, eval bundle, slice thresholds, rollout percentage, stop rules, and rollback target. The cohort map binds users, tenants, workspaces, or sessions to a release decision in a stable way.',
        'The invariant is version isolation. Cache, evaluation, telemetry, and routing state must be keyed by the fields that can change outputs. If two releases share a cache namespace by accident, the new model can inherit old behavior and produce misleading evidence. If two releases share an eval label by accident, a gate can approve the wrong artifact. The ledger makes those boundaries explicit.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A safe rollout usually starts with shadow traffic. The stable model still serves the user, but the candidate receives a forked copy of the prompt. The system records the candidate output, latency, token use, tool calls, safety verdict, retrieval citations, cache behavior, and slice labels. Shadow mode costs extra inference, but it lets the candidate fail before users see its answers.',
        'The next gate is canary traffic. A deterministic targeting key assigns a small cohort to the candidate: for example tenant id, workspace id, account id, or an agent-session id. Stable assignment matters because a user should not bounce between model versions during one task. The canary gate then compares live SLOs, guardrail outcomes, cost, and task-quality slices against thresholds in the release packet.',
        'The final control is rollback. Rollback is not only setting traffic percentage to zero. It may need to pin the old prompt template, old cache namespace, old guardrail policy, old adapter, and old routing target. A good ledger stores the rollback target before the rollout starts, then records proof that traffic and cache reads stopped hitting the bad revision.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a team is replacing model v1 with v2 for a coding assistant. The release packet says model=v2, prompt=repo-edit-template-17, guardrail=policy-9, cache namespace=code-v2, retrieval index=repo-index-2026-06, rollback target=v1 packet, and promotion gates for chat, code edit, long repository context, tool calls, safety, p99 latency, and dollars per successful task.',
        'Shadow traffic runs first. Global quality improves, but the long-repository slice shows more failed edits and higher latency. The diff rows reveal that v2 requests larger context windows and creates more tool retries. The team changes prompt packing, reruns shadow, and sees the long-context regression shrink. Only then does the canary start at one percent.',
        'At ten percent, an enterprise tenant slice fails a policy gate. The rollout state machine does not need a meeting to know the safe action. It pins that tenant cohort to v1, keeps shadow traffic for diagnosis if policy allows, and prevents promotion to twenty-five percent. The incident is bounded because the ledger knows the cohort, packet, stop rule, and rollback target.',
      ],
    },
    {
      heading: 'What the animation shows',
      paragraphs: [
        'The canary-gate view shows the rollout as a governed traffic split. The flag and split nodes are not decoration; they represent the cohort function and percentage schedule. The release-packet matrix shows why a model id alone is insufficient. Prompt, cache, guardrail, and eval fields are part of the release identity because each one can change behavior.',
        'The shadow-diff view shows why average metrics are weak. The plot can show a global-looking improvement while one slice carries negative quality delta and positive latency delta. The slice ledger turns that into a decision table: RAG faithfulness, code tests, agent tool behavior, tenant policy, and token cost each get their own gate.',
        'The rollback-audit view shows the release as a reversible operation. A failed gate should route live traffic back to a known good packet and produce proof. The important learning is that rollback keys are data, not tribal knowledge: route, flag, prompt, cache, guardrail, and eval references must all be recoverable.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Shadow mode works because it separates measurement from exposure. The candidate sees realistic prompts and traffic shape, but the user still receives the stable answer. That makes real-distribution evidence available before real-distribution harm.',
        'Canary mode works because it bounds exposure and preserves attribution. Stable cohorts make repeated behavior comparable inside a workflow. Versioned telemetry turns each span into a joinable row: request attributes connect to release fields, output scores, safety verdicts, cost, latency, and cache decisions. The team can ask which slice failed instead of asking whether the release felt worse.',
        'Rollback works because the old path remains explicit. A system that cannot name its last known good packet is not doing controlled rollout; it is doing hope with dashboards. A release ledger converts rollback from reconstruction into state transition.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The first cost is duplicate inference. Shadow traffic can double compute for sampled requests, and LLM traffic is expensive enough that this must be budgeted. Teams often shadow only selected slices, sample heavily, or stop shadowing once enough evidence exists.',
        'The second cost is operational complexity. Release packets, cohort functions, telemetry schemas, eval bundles, cache namespaces, and rollback playbooks all need ownership. A small team may be tempted to skip the ledger and rely on dashboards. That saves setup time but increases incident cost when the release fails in a narrow slice.',
        'The third cost is slower experimentation. Stable cohorts reduce random mixing, and slice-level gates require enough data per slice. The benefit is that results are interpretable. Fast, noisy rollout decisions are cheap only until they approve the wrong model.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern wins for model upgrades, prompt rewrites, adapter swaps, decoding-policy changes, guardrail-policy changes, tool-call policy changes, retrieval-index changes, cache namespace migrations, and serving-runtime changes. It is strongest when the product has clear slices: tenants, task types, prompt lengths, languages, tools, policy packs, price tiers, and traffic classes.',
        'It is also valuable when public trust or contractual obligations matter. If an enterprise customer asks whether its traffic saw a bad model for a two-hour window, a ledgered rollout can answer with cohort and span evidence. If a safety issue appears in one policy slice, the team can block that slice without freezing every unrelated improvement.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The pattern fails when shadow logging violates privacy rules or stores prompts and outputs without a redaction policy. It fails when the candidate can call tools with side effects during shadow mode. Shadow tool calls should usually be blocked, mocked, or isolated so measurement does not mutate production state.',
        'It fails when the cohort key is unstable. Per-request randomization can split a conversation across models and make differences impossible to interpret. It fails when the canary gate uses only global averages. It fails when cache keys ignore model, prompt, adapter, retrieval, or policy version. It fails when rollback has never been tested and depends on manual dashboard archaeology.',
        'A subtle failure is evaluator drift. If the same LLM judge or weak rubric approves every release, the rollout system can become ceremony. Gates need calibration, slice ownership, and occasionally human review for high-risk changes.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Feature Flag Control Plane for stable targeting mechanics, A/B Testing for experiment design, SLO-Aware LLM Request Router for release-aware routing, Prompt Cache-Key Canonicalization Ledger for version boundaries, LLM Response Cache Safety Ledger for cache safety, LLM Evaluation Runners and Golden Sets for offline gates, LLM Judge Calibration Drift Monitor for evaluator risk, LLM Guardrail Policy Engine for policy slices, GenAI Trace Token Cost Ledger for cost evidence, Distributed Tracing for span joins, and LLM Unit Economics Ledger Case Study for promotion gates that include dollars per useful task.',
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
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for llm-model-rollout-shadow-canary-ledger-case-study, continue to the next topic in the same track.'
  ],
      },
],
};
