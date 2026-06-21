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
        {
          type: 'callout',
          text: 'ROC shows the whole threshold menu; AUC asks how often a random positive outranks a random negative.',
        },
        "Read the animation as the execution trace for ROC Curves & AUC. Sweep every threshold at once: the curve is the menu of trade-offs, the area is the ranking skill..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      
        {type: 'image', src: './assets/gifs/roc-auc.gif', alt: 'Animated walkthrough of the roc auc visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: `Why this exists`,
      paragraphs: [
        `Many classifiers do not begin by making a hard yes-or-no decision. They produce a score. A spam filter may score one email 0.91 and another 0.37. A fraud model may score a transaction 0.08 even though the deployed threshold is 0.02. A medical model may rank patients by suspicion before a hospital chooses who receives a follow-up test. The threshold turns a score into an action, but the score itself contains more information than any one threshold can show.`,
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Roccurves.png/250px-Roccurves.png',
          alt: 'Several ROC curves compared against a diagonal random baseline.',
          caption: 'ROC curves turn many possible thresholds into one visible tradeoff surface. Source: https://commons.wikimedia.org/wiki/File:Roccurves.png',
        },
        `ROC curves exist because threshold choice is a policy decision, not only a modeling decision. One team may want to catch every possible positive case and tolerate many false alarms. Another may have a strict investigation budget and accept lower recall. If both teams use the same model, a single accuracy number at a default threshold hides the real question: what tradeoffs are available as the threshold changes?`,
        `A ROC curve sweeps all thresholds and plots true-positive rate against false-positive rate. AUC, the area under that curve, compresses the sweep into one ranking score. Its concrete interpretation is useful: draw one random positive example and one random negative example. AUC is the probability that the model scores the positive higher than the negative, with ties counting as half. That makes AUC a threshold-free measure of ranking skill.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `The naive evaluation is to pick a threshold, compute a confusion matrix, and report accuracy. That can be fine when the threshold is fixed by the product and class balance is stable. But it is a poor way to compare rankers. A model can look weak at threshold 0.5 and excellent at threshold 0.1. Another can look strong in accuracy because negatives dominate the data while still missing the positives that matter. The threshold can make model quality and deployment policy look like the same thing.`,
        `A second naive approach is to compare raw scores as if they were calibrated probabilities. That also fails. A model that gives positives scores around 0.8 and negatives around 0.7 may rank well even if its probabilities are miscalibrated. Another model may be well calibrated but have weak separation. ROC and AUC focus on ordering: do positives tend to appear above negatives? Calibration is a separate question handled by reliability diagrams and probability calibration methods.`,
        `The wall is overlap. If every positive score is above every negative score, thresholding is easy. Most real models have an overlap region where some negatives score higher than some positives. Every threshold through that region trades additional true positives for additional false positives. ROC makes that menu visible instead of pretending one threshold summarizes the model.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start with a threshold above every score. The model flags nothing. True-positive rate is zero because it catches no positives. False-positive rate is zero because it falsely flags no negatives. Now lower the threshold to the next score. If that score belongs to a positive example, true-positive rate increases. If it belongs to a negative example, false-positive rate increases. Continue until the threshold is below every score and the model flags everything. The curve moves from (0, 0) to (1, 1).`,
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/ROC_curves.svg/330px-ROC_curves.svg.png',
          alt: 'ROC curves showing weak, random, and strong classifier behavior.',
          caption: 'The curve shape reveals how quickly positives rise before false positives accumulate. Source: https://commons.wikimedia.org/wiki/File:ROC_curves.svg',
        },
        `True-positive rate is TP / (TP + FN). It is the same as recall: among actual positives, what fraction did the threshold catch? False-positive rate is FP / (FP + TN): among actual negatives, what fraction did the threshold wrongly flag? The x-axis asks how many negatives you disturb. The y-axis asks how many positives you capture. A useful classifier bends toward the top-left because it catches many positives before it accumulates many false positives.`,
        `A random ranker lies near the diagonal. If positives and negatives have identical score distributions, then lowering the threshold admits positives and negatives at the same rate. A perfect ranker goes straight up the y-axis and then across the top because every positive scores above every negative. Real curves live between those extremes.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `AUC is not accuracy. It is not precision. It is not calibration. It measures pairwise ordering. If AUC is 0.89, then in about 89 percent of positive-negative pairs, the positive receives the higher score. This is why AUC is valuable for comparing models before the organization has settled on an operating threshold. It says how much ranking signal the model has learned across the score range.`,
        `AUC of 0.50 means no ranking skill under the evaluated distribution. The model may still output varied scores, but positives do not systematically rank above negatives. AUC below 0.50 often means the score direction is inverted, assuming labels are correct. If every negative receives a higher score than every positive, flipping the score would produce a strong ranker.`,
        `AUC can be computed by sorting scores and integrating the ROC curve, or by counting positive-negative score comparisons. The direct pair interpretation is simple but O(P times N) for P positives and N negatives. Sorting-based implementations compute the same value more efficiently. In either case, ties matter: if a positive and negative receive the same score, that pair contributes half a win.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `ROC works because lowering a threshold produces a monotone sweep through the ranked list. Each time a positive example enters, true-positive rate rises. Each time a negative example enters, false-positive rate rises. The shape of the curve is therefore a picture of how positives and negatives are interleaved by score.`,
        `AUC works because that same sweep is equivalent to pairwise ranking. If most positives appear above most negatives, the curve bends toward the top-left and the area is high. If the score ordering is random, positives and negatives enter at about the same rate and the curve stays near the diagonal.`,
      ],
    },
    {
      heading: `Choosing a threshold`,
      paragraphs: [
        `ROC does not choose the threshold for you. It shows what thresholds make possible. The operating point should come from costs, constraints, and downstream capacity. In medicine, a screening test may accept more false positives to avoid missed disease. In fraud detection, an investigation team may have a fixed daily review budget. In content moderation, the threshold may depend on how harmful a missed positive is and how costly a false removal is.`,
        `A threshold should be chosen on validation data that matches deployment as closely as possible. If the business cost of a false negative is high, the chosen point may prioritize recall. If false positives trigger expensive human review, the chosen point may need a lower false-positive count even if AUC is high. A model with a slightly lower AUC can be better for deployment if its curve dominates in the region where the service actually operates.`,
        `This is why reporting only the best-looking point is misleading. A serious evaluation names the operating region, reports uncertainty, and explains the cost model. The ROC curve is the menu. The deployed threshold is the order.`,
      ],
    },
    {
      heading: `Where ROC is useful`,
      paragraphs: [
        `ROC is useful when teams need to compare rankers independently of one threshold. Medical diagnostics use it to compare sensitivity and specificity across cutoff choices. Credit, malware, search-quality, and moderation teams use AUC to decide whether a new model ranks positives above negatives better than an old model. Cross-validation can report AUC across folds, giving a more stable view than one split. Model cards often include ROC because the tradeoff surface is easier to audit than a single default-threshold metric.`,
        `ROC is also useful when class prevalence may change but the conditional score distributions remain similar. True-positive rate and false-positive rate are normalized within their actual classes, so they do not directly change when the number of negatives grows. That can make ROC a clean way to study ranking behavior under controlled evaluation. The same property, however, becomes a limitation in rare-event operations.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `The most common misconception is that high AUC means good deployment performance. AUC can be high while the selected threshold is bad, while probabilities are uncalibrated, or while the alert queue is unusable. AUC says the ordering is strong on average across all thresholds. It does not say that score 0.8 means 80 percent risk, and it does not say the threshold 0.5 is meaningful.`,
        `ROC can flatter rare-event models. Suppose fraud is extremely rare. A false-positive rate of 1 percent may sound excellent because it divides false positives by all legitimate transactions. But if there are millions of legitimate transactions, 1 percent can be an enormous investigation queue. Precision answers a different operational question: when the alarm fires, how often is it correct? For imbalanced classification, precision-recall curves often expose the burden that ROC hides.`,
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/ROC_curve_example_highlighting_sub-area_with_low_sensitivity_and_low_specificity.png/250px-ROC_curve_example_highlighting_sub-area_with_low_sensitivity_and_low_specificity.png',
          alt: 'ROC curve with a highlighted low-sensitivity and low-specificity region.',
          caption: 'AUC averages over the full curve, including regions a product may never use. Source: https://commons.wikimedia.org/wiki/File:ROC_curve_example_highlighting_sub-area_with_low_sensitivity_and_low_specificity.png',
        },
        `Another mistake is to compare AUC across mismatched datasets or time periods without checking distribution shift. If the negative population becomes easier, AUC may improve even though the model did not become better on hard cases. If positives are sampled differently from deployment, the curve may describe the benchmark rather than the service. Evaluation should include slices, confidence intervals, and the threshold region that matters.`,
      ],
    },
    {
      heading: `Case study: spam filtering`,
      paragraphs: [
        `Consider a spam classifier that scores ten spam emails and ten ham emails. Most spam scores are high, but a few legitimate emails also score in the middle. If the threshold is strict, the filter catches only the most obvious spam and creates few false alarms. If the threshold is permissive, it catches more spam but starts hiding legitimate mail. Neither point alone tells you whether the model is a good ranker.`,
        `The ROC sweep walks through every possible cutoff. When the curve bends toward the top-left, it shows that many spam emails score above most ham emails. The AUC summarizes that separation. But deployment still requires a policy decision. A personal inbox may prefer fewer false positives because losing legitimate mail is painful. A corporate quarantine system may accept more false positives if messages can be reviewed safely. Same model, different threshold, different product behavior.`,
        `The evaluation should not stop at AUC. Check precision at the intended quarantine rate, recall for high-risk spam categories, calibration if scores are shown to users, and performance on slices such as newsletters, receipts, phishing attempts, and non-English mail. ROC is a starting point for threshold analysis, not the whole evaluation story.`,
      ],
    },
    {
      heading: `Sources and study next`,
      paragraphs: [
        `Primary sources: Fawcett, "An introduction to ROC analysis" at https://people.inf.elte.hu/kiss/13dwhdm/roc.pdf; Hanley and McNeil, "The meaning and use of the area under a receiver operating characteristic curve" at https://pubs.rsna.org/doi/10.1148/radiology.143.1.7063747; and scikit-learn ROC documentation at https://scikit-learn.org/stable/modules/model_evaluation.html#roc-metrics.`,
        `Study Precision, Recall and the Confusion Matrix to connect each ROC point to counts. Study imbalanced classification to see why ROC can hide false-alarm volume in rare-event problems. Study calibration and reliability diagrams to separate ranking from probability meaning. Study threshold selection with real costs to turn a score distribution into a deployed policy.`,
      ],
    },
],
};

