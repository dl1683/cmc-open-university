// Difference-in-differences: when a policy lands on one group and not
// another, two subtractions cancel everything fixed about places and times —
// the workhorse design behind half of applied economics, computed live.

import { matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'difference-in-differences',
  title: 'Difference-in-Differences',
  category: 'Concepts',
  summary: 'Subtract across time to kill place effects, subtract across places to kill time effects: the 2×2 that recovers a known policy effect live — and the parallel-trends bet it rides on.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['the 2×2 that cancels twice', 'parallel trends & where it breaks'], defaultValue: 'the 2×2 that cancels twice' },
  ],
  run,
};

// A synthetic minimum-wage world (Card–Krueger shaped), fully known:
//   employment = base(state) + trend(period) + EFFECT·(treated & after)
// base: NJ 78, PA 92 (PA permanently bigger — a level difference that must
// not contaminate the answer). trend: every state drifts −4 from a soft
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
      [`${NJ_AFTER} − ${NJ_BEFORE} = ${D_NJ}: employment FELL after the raise — but a recession hit everyone that year, and this difference carries it`],
      [`${NJ_AFTER} − ${PA_AFTER} = ${NJ_AFTER - PA_AFTER}: NJ employs fewer than PA — but NJ was always smaller; this difference carries the permanent gap`],
      ['each single subtraction removes ONE nuisance and keeps the other: before/after keeps the recession, across-states keeps the level gap. The design needs both subtractions at once'],
    ]),
    highlight: { removed: ['naive1:verdict', 'naive2:verdict'] },
    explanation: `The setting is the most famous natural experiment in economics (Card & Krueger, 1994): New Jersey raised its minimum wage while next-door Pennsylvania didn't — and this page rebuilds it as a synthetic world where the policy's TRUE effect on employment is exactly +${TRUE_EFFECT}, so every estimator can be audited. Both obvious comparisons fail, and the table computes how: comparing NJ to itself over time (${D_NJ}) blames the policy for that year's recession; comparing NJ to PA after the fact (${NJ_AFTER - PA_AFTER}) blames it for a size gap that predates the policy by decades. One difference is never enough when two kinds of nuisance — fixed PLACE effects and shared TIME effects — are both in the data.`,
    invariant: 'One subtraction kills one nuisance: before/after keeps shared shocks, cross-section keeps fixed gaps. Two nuisances need two.',
  };

  yield {
    state: table(`The 2×2, fully computed (truth = +${TRUE_EFFECT})`, [
      ['nj', 'New Jersey (treated)'],
      ['pa', 'Pennsylvania (control)'],
      ['diff', 'difference of differences'],
    ], [['before', 'before'], ['after', 'after'], ['delta', 'change']], [
      [`${NJ_BEFORE}`, `${NJ_AFTER}`, `${D_NJ} = recession + policy`],
      [`${PA_BEFORE}`, `${PA_AFTER}`, `${D_PA} = recession only`],
      ['—', '—', `${D_NJ} − (${D_PA}) = +${DID} — the policy effect, exactly, with both nuisances dead`],
    ]),
    highlight: { found: ['diff:delta'], compare: ['nj:delta', 'pa:delta'] },
    explanation: `Four numbers, two subtractions, computed live. Subtract WITHIN each state across time: NJ changed by ${D_NJ}, PA by ${D_PA}. The within-state subtraction already killed the level gap — NJ's permanent smallness (${BASE.nj} vs ${BASE.pa}) appears in both of NJ's cells and cancels; likewise PA's. What remains in each change is (shared recession) plus, for NJ only, the policy. Now subtract ACROSS states: the recession (${TREND}) sits identically in both changes and cancels, leaving ${D_NJ} − (${D_PA}) = +${DID} — the true effect to the digit. Anything constant about a place dies in the first difference; anything shared about a time dies in the second. The estimator is literally its own name.`,
    invariant: 'DiD = (treated after − before) − (control after − before): fixed place effects cancel inside, shared time effects cancel across.',
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
      ['groups need not be similar! NJ ≠ PA in size, industry, everything — DiD only borrows PA\'s slope, never its level (that died in the first subtraction)'],
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
    explanation: 'The three ways real DiD studies die. A LOCAL SHOCK to the control (anything that bends PA\'s slope alone) corrupts the borrowed counterfactual — and note the cruelty: the better your control resembles a real economy, the more things can happen to it. TARGETING is subtler: policies are passed by people watching the outcome, so treatment timing is correlated with trends by construction — the exact selection-on-trends that parallel trends forbids. ANTICIPATION moves the response across the before/after line itself. None of these announce themselves in the 2×2; all of them show up — sometimes — as pre-trend divergence, which is why the event-study plot is the genre\'s mandatory first figure.',
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
    explanation: 'The observational-causality toolkit, now complete on this site, lined up by the bet each design asks you to make. Randomization buys certainty with control; adjustment buys reach with a graph you must defend; instruments buy unmeasured-confounder immunity with an exclusion argument; and DiD buys it with a slope-borrowing argument — often the cheapest bet available, because policies that hit one jurisdiction and not its neighbor are everywhere once you look. Card & Krueger\'s original found employment did NOT fall (their DiD came out slightly positive) — a result that overturned textbook consensus and eventually shared in a Nobel prize. One 2×2 table, argued carefully, can do that.',
    invariant: 'Every causal design = an estimator + an untestable bet: pick the bet your setting makes most defensible, then defend it in public.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the 2×2 that cancels twice') yield* twoByTwo();
  else if (view === 'parallel trends & where it breaks') yield* parallelTrends();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Difference-in-differences (DiD) is a causal-inference method that uses TWO subtractions to cancel out two types of nuisance — fixed place effects and shared time effects — when a policy lands on one group and not another. The Card–Krueger study (1994) is its canonical example: New Jersey raised its minimum wage while Pennsylvania didn't, and DiD recovered the true policy effect on employment by comparing (NJ after − NJ before) − (PA after − PA before). One subtraction kills place-level differences forever, the second kills shared economic shocks; what's left, if parallel trends held, is the policy effect alone.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The 2×2 table has rows for treated and control, columns for before and after. Four numbers, two subtractions. Within each group, subtract across time: that kills the fixed place gap (NJ's permanent size, PA's permanent size). Across groups, subtract the changes: that kills the shared recession. In the Card–Krueger setting, NJ dipped by −1 (recession + policy), PA dipped by −4 (recession only), so DiD = (−1) − (−4) = +3 — the true effect to the digit. The counterfactual picture is intuitive: draw control's trend line, graft it onto treated's starting point; the vertical gap between treated's actual endpoint and the counterfactual endpoint is the estimate. The entire design rests on one assumption: parallel trends — that absent the policy, the two groups would have changed identically. Untestable in the future, often checked in the past using pre-period event-study plots where the two lines marched in lockstep.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `DiD is computationally free — it is table arithmetic. Its cost is conceptual. The identification lives in a single, untestable assumption (parallel trends) and fails catastrophically when violated: a casino opening in the control state, policy targeting timed to outcome momentum, or anticipatory response from treated agents all corrupt the estimate, and none announce themselves in the 2×2 table itself — you need the event-study plot to suspect trouble. Unlike randomized experiments, DiD carries permanent assumption risk.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `DiD is ubiquitous in applied economics: studies of minimum-wage laws, school finance reforms, healthcare expansions, tax changes, all use this design when a policy lands in one jurisdiction at a time. It is the workhorse behind half of applied policy research. Modern extensions (heterogeneous treatment effects, staggered timings) handle multiple policies rolling out at different times, all coordinating on the same idea: borrow the control's slope, subtract it from treated, and claim the residual is causal. Card, who pioneered the Card–Krueger study, was awarded the Nobel Prize in Economics in 2021 partly for this methodological contribution and the empirical lesson it delivered — employment did not fall.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest misconception: parallel trends does NOT require the groups to be similar in level or demographics. DiD only borrows the control's slope, never its level — permanent differences die in the first subtraction. Second trap: a pre-trend event-study plot showing parallel history is EVIDENCE, not PROOF, of parallel counterfactuals. The assumption is about a world that never ran, so it is untestable exactly where it matters, the same way exclusion restrictions are untestable in Instrumental Variables & Natural Experiments. Third: DiD assumes the policy timing is exogenous to trends. If legislatures pass laws when employment is already moving in a certain direction — targeting on trends themselves — the estimate is biased before anyone opens a textbook. Finally, anticipation is pernicious: if employers shift hiring into the "before" period after hearing the law is coming, the before/after subtraction is contaminated from both sides.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read "Instrumental Variables & Natural Experiments" to see how DiD sits in the causal-design toolkit alongside instruments and natural experiments — each is an estimator + an untestable bet. Explore "Causal Graphs, Confounding & Simpson's Paradox" and "Doubly Robust Estimation" to understand how other methods handle confounding when you can measure it directly. Study "A/B Testing & p-values" to see how randomization buys certainty with control. Together, these four designs cover the four ways to buy causal inference: randomize, adjust on measured confounders, find a lottery, or find a border (that's DiD). The parallel-trends assumption is the price of DiD's simplicity — steep, but often worth it when policies land on one group and neighbors provide a natural control.`,
      ],
    },
  ],
};

