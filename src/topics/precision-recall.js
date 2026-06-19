// Precision, recall, and the confusion matrix: why a classifier can score
// 95% accuracy by doing literally nothing — and which numbers to trust
// instead. The four-cell table every model evaluation stands on.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'precision-recall',
  title: 'Precision, Recall & the Confusion Matrix',
  category: 'AI & ML',
  summary: 'Accuracy lies on imbalanced data — meet the four cells and two ratios that tell the truth.',
  controls: [
    { id: 'clf', label: 'Evaluate', type: 'select', options: ['lazy (always ham)', 'threshold 0.5', 'threshold 0.9 (cautious)'], defaultValue: 'lazy (always ham)' },
  ],
  run,
};

// 1,000 test emails, only 50 actually spam — imbalance is the norm.
const CLASSIFIERS = {
  'lazy (always ham)': { tp: 0, fn: 50, fp: 0, tn: 950 },
  'threshold 0.5': { tp: 40, fn: 10, fp: 30, tn: 920 },
  'threshold 0.9 (cautious)': { tp: 25, fn: 25, fp: 2, tn: 948 },
};

const metrics = ({ tp, fn, fp, tn }) => {
  const accuracy = (tp + tn) / (tp + fn + fp + tn);
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { accuracy, precision, recall, f1 };
};
const pct = (v) => `${(v * 100).toFixed(1)}%`;

