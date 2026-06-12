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
        `A ROC curve is a plot of every possible decision threshold all at once, showing the trade-off between catching true positives and accepting false alarms. ROC stands for Receiver Operating Characteristic — the name comes from radar engineering in the 1940s, where operators tuned a sensitivity dial and watched how often they caught real signals versus false blips. Today we use it to compare classifiers without picking a specific threshold, and the area under the curve (AUC) compresses that entire menu into a single ranking score. In the visualization, the spam and ham emails each have a classifier score — the model says "0.7 likely spam" or "0.2 likely spam" rather than a hard yes/no. The threshold is the boundary: score above it is "spam," below it is "ham." Slide the threshold from impossibly strict (flag nothing) to impossibly loose (flag everything), and you trace out the ROC curve — one point per threshold, showing the cost of each choice.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The animation starts by showing 10 true spam emails and 10 true ham emails, each assigned a score by the classifier. Most spam scores cluster high (0.7–0.95), most ham cluster low (0.05–0.5), but they overlap — some ham is legitimately high-scoring, some spam is deceptively low. That overlap zone (0.3–0.6 in our demo) is where threshold choice gets agonizing.`,
        `Now sweep the threshold from high to low. Start at the top: threshold = 1.0 (higher than any score). Result: no emails flagged as spam. False-positive rate = 0 out of 10 ham wrongly flagged = 0%. True-positive rate = 0 out of 10 spam caught = 0%. That is the bottom-left corner, (0, 0). Lower the threshold to 0.9: a few spam cross the line. Some ham might too. Both rates inch upward. Keep lowering: more spam flagged, but more ham wrongly flagged too. By threshold = 0.0 (lower than every score), everything is flagged spam. False-positive rate = 100%, true-positive rate = 100%. The top-right corner.`,
        `Plot every threshold, and you get the ROC curve. If the classifier is wise, it bows toward the top-left — catches most spam with few false alarms at the sweet spot. If it is useless (like the coin-flip demo), the curve rides the diagonal: at every threshold, you falsely flag just as many ham as you catch spam. The diagonal line y = x is the baseline, the "luck" line. Anything above it is skill; anything below it means your labels are inverted.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Building a ROC curve is cheap: sort the scores once (O(N log N)), then walk through each unique threshold and count how many positives and negatives cross it (O(N)). AUC calculation is a beautiful pair-counting algorithm: for every positive example and every negative example, count whether the positive scores higher. The classifier earns one point per pair where positive > negative, half a point per tie. Divide by the total possible pairs (positives × negatives), and you have AUC. In the demo, that is 100 pairs (10 spam × 10 ham). Our classifier wins 89 of them on average: 0.89 AUC. A perfect classifier wins all 100 (AUC = 1.0); a useless one wins roughly 50 (AUC = 0.5, coin flip). The pair-counting view means AUC is the probability that a random positive scores higher than a random negative — pure ranking power, threshold-agnostic.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Medical tests report ROC curves: they show clinicians the trade-off between sensitivity (catching disease) and specificity (avoiding false alarms) without forcing a single threshold choice. Different hospitals, different patient populations, different tolerances for false alarms — each chooses their own operating point on the same curve. Credit scoring uses ROC to set approval rates: nudge the threshold to approve 80% of applicants if that is your business constraint, and the curve tells you what fraud rate you get. Fraud detection, malware scanning, any system with a learned decision boundary and a cost to both kinds of mistakes — ROC is the first plot in the model card. Machine-learning competitions (Kaggle, etc.) use AUC leaderboards because it avoids the argument: "whose threshold is correct?" Instead, contestants compete on ranking skill, and the best ranker wins.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The most common mistake: confusing ROC with PR (precision-recall). Both are threshold sweeps, but they tell different stories. ROC's false-positive rate divides by the total number of negatives — if you have a million negatives and 1000 false alarms, the false-positive rate is 0.001. In imbalanced datasets (fraud: 1 in 10,000 examples), the denominator is huge, and the ROC curve looks great even if the false-alarm count is bad. The precision-recall curve divides by predicted positives, so it stays honest: a flood of false alarms tanks your precision immediately. Another trap: thinking a high AUC means high precision or high recall at some point. AUC ranks well overall; at your chosen threshold, you might have terrible precision. Always check the operating point on the ROC curve against your actual cost function. Finally, do not use AUC to tune the threshold — use it to compare classifiers only. Once you have chosen your favorite model (highest AUC), read Precision, Recall & the Confusion Matrix to pick the threshold that matches your true costs.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Precision, Recall & the Confusion Matrix shows the cost math behind threshold choice — AUC tells you how well your model ranks; this tells you where to stand on the curve. Thompson Sampling uses a similar Bayesian update strategy but for online decision-making — it adapts the threshold in real time based on feedback. A/B Testing & p-values teaches statistical significance: when you compare two models' AUCs, how sure are you one is truly better? Naive Bayes (Spam Filter) is the classifier used in our demo — it outputs scores that become decisions when you apply the threshold. Logistic Regression is another score-based classifier that sits at the heart of modern neural networks. All of these classifiers live on ROC curves; AUC is the universal language for comparing them.`,
      ],
    },
  ],
};
