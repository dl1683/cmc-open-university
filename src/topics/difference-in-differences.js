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
        "Read the animation as the execution trace for Difference-in-Differences. Subtract across time to kill place effects, subtract across places to kill time effects: a known policy effect recovered live, plus the parallel-trends bet..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: `Why this exists`,
      paragraphs: [
        `Policy questions often arrive without random assignment. One state raises a minimum wage. One school district changes funding. One hospital adopts a protocol. One platform rolls out a rule to some users first. The analyst wants the causal effect, but the treated group was not chosen by a coin flip.`,
        `A raw before/after comparison is tempting because it follows the treated group over time. A raw treated/control comparison is tempting because it compares the treated group with an untreated group. Both can be badly wrong. The before/after comparison mixes the policy with everything else that changed over time. The treated/control comparison mixes the policy with permanent differences between places, firms, people, or markets.`,
        `Difference-in-differences, usually shortened to DiD, solves one common version of that problem. It uses two subtractions: one across time and one across groups. The first subtraction removes fixed group differences. The second subtraction removes shared time shocks. If the control group's untreated trend is a valid stand-in for the treated group's missing untreated trend, the remaining difference is the policy effect.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The first obvious comparison is treated after minus treated before. In the New Jersey and Pennsylvania minimum-wage setting, that asks whether employment in New Jersey changed after the New Jersey policy. This comparison is easy to explain, but it carries every economy-wide shock that happened at the same time. If a recession hit both states, the before/after estimate blames the policy for the recession.`,
        `The second obvious comparison is treated after minus control after. That asks whether New Jersey employment after the policy was higher or lower than Pennsylvania employment after the same date. This comparison controls for the shared date, but it carries permanent differences between the states. If Pennsylvania restaurants were always larger or had different staffing levels, the cross-section estimate blames the policy for a pre-existing gap.`,
        `Neither comparison is foolish. Each removes one nuisance source. The before/after comparison removes permanent group levels because New Jersey is compared with itself. The treated/control comparison removes the shared calendar date because both groups are observed after the policy. The failure is that the data contain two nuisances, not one.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `The wall is the missing counterfactual. We observe New Jersey after the policy. We do not observe New Jersey after the same date without the policy. Causal inference is the discipline of building a defensible replacement for that missing timeline.`,
        `A control group is useful only if it supplies the right missing change. DiD does not require the treated and control groups to have the same level. That is the important mental shift. Permanent differences can be large and still cancel. What DiD requires is that, without treatment, the treated group would have changed by the same amount as the control group. This is the parallel-trends assumption.`,
        `Parallel trends is untestable exactly where it matters because the untreated treated outcome after treatment is never observed. Pre-policy trends can make the assumption more credible. They cannot prove it. Every DiD design is an argument that the control group's slope deserves to be borrowed.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The classic 2-by-2 DiD estimator has four cells: treated before, treated after, control before, and control after. First compute the treated group's change: treated after minus treated before. Then compute the control group's change: control after minus control before. Then subtract the changes. In symbols: DiD = (treated after - treated before) - (control after - control before).`,
        `The first difference removes group fixed effects. Anything permanent about New Jersey appears in both New Jersey cells and cancels. Anything permanent about Pennsylvania appears in both Pennsylvania cells and cancels. The second difference removes shared time shocks. If both states were hit by the same recession, that recession appears in both changes and cancels when the changes are compared.`,
        `What remains is the treated group's extra movement after removing its fixed level and the shared time movement. If parallel trends held and no other treated-only shock occurred, that extra movement is the treatment effect. DiD is named plainly: it is a difference of two differences.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `The visualization uses a synthetic world shaped like the famous Card and Krueger minimum-wage study. New Jersey is treated. Pennsylvania is the control. New Jersey starts lower than Pennsylvania, so a simple cross-section would be misleading. Both states also face a shared soft economy, so a simple before/after comparison would be misleading.`,
        `In the synthetic numbers, New Jersey goes from 78 before to 77 after, a change of -1. Pennsylvania goes from 92 before to 88 after, a change of -4. The before/after estimate for New Jersey alone says employment fell by 1. That is not the policy effect in this synthetic world because the economy also moved. The after-only comparison says New Jersey is 11 below Pennsylvania. That is not the policy effect either because New Jersey started lower.`,
        `DiD compares the changes: (-1) - (-4) = +3. Pennsylvania's -4 stands in for the recession. New Jersey's -1 contains recession plus policy. Subtracting the Pennsylvania change removes the shared recession and leaves the policy effect built into the example. The line plot shows the same calculation visually: start at New Jersey's before value, apply Pennsylvania's slope to build the untreated New Jersey counterfactual, and measure the vertical gap to New Jersey's actual after value.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `A plain model shows the cancellation. Suppose the outcome equals a group effect, plus a time effect, plus a treatment effect for treated observations after the policy, plus noise. The group effect captures fixed differences such as state size or industrial mix. The time effect captures shocks shared by both groups such as a recession. The treatment term appears only in the treated-after cell.`,
        `Subtracting before from after within a group removes the group effect because it is present in both periods. The treated change contains the shared time effect plus the treatment effect. The control change contains the shared time effect without the treatment effect. Subtracting the control change from the treated change removes the shared time effect. That is the identification argument in its cleanest form.`,
        `The argument breaks if the untreated treated group would not have followed the control's change. That is why DiD is not just arithmetic. The arithmetic is easy. The hard work is defending the counterfactual slope.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `The 2-by-2 computation is almost free. Its cost is conceptual and statistical. The analyst must choose a credible control group, define treatment timing, decide the outcome window, estimate uncertainty, and show why parallel trends is plausible. In regression form, the same estimator is often written with group fixed effects, time fixed effects, and a treatment indicator.`,
        `Real studies usually have more than two periods. That is good because pre-periods let analysts plot event studies and inspect whether treated and control groups moved together before treatment. Multiple post-periods can show whether effects appear immediately, grow over time, or fade. But more periods also create more ways to fool yourself: anticipation, dynamic effects, and changing composition can all bend the plot.`,
        `Staggered treatment timing needs extra care. If different groups adopt at different dates and treatment effects vary over time, simple two-way fixed-effect regressions can mix comparisons in hard-to-interpret ways. Modern DiD methods build cleaner comparisons by treatment cohort and time. The core question remains the same: which untreated trajectory is each treated group allowed to borrow?`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `A local shock breaks DiD when it affects one group at the same time as the policy. If Pennsylvania gets a casino, a factory closing, or a weather shock that New Jersey does not share, Pennsylvania's slope no longer represents New Jersey's untreated slope. The borrowed counterfactual is bent, and the estimate absorbs the local shock.`,
        `Policy targeting is another failure. Governments and firms do not assign policies randomly. They often act when outcomes are already trending up or down. If a minimum wage increase happens because the local economy was already strengthening, the DiD estimate can give the policy credit for momentum that was already present. If a policy is passed in response to decline, it can be blamed for decline that caused the policy.`,
        `Anticipation contaminates the before period. If employers, schools, hospitals, or users change behavior before the official treatment date because they know the policy is coming, the pre-treatment cell is no longer untreated. Spillovers create a different problem: if Pennsylvania workers, firms, or customers respond to New Jersey's policy, the control is no longer clean. Composition changes can also break the design if the groups being measured change across periods.`,
      ],
    },
    {
      heading: `Implementation guidance`,
      paragraphs: [
        `Start with the design, not the regression. Define the treated group, control group, treatment date, outcome, pre-periods, post-periods, and exclusion rules. Explain why the control group should have the same untreated trend as the treated group. If that sentence is weak, the design is weak no matter how clean the regression output looks.`,
        `Plot the data before estimating. Show levels and changes over time. Check whether pre-policy trends look parallel. Run placebo treatment dates when possible. Report event-study coefficients so readers can see pre-trends and dynamic effects. Cluster standard errors at the level where treatment varies, such as state, school district, firm, or hospital, because observations within a treated unit are not independent policy assignments.`,
        `Avoid bad controls. Controls affected by treatment belong after the causal effect, not before it. Adjusting for post-treatment variables can remove part of the effect you are trying to estimate. Covariates can help precision or support conditional parallel trends, but they do not rescue a design where the untreated slope is not credible.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `DiD wins when a policy or event lands on one group but not another, the groups have credible shared trends, and the analyst can observe enough pre-periods to make that claim visible. It is common in applied economics, public policy, education, healthcare, labor, taxation, platform experiments, and operational rollouts where randomized assignment is unavailable or unethical.`,
        `It is the wrong tool when treated and control groups were already moving differently, when treatment timing follows the outcome trend, when spillovers are strong, when the control group faces a different shock, or when the policy changes who is observed. In those settings, a clean-looking 2-by-2 table can be more dangerous than no estimate because it makes an assumption look like arithmetic.`,
        `The main misconception is that groups must be similar in level. They do not. DiD can handle fixed level gaps. The real requirement is slope similarity in the untreated world. Another misconception is that pre-trends prove the assumption. They do not. They are evidence about the past and a warning system for obvious failures, not a proof about the missing future.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Primary anchors: Card and Krueger's 1994 minimum-wage paper at https://davidcard.berkeley.edu/papers/njmin-aer.pdf, the 2021 Nobel Prize press release discussing natural experiments in labor economics at https://www.nobelprize.org/prizes/economic-sciences/2021/press-release/, and the broader DiD literature on parallel trends, event studies, and staggered treatment timing.`,
        `Study A/B Testing & p-values to see what random assignment buys when it is available. Study Causal Graphs for confounding language, Doubly Robust Estimation for adjustment when confounders are measured, Instrumental Variables for a different untestable identifying bet, Synthetic Control Donor Weights for weighted counterfactual trends, Regression Discontinuity for threshold assignment, and Permutation Tests for design-based uncertainty intuition.`,
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
        'Use this topic as a checkpoint: if you can explain why Difference-in-Differences moves from input to output in the animation and where it fails, you are ready for the next topic.',
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
