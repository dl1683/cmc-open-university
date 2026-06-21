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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/mlops-velocity-validation-versioning.gif', alt: 'Animated walkthrough of the mlops velocity validation versioning visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type: 'callout', text: 'MLOps is release engineering for systems whose behavior is produced by code, data, labels, and time together.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A production ML system is a directed loop of data, training, validation, deployment, monitoring, and feedback. Source: Wikimedia Commons, David W., public domain.'},
        `MLOps exists because a model is not a finished file. It is a dependency inside a changing data system. The product changes, users change, data pipelines change, labels arrive late, and a model that looked good last month can become wrong without any code deployment.`,
        `The useful frame from the interview-study literature is velocity, validation, and versioning. Velocity is the ability to learn and ship changes quickly. Validation is the set of checks that decide whether a change is safe. Versioning is the lineage that says exactly which code, data, features, labels, model, config, and evaluation suite produced a behavior.`,
        `The three ideas have to live together. A team that moves quickly without validation ships failures quickly. A team that validates without versioning cannot reproduce what passed. A team that versions everything but makes the workflow painful will be bypassed. MLOps is the operating system that keeps these forces in balance.`,
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        `The first naive approach is notebook-to-production. A data scientist trains a model, exports a pickle or weight file, and hands it to an engineer. The engineer wraps it in an endpoint. If the first demo works, the team treats deployment as mostly solved. This is common because it is the shortest path from experiment to visible product behavior.`,
        `The wall appears during the second or third release. Nobody can say which data snapshot trained model v17. The feature code used offline is not the feature code used online. The evaluation set was updated after the model was chosen. A bad canary cannot be explained. Rollback returns the old weights but leaves the new feature transform in place.`,
        `The second naive approach is to copy normal CI/CD and pretend the model is just another binary. That helps with packaging and deployment, but it misses the statistical part. The behavior of the artifact depends on training distribution, label quality, evaluation slices, thresholds, and runtime data. Testing the container starts is not the same as proving the model should serve users.`,
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        `The core insight is that production ML is a feedback loop with lineage. Data and labels feed experimentation. Experiments produce candidate models. Candidates pass through staged validation. Deployment creates new observations. Monitoring sends failures and fresh data back into the next training cycle. Versioning ties the loop together so each decision can be reconstructed.`,
        `Velocity is not recklessness. It comes from repeatable pipelines, reusable feature definitions, fast experiment tracking, clear promotion gates, and deployment mechanisms such as feature flags, shadow mode, canaries, and rollback. The point is to make the correct path easier than the heroic path.`,
        `Validation is not one metric. Offline evaluation catches some regressions before users see them. Shadow mode catches serving mismatches without affecting decisions. Canaries catch early production failures. A/B tests measure user impact. Drift monitors and delayed-label audits catch decay after launch. Each stage sees a different failure surface.`,
        `Versioning is the memory of the system. It links a model to the training code, data window, label source, feature definitions, hyperparameters, thresholds, evaluation set, approval record, and serving configuration. Without that graph, velocity and validation create artifacts but not control.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg', alt: 'Process state transition diagram', caption: 'Staged validation works like a state machine: candidates advance only after the right evidence exists for the next state. Source: Wikimedia Commons, MrArifnajafov, CC BY-SA 3.0.'},
        `A healthy MLOps loop starts before training. The team defines the product metric, guardrail metrics, label source, feature contract, and evaluation slices. The training pipeline then creates a candidate from a known code commit and a known data snapshot. The candidate is not just weights. It is weights plus configuration, feature schema, thresholds, and evaluation evidence.`,
        `The first validation stage is offline. The model must beat a baseline on held-out data and important slices. It should pass leakage checks, schema checks, feature freshness checks, calibration checks where relevant, and regression tests against known failure cases. Offline validation is cheap enough to run often, but it is still a proxy.`,
        `The next stages move closer to production. Shadow mode runs the candidate beside the current model without changing user outcomes. A canary sends a small traffic slice through the new path. An online experiment measures business and user effects. Monitors watch drift, latency, prediction distribution, calibration, data quality, and delayed labels after release.`,
        `Versioning runs through all of this. A registry should answer: what is serving, which data trained it, which feature definitions it expects, which evaluation suite it passed, which deployment promoted it, and what must roll back together. Incident response depends on that query being fast and exact.`,
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The operating-loop visual proves that production ML is cyclical. Data collection, experimentation, validation, deployment, monitoring, and versioning are not separate departments. They are one control loop. Monitoring without a path back to data is a dashboard. Experimentation without promotion gates is a notebook habit. Deployment without lineage is a blind write to production.`,
        `The staged-validation visual proves that no single gate is enough. Offline metrics, shadow mode, canaries, online experiments, and drift monitors each answer a different question. The failure-mode view then shows where systems break: notebook to pipeline, offline feature to online lookup, prediction to delayed label, and model artifact to lineage.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The method works because it makes change observable and reversible. Velocity is safe only when every promoted model has a known path back to its inputs and every rollout has a way to stop. Validation is meaningful only when the artifact being validated is the artifact that will serve. Versioning is useful only when it describes the whole behavior, not just the model file.`,
        `The invariant is simple: a production prediction must be explainable as the output of a specific model version, running under a specific serving configuration, using specific feature definitions, on specific input data, under a specific request context. If the team cannot reconstruct that path, it cannot debug the system reliably.`,
        `Staging works because ML failures are heterogeneous. A data leakage bug may look excellent offline and fail online. A feature lookup mismatch may pass training and fail in shadow mode. A slow feature service may show up only in canary latency. A delayed-label problem may appear weeks later. Multiple gates are not bureaucracy when each gate catches a distinct class of failure.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `The cost is engineering drag if the controls are poorly designed. Feature stores, model registries, experiment trackers, CI jobs, data validators, and deployment gates can become a maze. The goal is not maximum process. The goal is a short, paved path that captures enough evidence to move safely.`,
        `Validation also costs time and traffic. A/B tests need sample size. Canaries need monitoring windows. Shadow mode uses compute without direct product benefit. Offline evaluation can become slow if every candidate runs every benchmark. Practical systems stage cost: cheap checks on every run, expensive checks for promotion candidates, and online experiments for changes that matter.`,
        `Versioning costs storage and discipline. Data snapshots, feature definitions, eval sets, and model artifacts all need retention policies. Keeping too little breaks reproducibility. Keeping everything forever can be expensive or legally risky. The useful question is not "can we save it all?" It is "can we reconstruct decisions within the required audit and rollback window?"`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `The 3V frame fits recommendation, ranking, fraud detection, ads, search, credit risk, forecasting, support automation, personalization, computer vision, and LLM-powered products. It is especially useful when models retrain from live data or when product decisions depend on predictions that can silently decay.`,
        `A fraud model shows the pattern. Velocity matters because attackers adapt. Validation matters because false positives harm customers and false negatives lose money. Versioning matters because an incident investigation must reconstruct the exact labels, features, thresholds, rules, and model that produced decisions on a disputed transaction.`,
        `An LLM product has the same shape even when the artifact is a prompt, retrieval index, router, guardrail, fine-tune, or eval suite. A prompt change can improve one task and regress another. A retrieval corpus update can change answers without a model deployment. The 3V discipline still applies: move quickly, validate slices, and version the whole path.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Decision_tree_model.png', alt: 'Decision tree model with branches and leaf decisions', caption: 'Failure triage is a decision tree over lineage, serving skew, metric drift, and rollback scope. Source: Wikimedia Commons, CC BY-SA 4.0.'},
        `The first failure mode is offline-only confidence. A model can improve aggregate validation AUC while harming a critical slice, increasing latency, breaking calibration, or changing user behavior in production. Offline metrics are necessary, but they are not a substitute for staged rollout and monitoring.`,
        `The second failure mode is train-serving skew. The feature used in training is not the feature served online, or the online value arrives late, is computed differently, or has a different default. This is why feature contracts and replay tests matter. The model can be correct for the data it saw and wrong for the data it serves.`,
        `The third failure mode is lineage theater. Teams log many artifacts but cannot answer incident questions quickly. If the registry cannot tell what model served, what data trained it, what eval passed, and what to roll back together, the lineage exists as compliance decoration rather than operational machinery.`,
        `The fourth failure mode is slow safety. If every change requires a bespoke review, teams route around the process. Good MLOps makes safe behavior faster than unsafe behavior. The controls should remove repeated human effort, not add a meeting to every experiment.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Feature Store: Offline/Online Consistency, Point-in-Time Feature Join Index, Feature Freshness SLO Monitor, Training-Serving Skew Replay Diff, Data Leakage, Cross-Validation, A/B Testing, Feature Flag Control Plane, Distributed Tracing, and AIOps Incident Response. These are the practical controls behind the 3V frame.`,
        `For primary background, read Operationalizing Machine Learning: An Interview Study. Then compare it with model-card, data-validation, and experiment-tracking practices in the systems you use. The durable lesson is that MLOps is not a product category. It is the control loop that lets a learning system change without becoming unexplainable.`,
      ],
    },
  ],
};
