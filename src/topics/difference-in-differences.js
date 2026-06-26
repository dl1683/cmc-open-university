// Difference-in-differences: when a policy lands on one group and not
// another, two subtractions cancel everything fixed about places and times —
// the workhorse design behind half of applied economics, computed live.

import { matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'difference-in-differences',
  title: 'Difference-in-Differences',
  category: 'Concepts',
  summary: 'Subtract across time to kill place effects, subtract across places to kill time effects: the 2Ã—2 that recovers a known policy effect live — and the parallel-trends bet it rides on.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['the 2Ã—2 that cancels twice', 'parallel trends & where it breaks'], defaultValue: 'the 2Ã—2 that cancels twice' },
  ],
  run,
};

// A synthetic minimum-wage world (Card–Krueger shaped), fully known:
//   employment = base(state) + trend(period) + EFFECTÂ·(treated & after)
// base: NJ 78, PA 92 (PA permanently bigger — a level difference that must
// not contaminate the answer). trend: every state drifts âˆ’4 from a soft
// economy. TRUE policy effect: +3.
const TRUE_EFFECT = 3;
const BASE = { nj: 78, pa: 92 };
const TREND = -4;
const cell = (state, after, treated) => BASE[state] + (after ? TREND : 0) + (treated && after ? TRUE_EFFECT : 0);
const NJ_BEFORE = cell('nj', false, true);
const NJ_AFTER = cell('nj', true, true);
const PA_BEFORE = cell('pa', false, false);
const PA_AFTER = cell('pa', true, false);
const D_NJ = NJ_AFTER - NJ_BEFORE;
const D_PA = PA_AFTER - PA_BEFORE;
const DID = D_NJ - D_PA;

function table(title, rowDefs, colDefs, cellText) {
  let k = 0;
  const flat = [''];
  const values = rowDefs.map((_, r) => colDefs.map((__, c) => { flat.push(cellText[r][c]); k++; return k; }));
  return matrixState({
    title,
    rows: rowDefs.map(([id, label]) => ({ id, label })),
    columns: colDefs.map(([id, label]) => ({ id, label })),
    values,
    format: (v) => flat[v],
  });
}

