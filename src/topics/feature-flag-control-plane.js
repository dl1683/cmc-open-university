// Feature flag control plane: evaluate flags from context, route cohorts,
// observe impact, and roll forward/back without deploying new code.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'feature-flag-control-plane',
  title: 'Feature Flag Control Plane',
  category: 'Systems',
  summary: 'Progressive delivery as a data structure: flag keys, evaluation context, providers, hooks, targeting rules, cohorts, and kill switches.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['evaluation path', 'rollout safety'], defaultValue: 'evaluation path' },
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

function flagGraph(title) {
  return graphState({
    nodes: [
      { id: 'app', label: 'application', x: 0.8, y: 3.6, note: 'asks for flag' },
      { id: 'sdk', label: 'SDK/API', x: 2.7, y: 3.6, note: 'typed evaluation' },
      { id: 'context', label: 'evaluation context', x: 4.8, y: 1.7, note: 'user, tenant, region' },
      { id: 'provider', label: 'provider', x: 4.8, y: 5.4, note: 'vendor or local engine' },
      { id: 'rules', label: 'targeting rules', x: 6.8, y: 3.6, note: 'cohorts + percent' },
      { id: 'variant', label: 'variant', x: 8.7, y: 2.4, note: 'on/off/A/B' },
      { id: 'hooks', label: 'hooks/telemetry', x: 8.7, y: 4.9, note: 'audit + metrics' },
    ],
    edges: [
      { id: 'e-app-sdk', from: 'app', to: 'sdk', weight: 'flag key + default' },
      { id: 'e-sdk-context', from: 'sdk', to: 'context', weight: 'merge context' },
      { id: 'e-sdk-provider', from: 'sdk', to: 'provider', weight: 'evaluate' },
      { id: 'e-provider-rules', from: 'provider', to: 'rules', weight: 'ruleset' },
      { id: 'e-context-rules', from: 'context', to: 'rules', weight: 'attributes' },
      { id: 'e-rules-variant', from: 'rules', to: 'variant', weight: 'resolved value' },
      { id: 'e-rules-hooks', from: 'rules', to: 'hooks', weight: 'reason + metadata' },
    ],
  }, { title });
}

function* evaluationPath() {
  yield {
    state: flagGraph('The application asks for a typed flag value'),
    highlight: { active: ['app', 'sdk', 'e-app-sdk'], compare: ['provider'] },
    explanation: 'A feature flag starts as a typed evaluation request: flag key, default value, and context. The application should be able to fall back safely if the provider is unavailable.',
  };

  yield {
    state: flagGraph('Context and provider rules resolve the variant'),
    highlight: { active: ['context', 'provider', 'rules', 'variant', 'e-context-rules', 'e-provider-rules'], found: ['e-rules-variant'] },
    explanation: 'The provider evaluates targeting rules against context: user id, tenant, region, version, plan, device, or request attributes. The output is a variant plus metadata explaining why.',
    invariant: 'A flag is a pure decision function over key, default, rules, and context.',
  };

  yield {
    state: labelMatrix(
      'Evaluation context hierarchy',
      [
        { id: 'global', label: 'global' },
        { id: 'client', label: 'client' },
        { id: 'invocation', label: 'invocation' },
        { id: 'target', label: 'targeting key' },
      ],
      [
        { id: 'source', label: 'source' },
        { id: 'example', label: 'example' },
      ],
      [
        ['application config', 'service=checkout'],
        ['SDK client', 'tenant=enterprise'],
        ['request-specific', 'user=alice'],
        ['stable subject id', 'hash for percentage rollout'],
      ],
    ),
    highlight: { found: ['invocation:example', 'target:example'], active: ['global:source', 'client:source'] },
    explanation: 'Context merging matters because percentage rollout and targeting need stable inputs. Missing or unstable targeting keys create users who jump between variants.',
  };

  yield {
    state: labelMatrix(
      'Hooks in the lifecycle',
      [
        { id: 'before', label: 'before' },
        { id: 'after', label: 'after' },
        { id: 'error', label: 'error' },
        { id: 'finally', label: 'finally' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'guardrail', label: 'guardrail' },
      ],
      [
        ['enrich context', 'do not mutate flag key/default'],
        ['record reason/metadata', 'avoid slow hot-path work'],
        ['capture provider failure', 'return safe default'],
        ['emit telemetry', 'bounded latency'],
      ],
    ),
    highlight: { active: ['before:job', 'after:job'], found: ['error:guardrail'] },
    explanation: 'Hooks add cross-cutting behavior such as telemetry and context enrichment. They also need latency discipline because flag evaluation often sits directly in the request path.',
  };
}

