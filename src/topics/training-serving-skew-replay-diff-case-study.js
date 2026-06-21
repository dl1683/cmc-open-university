// Training-serving skew replay: compare online feature vectors with offline
// recomputation so production ML failures become diffable artifacts.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'training-serving-skew-replay-diff-case-study',
  title: 'Training-Serving Skew Replay Diff',
  category: 'Systems',
  summary: 'Log online feature vectors, replay them through offline definitions, and diff values to catch skew before model metrics drift.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['shadow replay', 'diff ledger'], defaultValue: 'shadow replay' },
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

function replayGraph(title) {
  return graphState({
    nodes: [
      { id: 'request', label: 'request', x: 0.7, y: 3.25, note: 'prod' },
      { id: 'online', label: 'online', x: 2.25, y: 2.0, note: 'lookup' },
      { id: 'log', label: 'log', x: 2.25, y: 4.45, note: 'features' },
      { id: 'queue', label: 'queue', x: 3.95, y: 4.45, note: 'replay' },
      { id: 'offline', label: 'offline', x: 5.45, y: 2.0, note: 'recompute' },
      { id: 'diff', label: 'diff', x: 6.9, y: 3.25, note: 'compare' },
      { id: 'ledger', label: 'ledger', x: 8.2, y: 2.0, note: 'skew' },
      { id: 'gate', label: 'gate', x: 8.2, y: 4.45, note: 'release' },
    ],
    edges: [
      { id: 'e-request-online', from: 'request', to: 'online' },
      { id: 'e-online-log', from: 'online', to: 'log' },
      { id: 'e-log-queue', from: 'log', to: 'queue' },
      { id: 'e-queue-offline', from: 'queue', to: 'offline' },
      { id: 'e-online-diff', from: 'online', to: 'diff' },
      { id: 'e-offline-diff', from: 'offline', to: 'diff' },
      { id: 'e-diff-ledger', from: 'diff', to: 'ledger' },
      { id: 'e-diff-gate', from: 'diff', to: 'gate' },
    ],
  }, { title });
}

function* shadowReplay() {
  yield {
    state: replayGraph('Production lookups become replayable evidence'),
    highlight: { active: ['request', 'online', 'log'], compare: ['offline'] },
    explanation: 'Training-serving skew is hard to see from model metrics alone. A replay diff starts by logging the exact online feature vector used for prediction, with feature versions, timestamps, defaults, and request context.',
  };

  yield {
    state: labelMatrix(
      'Online feature vector log',
      [
        { id: 'f1', label: 'rides_7d' },
        { id: 'f2', label: 'charge_1h' },
        { id: 'f3', label: 'city_lvl' },
        { id: 'f4', label: 'device_age' },
      ],
      [
        { id: 'online', label: 'online' },
        { id: 'meta', label: 'meta' },
        { id: 'ver', label: 'version' },
      ],
      [
        ['12', 'fresh', 'v8'],
        ['0', 'default', 'v8'],
        ['high', 'fresh', 'v4'],
        ['301', 'fresh', 'v2'],
      ],
    ),
    highlight: { active: ['f2:online', 'f2:meta'], found: ['f1:ver', 'f3:ver'] },
    explanation: 'Logging only the prediction score is not enough. The replay job needs the feature vector and metadata that explain where each value came from.',
    invariant: 'You cannot diff what you did not log.',
  };

  yield {
    state: replayGraph('Offline definitions recompute the same request later'),
    highlight: { active: ['queue', 'offline', 'diff'], found: ['ledger'] },
    explanation: 'A replay worker takes sampled production requests, recomputes feature values using the offline definitions and point-in-time rules, then compares the result against the online vector.',
  };

  yield {
    state: labelMatrix(
      'Replay diff result',
      [
        { id: 'rides', label: 'rides_7d' },
        { id: 'charge', label: 'charge_1h' },
        { id: 'city', label: 'city_lvl' },
        { id: 'device', label: 'device_age' },
      ],
      [
        { id: 'online', label: 'online' },
        { id: 'offline', label: 'offline' },
        { id: 'diff', label: 'diff' },
      ],
      [
        ['12', '12', 'ok'],
        ['0', '2', 'skew'],
        ['high', 'high', 'ok'],
        ['301', '301', 'ok'],
      ],
    ),
    highlight: { removed: ['charge:diff'], found: ['rides:diff', 'city:diff', 'device:diff'] },
    explanation: 'The skew appears before labels arrive. Online served a default for chargebacks while offline recomputation found a valid value. That points to an online materialization or freshness problem, not a model architecture problem.',
  };

  yield {
    state: replayGraph('Release gates can block skewed models'),
    highlight: { active: ['diff', 'ledger', 'gate'], compare: ['request'], found: ['offline'] },
    explanation: 'A model or feature-definition release can be gated on replay diff rates. If online and offline values disagree beyond tolerance, the release pauses before users discover the skew through degraded outcomes.',
  };
}

