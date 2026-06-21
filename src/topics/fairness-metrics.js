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
    explanation: 'The table splits the confusion matrix by group so the denominator is visible. False positive rates match, but group B has a much lower true positive rate, meaning qualified positives are missed more often. A global precision or recall score would average that harm away.',
    invariant: 'Fairness metrics are conditional rates; always ask what denominator they use.',
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
    explanation: 'Each metric conditions on a different population. Demographic parity looks at everyone in a group, equalized odds conditions on the true label, equal opportunity focuses on qualified positives, and calibration conditions on the score. The choice is a policy decision about which harm matters.',
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
    explanation: 'Moving thresholds changes which errors each group receives. A group-specific threshold can close the TPR gap, but it also changes selection rates, precision, and calibration. The visual is a tradeoff dial, not a free repair.',
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
    explanation: 'This checklist comes before metric choice. The harm model says which error matters, the label audit checks whether ground truth is trustworthy, base rates reveal possible conflicts, and the causal story guards against proxy paths.',
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
    explanation: 'The rows show why calibrated scores and equal selection can conflict when base rates differ. Forcing demographic parity may require different thresholds, while preserving score meaning may leave selection rates unequal.',
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
    explanation: 'The ROC plot shows feasible error-rate tradeoffs. Equalized odds asks both groups to land at the same TPR and FPR; if one curve dominates, the system may need randomization or reduced utility to hit the shared point.',
    invariant: 'Fairness constraints can redistribute errors; they do not erase model weakness.',
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
    explanation: 'The intervention table prevents a threshold-only mindset. Some gaps come from missing signal, biased labels, proxy leakage, or unfair causal paths, so the right fix may be data, measurement, causal correction, or product policy.',
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
    explanation: 'The reporting package links numbers to operations. Slice metrics expose harm, uncertainty sets show when to defer, and the decision policy explains human review, appeals, and drift response. A model card only helps if it changes decisions.',
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
      heading: "Why this exists",
      paragraphs: [
        "Fairness metrics exist because a model can look good on average while failing a particular group. Global accuracy, AUC, loss, or precision can hide who receives false positives, false negatives, bad calibration, low coverage, or no useful path to appeal. The metric has to be sliced before the harm is visible.",
        {
          type: "callout",
          text: "Fairness metrics are denominator choices: each metric names which group bears which kind of error.",
        },
        "This is separate from privacy, robustness, and security. A private model can still be unfair. A robust model can still assign one group more false negatives. A calibrated model can still have unequal error rates. A model with equal selection rates can still be wrong for one group. Fairness is not a bonus dashboard; it is a question about who bears the system's mistakes.",
      ],
    },
    {
      heading: "The naive approach",
      paragraphs: [
        "The naive approach is one global metric and one global threshold. If the model reaches the target AUC or accuracy, the team ships. That is attractive because it is simple, but it averages away the denominator. One group may have high recall while another group has qualified people missed at twice the rate.",
        "Another naive approach is to remove the protected attribute and assume the model is now fair. That can make the audit worse. Other features may proxy for the protected attribute, and without group labels the team may be unable to measure whether harms are concentrated. Blindness is not the same as fairness.",
      ],
    },
    {
      heading: "The core insight",
      paragraphs: [
        "The core insight is that fairness metrics are conditional rates. Each one asks about a different denominator. Demographic parity conditions on all people in a group and asks whether selection rates match. Equalized odds conditions on the true label and asks whether true positive and false positive rates match. Equal opportunity focuses on true positive rates among qualified positives. Calibration conditions on the score and asks whether the score means the same thing for each group.",
        "Because the denominators differ, the metrics encode different values. A hiring screen may care most about qualified people being missed. A pretrial risk tool may care intensely about false positives. A medical triage model may need calibration because clinicians interpret risk scores. Metric choice should follow the harm model, not fashion.",
      ],
    },
    {
      heading: "How the mechanism works",
      paragraphs: [
        "A fairness audit starts with a normal confusion matrix, then repeats it by group and often by intersectional slices. For each group, compute counts and rates: true positives, false positives, true negatives, false negatives, selection rate, precision, recall, false positive rate, false negative rate, calibration by score band, and coverage for any defer or abstain option.",
        {
          type: "image",
          src: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Confusion_Matrix_Metrics.png/250px-Confusion_Matrix_Metrics.png",
          alt: "Confusion matrix metrics showing accuracy, precision, recall, and specificity",
          caption: "Most group fairness metrics are rates computed from confusion-matrix cells, then compared across slices. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Confusion_Matrix_Metrics.png",
        },
        "The next step is comparison. Equal opportunity compares TPR across groups. Equalized odds compares both TPR and FPR. Demographic parity compares selection rates. Calibration compares empirical outcomes within score bands. The same table can support several definitions, but the interpretation changes with the denominator.",
        "Thresholds are a common intervention. A group-specific threshold can close a TPR gap, but it may change precision, selection rate, and calibration. Some equalized-odds procedures also use randomized decisions to reach a shared error-rate point. That can satisfy a statistical constraint while creating product and governance questions.",
      ],
    },
    {
      heading: "What the visual is proving",
      paragraphs: [
        "The confusion-by-group view proves that the denominator is the first thing to inspect. In the displayed example, false positive rates match while true positive rates differ. A global score would miss the fact that qualified positives in one group are being rejected more often.",
        "The metric table proves that fairness words are not interchangeable. Demographic parity, equalized odds, equal opportunity, and calibration each condition on a different population. The threshold and ROC visuals prove that fairness constraints move errors around. They are not a free repair button; they are a way to make a chosen tradeoff explicit.",
      ],
    },
    {
      heading: "Why it works",
      paragraphs: [
        "The method works because it turns an abstract fairness debate into measurable questions. Who was selected? Who was rejected? Among people who truly qualified, who was missed? Among people who did not qualify, who was falsely selected? Among people with the same score, did outcomes occur at the same rate?",
        "It also works because it forces the policy question into the open. If two groups have different base rates, calibration, demographic parity, and equalized error rates may not all hold at once. That is not a dashboard bug. It means the organization must decide which harm it is minimizing and what cost it is willing to pay.",
      ],
    },
    {
      heading: "Costs and tradeoffs",
      paragraphs: [
        "Fairness audits require data that many teams do not have cleanly: group labels, reliable outcome labels, enough sample size per slice, and a decision log that says what the model actually changed. If groups are small or intersectional, confidence intervals can be wider than the gap the team is trying to interpret.",
        "The hardest cost is label governance. If the historical outcome was produced by an unfair process, equalizing error rates against that label can preserve the old process. If protected attributes are unavailable, the team may be unable to audit harm. If protected attributes are available, the team must protect them and explain how they are used.",
        "There are performance tradeoffs too. A threshold change can improve one metric while reducing precision or calibration. Removing a proxy feature can reduce discrimination through one path while removing useful signal. A defer-to-human policy can reduce automated harm while increasing delay, cost, and inconsistent human judgment.",
      ],
    },
    {
      heading: "Real uses",
      paragraphs: [
        "Fairness metrics are used in lending, hiring, housing, insurance, education, fraud review, content moderation, medical triage, recommender systems, and language-model evaluation. The specific metric depends on the decision. A loan model may inspect approval rates, repayment prediction, false denial of creditworthy applicants, and calibration by score band. A medical model may care about missed positives and whether a risk score means the same thing across groups.",
        "A serious report shows several metrics together instead of pretending one is universal. It pairs global performance with slice metrics, uncertainty intervals, threshold policy, coverage or abstention rates, appeal outcomes, drift monitoring, and a statement of which errors are most harmful. The model card matters only if it changes decisions.",
      ],
    },
    {
      heading: "Failure modes and limits",
      paragraphs: [
        "There is no single fairness number. Metrics can conflict, labels can be biased, and groups can be too small for stable estimates. A model can satisfy demographic parity while making poor predictions for everyone. It can be calibrated while imposing unequal false negative rates. It can equalize an error rate while relying on an unfair label.",
        "Fairness is also not only a model property. Product recourse, human review, appeals, monitoring, explanation, data collection, and who bears the cost of mistakes are part of the system. If rejected users have no path to correct bad data, a clean metric table will not make the product fair.",
        "Causal structure matters. A feature can be unacceptable because of how it was caused, not only because of its correlation. Removing a sensitive attribute while keeping proxies may leave the unfair path intact. Correcting that requires causal assumptions, domain knowledge, and policy judgment, not just post-processing.",
      ],
    },
    {
      heading: "Study next",
      paragraphs: [
        "Primary sources: Equality of Opportunity in Supervised Learning at https://arxiv.org/abs/1610.02413 and the NeurIPS PDF at https://papers.neurips.cc/paper/6374-equality-of-opportunity-in-supervised-learning.pdf, plus Fairness and Machine Learning at https://fairmlbook.org/. Read them with one question in mind: which denominator matches the harm?",
        "Study Precision and Recall for confusion-matrix basics, ROC-AUC for threshold movement, Calibration Curves for score meaning, Threshold Optimization for post-processing, Causal Graphs for path-dependent fairness, Data Leakage for proxy problems, Conformal Prediction for defer and coverage behavior, and Differential Privacy SGD for why privacy and fairness remain separate guarantees.",
      ],
    },
  ],
};