function* rolloutSafety() {
  yield {
    state: labelMatrix(
      'Progressive rollout ladder',
      [
        { id: 'dark', label: 'dark launch' },
        { id: 'internal', label: 'internal users' },
        { id: 'canary', label: '1 percent canary' },
        { id: 'ramp', label: 'ramp to 50/100' },
      ],
      [
        { id: 'traffic', label: 'traffic' },
        { id: 'exit', label: 'exit condition' },
      ],
      [
        ['none or shadow', 'no errors in background path'],
        ['employees/test tenants', 'manual validation'],
        ['small stable cohort', 'SLO and metric guardrails'],
        ['increasing cohorts', 'no regression or rollback'],
      ],
    ),
    highlight: { active: ['canary:traffic', 'canary:exit'], found: ['ramp:exit'] },
    explanation: 'Feature flags turn deployment into progressive exposure. Code can be deployed everywhere while behavior is enabled for carefully chosen cohorts.',
  };

  yield {
    state: flagGraph('Telemetry closes the rollout loop'),
    highlight: { active: ['variant', 'hooks', 'e-rules-hooks'], found: ['context', 'rules'] },
    explanation: 'A rollout is only safe if the chosen variant is observable. Evaluation events, traces, metrics, and business outcomes connect the flag decision to impact.',
  };

  yield {
    state: labelMatrix(
      'Flag types',
      [
        { id: 'release', label: 'release flag' },
        { id: 'experiment', label: 'experiment flag' },
        { id: 'ops', label: 'ops flag' },
        { id: 'permission', label: 'permission flag' },
      ],
      [
        { id: 'purpose', label: 'purpose' },
        { id: 'debt', label: 'debt risk' },
      ],
      [
        ['decouple deploy and release', 'must be removed'],
        ['measure causal impact', 'statistical discipline'],
        ['kill switch or degrade', 'must be reliable'],
        ['entitlement/plan behavior', 'authorization confusion'],
      ],
    ),
    highlight: { found: ['release:purpose', 'ops:purpose', 'experiment:purpose'], compare: ['permission:debt'] },
    explanation: 'Not every flag is the same. Release flags should expire. Experiment flags need A/B Testing discipline. Ops flags are safety controls. Permission flags can become product policy.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'default', label: 'bad default' },
        { id: 'stale', label: 'stale SDK cache' },
        { id: 'target', label: 'unstable targeting' },
        { id: 'debt', label: 'flag debt' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['provider outage flips behavior', 'safe conservative default'],
        ['old rules remain active', 'TTL and stream health'],
        ['users bounce variants', 'stable targeting key'],
        ['dead code paths linger', 'owner and expiry metadata'],
      ],
    ),
    highlight: { active: ['default:symptom', 'target:symptom'], found: ['debt:fix'] },
    explanation: 'Flags are a control plane. They need defaults, TTLs, ownership, audit logs, and cleanup or they become a distributed pile of hidden branches.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'evaluation path') yield* evaluationPath();
  else if (view === 'rollout safety') yield* rolloutSafety();
  else throw new InputError('Pick a feature flag view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A feature flag control plane lets teams change behavior without deploying new code. Applications ask for typed flag values. The SDK merges evaluation context, calls a provider, applies targeting rules, returns a variant, and emits metadata or telemetry. That turns release, experimentation, and operational kill switches into runtime decisions instead of build-time branches.',
        'OpenFeature describes itself as an open specification for a vendor-agnostic feature flagging API: https://openfeature.dev/docs/reference/intro. The flag evaluation specification defines an evaluation API independent of any flag control plane or vendor: https://openfeature.dev/specification/sections/flag-evaluation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The application calls the SDK with a flag key, expected type, and default value. The SDK combines global, client-level, and invocation-level context. A provider evaluates rules using attributes such as user, tenant, region, plan, device, or service version. It returns a value plus metadata such as reason, variant, and provider details. Hooks can run before, after, on error, or finally to enrich context, record telemetry, validate outcomes, or capture failures.',
        'OpenFeature evaluation context is the container for contextual data used in dynamic evaluation: https://openfeature.dev/docs/reference/concepts/evaluation-context/. Providers perform flag evaluation and abstract the underlying management system: https://openfeature.dev/docs/reference/concepts/provider. Hooks allow behavior at well-defined points in the evaluation lifecycle: https://openfeature.dev/docs/reference/concepts/hooks/.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Flag evaluation often sits in the request path, so latency and failure behavior matter. SDKs commonly cache rules or stream updates, but stale cache policy must be explicit. Provider outages need safe defaults. Percentage rollout requires a stable targeting key; otherwise users bounce between variants. Experiment flags need statistical discipline, while ops kill switches need reliability even during incidents.',
        'Flags also create long-term code debt. Release flags should have owners, expiry dates, and cleanup tickets. Permission flags can accidentally become authorization systems. Experiment flags can leak into permanent product behavior. A mature control plane tracks ownership, audit logs, metadata, and telemetry, not just boolean values.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Feature flags enable dark launches, internal rollouts, canaries, A/B tests, geo-specific releases, tenant allowlists, plan entitlements, kill switches, and graceful degradation. They connect directly to A/B Testing, Cache Invalidation & Versioning, AIOps Incident Response, OpenTelemetry Collector pipelines, and Load Shedding because safe rollout requires both control and measurement. LLM Model Rollout Shadow Canary Ledger is the model-serving version: canary cohorts, shadow traffic, prompt-cache versioning, eval gates, and rollback proof all sit behind the same flag-control-plane discipline. They also matter for On-Device LLM Inference Cost Crossover and Accelerator Kernel Compatibility Matrix: local model packages and new accelerator routes both need staged rollout, device gates, and kill switches.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A flag is not automatically safe because it can be switched off. If the default is unsafe, the provider is unavailable, or the SDK cache is stale, the wrong behavior can persist. A percentage rollout is not a valid experiment unless assignment is stable and analysis avoids peeking and multiple-testing traps. A permission flag is not a substitute for authorization unless it is built and audited like authorization.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Official sources: OpenFeature intro at https://openfeature.dev/docs/reference/intro, flag evaluation API at https://openfeature.dev/specification/sections/flag-evaluation, evaluation context at https://openfeature.dev/docs/reference/concepts/evaluation-context/, providers at https://openfeature.dev/docs/reference/concepts/provider, and hooks at https://openfeature.dev/docs/reference/concepts/hooks/. Study A/B Testing, Multi-Armed Bandits, LLM Model Rollout Shadow Canary Ledger, Cache Invalidation & Versioning, OpenTelemetry Collector Case Study, AIOps Incident Response, On-Device LLM Inference Cost Crossover, Accelerator Kernel Compatibility Matrix, and Load Shedding & Graceful Degradation next.',
      ],
    },
  ],
};