export function* run(input) {
  const name = String(input.clf);
  const m = CLASSIFIERS[name];
  if (!m) throw new InputError('Pick a classifier.');

  const cmRows = [{ id: 'aspam', label: 'is spam' }, { id: 'aham', label: 'is ham' }];
  const cmCols = [{ id: 'pspam', label: 'flagged' }, { id: 'pham', label: 'passed' }];
  const cm = (title) => matrixState({ title, rows: cmRows, columns: cmCols, values: [[m.tp, m.fn], [m.fp, m.tn]] });

  yield {
    state: cm('The test set: 1,000 emails, only 50 actually spam'),
    highlight: {},
    explanation: `The setting that breaks naive evaluation: IMBALANCE. Of 1,000 test emails, just 50 are spam — and that ratio is the rule, not the exception (fraud among transactions, disease among patients, defects among parts). We're evaluating "${name}" — every prediction lands in exactly one of four cells.`,
  };

  yield {
    state: cm('The confusion matrix: four cells, no place to hide'),
    highlight: { found: ['aspam:pspam'], swap: ['aham:pspam'], compare: ['aspam:pham'], active: ['aham:pham'] },
    explanation: `Read it like a truth table. TRUE POSITIVES (${m.tp}): spam, correctly flagged. FALSE NEGATIVES (${m.fn}): spam that slipped through to the inbox. FALSE POSITIVES (${m.fp}): real mail wrongly junked — the expensive mistake. TRUE NEGATIVES (${m.tn}): ham correctly passed. Every metric you'll ever meet is arithmetic over these four numbers.`,
    invariant: 'The four cells always sum to the test set: every example lands in exactly one.',
  };

  const mt = metrics(m);
  yield {
    state: cm(`Accuracy: ${pct(mt.accuracy)} — impressive?`),
    highlight: { found: ['aspam:pspam', 'aham:pham'] },
    explanation: `ACCURACY = correct / total = ${pct(mt.accuracy)}. ${name === 'lazy (always ham)' ? 'And here is the scandal: this classifier does NOTHING — it calls everything ham — and still scores 95%, because 95% of the data IS ham. Accuracy on imbalanced data measures the imbalance, not the model. A 99%-accurate cancer screen that never detects cancer is a coin with one side.' : 'Looks great — but the lazy do-nothing classifier scores 95% on this same data. Accuracy barely distinguishes them. The informative questions are sharper.'}`,
  };

  yield {
    state: cm(`Precision ${pct(mt.precision)} Â· Recall ${pct(mt.recall)}`),
    highlight: { found: ['aspam:pspam'], swap: ['aham:pspam'], compare: ['aspam:pham'] },
    explanation: `The two questions that matter: PRECISION — of everything flagged, how much was really spam? ${m.tp}/(${m.tp}+${m.fp}) = ${pct(mt.precision)}. RECALL — of the real spam, how much did we catch? ${m.tp}/(${m.tp}+${m.fn}) = ${pct(mt.recall)}. Notice they audit DIFFERENT mistakes: precision punishes false alarms (good mail junked), recall punishes misses (spam delivered). ${name === 'lazy (always ham)' ? 'The lazy classifier\'s recall is 0% — the number accuracy was hiding.' : ''}`,
  };

  const all = Object.entries(CLASSIFIERS).map(([n, c]) => ({ n, ...metrics(c) }));
  yield {
    state: matrixState({
      title: 'Three classifiers, four lenses',
      rows: all.map((a, i) => ({ id: `c${i}`, label: a.n.split(' ')[0] })),
      columns: [{ id: 'acc', label: 'accuracy' }, { id: 'prec', label: 'precision' }, { id: 'rec', label: 'recall' }, { id: 'f1', label: 'F1' }],
      values: all.map((a) => [a.accuracy, a.precision, a.recall, a.f1]),
      format: (v) => `${(v * 100).toFixed(0)}%`,
    }),
    highlight: { active: all.map((_, i) => `c${i}:f1`) },
    explanation: 'All three side by side — and accuracy (95–97%) barely separates them while precision and recall tell three different stories. The thresholds reveal THE fundamental dial: flag more aggressively and recall rises while precision falls; get cautious and the reverse. You cannot max both; you can only choose your mistakes. F1, the harmonic mean of the two, is the standard one-number compromise — harmonic, so it collapses when either side does (the lazy classifier\'s F1: 0%).',
  };

  yield {
    state: cm('Choose metrics by the COST of each mistake'),
    highlight: {},
    explanation: 'The decision rule in practice: ask which error is expensive. Cancer screening: a miss can kill, a false alarm costs a follow-up test — maximize RECALL. Spam filtering: junking a job offer is a disaster, while one spam getting through is a shrug — favor PRECISION. Fraud, content moderation, medical triage: each picks its point on the curve (the full menu is the precision-recall curve, traced by sweeping the threshold). This is the evaluation layer under Naive Bayes (Spam Filter) and every classifier on this site — and the same base-rate trap that A/B Testing & p-values guards with priors and sample sizes.',
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Precision, Recall & the Confusion Matrix. Accuracy lies on imbalanced data — meet the four cells and two ratios that tell the truth..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Accuracy answers one question: what fraction of predictions were correct? That is useful only when the classes and mistakes are roughly balanced. Many real classifiers live in the opposite world. Fraud is rare. Cancer is rare. Critical defects are rare. Spam may be a small fraction of mail. In those settings, a classifier can achieve high accuracy by mostly predicting the majority class and ignoring the cases people actually care about.`,
        `The demo uses 1,000 emails, only 50 of which are spam. A lazy classifier that passes every email as ham gets 950 correct and scores 95 percent accuracy. It catches zero spam. Accuracy did not lie mathematically; it answered the wrong question for an imbalanced task. The model's success was mostly a reflection of the base rate.`,
        `Precision, recall, and the confusion matrix exist to stop that failure. They force evaluation to name the two kinds of positive-class mistakes: false positives, where harmless items are flagged, and false negatives, where real positives are missed. Once those counts are visible, the team can choose a model and threshold based on cost rather than being impressed by a majority-class score.`,
      ],
    },
    {
      heading: `The four-cell ledger`,
      paragraphs: [
        `The confusion matrix has four cells. True positives are positive cases correctly flagged. False negatives are positive cases missed. False positives are negative cases incorrectly flagged. True negatives are negative cases correctly ignored. Every example in a labeled evaluation set lands in exactly one cell, and every metric in this family is arithmetic over those cells.`,
        `Precision is TP / (TP + FP). It asks: of the things the model flagged, how many were actually positive? High precision means the alert queue is clean. In spam filtering, a false positive may bury a job offer or invoice, so precision matters. In fraud review, low precision means analysts waste time on innocent transactions.`,
        `Recall is TP / (TP + FN). It asks: of all real positives, how many did the model find? High recall means the system misses fewer target cases. In medical screening, a false negative can be much more serious than a false alarm, so recall often matters more. In security monitoring, recall measures how much of the real threat stream is being caught.`,
        `The threshold 0.5 classifier in the demo has TP = 40, FN = 10, FP = 30, and TN = 920. Accuracy is 96 percent, barely above the lazy 95 percent, but precision is 40 / (40 + 30), or 57.1 percent, and recall is 40 / (40 + 10), or 80 percent. Those two ratios reveal a model that catches most spam but creates a noisy flagged queue.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Precision and recall work because they separate two different promises. Precision asks whether positive predictions are trustworthy. Recall asks whether real positives are being missed. Accuracy merges those promises into one number, so it can hide the exact mistake the system is making.`,
        `The confusion matrix is the invariant behind the metrics. Every prediction lands in exactly one of four cells: true positive, false positive, true negative, or false negative. Precision uses the positive-prediction column. Recall uses the real-positive row. Once those denominators are visible, the tradeoff stops being a vague model-quality argument and becomes a question about which kind of error the application can afford.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `Most classifiers produce scores, not final decisions. A threshold turns scores into labels. Lower the threshold and the model flags more items. True positives usually rise, false positives usually rise, recall improves, and precision may fall. Raise the threshold and the model becomes cautious. False positives fall, precision often improves, but false negatives rise and recall falls.`,
        `The cautious threshold 0.9 classifier in the demo shows the trade. It has TP = 25, FN = 25, FP = 2, and TN = 948. Precision is 25 / (25 + 2), or 92.6 percent. Recall is 25 / (25 + 25), or 50 percent. Compared with the threshold 0.5 classifier, the alert queue is much cleaner, but half the spam escapes. Neither model is universally better. The better choice depends on the cost of junking ham versus the cost of letting spam through.`,
        `This is why the confusion matrix should be read before any one-number metric. The same model family, trained on the same data, can look aggressive or conservative depending on threshold. A product team that says "maximize precision" is choosing fewer false alarms. A team that says "maximize recall" is choosing fewer misses. Good evaluation makes that choice explicit.`,
      ],
    },
    {
      heading: `F1 and other summaries`,
      paragraphs: [
        `F1 is the harmonic mean of precision and recall: 2PR / (P + R). It is popular because it punishes collapse on either side. If precision is high but recall is near zero, F1 remains low. If recall is high but precision is awful, F1 remains low. The lazy classifier in the demo has 95 percent accuracy but zero recall and therefore F1 = 0. F1 exposes the trick accuracy missed.`,
        `But F1 is not a law of nature. It treats precision and recall symmetrically. Many products do not. A cancer screen may accept many false positives to avoid false negatives. A legal hold review system may prefer high recall because missing a relevant document is dangerous. A user-facing spam filter may prefer high precision because hiding legitimate mail is unacceptable. If the costs are asymmetric, use cost-weighted evaluation or choose a threshold against a required operating point, such as recall at 95 percent precision.`,
        `Other metrics answer adjacent questions. Specificity is TN / (TN + FP), the true-negative rate. It is not another name for precision. Negative predictive value asks, of the items passed, how many were truly negative. ROC curves plot true-positive rate against false-positive rate as thresholds move. Precision-recall curves are often more informative on heavily imbalanced data because they focus on the positive-class queue and detection rate.`,
      ],
    },
    {
      heading: `Evaluation discipline`,
      paragraphs: [
        `Computing these metrics is simple: run the model on labeled examples, count the four cells, divide. The hard part is making the evaluation set honest. It must match the deployment distribution or intentionally report separate distributions. It must avoid training-data leakage. It must preserve base rates or clearly document resampling. It must include enough positives for recall estimates to be stable. A recall estimate from five positive examples is not a product decision; it is a warning that the test set is too small.`,
        `Report confidence intervals or repeated-split variation when possible. Precision and recall can move sharply when the positive class is rare. Ten additional false positives may be trivial in a million-row system and catastrophic in a small expert-review queue. Slice the confusion matrix by subgroup, geography, device, language, source, or risk band. A model can have acceptable global recall while missing the exact subgroup that motivated the classifier.`,
        `Calibration matters when thresholds are chosen from probabilities. If a score of 0.9 does not mean about a 90 percent chance of being positive, threshold discussions become brittle. A model can rank examples well but produce poorly calibrated probabilities. Precision-recall curves inspect ranking behavior across thresholds; calibration diagrams inspect whether scores deserve probability interpretation. Production systems usually need both.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Spam filters use precision to avoid hiding legitimate mail and recall to keep inboxes clean. Fraud systems use precision to manage investigator workload and recall to limit missed losses. Medical screening uses recall or sensitivity to reduce missed disease, then precision or positive predictive value to understand how many follow-up tests will be unnecessary. Search and recommendation systems often use precision at k because users inspect only the first page or first few recommendations.`,
        `Moderation systems use the same ledger but with high stakes on both sides: false positives suppress legitimate speech, while false negatives leave harmful content up. Defect detection balances missed defects against unnecessary inspection. Sales lead scoring balances wasted sales effort against missed opportunities. The vocabulary changes by domain, but the cells remain the same.`,
        `The confusion matrix also helps debug model changes. If a new loss function improves recall but floods false positives, the business impact is different from a change that improves precision at the same recall. If a data-cleaning change improves true negatives but leaves true positives unchanged, accuracy may rise while the product problem remains unsolved. The four counts keep the discussion grounded.`,
      ],
    },
    {
      heading: `Where it fails (2)`,
      paragraphs: [
        `Do not compare precision across datasets with different base rates without naming the prevalence. If positives become rarer, precision can fall even when the classifier's ranking skill is unchanged. Do not compute the confusion matrix on training data and call it evaluation. Do not tune the threshold on the test set and then report the same test set as an unbiased result. Use validation data for threshold selection and reserve test data for final measurement.`,
        `Do not assume precision and recall should both improve when you move only the threshold. Usually the threshold buys one with the other. If both improve, something else changed: the model, features, labels, data split, or calibration. Do not hide the confusion matrix behind F1 alone. A single number is useful for sorting experiments, but deployment needs the underlying counts and costs.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Imbalanced Data to understand why majority-class accuracy is seductive, ROC Curves and AUC for threshold sweeps from the false-positive-rate perspective, Picking a Threshold with Real Costs for cost-sensitive deployment, and Calibration and Reliability Diagrams before treating scores as probabilities. Then practice by writing the confusion matrix for a real product decision. Name the positive class, name both mistakes, attach costs, choose the threshold, and only then decide which metric should lead the dashboard.`,
      ],
    },
      {
      heading: 'Why this exists',
      paragraphs: [
        "State the real constraint this topic fixes before introducing the mechanism.",
        "A good opening says what gets too slow, too fragile, or too hard to reason about under baseline behavior.",
        "Without that, every optimization appears decorative.",
      ],
    },

    {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },

    {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'The core insight',
      paragraphs: [
        "The core insight is the smallest idea that changes what can be proven.",
        "Phrase it as an invariant, boundary, or contract that stays true across all transitions.",
        "Everything else in the topic should serve this one sentence.",
      ],
    },

    {
      heading: 'How it works',
      paragraphs: [
        "Describe the mechanism as a sequence of state transitions, not as a story.",
        "Each step should say what changes, what stays true, and why the move is legal.",
        "The animation should look like this section made concrete.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Precision, Recall & the Confusion Matrix moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

