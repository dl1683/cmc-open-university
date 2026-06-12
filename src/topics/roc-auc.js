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
      markers: [{ id: 'pt', x: points[5].x, y: points[5].y, label: `t≈${coin ? '0.5' : '0.7'}` }],
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
      heading: `What it is`,
      paragraphs: [
        `ROC Curves & AUC evaluate a classifier's ranking skill across every possible threshold. The model first emits scores: Naive Bayes (Spam Filter), Logistic Regression, and Softmax & Temperature all produce values that can be sorted. A threshold turns those scores into actions. ROC refuses to pick one threshold too early; it sweeps them all and plots true-positive rate against false-positive rate. AUC, the area under that curve, compresses the sweep into one number: the probability that a random positive example receives a higher score than a random negative one.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The demo scores 10 true spam emails and 10 true ham emails. Spam mostly lands high, from 0.95 down to 0.30, while ham mostly lands lower, from 0.60 down to 0.05. The overlap around 0.30 to 0.60 is where threshold choices become trade-offs. Start with a threshold above every score: flag nothing, so TPR = 0 and FPR = 0. Lower the threshold one score at a time. More spam gets caught, but more ham gets falsely flagged. When every email is flagged, both rates are 1. The curve is the path through those operating points.`,
        `The real classifier bows toward the top-left, and its AUC is 0.89. The coin-flip view gives identical score distributions to spam and ham, so its curve sits on the diagonal and AUC is 0.50. Below 0.50 usually means the scores are inverted: reversing them would rank better. Precision, Recall & the Confusion Matrix names the cells behind each point; Picking a Threshold with Real Costs chooses which point to deploy.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Building ROC points is cheap. Sort N scores, walk thresholds, and update counts, for O(N log N) dominated by sorting. The pair-counting interpretation of AUC is O(P * Nneg) if done directly: compare every positive-negative pair and count wins, ties as half. Sorted implementations compute the same value faster. In the demo there are 100 spam-ham pairs; the 0.89 AUC means the model wins about 89% of those pairwise rankings.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Medical tests use ROC to show sensitivity versus false-alarm rate before hospitals choose an operating threshold. Credit, fraud, malware, and moderation teams use AUC to compare models without arguing about a default cutoff. Cross-Validation & Honest Evaluation can report mean AUC across folds. A/B Testing & p-values can test whether an AUC lift survives sampling noise before you ship a new model. Model cards often include ROC because it makes the threshold trade-off inspectable instead of hiding it behind one headline score, not magic.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `AUC is not accuracy, precision, recall, or calibration. It measures ordering, not whether a score of 0.80 means 80%. Calibration & Reliability Diagrams checks that. ROC can also flatter rare-event problems because false-positive rate divides false alarms by all negatives. In Imbalanced Data: When 99% Is One Class, 2% FPR may still be an unmanageable pile of alarms. There, the precision-recall curve is usually the operational plot. Finally, do not use AUC to choose a threshold; use it to compare rankers, then choose the threshold from costs and constraints.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Precision, Recall & the Confusion Matrix to read each threshold's counts, Calibration & Reliability Diagrams to check probability meaning, and Picking a Threshold with Real Costs to choose the deployed cutoff. Then revisit Naive Bayes (Spam Filter) and Logistic Regression as score factories that live on these curves.`,
      ],
    },
  ],
};