function* twoByTwo() {
  yield {
    state: table('1992: New Jersey raises its minimum wage. Pennsylvania does not.', [
      ['naive1', 'naive comparison #1: NJ after vs NJ before'],
      ['naive2', 'naive comparison #2: NJ after vs PA after'],
      ['why', 'why both lie'],
    ], [['verdict', '']], [
      [`${NJ_AFTER} âˆ’ ${NJ_BEFORE} = ${D_NJ}: employment FELL after the raise — but a recession hit everyone that year, and this difference carries it`],
      [`${NJ_AFTER} âˆ’ ${PA_AFTER} = ${NJ_AFTER - PA_AFTER}: NJ employs fewer than PA — but NJ was always smaller; this difference carries the permanent gap`],
      ['each single subtraction removes ONE nuisance and keeps the other: before/after keeps the recession, across-states keeps the level gap. The design needs both subtractions at once'],
    ]),
    highlight: { removed: ['naive1:verdict', 'naive2:verdict'] },
    explanation: `The setting is the most famous natural experiment in economics (Card & Krueger, 1994): New Jersey raised its minimum wage while next-door Pennsylvania didn't — and this page rebuilds it as a synthetic world where the policy's TRUE effect on employment is exactly +${TRUE_EFFECT}, so every estimator can be audited. Both obvious comparisons fail, and the table computes how: comparing NJ to itself over time (${D_NJ}) blames the policy for that year's recession; comparing NJ to PA after the fact (${NJ_AFTER - PA_AFTER}) blames it for a size gap that predates the policy by decades. One difference is never enough when two kinds of nuisance — fixed PLACE effects and shared TIME effects — are both in the data.`,
    invariant: 'One subtraction kills one nuisance: before/after keeps shared shocks, cross-section keeps fixed gaps. Two nuisances need two.',
  };

  yield {
    state: table(`The 2Ã—2, fully computed (truth = +${TRUE_EFFECT})`, [
      ['nj', 'New Jersey (treated)'],
      ['pa', 'Pennsylvania (control)'],
      ['diff', 'difference of differences'],
    ], [['before', 'before'], ['after', 'after'], ['delta', 'change']], [
      [`${NJ_BEFORE}`, `${NJ_AFTER}`, `${D_NJ} = recession + policy`],
      [`${PA_BEFORE}`, `${PA_AFTER}`, `${D_PA} = recession only`],
      ['—', '—', `${D_NJ} âˆ’ (${D_PA}) = +${DID} — the policy effect, exactly, with both nuisances dead`],
    ]),
    highlight: { found: ['diff:delta'], compare: ['nj:delta', 'pa:delta'] },
    explanation: `Four numbers, two subtractions, computed live. Subtract WITHIN each state across time: NJ changed by ${D_NJ}, PA by ${D_PA}. The within-state subtraction already killed the level gap — NJ's permanent smallness (${BASE.nj} vs ${BASE.pa}) appears in both of NJ's cells and cancels; likewise PA's. What remains in each change is (shared recession) plus, for NJ only, the policy. Now subtract ACROSS states: the recession (${TREND}) sits identically in both changes and cancels, leaving ${D_NJ} âˆ’ (${D_PA}) = +${DID} — the true effect to the digit. Anything constant about a place dies in the first difference; anything shared about a time dies in the second. The estimator is literally its own name.`,
    invariant: 'DiD = (treated after âˆ’ before) âˆ’ (control after âˆ’ before): fixed place effects cancel inside, shared time effects cancel across.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'period', min: -0.2, max: 1.2 }, y: { label: 'employment', min: 70, max: 96 } },
      series: [
        { id: 'pa', label: 'PA (control)', points: [{ x: 0, y: PA_BEFORE }, { x: 1, y: PA_AFTER }] },
        { id: 'nj', label: 'NJ (treated)', points: [{ x: 0, y: NJ_BEFORE }, { x: 1, y: NJ_AFTER }] },
        { id: 'cf', label: 'NJ counterfactual (PA\'s slope)', points: [{ x: 0, y: NJ_BEFORE }, { x: 1, y: NJ_BEFORE + D_PA }] },
      ],
    }),
    highlight: { found: ['nj'], compare: ['cf'], visited: ['pa'] },
    explanation: `The same arithmetic as a picture — the picture every DiD paper draws. PA's line falls with the recession. The dashed-role third line is the COUNTERFACTUAL: where NJ would have gone with no policy, built by giving NJ's starting point PA's slope. The vertical gap between NJ's actual endpoint (${NJ_AFTER}) and that counterfactual endpoint (${NJ_BEFORE + D_PA}) is the estimate: +${DID}. Said plainly: the control group's job is to stand in for the treated group's missing timeline. The whole design is one assumption wearing a graph — that NJ, untreated, would have moved PARALLEL to PA — and the next view stress-tests exactly that.`,
    invariant: 'DiD\'s counterfactual = treated start + control slope: the estimate is the gap between the actual and the borrowed trajectory.',
  };
}

