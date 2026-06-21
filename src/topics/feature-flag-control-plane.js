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
    explanation: `A feature flag starts as a typed evaluation request flowing through ${7} pipeline nodes: flag key, default value, and context. The application should be able to fall back safely if the provider is unavailable.`,
  };

  yield {
    state: flagGraph('Context and provider rules resolve the variant'),
    highlight: { active: ['context', 'provider', 'rules', 'variant', 'e-context-rules', 'e-provider-rules'], found: ['e-rules-variant'] },
    explanation: `The provider evaluates targeting rules against context through ${7} edges: user id, tenant, region, version, plan, device, or request attributes. The output is a variant plus metadata explaining why.`,
    invariant: `A flag is a pure decision function over ${4} inputs: key, default, rules, and context.`,
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
    explanation: `Context merging across ${4} hierarchy levels matters because percentage rollout and targeting need stable inputs. Missing or unstable targeting keys create users who jump between variants.`,
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
    explanation: `The ${4} lifecycle hooks add cross-cutting behavior such as telemetry and context enrichment. They also need latency discipline because flag evaluation often sits directly in the request path.`,
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
    explanation: `Feature flags turn deployment into progressive exposure through ${4} rollout stages. Code can be deployed everywhere while behavior is enabled for carefully chosen cohorts.`,
  };

  yield {
    state: flagGraph('Telemetry closes the rollout loop'),
    highlight: { active: ['variant', 'hooks', 'e-rules-hooks'], found: ['context', 'rules'] },
    explanation: `A rollout is only safe if the chosen variant is observable. The telemetry loop through ${7} pipeline nodes connects evaluation events, traces, metrics, and business outcomes to impact.`,
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
    explanation: `Not every flag is the same. The matrix shows ${4} distinct types: release flags should expire, experiment flags need A/B Testing discipline, ops flags are safety controls, and permission flags can become product policy.`,
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
    explanation: `Flags are a control plane with ${4} common failure modes. They need defaults, TTLs, ownership, audit logs, and cleanup or they become a distributed pile of hidden branches.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Feature Flag Control Plane. Progressive delivery as a data structure: flag keys, evaluation context, providers, hooks, targeting rules, cohorts, and kill switches..",
        {
          type: "callout",
          text: "A feature flag control plane turns release risk into a typed runtime decision with context, rules, defaults, and telemetry.",
        },
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      
        {type: 'image', src: './assets/gifs/feature-flag-control-plane.gif', alt: 'Animated walkthrough of the feature flag control plane visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A feature flag control plane exists because deploying code and releasing behavior are different actions. A team may want the new code path deployed everywhere but enabled only for employees, one enterprise tenant, one region, or one percent of stable users. It may also need to kill a broken feature without building and shipping a new artifact.',
        'The control plane turns behavior into a runtime decision. The application asks for a typed flag value. The SDK builds an evaluation context, the provider applies rules, the result resolves to a variant, and hooks emit telemetry. That small path lets teams dark launch, canary, experiment, degrade, and roll back with more precision than a deployment alone can provide.',
        {
          type: 'image',
          src: 'https://openfeature.dev/assets/images/ff-service-9bfd5d029bfcd0ebbea6c6cab79b6a14.png',
          alt: 'Feature flagging client sending flag evaluations to a feature flagging service',
          caption: 'OpenFeature shows the split between application evaluation calls, a client library, and the external flagging service that owns dynamic rules. Source: OpenFeature documentation, https://openfeature.dev/docs/reference/intro/',
        },
      ],
    },
    {
      heading: 'The obvious approach',
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
      heading: 'How it works',
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
      heading: 'Cost and behavior',
      paragraphs: [
        'Feature flags buy control by adding runtime branches, provider dependencies, cache policy, metadata, and cleanup work. SDKs often cache rules or stream updates to avoid network calls on every request, but then teams must decide how stale a decision can be. Strong consistency is expensive. Eventual consistency is usually fine for release flags but risky for safety kill switches.',
        'Flags also create code debt. Release flags should expire after rollout. Experiment flags should not become permanent product policy without review. Permission flags can drift into authorization logic. Ops flags must be reliable during incidents, when the control plane itself may be under pressure.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Feature flags win when behavior needs precise exposure. They support dark launches, canaries, A/B tests, geo releases, tenant allowlists, plan entitlements, safety kills, graceful degradation, and model rollouts. They let teams decouple code deployment from business release and incident response.',
        'The same structure appears in LLM systems. A model rollout can use cohorts, shadow traffic, prompt-cache version gates, eval thresholds, and rollback proof. On-device model delivery can gate by hardware, battery, locale, and accelerator support. A new accelerator route can be enabled for a small device family before it becomes the default.',
      ],
    },
    {
      heading: 'Where it fails',
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
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Why it works',
      paragraphs: [
        "Give the proof sketch as a preservation argument: invariant before, move, invariant after.",
        "If there is a nontrivial corner case, name it explicitly.",
        "When correctness is explicit, readers can transfer the method to new inputs.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
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
        'Use this topic as a checkpoint: if you can explain why Feature Flag Control Plane moves from input to output in the animation and where it fails, you are ready for the next topic.',
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

