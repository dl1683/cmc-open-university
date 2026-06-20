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
      heading: 'Why this exists',
      paragraphs: [
        'Synthetic control exists for interventions that happen to one visible unit instead of many randomly assigned units. A state passes a law, a city changes policing policy, a platform launches a market rule, or one store receives a new operating model. The analyst still needs a counterfactual: what would the treated unit have looked like if the intervention had not happened?',
        'The constraint is that no untreated unit is usually a perfect comparison. A neighboring state may share geography but not history. A similar store may share size but not demand mix. A country may share region but not institutions. Synthetic control answers by building a comparison unit from weighted untreated donors, then asking whether that weighted unit tracked the treated unit before the intervention.',
        'The output is not only a chart. A serious synthetic-control design produces a donor pool, a weight vector, pre-treatment fit diagnostics, a post-treatment gap path, placebo comparisons, and sensitivity checks. Those objects make the estimate inspectable. Without them, the method collapses into a line chart with causal language attached.',
        {type:'callout', text:'The donor-weight vector is the causal design object because it turns a missing counterfactual into an auditable mix of real untreated histories.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/c/c4/SCMGermany.png', alt:'Line chart comparing West Germany GDP with a synthetic counterfactual around reunification.', caption:'Synthetic control comparison for German reunification. Image: SCMGermany.png, Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable approach is before-after comparison. Measure the treated unit before the policy, measure it after the policy, and call the difference the effect. This is simple and sometimes useful when the outside world is stable. It fails when broader trends, recessions, seasonality, product cycles, demographic change, or measurement changes move the outcome at the same time.',
        'The next reasonable approach is to choose one control unit. Pick a neighboring state, a similar city, or the most comparable store, then subtract its trend. That is not a foolish baseline. If one untreated unit already matches the treated unit across the pre-treatment period, a single comparison can be transparent and easy to explain.',
        'The problem is that single controls often match one dimension and miss another. A neighboring region can have a different baseline level. A similar baseline unit can have a different trend. A unit with the right trend can face a shock of its own. The analyst needs a way to use the best pieces of several donors without pretending that any one donor is the missing treated path.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is pre-treatment mismatch. If the comparison unit was already higher, lower, faster-growing, or exposed to different shocks before treatment, the post-treatment gap mixes treatment effect with counterfactual error. A dramatic post-treatment gap is not persuasive if the comparison was already drifting away before treatment.',
        'The wall also includes analyst freedom. If donors, predictors, pre-periods, exclusions, and reporting choices are adjusted after seeing the post-treatment outcome, the final estimate can become a story selected from many attempts. Synthetic control looks quantitative, but it still needs design discipline before the outcome period is inspected too aggressively.',
        'The geometric version of the wall is support. If the treated unit lies outside what donor mixtures can reproduce, the optimizer cannot create a credible counterfactual by force. A low numerical error from a strange donor pool, a very short pre-period, or many tuned predictors may be overfit rather than evidence.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that a convex mixture of untreated donors can be a better counterfactual than any single untreated donor. The weights are nonnegative and sum to one, so the synthetic unit stays inside the donor pool. That constraint matters because it limits extrapolation. The method is saying, "this treated unit looked like this weighted combination of real untreated units before treatment."',
        'The donor-weight vector is the central data structure. It binds donor identity, weight, pre-treatment fit, predictor balance, and post-treatment comparison into one auditable object. A donor with weight zero is still part of the design because it was eligible and rejected by the fit. A donor with high weight deserves extra scrutiny because it carries much of the counterfactual.',
        'The method changes the causal question from "which untreated unit should we trust?" to "can a transparent donor mixture reproduce the treated unit before treatment, and is the later gap unusual compared with the same construction on untreated units?"',
      ],
    },
    {
      heading: 'How the construction works',
      paragraphs: [
        'Start by defining the treated unit, intervention date, outcome, and eligible donor pool. Donors should be untreated during the study window and should not be exposed to spillovers from the intervention. This step is design work, not optimization. A bad donor pool cannot be rescued by a clean weight vector.',
        'Next choose pre-treatment outcome periods and predictors that should matter for the missing untreated path. The optimizer searches for donor weights that make the weighted donor history resemble the treated history before intervention. The exact optimization can vary, but the visible contract is stable: weights must be nonnegative, must sum to one, and should create a synthetic pre-period that tracks the treated unit closely.',
        'After fitting, compute the post-treatment gap: treated outcome minus synthetic outcome at each post-treatment time. The gap is a path, not just one number. A temporary dip, delayed effect, level shift, or trend break tells a different story. Good reports show the whole path and the pre-period fit on the same scale.',
        'Placebo tests rerun the same construction as if each donor had been treated. Donors with poor pre-treatment fit are usually interpreted cautiously or excluded from rank comparisons. The treated gap is more persuasive when it is large relative to placebo gaps among units that the method could fit well before treatment.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The donor-weights view shows that the synthetic unit is a construction, not a found object. Nevada, Utah, Colorado, and Oregon do not become one real state. Their weighted outcome history becomes the comparison trajectory. The simplex constraint keeps that trajectory inside the donor evidence rather than letting the model invent negative donors or extreme extrapolation.',
        'The pre-fit plot shows the credibility gate. Before treatment, the treated and synthetic lines should be close. After treatment, the vertical distance is the estimated effect path. If a visible gap already exists before treatment, the later gap loses force because the comparison was not earning trust.',
        'The placebo view shows the second gate. A large treated gap matters only in context. If many untreated donors produce gaps as large as the treated unit under the same procedure, then the method is detecting volatility, donor shocks, or weak fit rather than a distinctive treatment effect.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works when pre-treatment similarity is evidence about the missing untreated path. If a weighted mixture of donors reproduces the treated unit across levels, trends, and important predictors before intervention, it is more plausible that the same mixture approximates the untreated path after intervention. The argument is not that matching guarantees truth. It is that the pre-period gives an observable test of the counterfactual model before the causal gap is read.',
        'The convex-weight constraint is part of the credibility argument. Negative weights or weights that do not sum to one can sometimes improve numerical fit, but they make the comparison harder to defend because the synthetic path may rely on extrapolation outside the donor support. The classic formulation favors an interpretable weighted average of real untreated units.',
        'Placebo inference works as a calibration check. It asks whether the treated unit looks unusual under the same procedure applied to units that should not have treatment effects. Placebos do not prove causality, but they expose whether the method tends to generate large gaps even when the treatment label is fake.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The computational cost is usually modest for the case-study settings where synthetic control is common. It grows with donor count, predictor count, and pre-treatment periods. The practical cost is design and sensitivity work. The analyst must justify donor eligibility, predictor choices, pre-period length, treatment timing, and exclusion rules.',
        'The statistical cost is overfit. A short pre-period, too many predictors, or a large flexible donor pool can produce a clean-looking pre-fit that does not generalize. Pre-treatment RMSPE helps, but it is not enough. The time plot, donor weights, leave-one-out checks, and placebo distribution all matter.',
        'When the donor pool doubles, the optimizer has more ways to match history. That can improve fit, but it can also increase design risk if many donors are weakly comparable. More donors are useful only when they are plausible untreated alternatives, not when they are added to search for a better-looking chart.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Spillover is the clearest failure. If the treated policy affects donors through migration, markets, media, supply chains, or neighboring behavior, the synthetic control is partly treated. The post-gap then understates or distorts the effect because the comparison path moved too.',
        'Donor shocks are another failure. A donor that receives its own policy change, measurement change, recession shock, or reporting break can contaminate the weighted path. Placebo gaps and donor audits help detect this, but the safest defense is exclusion rules defined before fitting.',
        'Bad pre-fit should not be explained away. If the synthetic path does not track the treated unit before treatment, the design has not earned the right to interpret the post-treatment gap. The answer may be that the treated unit has no credible donor support for this question.',
        'Instrumentation failure is separate from causal failure. If the intervention changes measurement, reporting, sample composition, or data collection at the same time as the outcome, the gap may be a measurement artifact rather than a treatment effect.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'A good implementation stores the full design packet. Record donor eligibility rules, excluded units, intervention date, predictors, pre-period windows, outcome transformations, optimization settings, donor weights, pre-fit errors, post-gap values, placebo results, and sensitivity variants. The design should be replayable from raw data.',
        'Treat donor weights as evidence that needs review. A high-weight donor should be checked for hidden exposure to treatment, data breaks, and idiosyncratic shocks. A synthetic unit dominated by one donor may be close to a single-control design; a synthetic unit spread across many donors may be harder to explain but less dependent on one place.',
        'Pre-registering the broad design is valuable when stakes are high. At minimum, decide the donor pool, primary outcome, pre-period, and main diagnostics before treating the largest post-gap as the headline. The method is strongest when the conclusion survives reasonable perturbations rather than one hand-tuned specification.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A state launches a tax policy in 2010. No neighboring state is a convincing control by itself. The analyst builds a synthetic state from Nevada, Utah, Colorado, and Oregon using pre-2010 outcomes and predictors. Suppose the weights are 0.42, 0.31, 0.18, and 0.09. Those numbers are not decoration. They say exactly which untreated histories define the missing path.',
        'If the weighted mixture tracks the treated state closely through 2009, the post-2010 treated-minus-synthetic gap becomes the effect path to inspect. If the treated line falls while the synthetic line continues along the old trend, the design suggests a negative effect. If the gap fades after two years, the effect may be temporary. If the gap starts before 2010, the design is weak.',
        'Now run placebos. Pretend each donor was treated in 2010 and rebuild its synthetic control. If many donors show gaps as large as the treated state, the result is not distinctive. If the treated gap is much larger than placebo gaps among units with good pre-fit, the design has stronger support.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Abadie, Diamond, and Hainmueller synthetic control paper at https://economics.mit.edu/sites/default/files/publications/Synthetic%20Control%20Methods.pdf, the NBER working paper at https://www.nber.org/system/files/working_papers/w12831/w12831.pdf, and Abadie 2021 on feasibility and data requirements at https://conference.nber.org/confer/2021/SI2021/Abadie_2021.pdf.',
        'Study Difference-in-Differences for parallel-trend comparisons, Propensity Score Overlap Diagnostics for support and comparability, Causal Graphs for design assumptions, Instrumental Variables for different identification logic, Regression Discontinuity for threshold designs, and Placebo Testing for falsification habits.',
      ],
    },
  ],
};
