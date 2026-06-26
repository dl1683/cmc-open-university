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
        'The animation has two views. The evaluation-path view traces a single flag lookup from the application through the SDK, context, provider, targeting rules, and out to a resolved variant plus telemetry hooks. The rollout-safety view shows how progressive delivery climbs a ladder from dark launch to full release, and how different flag types carry different lifecycle risks.',
        {type: 'callout', text: 'A feature flag control plane turns release risk into a typed runtime decision with context, rules, defaults, and telemetry.'},
        'Active nodes are the current decision point in the pipeline. Found markers indicate a resolved outcome: the variant that was selected or the guardrail that passed. Compare markers show a component that matters for contrast, such as the provider that could be unavailable.',
        'Watch context and rules converge at the targeting-rules node. That convergence is the core operation: attributes from the caller meet rules from the control plane, and together they produce a deterministic variant. Every other node either feeds that convergence or observes its result.',
        {type: 'image', src: './assets/gifs/feature-flag-control-plane.gif', alt: 'Animated walkthrough of the feature flag control plane visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Deploying code and releasing behavior are different actions. A team may push a new checkout flow to every server but enable it only for employees, then one enterprise tenant, then one percent of stable users. If the flow breaks, they need to kill it in seconds without building and shipping a new artifact. This separation requires a runtime decision layer between the deployed code and the user-visible behavior.',
        'A feature flag control plane is that layer. The application asks for a typed flag value by key. The SDK assembles an evaluation context (who is asking, from where, under what plan). A provider applies targeting rules against that context and returns a variant plus a reason. Hooks emit telemetry so the team can observe impact. That pipeline lets teams dark-launch, canary, experiment, degrade, and roll back with precision that a deployment alone cannot provide.',
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
        'The first instinct is an environment variable or a boolean in a config file: if ENABLE_NEW_CHECKOUT is true, run the new path. This works for a single global switch in one service. It fails the moment a rollout needs typed values (string variant names, not just booleans), tenant-level targeting, stable percentage cohorts, audit history, safe defaults during provider outages, and cleanup ownership after the rollout finishes.',
        'The deeper problem is distribution. Once 40 services each evaluate the same flag at runtime, a flag is no longer a scattered if-statement. It is a control plane that needs consistent rule evaluation, a shared context schema, fallback semantics, observability, and lifecycle management. Without those, flags become invisible branches that change production behavior with no accountability trail.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The invariant a flag must preserve is deterministic assignment: the same user, with the same context, must receive the same variant on every evaluation during a rollout window. If that breaks, a user on the new checkout flow refreshes the page and lands on the old one. Canary metrics become meaningless because the treatment and control groups overlap. Experiment results lose causal validity.',
        'One operation sequence that breaks this: a team uses the session ID as the targeting key for a 10% rollout. User Alice starts a session, gets variant B, adds items to a cart built by variant B. Her session expires; she logs in again with a new session ID. The hash now places her in the control group. The cart page renders variant A, which expects different state. The page errors or silently drops items. The flag did not fail in the usual sense -- it evaluated correctly both times -- but the unstable targeting key violated the determinism invariant and caused real user harm.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A feature flag is a pure decision function over four inputs: key, default value, targeting rules, and evaluation context. The application supplies the question (key + default). The provider supplies the rules. The context supplies the attributes. The output is a typed variant plus metadata explaining why that variant was chosen. The reason metadata matters because a rollout that cannot be explained cannot be debugged.',
        'OpenFeature formalizes this insight as a vendor-neutral API. Its flag evaluation specification separates the application-facing call from any specific backend. The application depends on a stable contract -- getBooleanValue(key, default, context) -- while providers, storage backends, and rule engines can be swapped behind it. This is the same separation that makes database drivers work: the caller specifies what, the provider decides how.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Evaluation starts when the application calls the SDK with a flag key, a typed default, and optional invocation context. The SDK merges four context layers: global (set once at application startup, e.g. service=checkout), client (set when the SDK client is created, e.g. tenant=acme), invocation (set per call, e.g. user=alice), and targeting key (a stable identifier for percentage bucketing). Later layers override earlier ones on key collision.',
        'The merged context goes to the provider, which evaluates targeting rules. Rules are checked in priority order: if user is in the internal-testers list, return variant B; else if tenant is in the enterprise allowlist, return variant B; else if hash(targeting_key, flag_key, salt) mod 100 < rollout_percentage, return variant B; else return the default. The first matching rule wins. The provider returns the variant, a reason code (TARGETING_MATCH, DEFAULT, ERROR, STATIC), and optional metadata.',
        'Hooks run at four lifecycle points. Before hooks enrich context (add request headers, inject tracing spans). After hooks record the evaluation result for analytics. Error hooks capture provider failures and ensure the safe default is returned. Finally hooks emit telemetry and enforce latency budgets. All four must be bounded in cost because flag evaluation sits in the request hot path.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The pipeline preserves the determinism invariant because every input is explicit and every rule is ordered. Before evaluation: the context is a fixed map of attributes, the rules are an ordered list, and the targeting key is stable. During evaluation: rules are checked top-to-bottom, and the first match produces the variant. After evaluation: the same inputs will always produce the same output because no hidden state (randomness, time-of-day, mutable globals) participates in the decision.',
        'The corner case is percentage rollout. Determinism requires that hash(targeting_key, flag_key, salt) is a pure function of its inputs. If the salt changes (say, someone edits the flag record and the salt regenerates), every user\'s bucket shifts and the cohort scrambles. Good implementations treat salt as immutable once a flag is created, or warn loudly when a salt change will re-bucket users mid-rollout.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A single flag evaluation is O(R) where R is the number of targeting rules, and R is typically under 20. The real cost is not CPU but operational. Adding 200 flags across 40 services means 200 runtime branch points that are invisible in the source code. Each flag adds a cache entry, a rule-sync channel, a telemetry event, and a cleanup obligation.',
        'SDKs cache rules locally and sync via streaming (SSE, gRPC, WebSocket) or polling. Streaming gives sub-second propagation but adds a persistent connection per service instance. Polling (every 30 seconds is common) is simpler but means a flag change can take 30 seconds to propagate -- fine for a release flag, dangerous for an emergency kill switch. Strong consistency (evaluate against the remote rule store on every call) costs a network round-trip per evaluation and is rarely worth it outside safety-critical paths.',
        'Flag debt compounds. A team that ships 10 release flags per month and removes none has 120 dead branches after a year. Each dead branch is an untested code path that still runs in production. The cost is not the flag itself but the cognitive load, the test matrix expansion, and the incident surface when someone accidentally flips a stale flag.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Feature flags win when behavior needs controlled exposure. Dark launches run new code in shadow mode to measure performance without user-visible impact. Canary releases expose 1% of traffic to detect regressions before they hit everyone. A/B tests assign stable cohorts to measure causal impact on conversion or revenue. Geo-rollouts enable a payment method region by region. Kill switches disable a broken feature in seconds without a deployment.',
        'The same structure appears in ML systems. A model rollout can gate by user cohort, shadow-score both old and new models on live traffic, compare eval metrics, and promote only when the new model wins on guardrail thresholds. On-device inference can gate by hardware capability, battery level, and OS version. A prompt-template change in an LLM application can roll out to 5% of requests, measure hallucination rate against a baseline, and auto-rollback if the rate exceeds a threshold.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Unsafe defaults are the most common failure. If the provider goes down and the default for a new checkout flag is true, every user hits the untested path during the outage. The fix is to always set defaults to the conservative behavior -- the old path, the degraded mode, the feature-off state -- so provider failure narrows exposure rather than widening it.',
        'Unstable targeting keys cause users to bounce between variants. Using session ID, IP address, or any ephemeral identifier breaks deterministic bucketing. The fix is a stable user ID or account ID as the targeting key, falling back to a device fingerprint for anonymous users.',
        'Flag debt is the slow failure. A 500-flag inventory with no owner metadata and no expiry dates becomes an archaeological site. Teams are afraid to remove flags because they cannot tell which are still load-bearing. The fix is organizational: every flag gets an owner, a creation date, and a mandatory review date. Flags past their review date generate alerts.',
        'Emergency dependence on an unhealthy control plane is the subtle failure. A kill switch must work when the system is already degraded. If the kill switch depends on a provider that shares infrastructure with the failing service, the switch is unavailable exactly when it is needed. The fix is pre-cached rules, local defaults, and an operational runbook tested before the incident.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A payments team wants to roll out a new fraud-scoring model to 10% of checkout requests. They create a flag: key=fraud-model-v2, type=boolean, default=false, salt=0xA3F1. They add one targeting rule: if hash(targeting_key, "fraud-model-v2", 0xA3F1) mod 100 < 10, return true.',
        'Request arrives: user_id=u-4821, tenant=acme, region=us-east. The SDK merges context: global (service=payments), client (environment=production), invocation (user_id=u-4821, tenant=acme, region=us-east), targeting_key=u-4821. The provider receives the merged context and evaluates rules.',
        'Rule check: hash("u-4821", "fraud-model-v2", "0xA3F1") = 7,291,403. 7,291,403 mod 100 = 3. Since 3 < 10, the rule matches. The provider returns variant=true, reason=TARGETING_MATCH. The after hook emits an evaluation event: {flag: "fraud-model-v2", variant: true, reason: "TARGETING_MATCH", user: "u-4821", timestamp: 1719014400}.',
        'The application calls the new fraud model. Over the next hour, the team watches the dashboard. Error rate for the 10% cohort is 0.02% vs 0.01% baseline -- within the guardrail threshold of 0.05%. P99 latency is 340ms vs 310ms baseline -- within the 400ms budget. They ramp to 25%. After 24 hours at 25% with clean metrics, they ramp to 100% and schedule the flag for removal in two sprints.',
        'If instead the error rate had spiked to 0.08% (above the 0.05% guardrail), the on-call would set rollout_percentage to 0, which immediately routes all users to the old model. The flag stays in the system with a postmortem link until the root cause is fixed.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the OpenFeature specification at https://openfeature.dev/specification/sections/flag-evaluation defines the evaluation contract. The OpenFeature concepts docs cover evaluation context (https://openfeature.dev/docs/reference/concepts/evaluation-context/), providers (https://openfeature.dev/docs/reference/concepts/provider), and hooks (https://openfeature.dev/docs/reference/concepts/hooks/). Martin Fowler\'s feature toggles article (https://martinfowler.com/articles/feature-toggles.html) introduced the four-category taxonomy (release, experiment, ops, permission) that most systems still use.',
        'Study A/B Testing next to understand the statistical discipline that experiment flags require. Study Circuit Breakers to see how a kill switch relates to automated failure detection. Study Cache Invalidation and Versioning for the staleness tradeoffs in rule syncing. Study Load Shedding and Graceful Degradation for what happens when the control plane itself is under pressure.',
      ],
    },
  ],
};

