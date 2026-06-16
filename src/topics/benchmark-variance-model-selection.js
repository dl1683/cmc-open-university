// Benchmark variance: model comparison is a random variable, not one number.
// Seeds, data sampling, initialization, augmentation, and HPO all move the score.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'benchmark-variance-model-selection',
  title: 'Benchmark Variance & Model Selection',
  category: 'AI & ML',
  summary: 'A benchmark discipline module: compare models across data, seeds, initialization, augmentation, and hyperparameter search instead of trusting one lucky score.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['variance sources', 'estimator discipline'], defaultValue: 'variance sources' },
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

function* varianceSources() {
  yield {
    state: labelMatrix(
      'Same algorithm, different benchmark luck',
      [
        { id: 'seed1', label: 'seed 1' },
        { id: 'seed2', label: 'seed 2' },
        { id: 'seed3', label: 'seed 3' },
        { id: 'seed4', label: 'seed 4' },
      ],
      [
        { id: 'split A', label: 'split A' },
        { id: 'split B', label: 'split B' },
        { id: 'split C', label: 'split C' },
      ],
      [
        ['82.1', '79.8', '84.0'],
        ['80.7', '78.9', '83.1'],
        ['83.4', '80.2', '85.2'],
        ['81.5', '77.6', '82.8'],
      ],
    ),
    highlight: { active: ['seed4:split B'], found: ['seed3:split C'] },
    explanation: 'A benchmark score is not a fixed property of the algorithm. It moves with train/test sampling, random initialization, minibatch order, augmentation, hardware nondeterminism, and hyperparameter choices.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'accuracy', min: 76, max: 88 }, y: { label: 'trial density', min: 0, max: 1.0 } },
      series: [
        { id: 'modelA', label: 'model A trials', points: [
          { x: 77, y: 0.10 }, { x: 79, y: 0.35 }, { x: 81, y: 0.82 }, { x: 83, y: 0.63 }, { x: 85, y: 0.20 },
        ] },
        { id: 'modelB', label: 'model B trials', points: [
          { x: 79, y: 0.08 }, { x: 81, y: 0.42 }, { x: 83, y: 0.88 }, { x: 85, y: 0.58 }, { x: 87, y: 0.16 },
        ] },
      ],
      markers: [
        { id: 'luckyA', x: 85, y: 0.2, label: 'lucky A' },
        { id: 'badB', x: 79, y: 0.08, label: 'bad B' },
      ],
    }),
    highlight: { active: ['modelA', 'modelB'], compare: ['luckyA', 'badB'] },
    explanation: 'With overlapping score distributions, a single run can reverse the conclusion. Reporting one lucky A against one unlucky B is not model comparison; it is sampling noise with a table around it.',
    invariant: 'The comparison is a distribution before it is a headline number.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'data', label: 'data sample', x: 0.8, y: 3.8, note: 'split' },
        { id: 'aug', label: 'augmentation', x: 2.5, y: 2.4, note: 'policy' },
        { id: 'init', label: 'init seed', x: 2.5, y: 5.2, note: 'weights' },
        { id: 'hpo', label: 'HPO', x: 4.6, y: 3.8, note: 'search' },
        { id: 'train', label: 'training run', x: 6.6, y: 3.8, note: 'stochastic' },
        { id: 'score', label: 'score', x: 8.6, y: 3.8, note: 'metric' },
      ],
      edges: [
        { id: 'e-data-aug', from: 'data', to: 'aug', weight: '' },
        { id: 'e-data-init', from: 'data', to: 'init', weight: '' },
        { id: 'e-aug-hpo', from: 'aug', to: 'hpo', weight: '' },
        { id: 'e-init-hpo', from: 'init', to: 'hpo', weight: '' },
        { id: 'e-hpo-train', from: 'hpo', to: 'train', weight: '' },
        { id: 'e-train-score', from: 'train', to: 'score', weight: '' },
      ],
    }, { title: 'Where variance enters an ML benchmark' }),
    highlight: { active: ['data', 'aug', 'init', 'hpo'], found: ['score'] },
    explanation: 'The MLSys variance paper models the whole benchmarking process, including hyperparameter optimization. The score is downstream of several random variables, not only the model architecture.',
  };

  yield {
    state: labelMatrix(
      'Report the sources, not only the winner',
      [
        { id: 'data', label: 'data' },
        { id: 'init', label: 'init' },
        { id: 'hpo', label: 'HPO' },
        { id: 'metric', label: 'metric' },
      ],
      [
        { id: 'bad report', label: 'bad report' },
        { id: 'better report', label: 'better report' },
      ],
      [
        ['one split', 'several splits'],
        ['one seed', 'seed interval'],
        ['best table only', 'budget + protocol'],
        ['mean only', 'mean + spread'],
      ],
    ),
    highlight: { found: ['data:better report', 'init:better report', 'hpo:better report', 'metric:better report'] },
    explanation: 'Good benchmark writing makes the random variables visible. If the claimed gain is smaller than ordinary run-to-run variation, the result should be treated as tentative.',
  };
}