function* diffLedger() {
  yield {
    state: labelMatrix(
      'Diff ledger schema',
      [
        { id: 'req', label: 'request id' },
        { id: 'feat', label: 'feature' },
        { id: 'vals', label: 'values' },
        { id: 'root', label: 'root cause' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['stable key', 'join logs'],
        ['name+ver', 'pin blame'],
        ['on/offline', 'measure gap'],
        ['lag/default', 'fix path'],
      ],
    ),
    highlight: { active: ['feat:stores', 'vals:stores', 'root:stores'], found: ['req:why'] },
    explanation: 'The ledger should make skew queryable by feature, version, owner, model, tenant, and request slice. Without that, a diff system produces anecdotes instead of operational signals.',
  };

  yield {
    state: replayGraph('Complete case: fraud model production gap'),
    highlight: { active: ['request', 'online', 'log', 'queue', 'offline', 'diff'], found: ['ledger'] },
    explanation: 'Case study: a fraud model has strong offline metrics but misses live chargebacks. Replay diff shows that the online feature path defaults chargebacks_1h during Kafka lag, while offline training rows had the correct values.',
  };

  yield {
    state: labelMatrix(
      'Skew root-cause buckets',
      [
        { id: 'lag', label: 'lag' },
        { id: 'version', label: 'version' },
        { id: 'default', label: 'default' },
        { id: 'clock', label: 'clock' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['freshness gap', 'SLO alert'],
        ['def mismatch', 'pin deploy'],
        ['cold start', 'backfill'],
        ['time skew', 'clock audit'],
      ],
    ),
    highlight: { active: ['lag:fix', 'version:fix', 'default:fix'], compare: ['clock:signal'] },
    explanation: 'Diffs should be categorized. A numerical difference is just the symptom; the useful output is a root cause that points to a pipeline owner and release control.',
  };

  yield {
    state: labelMatrix(
      'Tolerance policy',
      [
        { id: 'exact', label: 'categorical' },
        { id: 'float', label: 'float' },
        { id: 'count', label: 'count' },
        { id: 'embed', label: 'embedding' },
      ],
      [
        { id: 'compare', label: 'compare' },
        { id: 'alert', label: 'alert' },
      ],
      [
        ['exact', 'any change'],
        ['epsilon', 'drift band'],
        ['absolute', 'over limit'],
        ['cosine', 'large move'],
      ],
    ),
    highlight: { active: ['exact:compare', 'float:compare', 'count:alert'], compare: ['embed:compare'] },
    explanation: 'Not every feature diff is binary. Floating aggregates need tolerances. Counts need absolute and relative checks. Embeddings need distance thresholds. Categorical values often need exact equality.',
  };

  yield {
    state: replayGraph('Replay diffs become MLOps incident evidence'),
    highlight: { active: ['ledger', 'gate'], found: ['diff'], compare: ['log'] },
    explanation: 'The diff ledger closes the loop between Feature Store, Distributed Tracing, MLOps, and Data Leakage. It gives the team a concrete artifact when offline and production behavior diverge.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'shadow replay') yield* shadowReplay();
  else if (view === 'diff ledger') yield* diffLedger();
  else throw new InputError('Pick a replay diff view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Training-serving skew exists when a model sees one feature reality during training and a different feature reality during production serving. The model may be mathematically unchanged, the code may deploy cleanly, and offline metrics may look strong, but live predictions degrade because the input vector is different. Fraud counts default to zero online while training rows had real counts. A category is lowercased in one path and not in the other. A timestamp join leaks future data offline but production only has past data. These are systems failures that appear as model failures.',
        'A replay diff turns that vague failure into evidence. For a sampled production prediction, the serving path logs the exact online feature vector and metadata. Later, a replay job recomputes the same features from offline definitions using the same entity keys and prediction timestamp. The diff compares online and offline values, records tolerances, and stores the result in a ledger. The goal is not to admire disagreement after metrics have fallen. The goal is to catch skew early enough to block releases, page the right owner, and make the incident debuggable.',
        {type:'callout', text:'Replay diffs make production feature vectors the audit artifact, so skew becomes a data-path incident instead of a vague model regression.'},
      ],
    },
    {
      heading: 'The tempting wrong answer',
      paragraphs: [
        'The naive answer is to watch model scores and business metrics. If fraud loss rises or click-through drops, investigate. That is necessary, but it is late and ambiguous. Aggregate metrics cannot tell whether the model is bad, labels shifted, a feature pipeline lagged, a default value spiked, a version mismatch landed, or the experiment population changed. By the time aggregate metrics move, users have already seen the broken behavior.',
        'Another naive answer is to rerun feature code against the latest warehouse tables. That can be worse than doing nothing because it creates a false sense of correctness. Offline data changes after the prediction time. Late events arrive. Backfills repair missing values. Labels and features can leak future knowledge if point-in-time joins are wrong. A replay diff must reconstruct what should have been known at the original prediction timestamp, not what the warehouse knows today.',
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        'The core idea is to make every served feature vector replayable. The online path logs enough information to identify the request, entity keys, model id, feature names, feature versions, online values, feature event timestamps, freshness, default flags, and lookup source. It should also log the prediction timestamp and any context that changes feature selection, such as tenant, region, experiment arm, or model bundle. Without this metadata, a diff system can only say that values differ. It cannot explain why.',
        'A replay worker consumes those sampled records and runs the offline feature definitions with point-in-time rules. It then compares the online vector with the offline vector under a feature-specific policy. Categorical features usually require exact equality. Floats may allow a small epsilon. Counts may need absolute and relative thresholds. Embeddings may need distance metrics. The output is a skew ledger: a queryable table of differences grouped by feature, model, version, owner, source, time window, and suspected root cause.',
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        'The serving service first performs its normal online lookup and prediction. In parallel, it writes a compact evidence record. That record should avoid unnecessary payload, but it must preserve enough detail to reproduce the feature calculation. Many systems sample because logging every prediction can be expensive. Sampling should be deliberate: always include new model versions, high-value tenants, rare error paths, fresh feature definitions, and incidents under investigation. Random samples are useful for baseline rates, but targeted samples catch release risk faster.',
        'The replay pipeline reads those records from a log or table, hydrates the offline context, and recomputes features as of the original prediction time. This means point-in-time joins, watermark rules, late-event policy, entity key mapping, and feature version resolution must match the contract used during training. The diff stage normalizes values, applies tolerance, writes one row per feature comparison, and attaches labels such as lag, missing default, schema mismatch, stale materialization, clock skew, or version drift.',
        'The ledger then feeds two loops. The first is release control. A model, feature, or serving change can be blocked if skew exceeds thresholds for important features. The second is incident response. When online quality drops, the team can ask which features changed, which versions are affected, which tenants are exposed, and whether the problem is in serving, offline computation, source freshness, or the model itself.',
        'A strong implementation also records lineage. Each diff row should connect back to a feature definition commit, a materialization job, a source table or stream, and a serving store version when those identifiers exist. Lineage turns the ledger from a metric into a repair tool. It lets the team move from "chargebacks_1h is skewed" to "the online materialization for v8 in us-east stopped consuming partition 14 after 10:05."',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The shadow-replay view proves that the production feature vector is the artifact to preserve. A prediction score is not enough. A label that arrives days later is not enough. The online feature values, their versions, and their freshness metadata are the evidence needed to determine whether serving matched training. The offline job is useful only because the online path left a replayable trail.',
        'The diff-ledger view proves that skew must become an operational table, not a collection of notebook screenshots. Rows need stable keys, owner fields, tolerances, and root-cause buckets. That structure lets a team count skew by feature version, alert on a default burst, tie a problem to a freshness SLO, and block a release before aggregate model metrics have enough time to move.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The main cost is evidence volume. Feature vectors can be wide, frequent, and sensitive. The system needs sampling, retention limits, encryption, access control, redaction, and clear rules for personally identifiable data. Logging must not slow the prediction path. Replay compute also costs money because offline definitions may require joins over large tables. A practical design starts with high-value models and high-risk features, then expands coverage as incidents justify it.',
        'There is also comparison cost. Some differences are expected. A floating aggregate may differ because of rounding. A count may differ because a late event arrived. An embedding may move slightly after an upstream model refresh. The tolerance policy has to encode product risk. Too strict, and the ledger pages teams for harmless noise. Too loose, and real skew hides under thresholds. Good systems let each feature declare type, tolerance, owner, freshness SLO, and release criticality.',
        'Replay timing is another tradeoff. Near-real-time replay catches bad releases quickly, but it costs more and may compare before late data has settled. Batch replay is cheaper and steadier, but it may discover a production feature problem hours later. Many teams use both: fast replay for release gates and slower replay for broad coverage.',
      ],
    },
    {
      heading: 'Real uses and failure modes',
      paragraphs: [
        'Replay diffs are useful in fraud, ads, recommendations, ranking, credit risk, marketplace matching, pricing, ETA, and trust systems. A typical fraud case looks like this: offline training used a chargebacks_1h count computed from settled events, but online serving reads a streaming materialization that sometimes lags. During lag, the online path defaults the count to zero. Offline evaluation looks strong because historical rows have the real count. Production misses risky activity because the live model sees a safer customer than the offline model saw.',
        'The fix is a systems fix. Add freshness SLOs, expose default rates, log fallback reasons, gate releases on replay diff rates, backfill online stores before rollout, and evaluate the model with production-like defaults. A bigger model will not repair a broken feature path. The failure modes are also clear. The diff system can miss skew if the online log omits key metadata. It can create false alarms if point-in-time replay is wrong. It can leak data if logs are too rich. It can become unused if root-cause buckets do not map to owning teams.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Feature Store, Point-in-Time Feature Join Index, Feature Freshness SLO Monitor, Data Leakage, Distributed Tracing, Online Experimentation, and MLOps. External references worth reading include Uber Michelangelo, Uber Palette, Feast feature retrieval concepts, and papers or engineering reports on operational machine learning. The broader lesson is that model quality depends on data-path correctness. A replay diff is a control system for that data path.',
      ],
    },
  ],
};
