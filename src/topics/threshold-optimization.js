// The ROC curve is a menu; money is how you order. Attach a dollar cost to
// each kind of mistake and the "where do I set the threshold?" debate
// becomes arithmetic — and the optimum SLIDES when the costs flip.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'threshold-optimization',
  title: 'Picking a Threshold with Real Costs',
  category: 'AI & ML',
  summary: 'Attach a price to each mistake and the threshold debate becomes arithmetic — watch the optimum slide when costs flip.',
  controls: [
    { id: 'costs', label: 'World', type: 'select', options: ['a junked invoice costs $10', 'a missed fraud costs $10'], defaultValue: 'a junked invoice costs $10' },
  ],
  run,
};

// The same 20 scored emails from ROC Curves & AUC — one model, many thresholds.
const SPAM = [0.95, 0.9, 0.85, 0.8, 0.7, 0.65, 0.55, 0.45, 0.4, 0.3];
const HAM = [0.6, 0.5, 0.45, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05];
const THRESHOLDS = [...new Set([...SPAM, ...HAM])].sort((a, b) => a - b);

const mistakes = (t) => ({
  fp: HAM.filter((s) => s >= t).length,
  fn: SPAM.filter((s) => s < t).length,
});
const cost = (t, cFP, cFN) => {
  const { fp, fn } = mistakes(t);
  return fp * cFP + fn * cFN;
};

