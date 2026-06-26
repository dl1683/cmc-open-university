// Multiple testing: ask twenty questions at α = 0.05 and one "discovery"
// is practically guaranteed — even when nothing is true. The dashboard
// with twenty metrics is a lie generator, and the corrections are the cure.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'multiple-testing',
  title: 'Multiple Testing & False Discoveries',
  category: 'Concepts',
  summary: 'Twenty metrics at α = 0.05 and a false "win" is near-certain — Bonferroni, Holm, and BH are the antidotes.',
  controls: [
    { id: 'view', label: 'Test', type: 'select', options: ['twenty metrics, one lie guaranteed', 'the corrections, applied live'], defaultValue: 'twenty metrics, one lie guaranteed' },
  ],
  run,
};

const fwer = (k) => 1 - 0.95 ** k;

function* lieGuaranteed() {
  const KS = [1, 5, 20, 100];
  yield {
    state: matrixState({
      title: 'P(at least one false positive) when NOTHING is real — computed live',
      rows: KS.map((k) => ({ id: `k${k}`, label: `${k} test${k > 1 ? 's' : ''} at α = 0.05` })),
      columns: [{ id: 'p', label: 'chance of a fake "discovery"' }],
      values: KS.map((k) => [fwer(k) * 100]),
      format: (v) => `${v.toFixed(1)}%`,
    }),
    highlight: { compare: ['k1:p'], removed: ['k20:p', 'k100:p'] },
    explanation: `A/B Testing & p-values set the contract: at α = 0.05, a single test cries wolf 5% of the time when nothing is there. Now run the arithmetic this module just computed for ${KS.length} test counts, all on pure noise: five tests â†’ ${(fwer(5) * 100).toFixed(1)}% chance of at least one fake significant result; twenty â†’ ${(fwer(20) * 100).toFixed(1)}%; a hundred â†’ ${(fwer(100) * 100).toFixed(1)}%, a guarantee. Each test kept its individual promise; the FAMILY of tests broke it together. This compounding is the FAMILY-WISE ERROR RATE, and it is the same merciless formula as Tail Latency & p99 Thinking\'s fan-out — 1 âˆ’ (1 âˆ’ p)áµ — pointed at your statistics instead of your servers.`,
    invariant: `FWER = 1 âˆ’ (1 âˆ’ α)áµ: per-test honesty compounds into family-level deceit. With ${KS[KS.length - 1]} tests the rate is ${(fwer(KS[KS.length - 1]) * 100).toFixed(1)}%.`,
  };

  yield {
    state: matrixState({
      title: 'The experiment dashboard: one button color change, twenty metrics',
      rows: [
        { id: 'm3', label: 'session length' },
        { id: 'm7', label: 'clicks on help' },
        { id: 'm12', label: 'signups from Tuesday cohort' },
        { id: 'm17', label: 'scroll depth, mobile only' },
      ],
      columns: [{ id: 'pval', label: 'p-value' }, { id: 'call', label: 'naive verdict' }],
      values: [[0.61, 1], [0.34, 1], [0.04, 2], [0.83, 1]],
      format: (v) => (v === 1 ? 'not significant' : v === 2 ? '"SIGNIFICANT WIN!" âš ' : v.toFixed(2)),
    }),
    highlight: { removed: ['m12:call'], visited: ['m3:call', 'm7:call', 'm17:call'] },
    explanation: `How the trap springs in practice: ship a button-color change with NO real effect, and watch a dashboard tracking ${KS[2]} metrics. Sixteen come back quiet… but "signups from the Tuesday cohort" flashes p = 0.04, and the team celebrates a discovery that is pure sampling noise wearing a costume. The subtler version is the GARDEN OF FORKING PATHS: you didn\'t plan to check Tuesday cohorts — the data suggested it, you tested it, it "worked." Subgroups, time windows, metric variants: each fork is another silent test, and nobody is counting them. (xkcd\'s green-jellybean comic is this slide, funnier.)`,
    invariant: `Every metric, subgroup, and peek is a test — counted or not, it compounds the family-wise error — at ${KS[2]} tests the FWER is already ${(fwer(KS[2]) * 100).toFixed(0)}%.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'number of tests k' }, y: { label: 'P(â‰¥1 false positive), %' } },
      series: [{
        id: 'curve',
        label: 'FWER at α = 0.05',
        points: Array.from({ length: 30 }, (_, i) => 1 + i * 3.4).map((k) => ({ x: k, y: fwer(k) * 100 })),
      }],
      markers: [
        { id: 'one', x: 1, y: 5, label: 'the promise: 5%' },
        { id: 'twenty', x: 20, y: fwer(20) * 100, label: '20 tests: 64%' },
      ],
    }),
    highlight: { found: ['one'], removed: ['twenty'], active: ['curve'] },
    explanation: `The curve, plotted live: the 5% promise at k = 1 decays toward certainty with breathtaking speed — half-broken by seven tests (${(fwer(7) * 100).toFixed(0)}%), two-thirds broken by ${KS[2]} (${(fwer(KS[2]) * 100).toFixed(1)}%). And modern practice does not run twenty tests; it runs thousands: a genomics study tests 20,000 genes, a feature store screens hundreds of signals (Data Leakage & Contamination\'s cousin — the test set "wears out" one peek at a time), an experimentation platform runs hundreds of A/B tests a quarter. Without a correction, the question is not WHETHER the dashboard lies, only WHICH cell is lying today.`,
  };
}

function* corrections() {
  const bonferroniK = 20;
  yield {
    state: matrixState({
      title: 'Bonferroni: divide the α among the family',
      rows: [
        { id: 'rule', label: 'the rule' },
        { id: 'twenty', label: 'k = 20 tests' },
        { id: 'guarantee', label: 'the guarantee' },
        { id: 'price', label: 'the price' },
      ],
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'test each at α/k instead of α', 'each test must clear p < 0.0025', 'FWER â‰¤ 5%, no assumptions, ever', 'brutal power loss — real effects need ~2Ã— the n to clear the higher bar'][v],
    }),
    highlight: { found: ['guarantee:what'], removed: ['price:what'] },
    explanation: `Cure 1 — BONFERRONI, the bluntest honest instrument: divide the error budget among the family. ${bonferroniK} tests share the 5%, so each must clear p < ${(0.05 / bonferroniK).toFixed(4)}. The guarantee is ironclad and assumption-free; the price is paid in POWER — Statistical Power & Sample Size showed that a stricter α pushes required sample sizes up steeply, so at fixed n, Bonferroni silently converts true discoveries into "not significant." (Holm\'s step-down refinement — test the smallest p against α/k, the next against α/(kâˆ’1), and so on — keeps the identical guarantee while rescuing a little power; there is no reason to ever prefer plain Bonferroni over Holm.)`,
    invariant: `Bonferroni: per-test bar α/${bonferroniK} = ${(0.05 / bonferroniK).toFixed(4)} caps the family-wise error at α — bought entirely with power.`,
  };

  const PS = [0.001, 0.004, 0.011, 0.02, 0.03, 0.04, 0.28, 0.41, 0.6, 0.9];
  yield {
    state: plotState({
      axes: { x: { label: 'rank i (p-values sorted ascending)' }, y: { label: 'p-value' } },
      series: [
        { id: 'pvals', label: 'observed p-values', points: PS.map((p, i) => ({ x: i + 1, y: p })) },
        { id: 'bhline', label: 'BH line: (i/10)Â·0.05', points: [{ x: 1, y: 0.005 }, { x: 10, y: 0.05 }] },
      ],
      markers: [{ id: 'cut', x: 4, y: 0.02, label: 'last point under the line' }],
    }),
    highlight: { active: ['bhline'], found: ['cut'], compare: ['pvals'] },
    explanation: `Cure 2 — BENJAMINI–HOCHBERG, the modern workhorse, applied live to ${PS.length} p-values: sort them, draw the rising line (i/k)Â·q for target q = 5%, and find the LAST p-value under the line — rank 4 here (p = ${PS[3]} â‰¤ 0.020) — then declare ranks 1 through 4 discoveries. Compare: Bonferroni\'s flat bar at 0.005 accepts only two. The philosophical shift is the whole point: BH stops promising "probably zero false positives" and instead controls the FALSE DISCOVERY RATE — among your accepted discoveries, at most ~5% are expected to be fakes. Four discoveries with a small, known impurity, instead of two pristine ones.`,
    invariant: `BH: accept up to the largest i with pâ‚áµ¢â‚Ž â‰¤ (i/k)Â·q — the expected fraction of fake discoveries stays â‰¤ q. Here k = ${PS.length}.`,
  };

  yield {
    state: matrixState({
      title: 'Which guarantee do you actually need?',
      rows: [
        { id: 'fwerRow', label: 'FWER (Holm/Bonferroni)' },
        { id: 'fdrRow', label: 'FDR (Benjamini–Hochberg)' },
        { id: 'prereg', label: 'pre-registered primary metric' },
      ],
      columns: [{ id: 'when', label: 'reach for it when' }, { id: 'home', label: 'natural home' }],
      values: [[1, 2], [3, 4], [5, 6]],
      format: (v) => ['', 'ANY false positive is expensive; few tests', 'drug approval, ship/no-ship calls', 'discovery volume matters; thousands of tests', 'genomics screens, feature mining, log anomaly hunts', 'you can decide what matters BEFORE looking', 'every well-run A/B test (one primary, rest exploratory)'][v],
    }),
    highlight: { found: ['prereg:when', 'prereg:home'] },
    explanation: `The decision card — and the bottom row is the quiet champion: PRE-REGISTRATION. Declare ONE primary metric (unlike the ${PS.length} p-values just corrected) before the experiment starts; judge ship/no-ship on it alone at full α; mark everything else exploratory (hypothesis FUEL for the next test, never evidence in this one). No correction needed, full power preserved, forking paths fenced off — the same discipline as Statistical Power & Sample Size\'s pre-committed n and Cross-Validation & Honest Evaluation\'s sealed test set, applied to the question itself. The unifying law of all three pages: decide how you will judge BEFORE you look, because after you look, every choice you make is secretly another test.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'twenty metrics, one lie guaranteed') yield* lieGuaranteed();
  else if (view === 'the corrections, applied live') yield* corrections();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'The first view shows what happens when a family of null tests all use alpha = 0.05. Alpha means the false-positive probability for one test when the null hypothesis is true, and a false positive means reporting an effect that is not real. Removed cells mark cases where family-level risk has become too high; the correction view shows thresholds that stop a dashboard from giving noise repeated chances.',
      {type: 'callout', text: 'Multiplicity spends error budget every time the data gets another chance to produce a lucky-looking result.'},
      {type: 'image', src: './assets/gifs/multiple-testing.gif', alt: 'Animated walkthrough of the multiple testing visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
    ]},
    { heading: 'Why this exists', paragraphs: [
      'A hypothesis test decides whether data are surprising under a baseline claim called the null hypothesis. With alpha = 0.05, one valid test falsely rejects a true null about 5 percent of the time. Multiple testing exists because real analysis often checks many metrics, genes, cohorts, or subgroups, giving randomness many chances to pass the threshold.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Normal_Distribution_PDF.svg', alt: 'Normal distribution probability density functions', caption: 'A single-test threshold cuts a tail from one null distribution; repeated tests keep taking tail chances until noise survives. Source: Wikimedia Commons, Inductiveload, public domain.'},
    ]},
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is to run every test at p < 0.05 and report every result that clears the bar. A p-value is the probability, under the null model, of seeing data at least this extreme. That rule is correct for one pre-declared question, but it breaks when one decision is made after scanning many questions.']},
    { heading: 'The wall', paragraphs: ['The wall is compounding error. With k independent null tests, the chance of at least one false positive is 1 - (1 - 0.05)^k, not 0.05. For 20 tests the chance is 1 - 0.95^20 = 64.2 percent, so every test can keep its own promise while the family almost guarantees a fake win.']},
    { heading: 'The core insight', paragraphs: ['The core insight is that the unit of error control must match the unit of decision. If the decision is made after looking across twenty metrics, the guarantee must cover the twenty-metric family. Family-wise error rate controls the chance of any false discovery, while false discovery rate controls the expected fraction of false discoveries among accepted results.']},
    { heading: 'How it works', paragraphs: ['Bonferroni divides alpha by the number of tests, so 20 tests at alpha = 0.05 require p < 0.0025. Holm sorts p-values and uses a step-down version of the same family-wise guarantee. Benjamini-Hochberg sorts p-values, compares rank i to (i / k) * q, and accepts through the largest rank that passes, controlling false discovery rate instead of any-false-positive risk.']},
    { heading: 'Why it works', paragraphs: [
      'Bonferroni works because the probability of any bad event is at most the sum of the probabilities of the bad events. If each of 20 null tests gets at most 0.0025 false-positive probability, the family gets at most 20 * 0.0025 = 0.05. Benjamini-Hochberg works from sorted p-value behavior: null p-values are roughly uniform, while real effects pile up near zero.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Normal_Distribution_CDF.svg', alt: 'Normal distribution cumulative distribution functions', caption: 'The CDF view turns tail area into probability, which is the quantity multiple-testing corrections spend and protect. Source: Wikimedia Commons, Inductiveload, public domain.'},
    ]},
    { heading: 'Cost and complexity', paragraphs: ['Computation is cheap. Bonferroni is O(k), while Holm and Benjamini-Hochberg sort k p-values and cost O(k log k). The real cost is power: stricter thresholds need stronger evidence, so fixed sample sizes miss more true effects.']},
    { heading: 'Real-world uses', paragraphs: ['Use family-wise error control when one false positive is expensive, such as safety decisions, drug approvals, or ship-or-stop calls. Use false discovery rate when discovery volume matters and follow-up can filter candidates, such as gene screens, anomaly triage, feature mining, and exploratory science.']},
    { heading: 'Where it fails', paragraphs: ['Corrections do not fix biased data, confounding, leakage, broken randomization, or optional stopping. They also fail when the family is chosen after looking; if an analyst inspects one hundred cuts and corrects only the three that looked promising, the guarantee is void. The family must be defined before the data guide the analysis.']},
    { heading: 'Worked example', paragraphs: ['A team tests 20 independent metrics for a feature that truly has no effect. The chance of no false positives is 0.95^20 = 0.358, so the chance of at least one fake win is 1 - 0.358 = 0.642, or 64.2 percent. Bonferroni changes the per-test bar to 0.05 / 20 = 0.0025, so a p = 0.04 metric no longer qualifies.']},
    { heading: 'Sources and study next', paragraphs: ['Primary sources: Bonferroni on union-bound correction, Holm 1979 on the sequentially rejective procedure, Benjamini and Hochberg 1995 on false discovery rate, Benjamini and Yekutieli on dependency, and Ioannidis on false research findings. Study p-values, statistical power, confidence intervals, causal inference, cross-validation, and data leakage next.']},
  ],
};
