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
    explanation: 'Fairness audits usually start by splitting errors by group. Here the false positive rates match, but group B has a much lower true positive rate. A global Precision/Recall score would hide that harm.',
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
    explanation: 'The metrics encode different moral and operational commitments. Demographic parity cares about selection rates. Equalized odds cares about error rates by true label. Calibration cares whether a score means the same thing across groups.',
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
    explanation: 'Post-processing can adjust thresholds to target equal opportunity or equalized odds. That may improve one fairness metric while changing selection rates, precision, or calibration.',
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
    explanation: 'A metric is not a substitute for problem definition. You need the harm model, label audit, base-rate context, and causal story before deciding what fairness constraint is appropriate.',
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
    explanation: 'When base rates differ, you usually cannot satisfy all intuitive fairness definitions at once. This is not a dashboard bug; it is a mathematical and policy tradeoff.',
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
    explanation: 'Equalized odds asks groups to have the same TPR and FPR. If one ROC curve dominates another, meeting the constraint may require randomization or accepting lower utility for the stronger group.',
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
    explanation: 'Fairness work is not only threshold tuning. Sometimes the right answer is better labels, better measurement, causal adjustment, more representative data, or product-policy changes.',
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
    explanation: 'A serious fairness report connects metrics to decision rights. Who is harmed, what recourse exists, and how will drift be detected? The model card is only useful if it changes operations.',
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
      heading: 'What it is',
      paragraphs: [
        'Fairness metrics compare model behavior across protected or operationally important groups. The core idea is simple: global accuracy can improve while one group receives more false negatives, more false positives, worse calibration, or less useful uncertainty estimates.',
        'The local privacy-preserving ML notes mention fairness metrics because privacy, robustness, and fairness are separate guarantees. A private model can still be unfair. A calibrated model can still have unequal error rates. A model with equal selection rates can still be inaccurate for one group.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Demographic parity asks for equal selection rates across groups. Equalized odds asks for equal true positive and false positive rates. Equal opportunity relaxes equalized odds by focusing on true positive rates among qualified positives. Calibration by group asks whether a score has the same empirical meaning across groups.',
        'These metrics use different denominators and encode different values. If base rates differ, some fairness definitions can conflict. That is why metric choice must follow the harm model, not fashion.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Fairness audits require group labels, reliable outcome labels, enough sample size per slice, drift monitoring, and decision-policy clarity. Threshold adjustments may improve one metric while reducing precision, calibration, or utility. Removing a sensitive attribute may not help if proxies remain, and it can make auditing impossible.',
        'The hardest part is often label governance. If the historical outcome was produced by an unfair process, equalizing error rates against that label may preserve the old process. If protected attributes are unavailable, the team may be unable to audit harms. If groups are intersectional and small, confidence intervals matter as much as point estimates.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Fairness metrics are used in lending, hiring, moderation, medical triage, education, insurance, fraud review, recommender systems, and language-model evaluations. They connect to Causal Graphs, Threshold Optimization, Calibration Curves, Conformal Prediction, Data Leakage, and Differential Privacy SGD.',
        'A good audit reports several metrics together rather than pretending one is universal. For example, a loan model might report approval rate, true positive rate among repayers, false positive rate among defaulters, calibration by score band, appeal outcomes, and coverage of conformal uncertainty sets. The decision-maker then has to choose which harms the system is allowed to trade.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'There is no single fairness number. Metrics can conflict, labels can be biased, and groups can be too small for stable estimates. Fairness is also not only a model property. Product recourse, human review, appeals, monitoring, and who bears the cost of mistakes are part of the system.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Equality of Opportunity in Supervised Learning at https://arxiv.org/abs/1610.02413 and the NeurIPS PDF at https://papers.neurips.cc/paper/6374-equality-of-opportunity-in-supervised-learning.pdf, plus Fairness and Machine Learning at https://fairmlbook.org/. Study Precision/Recall, ROC-AUC, Calibration Curves, Threshold Optimization, Causal Graphs, and Conformal Prediction next.',
      ],
    },
  ],
};
