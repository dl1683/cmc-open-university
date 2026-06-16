// Synthetic control: choose donor weights that match pre-treatment history,
// then read the post-treatment gap as a comparative case-study estimate.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'synthetic-control-donor-weights-case-study',
  title: 'Synthetic Control Donor Weights',
  category: 'Concepts',
  summary: 'Build a weighted donor unit that matches pre-treatment history, then compare the treated unit against its synthetic counterfactual.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['donor weights', 'placebo test'], defaultValue: 'donor weights' },
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

function synthGraph(title) {
  return graphState({
    nodes: [
      { id: 'treated', label: 'treated', x: 0.75, y: 3.2, note: 'unit' },
      { id: 'donors', label: 'donors', x: 2.25, y: 3.2, note: 'pool' },
      { id: 'pre', label: 'pre-fit', x: 3.8, y: 2.0, note: 'match' },
      { id: 'opt', label: 'weights', x: 5.35, y: 3.2, note: 'simplex' },
      { id: 'synthetic', label: 'synth', x: 6.85, y: 3.2, note: 'donor mix' },
      { id: 'post', label: 'post', x: 8.15, y: 2.0, note: 'gap' },
      { id: 'placebo', label: 'placebo', x: 8.15, y: 4.4, note: 'tests' },
    ],
    edges: [
      { id: 'e-treated-pre', from: 'treated', to: 'pre' },
      { id: 'e-donors-pre', from: 'donors', to: 'pre' },
      { id: 'e-pre-opt', from: 'pre', to: 'opt' },
      { id: 'e-opt-synth', from: 'opt', to: 'synthetic' },
      { id: 'e-treated-post', from: 'treated', to: 'post' },
      { id: 'e-synth-post', from: 'synthetic', to: 'post' },
      { id: 'e-synth-placebo', from: 'synthetic', to: 'placebo' },
    ],
  }, { title });
}

function* donorWeights() {
  yield {
    state: synthGraph('Synthetic control builds a counterfactual unit'),
    highlight: { active: ['treated', 'donors', 'pre'], compare: ['post'] },
    explanation: 'When one state, city, store, or country receives a treatment, there may be no single good control. Synthetic control builds a weighted mixture of donor units that matches the treated unit before treatment.',
  };

  yield {
    state: labelMatrix(
      'Donor weight vector',
      [
        { id: 'd1', label: 'Nevada' },
        { id: 'd2', label: 'Utah' },
        { id: 'd3', label: 'Colorado' },
        { id: 'd4', label: 'Oregon' },
      ],
      [
        { id: 'weight', label: 'weight' },
        { id: 'role', label: 'role' },
      ],
      [
        ['0.42', 'major donor'],
        ['0.31', 'major donor'],
        ['0.18', 'minor donor'],
        ['0.09', 'minor donor'],
      ],
    ),
    highlight: { active: ['d1:weight', 'd2:weight'], compare: ['d4:weight'] },
    explanation: 'The weights are nonnegative and sum to one. That simplex constraint keeps the synthetic control inside the donor pool rather than allowing arbitrary extrapolation.',
    invariant: 'Good synthetic controls earn trust in the pre-treatment period.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'year index', min: 0, max: 6 }, y: { label: 'outcome', min: 40, max: 90 } },
      series: [
        { id: 'treated', label: 'treated', points: [{ x: 0, y: 62 }, { x: 1, y: 64 }, { x: 2, y: 66 }, { x: 3, y: 65 }, { x: 4, y: 58 }, { x: 5, y: 54 }, { x: 6, y: 52 }] },
        { id: 'synth', label: 'synthetic', points: [{ x: 0, y: 61 }, { x: 1, y: 65 }, { x: 2, y: 65 }, { x: 3, y: 66 }, { x: 4, y: 67 }, { x: 5, y: 69 }, { x: 6, y: 70 }] },
      ],
    }),
    highlight: { active: ['treated'], compare: ['synth'] },
    explanation: 'The pre-treatment lines track closely. After treatment, the treated unit falls away from the synthetic counterfactual. The vertical gap is the estimated effect path.',
  };

  yield {
    state: labelMatrix(
      'Pre-fit diagnostics',
      [
        { id: 'trend', label: 'pre trend' },
        { id: 'level', label: 'level' },
        { id: 'covars', label: 'covars' },
        { id: 'donors', label: 'donors' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['small RMSPE', 'bad fit'],
        ['matched', 'offset'],
        ['balanced', 'missing X'],
        ['plausible', 'bad pool'],
      ],
    ),
    highlight: { found: ['trend:check', 'level:check', 'covars:check'], compare: ['donors:risk'] },
    explanation: 'Synthetic control is only persuasive when the donor mixture matches the treated unit before intervention. A bad pre-fit means the post-treatment gap is not credible.',
  };

  yield {
    state: synthGraph('The post-treatment gap is the case-study estimate'),
    highlight: { active: ['synthetic', 'post', 'treated'], found: ['opt'] },
    explanation: 'The method packages the counterfactual as a data structure: donor pool, weight vector, pre-fit diagnostics, post-gap series, and placebo checks.',
  };
}

