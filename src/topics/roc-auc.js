// ROC curves: stop arguing about the threshold — sweep ALL of them and
// draw the whole menu of trade-offs as one curve. AUC compresses it to a
// single number: how well does the model RANK positives above negatives?

import { plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'roc-auc',
  title: 'ROC Curves & AUC',
  category: 'AI & ML',
  summary: 'Sweep every threshold at once: the curve is the menu of trade-offs, the area is the ranking skill.',
  controls: [
    { id: 'view', label: 'Evaluate', type: 'select', options: ['a real classifier', 'a coin flip'], defaultValue: 'a real classifier' },
  ],
  run,
};

// Scores the classifier gave 10 true spam and 10 true ham emails.
const SPAM = [0.95, 0.9, 0.85, 0.8, 0.7, 0.65, 0.55, 0.45, 0.4, 0.3];
const HAM = [0.6, 0.5, 0.45, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05];
// A useless classifier: identical score distributions for both classes.
const COIN_SPAM = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05];
const COIN_HAM = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05];

function rocPoints(spam, ham) {
  const thresholds = [...new Set([...spam, ...ham])].sort((a, b) => b - a);
  const points = [{ x: 0, y: 0 }];
  for (const t of thresholds) {
    points.push({
      x: ham.filter((s) => s >= t).length / ham.length,
      y: spam.filter((s) => s >= t).length / spam.length,
    });
  }
  points.push({ x: 1, y: 1 });
  return points;
}
function auc(spam, ham) {
  let wins = 0;
  for (const s of spam) for (const h of ham) wins += s > h ? 1 : s === h ? 0.5 : 0;
  return wins / (spam.length * ham.length);
}

