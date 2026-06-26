// Operationalizing ML: the 3V frame from an interview study of MLEs -
// velocity, validation, and versioning.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'mlops-velocity-validation-versioning',
  title: 'MLOps: Velocity, Validation, Versioning',
  category: 'Systems',
  summary: 'A production ML operating loop from the interview-study literature: move quickly, validate at every stage, and version data, code, features, and models together.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['3V operating loop', 'failure modes'], defaultValue: '3V operating loop' },
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

function mlLoop(title) {
  return graphState({
    nodes: [
      { id: 'data', label: 'data + labels', x: 1.0, y: 3.8, note: 'collect' },
      { id: 'experiment', label: 'experiment', x: 3.0, y: 2.4, note: 'iterate' },
      { id: 'validate', label: 'validate', x: 5.0, y: 2.4, note: 'offline/stage' },
      { id: 'deploy', label: 'deploy', x: 7.0, y: 3.8, note: 'canary' },
      { id: 'monitor', label: 'monitor', x: 5.0, y: 5.2, note: 'drift' },
      { id: 'version', label: 'version graph', x: 3.0, y: 5.2, note: 'lineage' },
    ],
    edges: [
      { id: 'e-data-experiment', from: 'data', to: 'experiment', weight: '' },
      { id: 'e-experiment-validate', from: 'experiment', to: 'validate', weight: '' },
      { id: 'e-validate-deploy', from: 'validate', to: 'deploy', weight: '' },
      { id: 'e-deploy-monitor', from: 'deploy', to: 'monitor', weight: '' },
      { id: 'e-monitor-data', from: 'monitor', to: 'data', weight: '' },
      { id: 'e-version-experiment', from: 'version', to: 'experiment', weight: '' },
      { id: 'e-monitor-version', from: 'monitor', to: 'version', weight: '' },
    ],
  }, { title });
}

function* threeVLoop() {
  const vCount = 3; // velocity, validation, versioning
  const loopStages = 6; // data, experiment, validate, deploy, monitor, version
  const validationStages = 5; // offline, shadow, canary, ab, full
  const versionedArtifacts = 5; // code, data, features, model, eval

  yield {
    state: labelMatrix(
      'The 3V frame for operational ML',
      [
        { id: 'velocity', label: 'V' },
        { id: 'validation', label: 'Val' },
        { id: 'versioning', label: 'Ver' },
      ],
      [
        { id: 'means', label: 'does' },
        { id: 'without it', label: 'risk' },
      ],
      [
        ['loops', 'stale'],
        ['check', 'blind'],
        ['trace', 'stuck'],
      ],
    ),
    highlight: { active: ['velocity:means', 'validation:means', 'versioning:means'] },
    explanation: `The interview study summarizes production ML success around ${vCount} variables: velocity, validation, and versioning. ML teams need to move quickly, but every movement changes data, code, features, model state, and evaluation assumptions.`,
  };

  yield {
    state: mlLoop('Operational ML is a continual loop, not a one-time deploy'),
    highlight: { active: ['data', 'experiment', 'validate', 'deploy', 'monitor'], found: ['version'] },
    explanation: `The loop connects ${loopStages} stages: data collection, experimentation, staged validation, deployment, monitoring, and back to data. A model is not a static artifact; it is a maintained dependency inside a changing data system.`,
    invariant: `Production ML is a feedback loop across ${loopStages} stages with lineage, not a final model file.`,
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'offline', label: 'offline eval', x: 0.8, y: 3.8, note: 'held-out' },
        { id: 'shadow', label: 'shadow mode', x: 2.7, y: 3.8, note: 'no user impact' },
        { id: 'canary', label: 'canary', x: 4.6, y: 3.8, note: 'small traffic' },
        { id: 'ab', label: 'A/B test', x: 6.5, y: 3.8, note: 'causal' },
        { id: 'full', label: 'full rollout', x: 8.5, y: 3.8, note: 'monitored' },
      ],
      edges: [
        { id: 'e-offline-shadow', from: 'offline', to: 'shadow', weight: '' },
        { id: 'e-shadow-canary', from: 'shadow', to: 'canary', weight: '' },
        { id: 'e-canary-ab', from: 'canary', to: 'ab', weight: '' },
        { id: 'e-ab-full', from: 'ab', to: 'full', weight: '' },
      ],
    }, { title: 'Validation is staged, not one gate' }),
    highlight: { active: ['offline', 'shadow', 'canary', 'ab'], found: ['full'] },
    explanation: `Validation is staged across ${validationStages} gates: offline metrics, shadow mode, canaries, A/B tests, and full rollout. Each catches different failures that earlier stages miss.`,
  };

  yield {
    state: labelMatrix(
      'What must be versioned together',
      [
        { id: 'code', label: 'code' },
        { id: 'data', label: 'data snapshot' },
        { id: 'features', label: 'features' },
        { id: 'model', label: 'model' },
        { id: 'eval', label: 'eval set' },
      ],
      [
        { id: 'artifact', label: 'artifact' },
        { id: 'rollback question', label: 'rollback question' },
      ],
      [
        ['training commit', 'which logic ran?'],
        ['time window', 'what rows existed?'],
        ['definition version', 'same online?'],
        ['weights + config', 'what served?'],
        ['benchmark version', 'what passed?'],
      ],
    ),
    highlight: { found: ['code:artifact', 'data:artifact', 'features:artifact', 'model:artifact', 'eval:artifact'] },
    explanation: `Versioning tracks ${versionedArtifacts} artifacts (code, data, features, model, eval) so velocity and validation can coexist. Without lineage, a bad rollout cannot be explained, reproduced, or safely rolled back.`,
  };
}