function* placeboTest() {
  yield {
    state: labelMatrix(
      'Placebo gaps compare treated against donors',
      [
        { id: 'treated', label: 'treated' },
        { id: 'p1', label: 'placebo A' },
        { id: 'p2', label: 'placebo B' },
        { id: 'p3', label: 'placebo C' },
      ],
      [
        { id: 'pre', label: 'pre RMSPE' },
        { id: 'post', label: 'post gap' },
        { id: 'rank', label: 'rank' },
      ],
      [
        ['1.2', '-18', 'largest'],
        ['1.4', '-4', 'small'],
        ['1.1', '3', 'small'],
        ['3.8', '-20', 'bad prefit'],
      ],
    ),
    highlight: { active: ['treated:post', 'treated:rank'], compare: ['p3:pre'], removed: ['p3:rank'] },
    explanation: 'Placebo tests rerun the method as if each donor had been treated. A large treated gap is more meaningful if donors with good pre-fit do not show similarly large placebo gaps.',
  };

  yield {
    state: synthGraph('Placebo inference reuses the same construction'),
    highlight: { active: ['placebo', 'synthetic', 'post'], compare: ['treated'] },
    explanation: 'Synthetic control inference is often permutation-style. Move the treatment label through donor units and compare gaps, while treating bad pre-treatment fits cautiously.',
  };

  yield {
    state: labelMatrix(
      'Complete case: policy launch',
      [
        { id: 'pool', label: 'donor pool' },
        { id: 'fit', label: 'pre fit' },
        { id: 'effect', label: 'effect' },
        { id: 'placebo', label: 'placebos' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['eligible', 'exclude'],
        ['low error', 'needed'],
        ['post gap', 'estimate'],
        ['rare gap', 'support'],
      ],
    ),
    highlight: { active: ['fit:lesson', 'effect:lesson', 'placebo:lesson'], compare: ['pool:state'] },
    explanation: 'Case study: one region launches a policy. Instead of choosing one neighboring region, the analyst builds a donor-weight vector that matches pre-policy outcomes and reports placebo ranks for context.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'spill', label: 'spillover' },
        { id: 'shock', label: 'donor shock' },
        { id: 'badfit', label: 'bad prefit' },
        { id: 'cherry', label: 'cherry pick' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'defense', label: 'defense' },
      ],
      [
        ['donor hit', 'exclude'],
        ['placebo gap', 'audit'],
        ['gap before', 'reject'],
        ['many tries', 'pre-register'],
      ],
    ),
    highlight: { active: ['spill:defense', 'badfit:defense'], removed: ['cherry:defense'] },
    explanation: 'Synthetic control is a design, not a graphing trick. The donor pool, pre-period, predictors, and placebo rules must be defensible before the post-treatment outcome is inspected too aggressively.',
  };

  yield {
    state: synthGraph('Synthetic controls sit between DiD and matching'),
    highlight: { active: ['pre', 'opt', 'synthetic'], found: ['placebo'], compare: ['donors'] },
    explanation: 'Difference-in-Differences borrows a slope from a control group. Synthetic control constructs a whole control trajectory from weighted donors. Both rest on a counterfactual trend assumption.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'donor weights') yield* donorWeights();
  else if (view === 'placebo test') yield* placeboTest();
  else throw new InputError('Pick a synthetic control view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Synthetic control is a comparative case-study method for estimating the effect of an intervention on one treated unit. It builds a weighted combination of untreated donor units that matches the treated unit before intervention, then treats that weighted mixture as the counterfactual path.',
        'The core data structure is the donor-weight vector plus its diagnostics: donor pool, pre-treatment fit, post-treatment gaps, and placebo gaps. It is a structured alternative to picking one control unit by intuition.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose a donor pool of untreated units. Optimize nonnegative weights that sum to one so the weighted donor history matches the treated unit in the pre-treatment period, often using both outcomes and covariates. After treatment, compare the treated outcome to the synthetic outcome period by period.',
        'Placebo tests rerun the method by pretending each donor was treated. If the actual treated unit has a much larger post-treatment gap than placebo units with good pre-fit, the causal story becomes more credible.',
      ],
    },
    {
      heading: 'Complete case study: regional policy launch',
      paragraphs: [
        'A state launches a tobacco-control policy. No single other state has the same pre-policy trajectory. Synthetic control creates a weighted donor state from several untreated states that together match the pre-policy trend. After the policy begins, the treated state falls below its synthetic counterfactual.',
        'The analyst reports the donor weights, pre-treatment RMSPE, post-treatment gap path, and placebo ranks. A large post-gap with poor pre-fit would not be persuasive; a large post-gap with strong pre-fit and weak placebo gaps is more compelling.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Synthetic control does not prove causality by itself. It assumes the weighted donor trajectory is a credible counterfactual absent treatment. Spillovers, donor shocks, cherry-picked predictors, short pre-periods, and bad pre-fit all weaken the design.',
        'The simplex weight constraint is a feature: it limits extrapolation. If the treated unit is outside the donor pool support, forcing a synthetic match can still fail. Report the donor pool and pre-fit, not just the final chart.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Abadie, Diamond, and Hainmueller synthetic control paper at https://economics.mit.edu/sites/default/files/publications/Synthetic%20Control%20Methods.pdf and the NBER working paper at https://www.nber.org/system/files/working_papers/w12831/w12831.pdf. Study Difference-in-Differences, Propensity Score Overlap Diagnostics, Causal Graphs, Instrumental Variables, and Regression Discontinuity next.',
      ],
    },
  ],
};
