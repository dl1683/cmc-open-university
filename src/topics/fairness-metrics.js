// Fairness metrics: compare model errors across groups, see why metrics can
// conflict, and connect statistical parity to causal assumptions.

import { matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'fairness-metrics',
  title: 'Fairness Metrics',
  category: 'AI & ML',
  summary: 'Demographic parity, equalized odds, equal opportunity, calibration, and why base rates force tradeoffs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['confusion by group', 'metric tradeoffs'], defaultValue: 'confusion by group' },
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

function* confusionByGroup() {
  yield {
    state: labelMatrix(
      'Same model, two group confusion matrices',
      [
        { id: 'a_tp', label: 'group A true positives' },
        { id: 'a_fp', label: 'group A false positives' },
        { id: 'b_tp', label: 'group B true positives' },
        { id: 'b_fp', label: 'group B false positives' },
      ],
      [
        { id: 'count', label: 'count' },
        { id: 'rate', label: 'rate' },
      ],
      [
        ['72 of 100 qualified', 'TPR 72%'],
        ['14 of 100 unqualified', 'FPR 14%'],
        ['54 of 100 qualified', 'TPR 54%'],
        ['14 of 100 unqualified', 'FPR 14%'],
      ],
    ),
    highlight: { active: ['a_tp:rate', 'b_tp:rate'], compare: ['a_fp:rate', 'b_fp:rate'] },
    explanation: `The table splits the confusion matrix into ${4} rows across ${2} groups so the denominator is visible. False positive rates match at ${14}%, but group B has a much lower true positive rate (${54}% vs ${72}%), meaning qualified positives are missed more often. A global precision or recall score would average that harm away.`,
    invariant: `Fairness metrics are conditional rates across ${2} groups; always ask what denominator they use.`,
  };

  yield {
    state: labelMatrix(
      'Common group metrics',
      [
        { id: 'dp', label: 'demographic parity' },
        { id: 'eo', label: 'equalized odds' },
        { id: 'eopp', label: 'equal opportunity' },
        { id: 'cal', label: 'calibration by group' },
      ],
      [
        { id: 'constraint', label: 'constraint' },
        { id: 'denominator', label: 'denominator' },
      ],
      [
        ['same selection rate', 'all people in group'],
        ['same TPR and FPR', 'condition on true label'],
        ['same TPR', 'qualified positives'],
        ['same meaning of score', 'condition on score'],
      ],
    ),
    highlight: { found: ['eo:constraint', 'eopp:constraint'], compare: ['dp:denominator', 'cal:denominator'] },
    explanation: `Each of the ${4} metrics conditions on a different population. Demographic parity looks at everyone in a group, equalized odds conditions on the true label, equal opportunity focuses on qualified positives, and calibration conditions on the score. The choice is a policy decision about which harm matters.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'threshold', min: 0, max: 1 }, y: { label: 'rate', min: 0, max: 1 } },
      series: [
        { id: 'tprA', label: 'group A TPR', points: [{ x: 0.2, y: 0.95 }, { x: 0.4, y: 0.84 }, { x: 0.6, y: 0.72 }, { x: 0.8, y: 0.45 }] },
        { id: 'tprB', label: 'group B TPR', points: [{ x: 0.2, y: 0.88 }, { x: 0.4, y: 0.70 }, { x: 0.6, y: 0.54 }, { x: 0.8, y: 0.30 }] },
      ],
      markers: [
        { id: 'single', x: 0.6, y: 0.63, label: 'single threshold gap' },
        { id: 'adjust', x: 0.45, y: 0.72, label: 'group-specific threshold' },
      ],
    }),
    highlight: { active: ['tprA', 'tprB'], compare: ['single', 'adjust'] },
    explanation: `Moving thresholds across ${4} sample points per group changes which errors each group receives. A group-specific threshold can close the TPR gap, but it also changes selection rates, precision, and calibration. The visual is a tradeoff dial, not a free repair.`,
  };

  yield {
    state: labelMatrix(
      'Audit questions before choosing a metric',
      [
        { id: 'harm', label: 'which error harms?' },
        { id: 'label', label: 'is label fair?' },
        { id: 'base', label: 'do base rates differ?' },
        { id: 'causal', label: 'what caused score?' },
      ],
      [
        { id: 'why', label: 'why it matters' },
        { id: 'link', label: 'study link' },
      ],
      [
        ['FP and FN have different costs', 'Threshold Optimization'],
        ['historical labels can encode bias', 'Data Leakage'],
        ['metrics may conflict', 'Calibration Curves'],
        ['paths matter', 'Causal Graphs'],
      ],
    ),
    highlight: { active: ['harm:why', 'label:why', 'causal:why'], compare: ['base:why'] },
    explanation: `This ${4}-question checklist comes before metric choice. The harm model says which error matters, the label audit checks whether ground truth is trustworthy, base rates reveal possible conflicts, and the causal story guards against proxy paths.`,
  };
}

function* metricTradeoffs() {
  yield {
    state: labelMatrix(
      'Base rates create metric conflicts',
      [
        { id: 'score', label: 'same calibrated score' },
        { id: 'base', label: 'different base rates' },
        { id: 'parity', label: 'demographic parity' },
        { id: 'calibration', label: 'calibration' },
      ],
      [
        { id: 'status', label: 'status' },
        { id: 'consequence', label: 'consequence' },
      ],
      [
        ['score means same risk', 'valuable property'],
        ['groups differ', 'selection rates diverge'],
        ['force equal selection', 'thresholds may diverge'],
        ['preserve score meaning', 'parity may fail'],
      ],
    ),
    highlight: { active: ['base:consequence'], compare: ['parity:consequence', 'calibration:consequence'] },
    explanation: `The ${4} rows show why calibrated scores and equal selection can conflict when base rates differ. Forcing demographic parity may require different thresholds, while preserving score meaning may leave selection rates unequal.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'false positive rate', min: 0, max: 0.5 }, y: { label: 'true positive rate', min: 0, max: 1 } },
      series: [
        { id: 'rocA', label: 'group A ROC', points: [{ x: 0.05, y: 0.45 }, { x: 0.10, y: 0.65 }, { x: 0.20, y: 0.82 }, { x: 0.35, y: 0.93 }] },
        { id: 'rocB', label: 'group B ROC', points: [{ x: 0.05, y: 0.30 }, { x: 0.10, y: 0.50 }, { x: 0.20, y: 0.72 }, { x: 0.35, y: 0.86 }] },
      ],
      markers: [
        { id: 'target', x: 0.20, y: 0.72, label: 'equalized odds target' },
      ],
    }),
    highlight: { active: ['rocA', 'rocB'], found: ['target'] },
    explanation: `The ROC plot with ${4} sample points per group shows feasible error-rate tradeoffs across ${2} curves. Equalized odds asks both groups to land at the same TPR and FPR; if one curve dominates, the system may need randomization or reduced utility to hit the shared point.`,
    invariant: `Fairness constraints can redistribute errors across ${2} groups; they do not erase model weakness.`,
  };

  yield {
    state: labelMatrix(
      'Metric choice changes the intervention',
      [
        { id: 'data', label: 'improve data' },
        { id: 'threshold', label: 'change threshold' },
        { id: 'features', label: 'remove feature' },
        { id: 'causal', label: 'causal correction' },
      ],
      [
        { id: 'fixes', label: 'fixes' },
        { id: 'danger' , label: 'danger' },
      ],
      [
        ['missing signal', 'slow and expensive'],
        ['error-rate target', 'can reduce calibration'],
        ['proxy leakage', 'can remove useful context'],
        ['unfair path', 'assumptions must hold'],
      ],
    ),
    highlight: { found: ['data:fixes', 'threshold:fixes', 'causal:fixes'], compare: ['features:danger'] },
    explanation: `The ${4}-row intervention table prevents a threshold-only mindset. Some gaps come from missing signal, biased labels, proxy leakage, or unfair causal paths, so the right fix may be data, measurement, causal correction, or product policy.`,
  };

  yield {
    state: labelMatrix(
      'Responsible reporting package',
      [
        { id: 'global', label: 'global metrics' },
        { id: 'slice', label: 'slice metrics' },
        { id: 'uncertainty', label: 'uncertainty sets' },
        { id: 'decision', label: 'decision policy' },
      ],
      [
        { id: 'include', label: 'include' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['accuracy, AUC, PR', 'baseline context'],
        ['TPR, FPR, precision by group', 'harm visibility'],
        ['coverage by group', 'defer safely'],
        ['human review and appeals', 'model is not the whole system'],
      ],
    ),
    highlight: { found: ['slice:include', 'uncertainty:include', 'decision:include'] },
    explanation: `The ${4}-component reporting package links numbers to operations. Slice metrics expose harm, uncertainty sets show when to defer, and the decision policy explains human review, appeals, and drift response. A model card only helps if it changes decisions.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'confusion by group') yield* confusionByGroup();
  else if (view === 'metric tradeoffs') yield* metricTradeoffs();
  else throw new InputError('Pick a fairness-metrics view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views selectable from the dropdown. "Confusion by group" splits one model\'s predictions into per-group confusion matrices so you can see exactly where errors land. Each frame highlights a different rate or metric, with the denominator visible in every cell. "Metric tradeoffs" shows why satisfying one fairness definition can violate another, with ROC curves and threshold diagrams making the conflict concrete.',
        'Watch the highlight colors. Active cells (green) show the metric being defined. Comparison cells (orange) show the contrasting metric or the competing constraint. When two cells highlight simultaneously, the animation is asking you to compare denominators. Step through slowly the first time; the point is not the numbers but which population each number divides by.',
        {type: 'image', src: './assets/gifs/fairness-metrics.gif', alt: 'Animated walkthrough of the fairness metrics visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A model can reach 92% accuracy while rejecting qualified applicants from one group at twice the rate of another. Global metrics average over groups, so the harm disappears into the denominator. A lending model with 5% overall false-denial rate may have 3% for group A and 9% for group B. Neither the AUC nor the log-loss will tell you that.',
        {type: 'callout', text: 'Fairness metrics are denominator choices: each metric names which group bears which kind of error.'},
        'Fairness metrics exist to make that denominator explicit. They are not a substitute for privacy, robustness, or security. A differentially private model can still assign one group more false negatives. A well-calibrated model can still have unequal error rates. The question fairness metrics answer is narrow and specific: given a decision boundary, who gets the errors?',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is to train a model, compute one global metric like accuracy or AUC, hit the target, and ship. This works when the population is homogeneous or when errors are equally costly across groups. In practice neither condition holds. A fraud detector with 99% accuracy on a population where 1% is fraudulent can achieve that score by predicting "not fraud" for everyone, which is useless for the minority class and potentially devastating for one demographic slice.',
        'The second instinct is to remove the protected attribute (race, gender, age) and assume the model cannot discriminate. This is called "fairness through unawareness." It fails because other features correlate with the removed attribute. Zip code proxies for race in many US datasets. Job title proxies for gender. Without the group label, the team cannot even measure whether harm concentrates. Blindness prevents auditing more than it prevents discrimination.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that there is no single number called "fairness." Chouldechova (2017) and Kleinberg, Mullainathan, and Raghavan (2016) proved independently that when base rates differ between groups, you cannot simultaneously achieve calibration, equal false positive rates, and equal false negative rates, except in degenerate cases (perfect prediction or equal base rates). This is not a software limitation. It is a mathematical impossibility.',
        'This means every fairness audit is a policy choice disguised as a technical one. The team must decide which errors matter more, for whom, and under what constraints. A pretrial risk tool that equalizes false positive rates will have unequal false negative rates when base rates differ. A hiring screen that equalizes selection rates may sacrifice calibration. The wall forces you to name the tradeoff instead of pretending one metric covers all harms.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Each fairness metric is a conditional rate with a specific denominator. Demographic parity conditions on all members of a group: P(Y_hat=1 | G=a) = P(Y_hat=1 | G=b). Equalized odds conditions on the true label: P(Y_hat=1 | Y=y, G=a) = P(Y_hat=1 | Y=y, G=b) for y in {0,1}. Equal opportunity is the special case where y=1 only, asking whether qualified positives are found at the same rate. Calibration conditions on the predicted score: P(Y=1 | S=s, G=a) = P(Y=1 | S=s, G=b), asking whether a score of 0.7 means the same thing in both groups.',
        'The denominator encodes a value judgment. Demographic parity says the system\'s outputs should look the same across groups regardless of inputs. Equalized odds says errors should be distributed equally given the truth. Calibration says the score should mean what it says. These are different ethical commitments, not interchangeable dashboard options. A hiring screen that prioritizes equal opportunity cares most about not missing qualified candidates. A bail algorithm that prioritizes calibration cares that a "low risk" label carries the same meaning for everyone.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A fairness audit begins with the standard confusion matrix, then repeats it per group. For a binary classifier with two groups, that means two 2x2 matrices: one for group A, one for group B. Each matrix yields counts (true positives, false positives, true negatives, false negatives) and rates (TPR = TP/(TP+FN), FPR = FP/(FP+TN), precision = TP/(TP+FP), selection rate = (TP+FP)/total). The audit compares these rates across groups.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Confusion_Matrix_Metrics.png/250px-Confusion_Matrix_Metrics.png', alt: 'Confusion matrix metrics showing accuracy, precision, recall, and specificity', caption: 'Most group fairness metrics are rates computed from confusion-matrix cells, then compared across slices. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Confusion_Matrix_Metrics.png'},
        'Comparison is where the metric definition matters. Equal opportunity checks whether TPR_A equals TPR_B. Equalized odds checks both TPR and FPR. Demographic parity checks selection rates. Calibration bins scores into bands (say 0.0-0.1, 0.1-0.2, ...) and checks whether the empirical positive rate in each band matches across groups. The same dataset can satisfy one definition while violating another.',
        'The main intervention is threshold adjustment. A single threshold produces different error rates when groups have different score distributions. A group-specific threshold can close a TPR gap but changes precision and selection rates simultaneously. Some equalized-odds methods use randomized decisions: for a given score, the classifier flips a coin to reach the target error-rate pair. This satisfies the statistical constraint but raises product questions about whether individual decisions should depend on randomness.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Decomposing a global metric into per-group rates works because it replaces a vague claim ("the model is fair") with a falsifiable statement ("TPR differs by at most 2 percentage points across groups"). Teams can test that statement, track it over time, and hold themselves accountable to it. The confusion matrix is the right substrate because every binary fairness metric is a ratio of its cells.',
        'The impossibility results work in the team\'s favor, not against it. They force the conversation from "which metric is correct" to "which harm are we prioritizing and why." That question has no technical answer; it requires stakeholder input, legal review, and a written policy. The framework succeeds precisely because it makes the tradeoff visible rather than hiding it inside a single score.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Computing fairness metrics adds negligible runtime cost. The confusion matrix is O(n) in the number of predictions, and slicing by group is a single pass with a hash map. Calibration binning is also O(n). The computational cost is not the bottleneck.',
        'The real costs are data and governance. Group labels must be collected, stored, and protected. Reliable outcome labels require follow-up: did the approved loan default? Did the hired candidate succeed? That feedback loop can take months or years. If the historical labels were produced by an unfair process (biased hiring panels, discriminatory policing), equalizing error rates against those labels can reproduce the old bias. Teams need enough samples per group-slice to produce stable estimates. With 50 members of an intersectional subgroup, a 95% confidence interval on TPR can span 30 percentage points, making any gap claim statistically meaningless.',
        'Threshold interventions carry performance costs. Closing a 10-point TPR gap by lowering the threshold for one group increases that group\'s false positive rate. Removing a proxy feature can reduce one discrimination pathway while losing predictive signal that helped both groups. A defer-to-human policy can reduce automated harm but adds latency, cost, and inconsistency from human judgment.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'In lending, the Equal Credit Opportunity Act requires that creditworthy applicants not be denied on the basis of protected characteristics. Lenders audit false denial rates (FNR) by race and gender, calibration of risk scores, and selection-rate ratios. A 4:5 selection-rate ratio (the "four-fifths rule") has been used as an adverse-impact threshold by the EEOC since 1978, though it is a heuristic, not a mathematical guarantee of fairness.',
        'In criminal justice, the COMPAS recidivism tool became a case study after ProPublica (2016) showed it had higher false positive rates for Black defendants than white defendants. Northpointe (now Equivant) responded that the tool was calibrated: a score of 7 meant the same recidivism probability regardless of race. Both claims were correct. The conflict is a direct instance of the Chouldechova/Kleinberg impossibility when base rates differ.',
        'In healthcare, Obermeyer et al. (2019) found that a widely used algorithm assigned lower risk scores to Black patients than equally sick white patients because it used healthcare spending as a proxy for health need. Spending reflects access, not illness severity. The fix was to change the label (predict health, not cost), not to post-process the threshold. This illustrates that metric choice alone cannot fix a biased label.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Fairness metrics fail when the label itself is biased. Equalizing TPR against a label that encodes historical discrimination (arrest records reflecting biased policing, hiring labels reflecting biased panels) locks in the old pattern. The metrics assume the label represents ground truth. When it does not, satisfying any metric can be harmful.',
        'They fail when groups are too small or too many. Intersectional audits (race x gender x age x disability) produce exponentially many slices, each with fewer samples. Confidence intervals widen, and the probability of a false alarm (detecting a "gap" that is noise) grows with the number of comparisons. Multiple-testing corrections help but reduce power to detect real gaps.',
        'They fail when fairness is causal, not statistical. A feature can be statistically neutral but causally unfair: if a zip code enters the model through a path that traces back to redlining, removing the correlation without removing the causal path does not fix the unfairness. Causal fairness (Kilbertus et al. 2017, Kusner et al. 2017) requires a causal graph and assumptions about which paths are acceptable. Statistical metrics cannot distinguish fair paths from unfair ones.',
        'They fail when the system is more than the model. A model with perfect equalized odds is still unfair if rejected applicants from one group have no appeal mechanism, no explanation, and no way to correct erroneous input data. Fairness is a property of the decision system, not just the classifier.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A bank builds a loan-approval model. Test set: 1,000 group-A applicants (600 creditworthy, 400 not) and 1,000 group-B applicants (400 creditworthy, 600 not). The model uses a single threshold of 0.5 on the predicted probability of repayment.',
        'Group A results at threshold 0.5: 510 approved (480 TP + 30 FP), 490 denied (120 FN + 370 TN). TPR = 480/600 = 80%. FPR = 30/400 = 7.5%. Selection rate = 510/1000 = 51%. Precision = 480/510 = 94.1%.',
        'Group B results at threshold 0.5: 250 approved (220 TP + 30 FP), 750 denied (180 FN + 570 TN). TPR = 220/400 = 55%. FPR = 30/600 = 5%. Selection rate = 250/1000 = 25%. Precision = 220/250 = 88%.',
        'Demographic parity check: selection rates are 51% vs 25%. The ratio is 25/51 = 0.49, well below the four-fifths threshold of 0.80. Fails. Equal opportunity check: TPR is 80% vs 55%, a 25-point gap. Creditworthy group-B applicants are denied at nearly double the rate. Fails. Equalized odds: TPR differs by 25 points, FPR differs by 2.5 points. Fails on TPR. Calibration: among applicants scored 0.5, if 75% of group-A applicants repay and 75% of group-B applicants repay, calibration holds. It is possible to be calibrated while violating equalized odds, and this example shows exactly that.',
        'If the bank lowers group B\'s threshold to 0.4, suppose TPR rises to 78% (closing the gap) but FPR rises to 12% and precision drops to 79%. The TPR gap shrinks from 25 points to 2, but now more non-creditworthy group-B applicants receive loans they may default on. The tradeoff is real: closing the equal-opportunity gap increases the default risk borne by the lender (and arguably by the borrowers who default). The right answer depends on the harm model the bank adopts.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Hardt, Price, and Srebro, "Equality of Opportunity in Supervised Learning" (2016): https://arxiv.org/abs/1610.02413 defines equalized odds and equal opportunity. Chouldechova, "Fair prediction with disparate impact" (2017): https://arxiv.org/abs/1703.09388 proves the impossibility theorem. Kleinberg, Mullainathan, and Raghavan, "Inherent Trade-Offs in the Fair Determination of Risk Scores" (2016): https://arxiv.org/abs/1609.05807 proves a parallel impossibility. Barocas, Hardt, and Narayanan, Fairness and Machine Learning: https://fairmlbook.org/ is the comprehensive textbook.',
        'Obermeyer et al., "Dissecting racial bias in an algorithm used to manage the health of populations" (Science, 2019) is the healthcare label-bias case study. Angwin et al., "Machine Bias" (ProPublica, 2016) is the COMPAS investigation. Corbett-Davies and Goel, "The Measure and Mismeasure of Fairness" (2018): https://arxiv.org/abs/1808.00023 surveys the landscape.',
        'Study Precision and Recall for confusion-matrix foundations, ROC-AUC for threshold geometry, Calibration Curves for score meaning, Threshold Optimization for post-processing mechanics, Causal Graphs for path-dependent fairness, and Data Leakage for proxy problems.',
      ],
    },
  ],
};
