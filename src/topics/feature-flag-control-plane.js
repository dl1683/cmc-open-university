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
      heading: 'Why this exists',
      paragraphs: [
        'A feature flag control plane exists because deploying code and releasing behavior are different actions. A team may want the new code path deployed everywhere but enabled only for employees, one enterprise tenant, one region, or one percent of stable users. It may also need to kill a broken feature without building and shipping a new artifact.',
        'The control plane turns behavior into a runtime decision. The application asks for a typed flag value. The SDK builds an evaluation context, the provider applies rules, the result resolves to a variant, and hooks emit telemetry. That small path lets teams dark launch, canary, experiment, degrade, and roll back with more precision than a deployment alone can provide.',
      ],
    },
    {
      heading: 'The naive switch',
      paragraphs: [
        'The obvious approach is an environment variable or a boolean in a config file. That works for a single global switch in one service. It fails when a rollout needs typed values, tenant targeting, stable percentage cohorts, audit history, experiment metadata, safe defaults, provider outage behavior, and cleanup ownership.',
        'The hidden problem is distribution. Once many services evaluate a flag at runtime, a flag is no longer a scattered if-statement. It is a control plane. It needs consistent rule evaluation, context shape, fallback semantics, observability, and lifecycle management. Without those, flags become invisible branches that change production behavior with weak accountability.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A feature flag should behave like a pure decision function over four inputs: key, default value, rules, and context. The application supplies the question. The provider evaluates the rules. The output is a value plus metadata explaining the reason. That reason is important because a rollout that cannot be explained cannot be debugged.',
        'OpenFeature captures this idea as a vendor-neutral feature flagging API. Its flag evaluation specification separates the application-facing evaluation call from any specific backend control plane. That separation is the systems lesson: application code should depend on a stable contract, while providers and storage backends can change behind it.',
      ],
    },
    {
      heading: 'Evaluation path',
      paragraphs: [
        'Evaluation starts when the application asks for a typed value such as boolean, string, number, or object. The call includes a flag key and a safe default. The SDK merges global context, client context, invocation context, and a stable targeting key. The provider evaluates rules against that context and returns the variant.',
        'The safe default matters. If the provider is down, the network is slow, or the local cache is stale beyond policy, the application still has to decide. For a release flag the safe default may be off. For an ops kill switch the safe default may be degraded mode. The default is part of the control-plane design, not an afterthought.',
      ],
    },
    {
      heading: 'Control-plane records',
      paragraphs: [
        'A mature flag record has more than a key and a value. It carries type, allowed variants, targeting rules, percentage rollout salt, owner, description, creation date, expiry date, dependencies, approval state, audit history, and linked metrics. Experiment flags also need hypothesis, randomization unit, exposure event, analysis window, and guardrail metrics.',
        'The evaluation context is another record with a schema. It may include service, environment, tenant, user, region, device, plan, build version, request attributes, and targeting key. The targeting key must be stable for percentage rollout. If it changes between requests, users bounce between variants and both experiments and rollouts become misleading.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The evaluation-path view proves that a flag decision is a pipeline, not a global variable lookup. The application sends a key and default to the SDK. Context and provider rules meet at evaluation. The resolved variant flows back with reason metadata. Hooks record what happened.',
        'The rollout-safety view proves that exposure is gradual and observable. A dark launch may run code without user-visible behavior. Internal users test the path. A one percent canary checks guardrails. A ramp expands only if metrics hold. The flag-type table proves that release, experiment, ops, and permission flags have different lifecycles and risks.',
      ],
    },
    {
      heading: 'Rollout mechanics',
      paragraphs: [
        'Progressive delivery usually moves through a ladder: dark launch, internal cohort, small canary, larger ramp, and full release. The exact ladder depends on blast radius. A checkout change may require slow regional rollout and revenue guardrails. A UI copy change can move faster. A database migration gate needs a plan for both old and new code paths.',
        'Percentage rollout should use deterministic hashing over a stable subject. The result is a cohort, not a random coin flip on every request. Sticky assignment keeps users in the same variant, makes canary metrics meaningful, and lets support teams reproduce behavior by checking the evaluation reason.',
      ],
    },
    {
      heading: 'Observability loop',
      paragraphs: [
        'A flag is only safe if its impact is visible. Evaluation events should include key, variant, reason, targeting key, service, environment, and request correlation metadata. Metrics should connect exposure to errors, latency, saturation, conversion, revenue, support tickets, or model-quality scores, depending on the flag.',
        'Hooks are the place for cross-cutting behavior such as context enrichment, audit events, and telemetry. They must be bounded because flag evaluation often sits in the request path. A slow hook can turn a safety control into a latency regression. The control plane should record enough to debug without adding unbounded work to hot paths.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Feature flags buy control by adding runtime branches, provider dependencies, cache policy, metadata, and cleanup work. SDKs often cache rules or stream updates to avoid network calls on every request, but then teams must decide how stale a decision can be. Strong consistency is expensive. Eventual consistency is usually fine for release flags but risky for safety kill switches.',
        'Flags also create code debt. Release flags should expire after rollout. Experiment flags should not become permanent product policy without review. Permission flags can drift into authorization logic. Ops flags must be reliable during incidents, when the control plane itself may be under pressure.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Feature flags win when behavior needs precise exposure. They support dark launches, canaries, A/B tests, geo releases, tenant allowlists, plan entitlements, safety kills, graceful degradation, and model rollouts. They let teams decouple code deployment from business release and incident response.',
        'The same structure appears in LLM systems. A model rollout can use cohorts, shadow traffic, prompt-cache version gates, eval thresholds, and rollback proof. On-device model delivery can gate by hardware, battery, locale, and accelerator support. A new accelerator route can be enabled for a small device family before it becomes the default.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first failure mode is an unsafe default. If the provider fails and the default enables the risky path, the flag amplifies the outage. The second is unstable targeting, where users bounce between variants because the targeting key changes. The third is stale cache behavior that keeps old rules active longer than the team expects.',
        'The fourth is flag debt. Old release flags leave dead branches that no one tests. Permission flags can contradict real authorization. Experiment flags can be read as causal truth without statistical discipline. A control plane needs owner metadata, expiry dates, audit logs, and cleanup pressure to stay useful.',
        'A fifth is emergency dependence on an unhealthy control plane. Kill switches should work when the normal release system is degraded. That often means local cached rules, predeclared safe defaults, and an operational path that has been tested before the incident.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Official sources include the OpenFeature introduction at https://openfeature.dev/docs/reference/intro, the flag evaluation specification at https://openfeature.dev/specification/sections/flag-evaluation, evaluation context at https://openfeature.dev/docs/reference/concepts/evaluation-context/, providers at https://openfeature.dev/docs/reference/concepts/provider, and hooks at https://openfeature.dev/docs/reference/concepts/hooks/.',
        'Study A/B Testing, Multi-Armed Bandits, LLM Model Rollout Shadow Canary Ledger, Cache Invalidation and Versioning, OpenTelemetry Collector Case Study, AIOps Incident Response, On-Device LLM Inference Cost Crossover, Accelerator Kernel Compatibility Matrix, Load Shedding and Graceful Degradation, Circuit Breakers, and Distributed Configuration next.',
      ],
    },
  ],
};