function* estimatorDiscipline() {
  yield {
    state: labelMatrix(
      'Estimator choices',
      [
        { id: 'single', label: 'single run' },
        { id: 'multi', label: 'multi seed' },
        { id: 'fixed', label: 'fixed HPO' },
        { id: 'nested', label: 'nested HPO' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'risk', label: 'risk' },
        { id: 'use when', label: 'use when' },
      ],
      [
        ['1x', 'high noise', 'smoke test'],
        ['kx', 'less noise', 'paper table'],
        ['medium', 'HPO bias', 'cheap compare'],
        ['high', 'closest truth', 'final claim'],
      ],
    ),
    highlight: { active: ['single:risk'], found: ['nested:risk'] },
    explanation: 'The ideal estimator retrains and retunes the whole pipeline across sources of variation. That is expensive, so most work uses approximations. The right question is which approximation is honest enough for the claim.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'compute budget multiplier', min: 1, max: 60 }, y: { label: 'estimation error', min: 0, max: 1.0 } },
      series: [
        { id: 'perfect', label: 'full ideal', points: [
          { x: 1, y: 0.95 }, { x: 10, y: 0.45 }, { x: 30, y: 0.22 }, { x: 60, y: 0.12 },
        ] },
        { id: 'practical', label: 'practical estimator', points: [
          { x: 1, y: 0.80 }, { x: 5, y: 0.38 }, { x: 12, y: 0.24 }, { x: 20, y: 0.18 },
        ] },
      ],
    }),
    highlight: { active: ['practical'], compare: ['perfect'] },
    explanation: 'The MLSys paper highlights a counterintuitive result: adding more sources of variation to an imperfect estimator can get closer to the ideal comparison at much lower compute. The animation shows the shape, not an exact reproduction of their experiment.',
    invariant: 'A biased estimator with the right variation can be more useful than a narrow estimator that ignores how models are actually selected.',
  };

  yield {
    state: labelMatrix(
      'Claim-strength ladder',
      [
        { id: 'demo', label: 'demo' },
        { id: 'ablation', label: 'ablation' },
        { id: 'paper', label: 'paper' },
        { id: 'production', label: 'production' },
      ],
      [
        { id: 'minimum evidence', label: 'minimum evidence' },
        { id: 'next audit', label: 'next audit' },
      ],
      [
        ['runs once', 'state limits'],
        ['seeds + CIs', 'ablate knobs'],
        ['retune fairly', 'leakage audit'],
        ['online A/B', 'monitor drift'],
      ],
    ),
    highlight: { found: ['paper:minimum evidence', 'production:minimum evidence'] },
    explanation: 'The evidence should match the consequence. A demo can be a single run. A paper claim needs uncertainty. A production rollout needs online validation because offline benchmark variance is not the only uncertainty.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'cv', label: 'cross-val', x: 0.8, y: 3.8, note: 'honest folds' },
        { id: 'hpo', label: 'HPO', x: 2.8, y: 2.4, note: 'search budget' },
        { id: 'ci', label: 'bootstrap CI', x: 2.8, y: 5.2, note: 'error bars' },
        { id: 'leak', label: 'leakage audit', x: 5.0, y: 2.4, note: 'chain' },
        { id: 'ab', label: 'A/B test', x: 5.0, y: 5.2, note: 'online' },
        { id: 'claim', label: 'model claim', x: 7.4, y: 3.8, note: 'defensible' },
      ],
      edges: [
        { id: 'e-cv-hpo', from: 'cv', to: 'hpo', weight: '' },
        { id: 'e-cv-ci', from: 'cv', to: 'ci', weight: '' },
        { id: 'e-hpo-leak', from: 'hpo', to: 'leak', weight: '' },
        { id: 'e-ci-ab', from: 'ci', to: 'ab', weight: '' },
        { id: 'e-leak-claim', from: 'leak', to: 'claim', weight: '' },
        { id: 'e-ab-claim', from: 'ab', to: 'claim', weight: '' },
      ],
    }, { title: 'Benchmark variance ties the evaluation stack together' }),
    highlight: { active: ['cv', 'hpo', 'ci', 'leak', 'ab'], found: ['claim'] },
    explanation: 'This topic is the connective tissue between Cross-Validation, Hyperparameter Search, Bootstrap CIs, Data Leakage, and A/B Testing. The result is not just a score; it is a defensible claim.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'variance sources') yield* varianceSources();
  else if (view === 'estimator discipline') yield* estimatorDiscipline();
  else throw new InputError('Pick a benchmark variance view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Benchmark variance is the fact that an ML comparison is a random variable. The same algorithm can score differently because of data sampling, train/test split, augmentation policy, parameter initialization, minibatch order, nondeterministic kernels, early stopping, and hyperparameter optimization. A single number in a leaderboard table is usually one draw from a distribution.',
        'The paper "Accounting for Variance in Machine Learning Benchmarks" models the full benchmarking process and shows why common comparison shortcuts can mislead. The key practical lesson is that evidence for "model A beats model B" should include the important sources of variation, not only the best run or a single seed.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Imagine comparing two models. If both are trained once, the observed difference mixes architecture quality with split luck, initialization luck, augmentation luck, and hyperparameter luck. Multiple seeds reduce one part of the noise. Multiple data splits reduce another. Retuning hyperparameters for each sampled setting is closer to the ideal question - what would a competent practitioner get from this method? - but it is also expensive.',
        'The counterintuitive result from the MLSys paper is that an imperfect estimator that includes more sources of variation can be closer to the ideal estimator than a narrower estimator that ignores how models are actually selected. In other words, it can be better to sample the messy process honestly than to measure a clean but unrealistic slice of it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Full benchmark discipline can be expensive. If one training run costs T, then k seeds, s splits, and h hyperparameter trials can cost k * s * h * T. That is why papers and production teams choose evidence levels. A smoke test can run once. A serious offline claim should include several seeds or confidence intervals. A production claim should add online A/B testing, drift monitoring, and rollback criteria.',
        'The cost should be reported, not hidden. Hyperparameter Search, RandAugment-style augmentation tuning, Neural Architecture Search, and early-stopping rules all consume budget and can bias comparisons if one model receives more search effort than another. Fair benchmarking includes search budget as part of the method.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Benchmark variance matters in paper reviews, model cards, internal platform decisions, recommender-system launches, forecasting model upgrades, LLM evals, and production A/B rollouts. It is the reason teams report mean plus standard deviation, confidence intervals, win rates across tasks, seed sweeps, and cost per task rather than only best scores.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'More runs do not fix a leaked benchmark. Data Leakage & Contamination still invalidates the measurement. More seeds also do not fix unfair tuning if one method received a much larger search budget. Another trap is hiding failed runs as "instability" while reporting the lucky one. Instability is part of the model behavior and should be reported. Finally, statistical significance does not automatically imply product significance; a tiny reliable gain may not justify cost or complexity.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Accounting for Variance in Machine Learning Benchmarks at https://arxiv.org/abs/2103.03098 and the MLSys proceedings page at https://proceedings.mlsys.org/paper_files/paper/2021/hash/0184b0cd3cfb185989f858a1d9f5c1eb-Abstract.html. Study Scaling as Local Optimum Case Study, Cross-Validation & Honest Evaluation, Bootstrap Confidence Intervals, A/B Testing & p-values, Hyperparameter Search, Data Leakage & Contamination, RL Experiment Reproducibility Ledger, Sparse Autoencoder Feature Dictionary Case Study, Chain of Draft Reasoning Token Budget Case Study, Learning Curves & Bias-Variance, and DLinear Time-Series Case Study next.',
      ],
    },
  ],
};