export function* run(input) {
  const coin = String(input.view) === 'a coin flip';
  if (!['a real classifier', 'a coin flip'].includes(String(input.view))) throw new InputError('Pick a view.');
  const spam = coin ? COIN_SPAM : SPAM;
  const ham = coin ? COIN_HAM : HAM;

  const scoreSeries = [
    { id: 'spamScores', label: 'spam', points: spam.map((s, i) => ({ x: i + 1, y: s })) },
    { id: 'hamScores', label: 'ham', points: ham.map((s, i) => ({ x: i + 1, y: s })) },
  ];
  yield {
    state: plotState({ axes: { x: { label: 'email (ranked)' }, y: { label: 'classifier score' } }, series: scoreSeries }),
    highlight: {},
    explanation: `A classifier rarely says "spam" — it says 0.83, a SCORE (see Naive Bayes (Spam Filter) and Softmax & Temperature). Here are its scores for 10 true spam and 10 true ham emails. ${coin ? 'In this version the two classes score IDENTICALLY — the model has learned nothing.' : 'Spam mostly scores higher, but the distributions OVERLAP around 0.3–0.6 — and that overlap zone is where every threshold decision gets hard.'} The threshold you pick converts scores into decisions, and Precision, Recall & the Confusion Matrix showed each threshold is one trade-off. Why pick just one?`,
  };

  const points = rocPoints(spam, ham);
  const diag = { id: 'chance', label: 'coin flip', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
  const partial = (n) => [
    { id: 'roc', label: 'ROC', points: points.slice(0, n) },
    diag,
  ];

  yield {
    state: plotState({
      axes: { x: { label: 'false positive rate' }, y: { label: 'true positive rate' } },
      series: partial(6),
      markers: [{ id: 'pt', x: points[5].x, y: points[5].y, label: `tâ‰ˆ${coin ? '0.5' : '0.7'}` }],
    }),
    highlight: { active: ['roc'] },
    explanation: 'The ROC construction: start with an impossibly strict threshold (flag nothing — bottom-left corner: zero false alarms, zero catches), then LOWER it step by step. Each threshold yields one point: x = false positive rate (fraction of ham wrongly flagged), y = true positive rate (recall). Strict thresholds live near the origin; permissive ones drift toward the top-right (flag everything).',
    invariant: 'Lowering the threshold can only add flags: both rates move monotonically from (0,0) to (1,1).',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'false positive rate' }, y: { label: 'true positive rate' } },
      series: [{ id: 'roc', label: 'ROC', points }, diag],
    }),
    highlight: { active: ['roc'], visited: ['chance'] },
    explanation: `The full sweep — every possible threshold, one curve. ${coin ? 'And it lies ON the diagonal: at every threshold, the false-positive rate equals the true-positive rate. The diagonal IS random guessing — this model adds nothing over a coin flip.' : 'See it BOW toward the top-left: that bulge is skill. At its best point this model catches ~70% of spam at only ~10% false alarms. The diagonal below is what guessing looks like; the gap between curve and diagonal is everything the model learned.'}`,
  };

  const a = auc(spam, ham);
  yield {
    state: plotState({
      axes: { x: { label: 'false positive rate' }, y: { label: 'true positive rate' } },
      series: [{ id: 'roc', label: 'ROC', points }, diag],
    }),
    highlight: { active: ['roc'] },
    explanation: `AUC — the Area Under the Curve — compresses the whole menu to one number: ${a.toFixed(2)}. And it has a beautiful concrete meaning: draw one random spam and one random ham, and AUC is the probability the model scores the spam HIGHER — pure RANKING skill, no threshold involved. ${coin ? '0.50 = the model cannot rank at all.' : '0.89 here: a strong ranker. 1.0 would be perfect separation; 0.5 is a coin; and below 0.5 means your labels are inverted — flip the predictions and profit.'}`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'false positive rate' }, y: { label: 'true positive rate' } },
      series: [{ id: 'roc', label: 'ROC', points }, diag],
    }),
    highlight: {},
    explanation: 'How the pieces fit: use AUC to COMPARE models (which ranks better, threshold-free), then use the cost analysis from Precision, Recall & the Confusion Matrix to PICK the operating point. One caution: under heavy imbalance, ROC can flatter — its false-positive rate divides by a huge number of negatives, so a flood of false alarms barely moves the curve; the precision-recall curve stays honest there. Medical-test papers report ROC; fraud and retrieval teams live on PR curves; every serious model card carries both.',
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation sorts examples by model score and moves a threshold through that order. A threshold is the score cutoff above which the model predicts positive.',
        {
          type: 'callout',
          text: 'ROC shows the whole threshold menu; AUC asks how often a random positive outranks a random negative.',
        },
        'The y-axis is true positive rate, which means the fraction of real positives caught. The x-axis is false positive rate, which means the fraction of real negatives incorrectly flagged.',
        'Each step lowers the threshold and adds one more example to the predicted-positive side. Moving up is good because a positive was caught; moving right is the cost of disturbing a negative.',
        {type: 'image', src: './assets/gifs/roc-auc.gif', alt: 'Animated walkthrough of the roc auc visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many classifiers output scores, not final decisions. A fraud model, spam model, or medical-risk model may say 0.83, but the product still needs a threshold for action.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Roccurves.png/250px-Roccurves.png',
          alt: 'Several ROC curves compared against a diagonal random baseline.',
          caption: 'ROC curves turn many possible thresholds into one visible tradeoff surface. Source: https://commons.wikimedia.org/wiki/File:Roccurves.png',
        },
        'ROC means receiver operating characteristic. It exists to show how the same score ranking behaves across every possible threshold instead of reporting one operating point.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is accuracy at one threshold. Pick 0.5, count correct predictions, and compare models by the fraction right.',
        'That can be acceptable when classes are balanced and the threshold is fixed by the product. It becomes misleading when the threshold is negotiable or when false positives and false negatives have very different costs.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that one threshold hides the ranking. A model can have poor accuracy at 0.5 but still rank positives above negatives well enough to be useful at another cutoff.',
        'Class imbalance also distorts accuracy. If only 1 percent of events are fraud, predicting never fraud gives 99 percent accuracy while catching no fraud.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'ROC treats the model as a ranker. It asks what happens as you accept examples from highest score to lowest score.',
        'AUC means area under the ROC curve. It has a useful interpretation: the probability that a randomly chosen positive example receives a higher score than a randomly chosen negative example.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Sort all examples by score from high to low. Start with the threshold above every score, so nothing is predicted positive and the curve starts at (0, 0).',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/ROC_curves.svg/330px-ROC_curves.svg.png',
          alt: 'ROC curves showing weak, random, and strong classifier behavior.',
          caption: 'The curve shape reveals how quickly positives rise before false positives accumulate. Source: https://commons.wikimedia.org/wiki/File:ROC_curves.svg',
        },
        'Lower the threshold one score at a time. When the next example is positive, move up by 1 divided by the number of positives; when it is negative, move right by 1 divided by the number of negatives.',
        'The AUC is the area under that staircase. A curve near the top-left has high AUC because positives appear early in the sorted order before many negatives are admitted.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The curve is correct because every possible threshold corresponds to some cut in the sorted score list. Sweeping the list visits those cuts in order, so no threshold is skipped.',
        'The pairwise interpretation follows from counting ranks. Each positive-negative pair contributes one win if the positive score is higher, half a win for a tie, and zero if the negative score is higher.',
        'AUC is that win count divided by the number of positive-negative pairs. This is why AUC measures ranking quality rather than calibration or business value at a chosen threshold.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Computing ROC is dominated by sorting n scored examples, so the usual cost is O(n log n). After sorting, the sweep is O(n) and stores only running counts plus the curve points.',
        'Doubling examples roughly doubles the sweep work and more than doubles the sort comparison work. In practice, sorting scores is the cost center unless the evaluation pipeline is streaming pre-sorted outputs.',
        'The behavioral cost is threshold blindness. AUC summarizes the full menu, but deployment uses one region of that menu, and the wrong region can look good in the average while being unusable in production.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'ROC-AUC is useful when ranking matters and the operating threshold may change. Medical triage, fraud review queues, spam filtering, and alerting systems often inspect different cutoffs before choosing one.',
        'It is also useful during model development because it separates score ordering from threshold selection. A model with better AUC usually gives the product team a better set of possible tradeoffs, even though the final threshold still needs cost analysis.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'ROC can flatter rare-event models. A false-positive rate of 1 percent sounds small, but with 10,000,000 legitimate transactions it creates 100,000 false alarms.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/ROC_curve_example_highlighting_sub-area_with_low_sensitivity_and_low_specificity.png/250px-ROC_curve_example_highlighting_sub-area_with_low_sensitivity_and_low_specificity.png',
          alt: 'ROC curve with a highlighted low-sensitivity and low-specificity region.',
          caption: 'AUC averages over the full curve, including regions a product may never use. Source: https://commons.wikimedia.org/wiki/File:ROC_curve_example_highlighting_sub-area_with_low_sensitivity_and_low_specificity.png',
        },
        'It also ignores calibration. A score of 0.9 should mean about 90 percent probability only if the model is calibrated; AUC can be high even when probabilities are badly scaled.',
        'For imbalanced detection, precision-recall curves often expose the workload better. Precision answers the operational question: when the model flags something, how often is it actually positive?',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose there are five examples sorted by score: P at 0.95, N at 0.80, P at 0.70, N at 0.40, N at 0.10. There are 2 positives and 3 negatives, so each positive step moves up 0.5 and each negative step moves right about 0.333.',
        'The curve moves from (0, 0) to (0, 0.5), then (0.333, 0.5), then (0.333, 1.0), then (0.667, 1.0), then (1.0, 1.0). The positive-negative pairs are 2 * 3 = 6 pairs.',
        'The first positive beats all 3 negatives, and the second positive beats the negatives scored 0.40 and 0.10 but loses to 0.80. That is 5 wins out of 6, so AUC is 0.833.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: Green and Swets, Signal Detection Theory and Psychophysics, 1966; Fawcett, An introduction to ROC analysis, 2006; Hand and Till, A simple generalisation of the area under the ROC curve, 2001.',
        'Study next by decision need. Read Confusion Matrix for threshold counts, Precision-Recall for rare positives, Calibration for probability meaning, Cost-Sensitive Classification for action thresholds, and Ranking Metrics for pairwise evaluation.',
      ],
    },
  ],
};