function* failureModes() {
  const antiPatterns = 4;
  const monitorDays = 30;
  const lineageNodes = 6; // modelA, features, data, eval, code, incident
  const checklistItems = 4;

  yield {
    state: labelMatrix(
      'Common MLOps anti-patterns',
      [
        { id: 'notebook', label: 'notebook model' },
        { id: 'offline', label: 'offline-only win' },
        { id: 'feature', label: 'feature drift' },
        { id: 'label', label: 'label delay' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'control', label: 'control' },
      ],
      [
        ['cannot reproduce', 'pipeline lineage'],
        ['online drop', 'staged validation'],
        ['train/serve skew', 'feature store'],
        ['late truth', 'monitor lag'],
      ],
    ),
    highlight: { active: ['offline:symptom', 'feature:symptom'], found: ['feature:control'] },
    explanation: `The interview-study lesson identifies ${antiPatterns} common anti-patterns, all operational rather than statistical. Most failures are handoff failures: experiment to deployment, offline metric to online behavior, feature definition to serving lookup, prediction to delayed label.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'days since deploy', min: 0, max: 30 }, y: { label: 'business metric', min: 0.6, max: 1.05 } },
      series: [
        { id: 'metric', label: 'observed metric', points: [
          { x: 0, y: 1.0 }, { x: 5, y: 0.98 }, { x: 10, y: 0.94 }, { x: 15, y: 0.87 }, { x: 20, y: 0.78 }, { x: 30, y: 0.70 },
        ] },
        { id: 'alert', label: 'alert threshold', points: [
          { x: 0, y: 0.9 }, { x: 30, y: 0.9 },
        ] },
      ],
      markers: [
        { id: 'trip', x: 13, y: 0.9, label: 'alert' },
      ],
    }),
    highlight: { active: ['metric'], found: ['trip'] },
    explanation: `A model can pass launch checks and decay over ${monitorDays} days as data changes. Monitoring turns validation from a gate into a continuing obligation.`,
    invariant: `Validation after deploy is still validation -- drift can emerge anywhere across ${monitorDays} days of serving.`,
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'modelA', label: 'model v17', x: 1.0, y: 3.8, note: 'serving' },
        { id: 'features', label: 'feature v9', x: 3.0, y: 2.5, note: 'contract' },
        { id: 'data', label: 'data 2026-06', x: 3.0, y: 5.1, note: 'snapshot' },
        { id: 'eval', label: 'eval v4', x: 5.2, y: 2.5, note: 'bench' },
        { id: 'code', label: 'code sha', x: 5.2, y: 5.1, note: 'trainer' },
        { id: 'incident', label: 'incident', x: 7.8, y: 3.8, note: 'debug' },
      ],
      edges: [
        { id: 'e-model-features', from: 'modelA', to: 'features', weight: '' },
        { id: 'e-model-data', from: 'modelA', to: 'data', weight: '' },
        { id: 'e-model-eval', from: 'modelA', to: 'eval', weight: '' },
        { id: 'e-model-code', from: 'modelA', to: 'code', weight: '' },
        { id: 'e-eval-incident', from: 'eval', to: 'incident', weight: '' },
        { id: 'e-code-incident', from: 'code', to: 'incident', weight: '' },
      ],
    }, { title: 'Version lineage makes incidents debuggable' }),
    highlight: { active: ['modelA', 'features', 'data', 'eval', 'code'], found: ['incident'] },
    explanation: `When an incident happens, the team traces ${lineageNodes} lineage nodes -- model, features, data, eval, code, and the incident itself -- to reconstruct the exact behavior. Versioning is incident response infrastructure.`,
  };

  yield {
    state: labelMatrix(
      'A practical readiness checklist',
      [
        { id: 'metric', label: 'metric' },
        { id: 'skew', label: 'skew' },
        { id: 'rollback', label: 'rollback' },
        { id: 'owner', label: 'owner' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'linked topic', label: 'read next' },
      ],
      [
        ['what must not regress?', 'A/B Testing'],
        ['offline equals online?', 'Feature Store'],
        ['how to revert?', 'Feature Flags'],
        ['who responds?', 'AIOps Incident'],
      ],
    ),
    highlight: { found: ['metric:question', 'skew:question', 'rollback:question', 'owner:question'] },
    explanation: `The readiness checklist distills MLOps into ${checklistItems} questions: what must not regress, does offline equal online, how to revert, and who responds. The discipline is the set of controls that keep learning systems observable and reversible.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === '3V operating loop') yield* threeVLoop();
  else if (view === 'failure modes') yield* failureModes();
  else throw new InputError('Pick an MLOps operating-loop view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The operating loop shows production machine learning as a cycle, not a one-time deploy. Data and labels feed experiments, experiments produce candidate models, validation decides promotion, deployment creates serving behavior, and monitoring feeds the next data cycle. The version graph is the memory that links these stages.',
        'Velocity means changing the system quickly, validation means checking that a change is safe, and versioning means recording exactly what produced a behavior. The safe inference rule is that a model version is not enough; a prediction depends on code, data, features, labels, config, thresholds, and serving context together.',
        {type: 'image', src: './assets/gifs/mlops-velocity-validation-versioning.gif', alt: 'Animated walkthrough of the mlops velocity validation versioning visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Software behavior usually changes when code changes. Machine-learning behavior can change when code changes, but also when data distribution changes, labels arrive late, feature definitions drift, thresholds move, or users adapt. That makes ordinary release engineering necessary but incomplete.',
        'MLOps exists to operate that larger behavior surface. The 3V frame names the pressure: teams need velocity, validation, and versioning at the same time. Moving fast is useful only when the system can prove what changed, decide whether it is safe, and roll back the whole behavior if it is not.',
        {type: 'callout', text: 'MLOps is release engineering for systems whose behavior is produced by code, data, labels, and time together.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A production ML system is a directed loop of data, training, validation, deployment, monitoring, and feedback. Source: Wikimedia Commons, David W., public domain.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is notebook-to-endpoint. Train a model in a notebook, export weights or a pickle file, wrap it with an API, and deploy it like a normal service. This is fast for a demo and can be enough for a low-risk internal tool.',
        'Another obvious approach is to copy standard CI/CD. Build a container, run unit tests, deploy to staging, and promote to production. That improves packaging, but it does not prove the model was trained on the right data or that offline features match online features.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears during reproduction and rollback. A bad model version may have passed evaluation because the eval set leaked training data, the labels were stale, or one important slice regressed while the aggregate metric improved. Rolling back weights may not roll back the feature definition or threshold that caused the incident.',
        'Machine-learning failures are often delayed. A model can pass launch checks and decay over weeks as user behavior changes. If lineage is incomplete, the team cannot tell whether the failure came from data drift, serving skew, label delay, feature code, model weights, or product changes.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat production ML as a controlled feedback loop with lineage. Every candidate model should be tied to the code commit, data snapshot, feature definitions, label source, hyperparameters, evaluation suite, approval record, and serving configuration that produced it. Every deployment should record what traffic saw it and how it can be reversed.',
        'Velocity comes from making this path repeatable, not from skipping controls. Validation becomes a staged process, not one score. Versioning becomes incident-response infrastructure, not archival decoration.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg', alt: 'Process state transition diagram', caption: 'Staged validation works like a state machine: candidates advance only after the right evidence exists for the next state. Source: Wikimedia Commons, MrArifnajafov, CC BY-SA 3.0.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start by defining the decision the model affects, the product metric, guardrail metrics, required slices, label source, and feature contract. A training pipeline then builds a candidate from a known data snapshot and code commit. The candidate includes weights, preprocessing, thresholds, schema, and evaluation evidence.',
        'Offline validation checks held-out metrics, slice regressions, leakage, schema, feature freshness, calibration where relevant, and known failure cases. Shadow mode runs the candidate beside production without affecting users. Canary rollout sends a small traffic share through the candidate, and online experiments measure product impact when causal evidence is needed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is operational rather than mathematical. A production prediction is explainable only if it can be traced to a specific model, code path, feature definition, data window, threshold, and serving configuration. Lineage makes that trace available when the system works and when it fails.',
        'Staged validation works because different failures appear at different distances from production. Leakage can be caught offline, train-serving skew can appear in shadow mode, latency can appear in canary, product harm can appear in an online experiment, and drift can appear weeks later.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost of MLOps is process and platform surface. Experiment tracking, feature stores, model registries, data validation, CI jobs, deployment gates, and monitors can slow teams if they are bolted on manually. The point is a paved path that captures evidence by default, not a maze of approvals.',
        'Validation has direct cost: offline suites consume compute, shadow mode duplicates inference, canaries need monitoring windows, and A/B tests require enough traffic to see effects. Practical systems stage the expense with cheap checks on every run, expensive checks for promotion, and online tests for changes with real user impact.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The 3V frame fits recommender systems, ranking, fraud detection, search, ads, forecasting, personalization, credit models, computer vision, and LLM products. Any system retrained from changing data needs a way to move quickly without losing control of what changed.',
        'In fraud detection, velocity matters because attackers adapt. Validation matters because false positives harm customers and false negatives lose money. Versioning matters because disputes require reconstructing the exact features, thresholds, labels, and model that made a decision.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'MLOps fails when lineage is shallow. Logging a model id is not enough if the team cannot recover the feature code, data snapshot, label rules, eval set, threshold, and deployment config. That is lineage theater: lots of records with no incident answer.',
        'It also fails when safety is too slow. If every candidate requires bespoke manual review, teams will bypass the process or stop iterating. Good controls make the safe route faster than the unsafe route by automating repeated checks.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Decision_tree_model.png', alt: 'Decision tree model with branches and leaf decisions', caption: 'Failure triage is a decision tree over lineage, serving skew, metric drift, and rollback scope. Source: Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A ranking team trains model v17 on clicks from May 1 through May 31. Offline NDCG rises from 0.412 to 0.431, but the slice for new users drops from 0.280 to 0.250. The promotion gate blocks launch until the team either fixes the slice or records an explicit risk decision.',
        'After a fix, v18 passes offline checks and runs in shadow mode for 24 hours. Shadow logs show 2 percent of requests missing a feature that existed offline, caused by an online default value. The team fixes the feature pipeline before any user traffic sees the candidate.',
        'The canary sends 5 percent of traffic to v19. Latency p95 rises from 80 ms to 130 ms, crossing the 100 ms guardrail, so the deployment rolls back model, threshold, and feature transform together. The incident is debuggable because the registry links v19 to its data snapshot, feature version, eval suite, and serving config.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read the interview-study literature behind the velocity, validation, and versioning frame, then compare it with model-card, data-validation, experiment-tracking, and feature-store practices in your own stack. The durable lesson is that MLOps is not a vendor category; it is a control loop for changing learned behavior.',
        'Study Feature Store, Point-in-Time Feature Join, Training-Serving Skew, Data Leakage, Cross-Validation, A/B Testing, Feature Flags, Distributed Tracing, and Incident Response. For LLM systems, add eval harnesses, prompt/version registries, retrieval-corpus versioning, and guardrail monitoring to the same lineage model.',
      ],
    },
  ],
};
