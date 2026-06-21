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
  const seedCount = 4;
  const splitCount = 3;
  const worstScore = '77.6';
  const bestScore = '85.2';
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
        ['83.4', '80.2', bestScore],
        ['81.5', worstScore, '82.8'],
      ],
    ),
    highlight: { active: ['seed4:split B'], found: ['seed3:split C'] },
    explanation: `A benchmark score is not a fixed property of the algorithm. Across ${seedCount} seeds and ${splitCount} splits, scores range from ${worstScore} to ${bestScore} — moved by train/test sampling, random initialization, minibatch order, augmentation, hardware nondeterminism, and hyperparameter choices.`,
  };

  const luckyA = 85;
  const badB = 79;
  yield {
    state: plotState({
      axes: { x: { label: 'accuracy', min: 76, max: 88 }, y: { label: 'trial density', min: 0, max: 1.0 } },
      series: [
        { id: 'modelA', label: 'model A trials', points: [
          { x: 77, y: 0.10 }, { x: 79, y: 0.35 }, { x: 81, y: 0.82 }, { x: 83, y: 0.63 }, { x: luckyA, y: 0.20 },
        ] },
        { id: 'modelB', label: 'model B trials', points: [
          { x: badB, y: 0.08 }, { x: 81, y: 0.42 }, { x: 83, y: 0.88 }, { x: 85, y: 0.58 }, { x: 87, y: 0.16 },
        ] },
      ],
      markers: [
        { id: 'luckyA', x: luckyA, y: 0.2, label: 'lucky A' },
        { id: 'badB', x: badB, y: 0.08, label: 'bad B' },
      ],
    }),
    highlight: { active: ['modelA', 'modelB'], compare: ['luckyA', 'badB'] },
    explanation: `With overlapping score distributions, a single run can reverse the conclusion. Reporting one lucky A at ${luckyA} against one unlucky B at ${badB} is not model comparison; it is sampling noise with a table around it.`,
    invariant: 'The comparison is a distribution before it is a headline number.',
  };

  const varianceNodes = ['data', 'aug', 'init', 'hpo', 'train', 'score'];
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
    explanation: `The MLSys variance paper models the whole benchmarking process across ${varianceNodes.length} stages, including hyperparameter optimization. The ${varianceNodes[varianceNodes.length - 1]} is downstream of several random variables, not only the model architecture.`,
  };

  const reportSources = ['data', 'init', 'HPO', 'metric'];
  yield {
    state: labelMatrix(
      'Report the sources, not only the winner',
      [
        { id: 'data', label: reportSources[0] },
        { id: 'init', label: reportSources[1] },
        { id: 'hpo', label: reportSources[2] },
        { id: 'metric', label: reportSources[3] },
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
    explanation: `Good benchmark writing makes all ${reportSources.length} random variables visible — ${reportSources.join(', ')}. If the claimed gain is smaller than ordinary run-to-run variation, the result should be treated as tentative.`,
  };
}

function* estimatorDiscipline() {
  const estimators = ['single run', 'multi seed', 'fixed HPO', 'nested HPO'];
  yield {
    state: labelMatrix(
      'Estimator choices',
      [
        { id: 'single', label: estimators[0] },
        { id: 'multi', label: estimators[1] },
        { id: 'fixed', label: estimators[2] },
        { id: 'nested', label: estimators[3] },
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
    explanation: `The ideal estimator (${estimators[3]}) retrains and retunes the whole pipeline across sources of variation. That is expensive, so most work uses approximations like ${estimators[0]} or ${estimators[1]}. The right question is which approximation is honest enough for the claim.`,
  };

  const maxBudget = 60;
  const idealFinalError = 0.12;
  const practicalFinalError = 0.18;
  yield {
    state: plotState({
      axes: { x: { label: 'compute budget multiplier', min: 1, max: maxBudget }, y: { label: 'estimation error', min: 0, max: 1.0 } },
      series: [
        { id: 'perfect', label: 'full ideal', points: [
          { x: 1, y: 0.95 }, { x: 10, y: 0.45 }, { x: 30, y: 0.22 }, { x: maxBudget, y: idealFinalError },
        ] },
        { id: 'practical', label: 'practical estimator', points: [
          { x: 1, y: 0.80 }, { x: 5, y: 0.38 }, { x: 12, y: 0.24 }, { x: 20, y: practicalFinalError },
        ] },
      ],
    }),
    highlight: { active: ['practical'], compare: ['perfect'] },
    explanation: `The MLSys paper highlights a counterintuitive result: a practical estimator reaches ${practicalFinalError} error at 20x budget while the ideal needs ${maxBudget}x to reach ${idealFinalError}. Adding more sources of variation to an imperfect estimator can get closer to the ideal at much lower compute.`,
    invariant: 'A biased estimator with the right variation can be more useful than a narrow estimator that ignores how models are actually selected.',
  };

  const claimLevels = ['demo', 'ablation', 'paper', 'production'];
  yield {
    state: labelMatrix(
      'Claim-strength ladder',
      [
        { id: 'demo', label: claimLevels[0] },
        { id: 'ablation', label: claimLevels[1] },
        { id: 'paper', label: claimLevels[2] },
        { id: 'production', label: claimLevels[3] },
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
    explanation: `The evidence should match the consequence across ${claimLevels.length} levels. A ${claimLevels[0]} can be a single run. A ${claimLevels[2]} claim needs uncertainty. A ${claimLevels[3]} rollout needs online validation because offline benchmark variance is not the only uncertainty.`,
  };

  const evalParts = ['cross-val', 'HPO', 'bootstrap CI', 'leakage audit', 'A/B test'];
  yield {
    state: graphState({
      nodes: [
        { id: 'cv', label: evalParts[0], x: 0.8, y: 3.8, note: 'honest folds' },
        { id: 'hpo', label: evalParts[1], x: 2.8, y: 2.4, note: 'search budget' },
        { id: 'ci', label: evalParts[2], x: 2.8, y: 5.2, note: 'error bars' },
        { id: 'leak', label: evalParts[3], x: 5.0, y: 2.4, note: 'chain' },
        { id: 'ab', label: evalParts[4], x: 5.0, y: 5.2, note: 'online' },
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
    explanation: `This topic is the connective tissue between ${evalParts.join(', ')}. The result is not just a score; it is a defensible claim built from ${evalParts.length} evaluation components.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/benchmark-variance-model-selection.gif', alt: 'Animated walkthrough of the benchmark variance model selection visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'The problem',
      paragraphs: [
        'Benchmark variance is the reason model comparison is harder than reading one score from one table. A training run is not a pure measurement of an algorithm. It is the result of data sampling, train/test split, initialization, minibatch order, augmentation, nondeterministic kernels, early stopping, hyperparameter search, metric implementation, and sometimes evaluator or judge noise. The same method can score differently across those choices even when the code is correct.',
        'The practical problem is decision risk. A team wants to know whether model A is better than model B, whether a new training recipe deserves more compute, or whether an offline benchmark justifies a production rollout. A single lucky run can make an ordinary method look strong. A single unlucky run can make a strong method look weak. Benchmark variance turns model selection into an estimation problem, not a screenshot problem.',
        {type: 'callout', text: 'A benchmark result is a sampled measurement process, so model selection must estimate the distribution that produced the score.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Bias_and_variance_contributing_to_total_error.svg', alt: 'Diagram showing bias and variance contributing to total error, with the U-shaped tradeoff curve', caption: 'Bias-variance decomposition of total error. Benchmark variance is one component; ignoring it can make a biased estimator look artificially precise. (Source: Wikimedia Commons)'},
      ],
    },
    {
      heading: 'Naive approach',
      paragraphs: [
        'The naive approach is to train each candidate once, sort by the reported metric, and declare the higher score the winner. That is sometimes acceptable for a smoke test, but it is a weak basis for a paper claim, a procurement decision, or a production migration. The observed gap might be smaller than ordinary seed-to-seed variation. It might depend on one train/test split. It might come from giving one model a larger hyperparameter search budget.',
        'A slightly less naive approach is to run several seeds and report a mean and standard deviation. That helps, but only for the randomness that the seed controls. It does not fix data leakage. It does not fix unfair tuning. It does not estimate the effect of choosing a different data split. It does not answer whether the model would still win after both methods are retuned fairly under the same budget. Repetition is useful only when it samples the right uncertainty.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that "model quality" is not directly observed. We observe scores produced by a benchmarking process. That process includes random variables and human choices. If the process changes, the score can change. If the process is biased, the score can be confidently wrong. If the process is too narrow, the score can be precise about an unrealistic setting and unhelpful for the real decision.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Big-O_Computational_Complexity.svg', alt: 'Chart of common algorithmic complexity classes showing how cost grows with input size', caption: 'Complexity of exhaustive model comparison grows fast. With k seeds, s splits, and h hyperparameter trials, the budget is k * s * h * T per candidate. (Source: Wikimedia Commons)'},
        'This is why benchmark variance is not only a statistics topic. It is a systems topic. The measurement pipeline has state, budgets, caches, data boundaries, selection rules, and reporting incentives. A benchmark can fail because the model is unstable, because the estimator ignores a source of variation, because the hyperparameter search is asymmetric, or because the final metric is computed on a contaminated test set. The wall is not noise alone. It is unmodeled process.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that a model comparison is a distribution before it becomes a headline number. The score of model A and the score of model B each vary. The difference between them varies too. Good benchmark discipline asks what random process generated the observed difference and whether the evidence is strong enough for the claim being made.',
        'The paper "Accounting for Variance in Machine Learning Benchmarks" frames the benchmark as a full procedure rather than one run. That matters because model selection usually includes hyperparameter optimization. A method is not just an architecture; it is architecture plus training recipe plus search budget plus selection rule. The practical target is an estimator that approximates the question a competent practitioner actually cares about: if we adopted this method under a fair protocol, how well would it perform?',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A disciplined benchmark starts by naming variance sources. Data variance comes from which examples or folds are used. Initialization variance comes from random starting weights. Training variance comes from minibatch order, augmentation, dropout, nondeterministic kernels, and early stopping. Search variance comes from which hyperparameters were tried and how the best run was selected. Evaluation variance comes from finite test sets, metric noise, and in LLM settings, sometimes judge or task-sampling noise.',
        'The estimator then chooses which of those sources to sample. Multi-seed evaluation samples initialization and training randomness. Cross-validation samples data splits. Bootstrapping estimates uncertainty from finite evaluation sets. Paired comparisons reduce noise by evaluating methods on the same examples or tasks. Nested hyperparameter optimization tries to account for the fact that a real practitioner would retune a method instead of using one fixed configuration forever. Each estimator costs compute, so the protocol should match the strength of the claim.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose model A scores 85.0 on one run and model B scores 84.4. A naive report says A wins by 0.6 points. Now run five seeds and three data splits. A produces scores from 82.0 to 85.4. B produces scores from 82.6 to 86.1. The distributions overlap. On some paired splits B wins. The original 0.6 point gap is no longer a stable fact about the algorithms. It is one draw from a noisy process.',
        'Now add hyperparameter search. Model A received 50 trials because it was the new method. Model B received the old default configuration. That comparison is unfair even if it has many seeds. A fairer protocol either gives both methods comparable search budgets or explicitly reports that the result includes more tuning effort for A. The conclusion might change from "A is better" to "A can be made better under a larger search budget." That is a different claim.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The variance-sources view shows a matrix where the same method moves across seeds and splits. The point is not the exact numbers. The point is that the benchmark output has a spread. The plot view shows two score distributions that overlap, with a lucky sample from one model and an unlucky sample from another. That is the visual form of a misleading leaderboard row.',
        'The estimator-discipline view shows the cost and risk ladder. A single run is cheap and noisy. Multi-seed runs reduce one kind of noise. Fixed hyperparameter protocols can be useful but can hide tuning bias. Nested or repeated search is closer to the real model-selection process, but it is expensive. The final graph connects this topic to cross-validation, confidence intervals, leakage audits, and A/B testing because a defensible claim needs more than one metric cell.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Variance-aware benchmarking works because it aligns the evidence with the decision. If the decision is a quick engineering smoke test, a single run may be enough. If the decision is a publication claim, the evidence should show uncertainty. If the decision is a production rollout, the offline result should be paired with online validation, drift monitoring, and rollback criteria. The estimator becomes part of the claim.',
        'It also prevents a common kind of self-deception. Without uncertainty, a small gain looks crisp. With uncertainty, the same gain may be tentative, task-specific, or not worth the added cost. That does not make benchmarking weaker. It makes benchmark claims more honest. A result with error bars, budget accounting, and known limitations is more useful than a clean number that hides the process that produced it.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The obvious cost is compute. If one training run costs T, then k seeds, s splits, and h hyperparameter trials can cost k * s * h * T. A fully nested comparison may be too expensive for early exploration. That is why teams use evidence ladders. Early experiments can be cheap and noisy. Final claims should spend more budget to sample the sources of variation that could reverse the conclusion.',
        'The second cost is reporting complexity. A full report may need means, intervals, paired win rates, search budgets, failed runs, task coverage, and cost per task. That can look less tidy than one leaderboard number, but it carries more information. The third cost is organizational: variance-aware work can slow down premature declarations of victory. That friction is useful when the consequence of being wrong is large.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Benchmark variance discipline wins in paper reviews, model cards, internal platform decisions, recommender launches, forecasting upgrades, medical or legal ML studies, LLM evals, agent benchmarks, and expensive production migrations. It is most valuable when the measured gains are small, the evaluation set is limited, or the benchmark is used to justify cost, risk, or public claims.',
        'It also wins when teams compare model families with different tuning sensitivity. Some methods are robust across seeds and hyperparameters. Others have high upside but unstable training. Mean score alone can hide that difference. A method with slightly lower average performance but much lower variance may be better for an operational system. A method with high variance may still be useful if the deployment can afford search and selection.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Variance accounting does not rescue a broken benchmark. If the test set leaks into training, repeated runs only estimate the wrong process more precisely. If the task distribution is unrepresentative, confidence intervals around that distribution do not prove the model will work elsewhere. If a judge systematically favors one style of answer, more sampled tasks may preserve the bias. Benchmark discipline must include data and metric audits, not only statistics.',
        'Common failure modes include reporting only the best seed, deleting failed runs, changing the search budget after seeing results, using unpaired tests when paired comparisons are available, ignoring multiple comparisons across many models, and treating statistical significance as product significance. A tiny reliable gain may still be too expensive, too slow, or too complex. The result should answer both "is it real?" and "does it matter?"',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Accounting for Variance in Machine Learning Benchmarks at https://arxiv.org/abs/2103.03098 and the MLSys proceedings page at https://proceedings.mlsys.org/paper_files/paper/2021/hash/0184b0cd3cfb185989f858a1d9f5c1eb-Abstract.html.',
        'Study Cross-Validation for data-split discipline, Bootstrap Confidence Intervals for finite-sample uncertainty, Hyperparameter Search for tuning-budget bias, Data Leakage and Contamination for invalid measurements, A/B Testing for online validation, Power Analysis for sample sizing, Permutation Tests for distribution-free comparison, RL Experiment Reproducibility Ledger for unstable training loops, and LLM evaluation topics where judge variance and task sampling become first-class parts of the benchmark.',
      ],
    },
  ],
};