export function* run(input) {
  const world = String(input.costs);
  const invoiceWorld = world === 'a junked invoice costs $10';
  if (!invoiceWorld && world !== 'a missed fraud costs $10') throw new InputError('Pick a cost world.');
  const [cFP, cFN] = invoiceWorld ? [10, 1] : [1, 10];
  const flagged = invoiceWorld ? 'junk a real email' : 'block a legit transaction';
  const missed = invoiceWorld ? 'let spam into the inbox' : 'let a fraud through';

  yield {
    state: matrixState({
      title: 'The confusion matrix, with prices attached',
      rows: [{ id: 'spam', label: 'actually bad' }, { id: 'ham', label: 'actually good' }],
      columns: [{ id: 'flag', label: 'we flag it' }, { id: 'pass', label: 'we pass it' }],
      values: [[0, cFN], [cFP, 0]],
      format: (v) => (v === 0 ? '$0' : `$${v}`),
    }),
    highlight: { active: [cFP > cFN ? 'ham:flag' : 'spam:pass'] },
    explanation: `ROC Curves & AUC ended with a menu of trade-offs and a question: which threshold do you PICK? Answer: the one that loses the least money. Stop treating the two mistakes as abstract rates and price them like an accountant. In this world, to ${cFP > cFN ? flagged : missed} costs $${Math.max(cFP, cFN)} — that is where the pain lives — while to ${cFP > cFN ? missed : flagged} costs only $1. Correct decisions are free. Now every threshold has a bill, and we can shop.`,
  };

  const curvePoints = THRESHOLDS.map((t) => ({ x: t, y: cost(t, cFP, cFN) }));
  const best = THRESHOLDS.reduce((a, t) => (cost(t, cFP, cFN) < cost(a, cFP, cFN) ? t : a), THRESHOLDS[0]);
  yield {
    state: plotState({
      axes: { x: { label: 'threshold' }, y: { label: 'total cost on the 20 test emails ($)' } },
      series: [{ id: 'costCurve', label: 'expected cost', points: curvePoints }],
      markers: [{ id: 'best', x: best, y: cost(best, cFP, cFN), label: `t = ${best} â†’ $${cost(best, cFP, cFN)}` }],
    }),
    highlight: { active: ['costCurve'], found: ['best'] },
    explanation: `Sweep every threshold over the same 20 scored emails the ROC topic used and total the bill at each stop: cost(t) = $${cFP}Â·(false positives) + $${cFN}Â·(false negatives). The curve sags to a minimum and climbs at both ends — flag everything and the $${cFP} mistakes pile up on the ${invoiceWorld ? 'left' : 'right'} side of the ledger; flag nothing and the $${cFN} ones do. The cheapest threshold is t = ${best}, total damage $${cost(best, cFP, cFN)}. ${invoiceWorld ? 'A STRICT threshold: with junked invoices at $10, the filter only flags what it is very sure of — precision bought with recall.' : 'A PERMISSIVE threshold: with missed fraud at $10, the system flags on faint suspicion — recall bought with false alarms.'}`,
    invariant: 'The optimal threshold minimizes cFPÂ·FP(t) + cFNÂ·FN(t) — nothing else about the model changes.',
  };

  const sample = [0.3, 0.45, 0.55, 0.65, 0.8, 0.95];
  yield {
    state: matrixState({
      title: `The ledger, line by line (FP @ $${cFP}, FN @ $${cFN})`,
      rows: sample.map((t) => ({ id: `t${String(t).replace('.', '')}`, label: `t = ${t}` })),
      columns: [{ id: 'fp', label: 'false pos' }, { id: 'fn', label: 'false neg' }, { id: 'bill', label: 'total bill' }],
      values: sample.map((t) => {
        const { fp, fn } = mistakes(t);
        return [fp, fn, cost(t, cFP, cFN)];
      }),
      format: String,
    }),
    highlight: { found: [`t${String(best).replace('.', '')}:bill`] },
    explanation: `The same sweep as a ledger. Read how the trade executes: tightening the threshold converts false positives into false negatives one email at a time, and whether that trade is GOOD depends only on the exchange rate — $${cFP} against $${cFN}. Notice what we did NOT do: retrain the model, touch its weights, or change its AUC. Threshold choice is a free knob that sits entirely OUTSIDE the model — which is why deploying the same fraud model at two banks with different fraud economics correctly yields two different thresholds.`,
  };

  const otherBest = THRESHOLDS.reduce((a, t) => (cost(t, cFN, cFP) < cost(a, cFN, cFP) ? t : a), THRESHOLDS[0]);
  yield {
    state: plotState({
      axes: { x: { label: 'threshold' }, y: { label: 'total cost ($)' } },
      series: [
        { id: 'costCurve', label: 'this world', points: curvePoints },
        { id: 'flipped', label: 'costs flipped', points: THRESHOLDS.map((t) => ({ x: t, y: cost(t, cFN, cFP) })) },
      ],
      markers: [
        { id: 'best', x: best, y: cost(best, cFP, cFN), label: `t = ${best}` },
        { id: 'otherBest', x: otherBest, y: cost(otherBest, cFN, cFP), label: `t = ${otherBest}` },
      ],
    }),
    highlight: { active: ['best'], compare: ['otherBest'] },
    explanation: `Both worlds on one chart. Same model, same scores, same ROC curve — yet the optimum sits at t = ${best} in this world and slides to t = ${otherBest} when the costs flip. The model has no opinion about where to operate; the ECONOMICS does. This is the cleanest division of labor in applied ML: scientists raise the AUC (a better menu), the business sets cFP and cFN (the prices), and the threshold falls out mechanically. Arguments about "the right threshold" are usually disguised arguments about the prices.`,
  };

  const tStar = cFP / (cFP + cFN);
  yield {
    state: matrixState({
      title: 'The closed form — if the probabilities are honest',
      rows: [{ id: 'formula', label: 't* = cFP/(cFP+cFN)' }, { id: 'empirical', label: 'our sweep found' }],
      columns: [{ id: 'value', label: 'threshold' }],
      values: [[tStar], [best]],
      format: (v) => v.toFixed(2),
    }),
    highlight: { compare: ['formula:value', 'empirical:value'] },
    explanation: `One more beautiful step: if the model's probabilities were CALIBRATED (see Calibration & Reliability Diagrams), no sweep would be needed. Flag exactly when pÂ·$${cFN} — the expected cost of passing — exceeds (1âˆ’p)Â·$${cFP}, the expected cost of flagging. Solve: t* = cFP/(cFP+cFN) = ${tStar.toFixed(2)}. Our empirical sweep said ${best} instead — and that gap is the fingerprint of MISCALIBRATION: the formula trusts the scores' face value, the sweep trusts what they actually did. Calibrate first and the two answers converge; that is why calibration is not cosmetic — it is what lets you set thresholds with algebra instead of experiments.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Picking a Threshold with Real Costs. Attach a price to each mistake and the threshold debate becomes arithmetic — watch the optimum slide when costs flip..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
        {type: "callout", text: "A threshold is a priced operating point, not a model property; changing costs can move the best cutoff while the scores stay fixed."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A classifier often produces a score before it produces an action. A spam filter estimates how likely an email is to be spam. A fraud model estimates how risky a transaction looks. A medical screening model estimates whether a case deserves follow-up. None of those scores automatically says what the product should do. The action comes from a threshold: above the threshold, flag; below it, pass.',
        'Threshold optimization exists because mistakes do not cost the same. Junking a real invoice may be worse than letting one spam message through. Missing a fraudulent transaction may be worse than asking a real customer for extra verification. A model score is a statistical estimate. A threshold is a policy decision that turns that estimate into action under costs, capacity, regulation, and user trust.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious threshold is 0.5. If the score is above one half, flag the case. If it is below one half, pass it. That rule is reasonable only when the score is a calibrated probability, the two mistake types have equal cost, and the product has no capacity limits. Those assumptions are rare in deployed systems.',
        'A fraud team may accept many false alarms to avoid large losses. An email provider may require high confidence before hiding a legitimate message. A medical screening workflow may set a low first-stage threshold because a human specialist reviews the positives. The threshold is not a universal truth about the model. It is the operating point chosen for a particular decision.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The 0.5 rule fails when costs differ, when classes are imbalanced, when scores are not calibrated, or when the system has a limited review budget. It can raise accuracy while harming the rare class. It can improve recall while overwhelming reviewers. It can reduce false positives while allowing expensive misses. Accuracy hides the tradeoff because it combines multiple kinds of decisions into one number.',
        'ROC Curves and AUC shows the menu of possible operating points for a ranker. Precision and Recall explain how one threshold changes counts in the confusion matrix. Threshold optimization chooses one point on that menu using costs and constraints. The model is not retrained. The deployment rule changes.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is simple: choose the action with the lower expected loss. A threshold is correct only relative to a loss function. If a false positive costs cFP and a false negative costs cFN, then every threshold t has a bill: cost(t) = cFP * FP(t) + cFN * FN(t). The best threshold is the one with the smallest bill on data that represents the deployment population.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/ROC_curves.svg', alt: 'ROC curve diagram with threshold movement and confusion matrix', caption: 'ROC space shows the threshold menu before a cost model chooses one operating point. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:ROC_curves.svg.'},
        'This turns a vague debate into a ledger. Tightening the threshold usually reduces false positives and increases false negatives. Loosening the threshold usually increases false positives and reduces false negatives. Whether the trade is good depends on the exchange rate between cFP and cFN. A team arguing about the right threshold is often arguing about the prices without writing them down.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The empirical mechanism is a sweep. Sort the candidate scores, evaluate the confusion matrix at each possible cutoff on validation data, and compute the cost for each cutoff. The minimum-cost cutoff becomes the proposed threshold. This procedure trusts observed behavior on held-out examples rather than trusting the numeric score at face value.',
        'The module uses twenty scored emails from the ROC topic: ten spam messages and ten legitimate messages. In the invoice world, the expensive mistake is a false positive. Junking a real invoice costs $10, while letting one spam message through costs $1. The threshold becomes strict because the system should flag only messages it is very sure about. Precision is bought by giving up recall.',
        'Flip the prices and the best threshold moves. In the fraud world, a missed fraud costs $10 and a false alarm costs $1. The same scores now call for a permissive threshold. The system flags on weaker evidence because missing a positive case is expensive. The ranking, ROC curve, and AUC did not change. The economics changed, so the operating point changed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Threshold optimization works because it separates ranking from action. A model may be good at ordering cases from most risky to least risky. The threshold decides how much of that ranked list the system acts on. Improving AUC gives a better menu. Optimizing the threshold chooses an item from that menu.',
        'If the score is a calibrated probability, the expected-cost rule has a closed form. Passing a case with probability p of being positive has expected cost p * cFN. Flagging the case has expected cost (1 - p) * cFP. Flag when p * cFN is greater than (1 - p) * cFP. Solving gives t* = cFP / (cFP + cFN). Equal costs give 0.5. Expensive false positives push the threshold up. Expensive false negatives push it down.',
        'This proof is small, but the assumptions are large. The formula assumes the score is a probability and the cost numbers are real. If a score of 0.8 does not correspond to about an 80 percent event rate, then the algebra is using the wrong input. That is why Calibration and Reliability Diagrams belong next to this topic.',
      ],
    },
    {
      heading: 'Calibration and sweeps',
      paragraphs: [
        'When calibration is uncertain, an empirical sweep is safer than the closed-form rule. The sweep asks what the scores actually did on held-out examples. It can disagree with the algebra because the dataset is finite, scores are discrete, base rates differ, or the model is miscalibrated. That disagreement is not a bug; it is evidence that the score should not be treated as an honest probability.',
        'Calibration still matters because it makes threshold policy more portable. A calibrated model lets a team reason about new cost ratios without rerunning every historical experiment from scratch. It also makes segment-level monitoring easier because a score band should have a stable meaning. Calibration can drift when data changes, when base rates move, or when the model is applied to a new user group, so threshold optimization needs reliability checks and periodic recalibration.',
      ],
    },
    {
      heading: 'Capacity constraints',
      paragraphs: [
        'Real systems often have limits that a simple dollar model misses. A fraud team may review only 500 alerts per hour. A hospital may need same-day follow-up for every positive screening result. A moderation system may have separate queues for automatic blocking, human review, and low-risk pass-through. In those cases the threshold is also a resource-allocation knob.',
        'One common design is a two-threshold policy. Very high scores trigger automatic action. Middle scores go to review. Low scores pass. This keeps the expected-loss logic but adds operational capacity. Another design is segment-specific thresholds, which can improve utility but must be audited carefully because thresholds can change fairness, access, and user experience. A threshold policy is part of the product, not just a notebook value.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Start by defining the action, not the model. The threshold for deleting an email should be higher than the threshold for moving it to a spam folder. The threshold for blocking a payment should be different from the threshold for sending it to step-up authentication. Attach costs or constraints to the actual action being taken.',
        'Use held-out data that matches deployment as closely as possible. Compute FP(t), FN(t), cost(t), alert volume, precision, recall, and segment-level behavior for candidate thresholds. Choose a threshold with a rollback plan, monitor it after release, and recheck it when base rates, traffic mix, fraud tactics, or review capacity changes. Store the cost assumptions with the threshold so future teams know why it was chosen.',
        'Do not hide the chosen threshold inside model code. Treat it as configuration with versioning, owners, audit notes, and experiments. A threshold change can be as user-visible as a model change, even though no weights moved.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Spam filters use high thresholds when hiding legitimate mail is unacceptable. Fraud systems often use lower thresholds when losses are large and review is cheap enough. Medical screening usually favors recall in the first stage, then relies on confirmatory tests or human review to control false positives. Search, recommendations, ads, safety systems, credit, insurance, and compliance workflows all use thresholds under different cost and audit constraints.',
        'The common pattern is that the same model can be deployed differently in different contexts. A bank serving high-risk transactions may use a lower threshold than a bank serving small routine payments. An email provider may use a stricter threshold for deleting messages than for labeling them. The action matters. Thresholds should be chosen for the decision being made, not copied from a benchmark.',
      ],
    },
    {
      heading: 'Where it fails (2)',
      paragraphs: [
        'Threshold tuning cannot rescue a model that ranks cases badly. If positives and negatives are mixed at every score level, every threshold is a painful compromise. A better AUC improves the menu of possible tradeoffs; threshold optimization chooses from the menu. These are different jobs.',
        'It also fails when costs are guessed poorly. A false positive may have hidden costs such as churn, support load, legal exposure, or lost trust. A false negative may have delayed costs that are hard to observe. If the validation set is shifted, contaminated, or too small, the chosen threshold can look cheap offline and fail in production.',
        'Thresholds can also fail socially. Segment-specific thresholds may improve one metric while creating unfair treatment. Capacity-driven thresholds may ration attention toward easy cases. Any threshold policy that affects people should be audited by segment, monitored for drift, and reviewed under the same governance as the model.',
      ],
    },
    {
      heading: 'Using the visualizer',
      paragraphs: [
        'Start with the priced confusion matrix and identify which mistake is expensive. Then treat the cost curve as a threshold ledger, not as a new model-quality curve. The lowest point is the threshold that minimizes the current cost model on the sample.',
        'The flipped-cost view is the main lesson. Same scores, same labels, same ROC curve, different best threshold. The model has no universal opinion about where to operate. The cost model, capacity limit, and product action supply the operating point. The calibrated-probability frame then shows when algebra can replace an empirical sweep: only when the scores deserve to be treated as probabilities.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Precision, Recall and the Confusion Matrix for the counts behind the ledger. Study ROC Curves and AUC to understand the menu of possible thresholds. Study Calibration and Reliability Diagrams before trusting closed-form threshold rules. Study Imbalanced Classification because rare positive classes make default thresholds dangerous. Study A/B Testing and p-values for verifying that a threshold change improves production outcomes rather than only offline cost.',
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
      heading: 'Cost and behavior',
      paragraphs: [
        "Cost is both asymptotic and practical.",
        "State what grows, what stays flat, and what setup cost dominates before the method becomes useful.",
        "If possible, convert cost into an intuition: doubling, halving, or crossing a fixed bound.",
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
        'Use this topic as a checkpoint: if you can explain why Picking a Threshold with Real Costs moves from input to output in the animation and where it fails, you are ready for the next topic.',
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

