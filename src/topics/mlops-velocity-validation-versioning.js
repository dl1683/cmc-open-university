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
    explanation: 'The interview study summarizes production ML success around three variables: velocity, validation, and versioning. ML teams need to move quickly, but every movement changes data, code, features, model state, and evaluation assumptions.',
  };

  yield {
    state: mlLoop('Operational ML is a continual loop, not a one-time deploy'),
    highlight: { active: ['data', 'experiment', 'validate', 'deploy', 'monitor'], found: ['version'] },
    explanation: 'The loop is data collection, experimentation, staged validation, deployment, monitoring, and back to data. A model is not a static artifact; it is a maintained dependency inside a changing data system.',
    invariant: 'Production ML is a feedback loop with lineage, not a final model file.',
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
    explanation: 'Validation begins with offline metrics but does not end there. Shadow mode, canaries, feature flags, A/B tests, and drift monitors each catch different failures.',
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
    explanation: 'Versioning is the machinery that lets velocity and validation coexist. Without lineage, a bad rollout cannot be explained, reproduced, or safely rolled back.',
  };
}

function* failureModes() {
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
    explanation: 'The interview-study lesson is operational, not only statistical. Most failures are handoff failures: experiment to deployment, offline metric to online behavior, feature definition to serving lookup, prediction to delayed label.',
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
    explanation: 'A model can pass launch checks and decay later as data changes. Monitoring turns validation from a gate into a continuing obligation.',
    invariant: 'Validation after deploy is still validation.',
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
    explanation: 'When an incident happens, the team needs to reconstruct the exact model, training data, feature definitions, evaluation suite, and code that produced the behavior. Versioning is incident response infrastructure.',
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
    explanation: 'MLOps is software engineering under statistical uncertainty. The discipline is not a tool brand; it is the set of controls that keep learning systems observable and reversible.',
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
      heading: 'What it is',
      paragraphs: [
        'The paper "Operationalizing Machine Learning: An Interview Study" studies how machine-learning engineers deploy and maintain ML pipelines in production. Its useful teaching frame is the 3Vs: velocity, validation, and versioning. AI Engineering Stack: Five Parts Primer gives the companion diagnostic map: data, model, compute, evaluation, and serving. Teams need velocity because data and products change. They need validation because offline metrics, staged deployments, and monitoring catch different failures. They need versioning because every ML behavior depends on code, data, labels, features, model configuration, and evaluation state.',
        'This topic treats MLOps as an operating loop rather than a tool list. The loop is data collection and labeling, experimentation, staged evaluation, deployment, production monitoring, and back to data. Every pass through the loop should improve the system without destroying the ability to reproduce or roll back what happened.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Velocity comes from automated pipelines, reusable features, fast experiment tracking, and deployment mechanisms such as feature flags and canaries. Validation comes from train/validation/test discipline, data-leakage checks, offline benchmarks, shadow mode, canaries, online A/B tests, drift monitors, and delayed-label audits. Versioning ties code commits, data snapshots, feature definitions, model weights, configs, and evaluation suites into a lineage graph.',
        'The 3Vs trade against each other. More velocity without validation ships broken models faster. More validation without versioning produces reports nobody can reproduce. More versioning without usable workflows becomes bureaucracy. A strong ML platform makes the right behavior the fast behavior.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Production ML adds costs that ordinary stateless services do not carry. Labels can arrive late. Data distributions drift. Feature pipelines can lag or skew. A model can pass offline tests and fail under a new traffic mix. A rollback may require reverting features and model weights together. That is why Feature Store, Distributed Tracing, Feature Flag Control Plane, A/B Testing, and Data Leakage & Contamination are not side topics; they are part of the same operating system.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The 3V frame applies to recommendation systems, fraud detection, search ranking, ads, autonomous-vehicle perception pipelines, credit risk, support automation, personalization, and LLM-powered products. Any team retraining models from live data needs explicit answers to: how fast can we learn, how do we prove the change is safe, and how do we reconstruct what served?',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'MLOps is not just CI/CD with model files. A model artifact is coupled to data, labels, features, thresholds, and online serving code. Another misconception is that a better offline metric guarantees better production behavior. It does not; offline validation is one stage. Also, versioning alone is insufficient if the team cannot query lineage during incidents. The lineage graph must be operationally useful, not just archived.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Operationalizing Machine Learning: An Interview Study at https://arxiv.org/abs/2209.09125 and the CSCW paper PDF at https://rlnsanz.github.io/dat/MLOps_Interview_Study__CSCW24.pdf. Study AI Engineering Stack: Five Parts Primer, Feature Store: Offline/Online Consistency, Point-in-Time Feature Join Index, Feature Freshness SLO Monitor, Training-Serving Skew Replay Diff, Data Leakage & Contamination, Cross-Validation & Honest Evaluation, Feature Flag Control Plane, Distributed Tracing, A/B Testing & p-values, and AIOps Incident Response next.',
      ],
    },
  ],
};