function* parallelTrends() {
  yield {
    state: table('The load-bearing assumption: PARALLEL TRENDS', [
      ['says', 'what it says'],
      ['nice', 'what it does NOT require'],
      ['check', 'the standard diagnostic'],
      ['evidence', 'what passing actually proves'],
    ], [['detail', '']], [
      ['absent the policy, treated and control would have CHANGED by the same amount — levels may differ forever; SLOPES must match'],
      ['groups need not be similar! NJ â‰  PA in size, industry, everything — DiD only borrows PA\'s slope, never its level (that died in the first subtraction)'],
      ['plot several PRE-policy periods: if the two lines moved in lockstep before treatment, the lockstep claim after is more credible — the "event-study" plot every referee demands'],
      ['necessary, not sufficient: parallel HISTORY is evidence, not proof, about the counterfactual FUTURE — the assumption is untestable exactly where it matters, like exclusion in Instrumental Variables & Natural Experiments'],
    ]),
    highlight: { active: ['nice:detail'], removed: ['evidence:detail'] },
    explanation: 'Everything DiD buys is purchased with one assumption, so state it precisely. Parallel trends does NOT say the groups are comparable in level — the design\'s superpower is that permanent differences cancel for free. It says: had the policy never happened, the treated group\'s CHANGE would have equaled the control\'s. That is a claim about a world that never ran, so it cannot be verified — only made plausible. The standard evidence is pre-trends: show the two lines marching in parallel for several periods before treatment. Lockstep history makes lockstep counterfactuals credible; it cannot make them certain. Every DiD argument is ultimately an argument about why the control\'s slope deserves to be borrowed.',
    invariant: 'DiD\'s identifying assumption lives in slopes, not levels — testable in the past, assumed in the counterfactual, never proven.',
  };

  yield {
    state: table('How it breaks: three classic failure stories', [
      ['shock', 'a local shock'],
      ['target', 'policy targeting'],
      ['anticip', 'anticipation'],
    ], [['story', 'what happens'], ['bias', 'where the estimate lands']], [
      ['a casino opens in PA the same year — PA\'s slope steepens for reasons NJ doesn\'t share', 'the borrowed slope is wrong; the casino\'s boost gets subtracted from NJ and masquerades as policy damage'],
      ['legislatures raise minimum wages WHEN local employment is already trending up (or down) — treatment timing correlates with the outcome\'s slope', 'the pre-existing trend differential loads straight into the estimate: the policy gets credit (or blame) for momentum it never caused'],
      ['employers hear the law coming and shift hiring into the before period', 'the "before" cell is contaminated: part of the response moved across the subtraction line, biasing the change comparison both ways'],
    ]),
    highlight: { removed: ['shock:bias', 'target:bias', 'anticip:bias'] },
    explanation: 'The three ways real DiD studies die. A LOCAL SHOCK to the control (anything that bends PA\'s slope alone) corrupts the borrowed counterfactual — and note the cruelty: the better your control resembles a real economy, the more things can happen to it. TARGETING is subtler: policies are passed by people watching the outcome, so treatment timing is correlated with trends by construction — the exact selection-on-trends that parallel trends forbids. ANTICIPATION moves the response across the before/after line itself. None of these announce themselves in the 2Ã—2; all of them show up — sometimes — as pre-trend divergence, which is why the event-study plot is the genre\'s mandatory first figure.',
    invariant: 'Anything that bends ONE group\'s slope — shocks, targeting, anticipation — loads directly into the estimate, disguised as the policy.',
  };

  yield {
    state: table('The toolkit, complete: four designs, one question', [
      ['ab', 'randomize'],
      ['adjust', 'adjust'],
      ['iv', 'find a lottery'],
      ['did', 'find a border'],
    ], [['when', 'when'], ['bet', 'the bet you make']], [
      ['you control assignment — A/B Testing & p-values', 'none: the coin severs every arrow (the gold standard, when ethics and logistics allow)'],
      ["confounders are MEASURED — Causal Graphs, Confounding & Simpson's Paradox + Doubly Robust Estimation", 'you drew the right graph and measured every back door'],
      ['confounders unmeasured, but something random nudged treatment — Instrumental Variables & Natural Experiments', 'exclusion: the lottery touches the outcome through one door only'],
      ['confounders unmeasured, but a policy hit one group and time hit both — this page', 'parallel trends: the control\'s slope is the treated group\'s missing future'],
    ]),
    highlight: { active: ['did:bet'] },
    explanation: 'The observational-causality toolkit, now complete on this site, lined up by the bet each design asks you to make. Randomization buys certainty with control; adjustment buys reach with a graph you must defend; instruments buy unmeasured-confounder immunity with an exclusion argument; and DiD buys it with a slope-borrowing argument — often the cheapest bet available, because policies that hit one jurisdiction and not its neighbor are everywhere once you look. Card & Krueger\'s original found employment did NOT fall (their DiD came out slightly positive) — a result that overturned textbook consensus and eventually shared in a Nobel prize. One 2Ã—2 table, argued carefully, can do that.',
    invariant: 'Every causal design = an estimator + an untestable bet: pick the bet your setting makes most defensible, then defend it in public.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the 2Ã—2 that cancels twice') yield* twoByTwo();
  else if (view === 'parallel trends & where it breaks') yield* parallelTrends();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        `The animation builds a synthetic minimum-wage world where the true policy effect is known (+3), then shows why single comparisons fail and how the double subtraction recovers the truth. The first view constructs the 2x2 table cell by cell: New Jersey (treated) and Pennsylvania (control), before and after the policy. Active cells are the current computation. Found cells are quantities the design has successfully isolated. Removed cells are naive estimates the proof has discarded.`,
        {type: 'image', src: './assets/gifs/difference-in-differences.gif', alt: 'Animated walkthrough of the difference in differences visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        {type: "callout", text: "DiD is a causal design for borrowing a control group trend, not just an arithmetic trick with four averages."},
        `The second view switches to the parallel-trends assumption. It lays out what the assumption says, what it does not require, the standard diagnostic (pre-trend event studies), and three classic ways the assumption breaks. Watch the removed markers on the failure stories: each one shows a specific bias direction, not just a vague warning.`,
        `The line plot in the first view is the picture every DiD paper draws. The dashed counterfactual line starts at New Jersey\'s before value and follows Pennsylvania\'s slope. The vertical gap between that line and New Jersey\'s actual after value is the DiD estimate. If you can read the gap as the treatment effect and explain why the counterfactual slope came from Pennsylvania, you have the design.`,
      ],
    },
    {
      heading: `Why this exists`,
      paragraphs: [
        `Policy questions arrive without random assignment. A state raises its minimum wage. A school district changes funding rules. A hospital adopts a new protocol. A platform rolls out a feature to one region first. The analyst wants the causal effect of the policy, but the treated group was not selected by a coin flip, so raw comparisons carry confounders.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Illustration_of_Difference_in_Differences.png/330px-Illustration_of_Difference_in_Differences.png`, alt: `Difference-in-differences plot with treated control and counterfactual lines`, caption: `The DiD estimand is the vertical gap between observed treated-after outcome and the parallel-trend counterfactual. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Illustration_of_Difference_in_Differences.png/330px-Illustration_of_Difference_in_Differences.png`},
        `Two kinds of nuisance sit in the data simultaneously. Fixed group effects are permanent differences between places, firms, or people: New Jersey restaurants have always been smaller than Pennsylvania\'s. Shared time effects are shocks that hit everyone in the same period: a recession drags employment down in both states at once. Any single comparison removes one nuisance but carries the other.`,
        `Difference-in-differences (DiD) removes both at once with two subtractions. Subtract within each group across time to kill fixed levels. Then subtract across groups to kill the shared time shock. If the control group\'s untreated trend is a valid stand-in for the treated group\'s missing untreated trend, the remainder is the policy effect. The design is the workhorse behind half of applied economics, and the 1994 Card and Krueger minimum-wage study is its most famous application.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The first natural comparison is treated-after minus treated-before. In the animation\'s synthetic world, New Jersey goes from 78 to 77, a change of -1. That looks like the policy hurt employment. But a recession hit both states that year, dragging everyone down by 4. The before/after estimate blames the policy for the recession because it cannot separate the two forces.`,
        `The second natural comparison is treated-after minus control-after. New Jersey after (77) minus Pennsylvania after (88) is -11. That looks like New Jersey is far behind. But New Jersey was always smaller: 78 versus 92 before the policy. The cross-section estimate blames the policy for a pre-existing gap that has nothing to do with the wage change.`,
        `Neither comparison is foolish. The before/after comparison removes permanent group levels because New Jersey is compared with itself. The cross-section comparison removes the shared calendar date because both groups are observed at the same moment. Each kills one nuisance. The problem is that the data contain two nuisances, and each single subtraction only handles one.`,
        `A researcher who reports either number as the policy effect is making a hidden claim: that the nuisance they did not remove is zero. In the synthetic world, that claim is visibly false in both cases. The recession is -4, not zero. The level gap is 14, not zero. One subtraction is not enough.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `The fundamental obstacle is the missing counterfactual. We observe New Jersey after the policy. We never observe New Jersey after the same date without the policy. That unobserved timeline is the thing we need to subtract, and it does not exist in any dataset.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Parallel_Trend_Assumption.png/330px-Parallel_Trend_Assumption.png`, alt: `Parallel trend assumption diagram with observed and assumed counterfactual lines`, caption: `Parallel trends is the claim that the control slope can stand in for the unobserved treated-without-treatment slope. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Parallel_Trend_Assumption.png/330px-Parallel_Trend_Assumption.png`},
        `A control group is useful only if it supplies the right missing change. DiD does not need the groups to match in level. New Jersey can start 14 points below Pennsylvania and the design still works, because levels cancel in the first subtraction. What DiD needs is that, had the policy never happened, New Jersey\'s change would have equaled Pennsylvania\'s change. This is the parallel-trends assumption: same slopes, not same levels.`,
        `Parallel trends is untestable exactly where it matters. The treated group\'s untreated-after outcome is the missing cell. Pre-policy data can make the assumption more credible by showing lockstep movement before treatment, but lockstep history is evidence, not proof, about the counterfactual future. Every DiD study is ultimately an argument that the control group\'s slope deserves to be borrowed for the treated group\'s missing timeline.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `Two subtractions kill two nuisances. The first subtraction (within-group, across time) removes anything fixed about a group because it appears in both periods and cancels. The second subtraction (across groups) removes anything shared about a time period because it appears in both groups\' changes and cancels. What survives both subtractions is the treated group\'s extra movement -- the piece that is neither permanent nor shared.`,
        `The insight is structural, not numerical. It does not depend on the specific values 78, 77, 92, 88. It depends on additive separability: the outcome is a sum of a group effect, a time effect, and a treatment effect. If the world works that way, two differences isolate the treatment term by zeroing out the other two. The design is literally its own name: a difference of differences.`,
        `This also reveals the design\'s fragility. If the treatment effect is not additive -- if, for example, the policy\'s impact depends on the group\'s level -- the cancellation is incomplete. And if any unmodeled force bends one group\'s slope without bending the other\'s, the estimator absorbs that force and calls it treatment. The power and the risk live in the same place: the assumption that two subtractions are enough.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The 2x2 DiD estimator uses four cells. Treated before: 78. Treated after: 77. Control before: 92. Control after: 88. Step one: compute each group\'s change over time. New Jersey changed by 77 - 78 = -1. Pennsylvania changed by 88 - 92 = -4. These within-group differences have already killed the level gap: New Jersey\'s permanent 78-baseline and Pennsylvania\'s permanent 92-baseline each appeared in both their own cells and cancelled.`,
        `Step two: subtract the changes. DiD = (-1) - (-4) = +3. Pennsylvania\'s change of -4 is the recession component. New Jersey\'s change of -1 is recession plus policy. Subtracting the control change strips out the shared recession and leaves the policy effect. The estimate matches the +3 built into the synthetic world.`,
        `In regression form, the same estimator is a linear model with group fixed effects, time fixed effects, and a treatment indicator (the interaction of being treated and being in the post period). The coefficient on that interaction term is the DiD estimate. With more than two periods, the regression extends to an event-study specification: separate coefficients for each pre- and post-period relative to the treatment date, letting the researcher inspect pre-trends and dynamic effects.`,
        `The line plot renders the same arithmetic visually. Start at New Jersey\'s before value (78). Apply Pennsylvania\'s slope (-4) to construct the counterfactual: where New Jersey would have ended up without the policy (74). The vertical gap between New Jersey\'s actual after value (77) and the counterfactual (74) is the DiD estimate: +3. The control group\'s only job is to donate its slope for that dashed line.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Model the outcome as Y = group_effect + time_effect + treatment_effect * (treated AND after) + noise. The group effect captures anything permanent about a unit: state size, industry mix, geography. The time effect captures anything shared across groups in a period: recessions, seasons, federal policy. The treatment term appears only in the treated-after cell.`,
        `Subtracting before from after within the treated group gives: (group + time_after + treatment) - (group + time_before) = (time_after - time_before) + treatment. The group effect cancels. Subtracting before from after within the control group gives: (time_after - time_before). No treatment term because the control is untreated. Subtracting the control change from the treated change gives: treatment. Both time effects cancel.`,
        `This is the identification argument. It works because the model is additive and the time effect is shared. If the treated group would have experienced a different time effect than the control -- a different slope -- the cancellation is incomplete and the estimate is biased. That is exactly the parallel-trends assumption restated algebraically. The arithmetic always produces a number. The question is whether that number means what the researcher claims.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The computational cost of the 2x2 estimator is trivial: four numbers, two subtractions. The real costs are inferential and design-level. Choosing a credible control group, defining treatment timing, selecting the outcome measure, justifying parallel trends, and computing correct standard errors all require judgment and domain knowledge that no formula automates.`,
        `Standard errors must be clustered at the level where treatment varies. If the policy is assigned at the state level, there are only two clusters (New Jersey and Pennsylvania), which is too few for reliable inference. Real DiD studies need many treated and control units, or they must use permutation-based inference, wild bootstrap, or other small-sample corrections. Ignoring clustering produces standard errors that are far too small, making noise look like significance.`,
        `With more than two periods and staggered treatment timing (different groups treated at different dates), the simple two-way fixed-effects regression can produce misleading estimates. When treatment effects vary over time, the regression mixes clean never-treated-vs-treated comparisons with already-treated-vs-newly-treated comparisons, and the weights can even go negative. Modern methods (Callaway and Sant\'Anna, Sun and Abraham, de Chaisemartin and D\'Haultfoeuille) build cleaner comparisons by cohort and relative time. The core question is the same -- which untreated trajectory gets borrowed -- but the bookkeeping is harder.`,
        `Data requirements scale with ambition. A basic 2x2 needs four cells. An event study needs several pre-periods and post-periods. Testing robustness to control group choice, outcome definition, and functional form multiplies the analysis. None of this is computationally expensive, but it is analytically expensive: each choice is an argument the researcher must defend.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `DiD is the default tool in applied economics when a policy lands on one jurisdiction and not its neighbor. Card and Krueger (1994) compared fast-food employment in New Jersey and Pennsylvania after New Jersey raised its minimum wage. Their DiD estimate was slightly positive, contradicting the textbook prediction that minimum wages reduce employment. That result, defended and debated for decades, contributed to David Card\'s 2021 Nobel Prize in Economics.`,
        {type: `image`, src: `https://finshots.in/images/blog/davidcard.jpg`, alt: `Portrait of economist David Card`, caption: `David Card shared the 2021 economics Nobel for empirical labor-economics work including natural-experiment designs. Source: https://finshots.in/images/blog/davidcard.jpg`},
        `Beyond labor economics, DiD appears in public health (did a state-level smoking ban reduce hospitalizations?), education (did a funding reform change test scores?), taxation (did a corporate tax cut increase investment?), and technology platforms (did a policy change on one platform shift user behavior relative to a comparable platform that did not change?). The common structure is a policy that creates a sharp before/after boundary and a comparison group that shares the same time environment but not the policy.`,
        `DiD is also used in operational settings. A company rolls out a new feature to one market and compares sales trends with a holdout market. A hospital system adopts a protocol in some facilities first. A city implements congestion pricing while neighboring cities do not. Anywhere a natural or deliberate rollout creates treated and untreated groups with shared time exposure, DiD is a candidate design.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `A local shock to the control group bends the borrowed slope. If Pennsylvania opens a casino the same year as the New Jersey wage increase, Pennsylvania\'s employment trend steepens for reasons New Jersey does not share. The DiD estimate absorbs the casino\'s effect and misattributes it to the minimum wage. The same failure works in reverse: a shock to the treated group that is unrelated to the policy also loads into the estimate.`,
        `Policy targeting is a subtler failure. Governments raise minimum wages when local economies are already strengthening, or pass safety regulations in response to visible decline. If treatment timing correlates with the outcome\'s pre-existing trend, the DiD estimate gives the policy credit (or blame) for momentum it did not cause. This is selection on trends, the exact violation parallel trends forbids.`,
        `Anticipation contaminates the before period. If employers hear the law is coming and shift hiring into the pre-policy window, the "before" cell is no longer untreated. Part of the response has moved across the subtraction boundary, biasing the change comparison in both directions. Spillovers contaminate the control: if Pennsylvania workers commute to New Jersey or Pennsylvania firms adjust wages preemptively, the control group is no longer clean.`,
        `Composition changes break the design when the groups being measured change across periods. If the minimum wage causes some restaurants to close, the surviving sample is different from the original sample, and the before/after comparison no longer tracks the same units. Attrition, entry, and migration all create composition bias that the basic 2x2 does not address.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `The animation uses a fully known synthetic world. Employment = base(state) + trend(period) + effect * (treated AND after). New Jersey base: 78. Pennsylvania base: 92. Trend (shared recession): -4. True policy effect: +3. This gives four cells: NJ before = 78, NJ after = 78 + (-4) + 3 = 77, PA before = 92, PA after = 92 + (-4) = 88.`,
        `Naive estimate 1 (before/after for NJ): 77 - 78 = -1. This says employment fell. It is wrong because -1 = recession(-4) + policy(+3). The recession is hidden inside the change. Naive estimate 2 (NJ after vs PA after): 77 - 88 = -11. This says NJ is far behind. It is wrong because the gap existed before the policy (78 - 92 = -14); the gap actually shrank by 3 because of the policy.`,
        `DiD: (77 - 78) - (88 - 92) = (-1) - (-4) = +3. The first subtraction kills group levels: NJ\'s 78 base cancels within NJ\'s own change; PA\'s 92 base cancels within PA\'s change. The second subtraction kills the recession: both changes contain -4, and -4 minus -4 is zero. What remains is the +3 treatment effect, matching the truth built into the model.`,
        `The counterfactual line starts at NJ\'s before value (78) and drops by PA\'s change (-4), landing at 74. NJ\'s actual after value is 77. The gap is 77 - 74 = +3. This is the same number, computed geometrically instead of algebraically. If you change the true effect to 0, the counterfactual and actual lines converge. If you change it to -5, NJ falls below the counterfactual. The estimate always equals the vertical gap between the observed treated endpoint and the borrowed-slope counterfactual.`,
      ],
    },
    {
      heading: `Sources and study next`,
      paragraphs: [
        `The foundational study is Card and Krueger, "Minimum Wages and Employment: A Case Study of the Fast-Food Industry in New Jersey and Pennsylvania" (1994), available at https://davidcard.berkeley.edu/papers/njmin-aer.pdf. The 2021 Nobel Prize press release discusses natural experiments in labor economics at https://www.nobelprize.org/prizes/economic-sciences/2021/press-release/. For modern methods addressing staggered timing, see Callaway and Sant\'Anna (2021) and Sun and Abraham (2021).`,
        `Study A/B Testing & p-values to see what random assignment buys when it is available. Study Causal Graphs for confounding language and back-door adjustment. Study Doubly Robust Estimation for cases where confounders are measured. Study Instrumental Variables & Natural Experiments for a different identifying assumption (exclusion rather than parallel trends). Study Synthetic Control Donor Weights for a data-driven alternative to choosing a single control group.`,
        `For related statistical reasoning, study Regression Discontinuity for threshold-based designs, Permutation Tests for design-based uncertainty, and Bootstrap for resampling-based inference. Each of these tools makes a different bet about what the data can support; DiD\'s bet is that the control group\'s slope is the treated group\'s missing future.`,
      ],
    },
  ],
};
