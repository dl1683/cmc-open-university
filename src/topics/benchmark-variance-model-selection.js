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
        'The variance-sources view lays out a matrix where a single method is trained across different random seeds and data splits. Watch the scores shift even though the code never changes. The spread you see is benchmark variance -- the gap between what the algorithm is and what one run measures.',
        'The estimator-discipline view walks up a cost ladder from a single run to nested cross-validated search. Each rung samples more sources of variation and costs more compute. The final frame connects variance control to the rest of the evaluation stack: cross-validation, confidence intervals, leakage audits, and A/B tests.',
        {type: 'image', src: './assets/gifs/benchmark-variance-model-selection.gif', alt: 'Animated walkthrough of the benchmark variance model selection visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Benchmark variance is the reason model comparison is harder than reading one number off a leaderboard. A training run is not a pure measurement of an algorithm\'s quality. It is the output of a process that includes data sampling, train/test splitting, weight initialization, minibatch ordering, data augmentation, nondeterministic GPU kernels, early stopping, hyperparameter search scope, metric implementation, and sometimes evaluator or judge noise. The same method can produce materially different scores across those choices, even when the code is identical.',
        'The practical consequence is decision risk. A team wants to know whether model A beats model B, whether a new recipe justifies more compute, or whether an offline benchmark supports a production rollout. One lucky seed can make an average method look strong; one unlucky seed can bury a strong method. Benchmark variance turns model selection from a lookup problem into an estimation problem, and estimation demands statistical discipline.',
        {type: 'callout', text: 'A benchmark result is a sampled measurement process, so model selection must estimate the distribution that produced the score.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Bias_and_variance_contributing_to_total_error.svg', alt: 'Diagram showing bias and variance contributing to total error, with the U-shaped tradeoff curve', caption: 'Bias-variance decomposition of total error. Benchmark variance is one component; ignoring it can make a biased estimator look artificially precise. (Source: Wikimedia Commons)'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to train each candidate once, sort by the reported metric, and declare the top scorer the winner. This is fine for a quick smoke test, but it is a weak foundation for a paper claim, a procurement decision, or a production migration. The observed gap might be smaller than ordinary seed-to-seed variation. It might depend on a single lucky train/test split. It might reflect the fact that one model got a larger hyperparameter search budget than the other.',
        'A slightly better version runs several seeds and reports mean plus standard deviation. That helps, but it only covers the randomness the seed controls: weight initialization and minibatch order. It does not sample the effect of different data splits. It does not account for unfair tuning budgets. It does not detect data leakage. Repetition is only useful when it targets the right source of uncertainty.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        '"Model quality" is not directly observable. We observe scores produced by a benchmarking process, and that process contains random variables and human choices. If the process changes -- different split, different search budget, different stopping criterion -- the score changes. If the process is biased, the score can be confidently wrong. If the process is too narrow, the score can be precise about an unrealistic setting and useless for the real decision.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Big-O_Computational_Complexity.svg', alt: 'Chart of common algorithmic complexity classes showing how cost grows with input size', caption: 'Complexity of exhaustive model comparison grows fast. With k seeds, s splits, and h hyperparameter trials, the budget is k * s * h * T per candidate. (Source: Wikimedia Commons)'},
        'This is why benchmark variance is a systems problem, not only a statistics problem. The measurement pipeline has state, budgets, caches, data boundaries, selection rules, and reporting incentives. A benchmark can fail because the model\'s training is unstable, because the estimator ignores a source of variation, because the hyperparameter search was asymmetric, or because the test set was contaminated. The wall is not noise alone. It is unmodeled process hiding inside the number.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A model comparison is a distribution before it becomes a headline number. The score of model A varies. The score of model B varies. The difference between them varies too. Sound benchmark discipline asks: what random process generated the observed difference, and is the evidence strong enough for the claim being made?',
        'Bouthillier et al.\'s "Accounting for Variance in Machine Learning Benchmarks" (MLSys 2021) formalize this by framing the benchmark as a full procedure, not a single run. A method is not just an architecture; it is architecture plus training recipe plus search budget plus selection rule. The target estimator answers the question a competent practitioner actually cares about: if we adopted this method under a fair protocol, how well would it perform on average?',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Step one: enumerate variance sources. Data variance comes from which examples or folds are used for training and evaluation. Initialization variance (sometimes called seed variance) comes from random starting weights. Training variance comes from minibatch order, dropout masks, data augmentation, nondeterministic GPU kernels, and early stopping. Search variance comes from which hyperparameter configurations were tried and how the best run was selected. Evaluation variance comes from finite test sets, metric noise, and in LLM settings, judge or task-sampling noise.',
        'Step two: choose an estimator that samples the sources that matter for the claim. Multi-seed evaluation (same split, different seeds) captures initialization and training randomness. k-fold cross-validation captures data-split variance. Bootstrapping the test set estimates uncertainty from a finite evaluation sample. Paired comparisons -- evaluating both methods on exactly the same folds or examples -- cancel shared noise and sharpen the contrast. Nested hyperparameter optimization accounts for the fact that a real practitioner would retune a method, not freeze one configuration forever.',
        'Step three: match the protocol to the decision\'s stakes. An early exploration can tolerate cheap, noisy estimates. A final claim that justifies a production migration or a publication should spend enough compute to cover every variance source that could reverse the conclusion.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Variance-aware benchmarking works because it aligns the strength of evidence with the weight of the decision. A smoke test needs one run. A publication needs uncertainty estimates. A production rollout needs offline results paired with online A/B validation, drift monitoring, and rollback criteria. The estimator\'s rigor becomes part of the claim itself.',
        'It also defeats a common form of self-deception. Without uncertainty, a 0.3-point improvement looks crisp and decisive. With uncertainty, the same 0.3 points may sit inside a confidence interval that spans zero, may hold only on one task subset, or may not justify the added complexity. That does not make benchmarking weaker -- it makes benchmark claims defensible. A result with error bars, paired win rates, budget accounting, and known limitations carries more information than a clean leaderboard number that hides the process that produced it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The obvious cost is compute. If one training run costs T GPU-hours, then k seeds across s data splits with h hyperparameter trials costs k * s * h * T per candidate model. A concrete example: T = 4 GPU-hours, k = 5 seeds, s = 3 splits, h = 20 search trials gives 5 * 3 * 20 * 4 = 1,200 GPU-hours per candidate. With two candidates, that is 2,400 GPU-hours just to compare them fairly. A fully nested comparison may be prohibitive for early exploration, which is why teams use evidence ladders: cheap and noisy early, expensive and precise for final claims.',
        'The second cost is reporting complexity. A full report needs means, confidence intervals, paired win rates, search budgets, counts of failed runs, task coverage, and cost per evaluation. That is less tidy than one leaderboard number, but it is more honest. The third cost is organizational friction: variance-aware work slows down premature declarations of victory. That friction is a feature when the consequence of a wrong decision is a wasted quarter of engineering or a retracted paper.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Variance discipline is most valuable when measured gains are small, evaluation sets are limited, or the benchmark is used to justify cost, risk, or public claims. That covers paper submissions and reviews, model cards, internal platform selection, recommender system launches, forecasting pipeline upgrades, medical or legal ML evaluations, LLM evals with judge noise, agent benchmarks with stochastic environments, and expensive production migrations.',
        'It also matters when comparing model families with different tuning sensitivity. Some methods are robust across seeds and hyperparameters; others have high upside but unstable training. Mean score alone hides that difference. A method with slightly lower average performance but much tighter variance may be the right choice for an operational system that needs predictable behavior. Conversely, a high-variance method may still win if the deployment can afford search and selection -- but the report should say so explicitly.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Variance accounting does not rescue a broken benchmark. If the test set leaks into training, repeated runs only estimate the wrong quantity more precisely. If the task distribution is unrepresentative, tight confidence intervals around that distribution do not prove the model will generalize. If a judge systematically favors one answer style, sampling more tasks preserves the bias. Variance discipline must include data and metric audits, not only statistics.',
        'Common failure modes: reporting only the best seed out of many (selection bias), deleting diverged runs without disclosing them (survivorship bias), adjusting the search budget after peeking at results (adaptive bias), using unpaired statistical tests when paired comparisons are available (power loss), ignoring the multiple-comparisons problem when ranking many models (inflated false discovery), and treating statistical significance as product significance. A tiny reliable gain may still be too expensive, too slow, or too fragile to ship.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose model A scores 85.0 on a single run and model B scores 84.4. A naive report says A wins by 0.6 points. Now run 5 seeds across 3 data splits (15 runs per model). A produces scores ranging from 82.0 to 85.4 with mean 83.8 and standard deviation 1.1. B produces scores from 82.6 to 86.1 with mean 84.0 and standard deviation 0.9. The distributions overlap substantially. On 6 of the 15 paired comparisons, B wins. A paired t-test on the 15 differences yields p = 0.41 -- nowhere near conventional significance. The original 0.6-point gap was one draw from a noisy process, not a stable fact about the algorithms.',
        'Now layer in hyperparameter search. Model A received 50 random search trials because it was the exciting new method. Model B used its published default configuration. That comparison is unfair even with 15 seeds each, because A had 50 chances to find a good configuration while B had one. A fairer protocol gives both methods the same search budget -- say 20 trials each inside each fold -- and reports the nested cross-validated score. The conclusion might shift from "A is better" to "A can be made slightly better if you spend 20x the tuning budget." Those are different claims with different operational implications.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Bouthillier et al., "Accounting for Variance in Machine Learning Benchmarks," MLSys 2021 (https://arxiv.org/abs/2103.03098, proceedings at https://proceedings.mlsys.org/paper_files/paper/2021/hash/0184b0cd3cfb185989f858a1d9f5c1eb-Abstract.html). Also valuable: Dodge et al., "Show Your Work: Improved Reporting of Experimental Results" (EMNLP 2019), and Lucic et al., "Are GANs Created Equal?" (NeurIPS 2018) for a case study in how variance hides real differences.',
        'Study Cross-Validation next for data-split discipline, then Bootstrap Confidence Intervals for finite-sample uncertainty estimation. Hyperparameter Search covers tuning-budget bias. Data Leakage and Contamination explains how variance reduction is worthless when the measurement itself is invalid. A/B Testing bridges offline benchmarks to online decisions. Power Analysis tells you how many runs you need before you start. Permutation Tests provide distribution-free comparison when normality assumptions fail. For domains with especially unstable training, see RL Experiment Reproducibility Ledger.',
      ],
    },
  ],
};
