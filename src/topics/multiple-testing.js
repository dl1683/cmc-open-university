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
    explanation: 'A/B Testing & p-values set the contract: at α = 0.05, a single test cries wolf 5% of the time when nothing is there. Now run the arithmetic this module just computed for MANY tests, all on pure noise: five tests → 22.6% chance of at least one fake significant result; twenty → 64.2%; a hundred → 99.4%, a guarantee. Each test kept its individual promise; the FAMILY of tests broke it together. This compounding is the FAMILY-WISE ERROR RATE, and it is the same merciless formula as Tail Latency & p99 Thinking\'s fan-out — 1 − (1 − p)ᵏ — pointed at your statistics instead of your servers.',
    invariant: 'FWER = 1 − (1 − α)ᵏ: per-test honesty compounds into family-level deceit.',
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
      format: (v) => (v === 1 ? 'not significant' : v === 2 ? '"SIGNIFICANT WIN!" ⚠' : v.toFixed(2)),
    }),
    highlight: { removed: ['m12:call'], visited: ['m3:call', 'm7:call', 'm17:call'] },
    explanation: 'How the trap springs in practice: ship a button-color change with NO real effect, and watch a dashboard tracking twenty metrics. Sixteen come back quiet… but "signups from the Tuesday cohort" flashes p = 0.04, and the team celebrates a discovery that is pure sampling noise wearing a costume. The subtler version is the GARDEN OF FORKING PATHS: you didn\'t plan to check Tuesday cohorts — the data suggested it, you tested it, it "worked." Subgroups, time windows, metric variants: each fork is another silent test, and nobody is counting them. (xkcd\'s green-jellybean comic is this slide, funnier.)',
    invariant: 'Every metric, subgroup, and peek is a test — counted or not, it compounds the family-wise error.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'number of tests k' }, y: { label: 'P(≥1 false positive), %' } },
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
    explanation: 'The curve, plotted live: the 5% promise at k = 1 decays toward certainty with breathtaking speed — half-broken by seven tests, two-thirds broken by twenty. And modern practice does not run twenty tests; it runs thousands: a genomics study tests 20,000 genes, a feature store screens hundreds of signals (Data Leakage & Contamination\'s cousin — the test set "wears out" one peek at a time), an experimentation platform runs hundreds of A/B tests a quarter. Without a correction, the question is not WHETHER the dashboard lies, only WHICH cell is lying today.',
  };
}

function* corrections() {
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
      format: (v) => ['', 'test each at α/k instead of α', 'each test must clear p < 0.0025', 'FWER ≤ 5%, no assumptions, ever', 'brutal power loss — real effects need ~2× the n to clear the higher bar'][v],
    }),
    highlight: { found: ['guarantee:what'], removed: ['price:what'] },
    explanation: 'Cure 1 — BONFERRONI, the bluntest honest instrument: divide the error budget among the family. Twenty tests share the 5%, so each must clear p < 0.0025. The guarantee is ironclad and assumption-free; the price is paid in POWER — Statistical Power & Sample Size showed that a stricter α pushes required sample sizes up steeply, so at fixed n, Bonferroni silently converts true discoveries into "not significant." (Holm\'s step-down refinement — test the smallest p against α/k, the next against α/(k−1), and so on — keeps the identical guarantee while rescuing a little power; there is no reason to ever prefer plain Bonferroni over Holm.)',
    invariant: 'Bonferroni: per-test bar α/k caps the family-wise error at α — bought entirely with power.',
  };

  const PS = [0.001, 0.004, 0.011, 0.02, 0.03, 0.04, 0.28, 0.41, 0.6, 0.9];
  yield {
    state: plotState({
      axes: { x: { label: 'rank i (p-values sorted ascending)' }, y: { label: 'p-value' } },
      series: [
        { id: 'pvals', label: 'observed p-values', points: PS.map((p, i) => ({ x: i + 1, y: p })) },
        { id: 'bhline', label: 'BH line: (i/10)·0.05', points: [{ x: 1, y: 0.005 }, { x: 10, y: 0.05 }] },
      ],
      markers: [{ id: 'cut', x: 4, y: 0.02, label: 'last point under the line' }],
    }),
    highlight: { active: ['bhline'], found: ['cut'], compare: ['pvals'] },
    explanation: 'Cure 2 — BENJAMINI–HOCHBERG, the modern workhorse, applied live to ten p-values: sort them, draw the rising line (i/k)·q for target q = 5%, and find the LAST p-value under the line — rank 4 here (p = 0.02 ≤ 0.020) — then declare ranks 1 through 4 discoveries. Compare: Bonferroni\'s flat bar at 0.005 accepts only two. The philosophical shift is the whole point: BH stops promising "probably zero false positives" and instead controls the FALSE DISCOVERY RATE — among your accepted discoveries, at most ~5% are expected to be fakes. Four discoveries with a small, known impurity, instead of two pristine ones.',
    invariant: 'BH: accept up to the largest i with p₍ᵢ₎ ≤ (i/k)·q — the expected fraction of fake discoveries stays ≤ q.',
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
    explanation: 'The decision card — and the bottom row is the quiet champion: PRE-REGISTRATION. Declare ONE primary metric before the experiment starts; judge ship/no-ship on it alone at full α; mark everything else exploratory (hypothesis FUEL for the next test, never evidence in this one). No correction needed, full power preserved, forking paths fenced off — the same discipline as Statistical Power & Sample Size\'s pre-committed n and Cross-Validation & Honest Evaluation\'s sealed test set, applied to the question itself. The unifying law of all three pages: decide how you will judge BEFORE you look, because after you look, every choice you make is secretly another test.',
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
    {
      heading: `What it is`,
      paragraphs: [
        `Multiple testing is what happens when one p-value becomes a dashboard. A single test at alpha = 0.05 has a 5% false-alarm rate when no effect exists. Run twenty such tests on pure noise and the chance of at least one fake "significant" result becomes 1 - 0.95^20 = 64.2%. Run one hundred and it becomes 99.4%. The visualization computes those numbers before showing why a lone p = 0.04 in a twenty-metric dashboard is not a discovery.`,
        `A/B Testing & p-values gives the single-test contract. Multiple Testing & False Discoveries explains how that contract breaks when you test metrics, cohorts, time windows, model variants, and peeks without accounting for the family.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The first view plots family-wise error rate, the probability that any test in the family is falsely positive. Bonferroni controls it by testing each p-value against alpha/k, so twenty tests require p < 0.0025. Holm improves the same guarantee by checking sorted p-values against gradually looser thresholds. Both preserve the "almost no false positives" promise, but Statistical Power & Sample Size shows the cost: stricter thresholds demand more data.`,
        `Benjamini-Hochberg changes the promise. It sorts p-values, draws the rising line (i/k)q, and accepts up to the last p-value under the line. In the demo's ten p-values, BH accepts four discoveries while Bonferroni accepts two. The trade is explicit: control the expected false discovery rate rather than the chance of any false positive.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The algorithms are cheap: division or sorting. The real cost is power and governance. Every endpoint, subgroup, feature idea, and interim look must be counted. Hyperparameter Search has the same pathology in ML: try enough settings on the same validation signal and one will look lucky. Cross-Validation & Honest Evaluation and Data Leakage & Contamination are defenses against wearing out evaluation data.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Drug trials pre-register one primary endpoint and treat the rest as exploratory. Experimentation platforms lock a primary metric before launch. Genomics uses false discovery rate because millions of variants make family-wise control too severe. Causal Graphs, Confounding & Simpson's Paradox helps decide which subgroup analyses were planned causal questions and which are fishing. Instrumental Variables & Natural Experiments often reports multiple robustness checks, which need the same accounting discipline.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Do not correct everything with Bonferroni by reflex. If any false positive is catastrophic, use Holm or Bonferroni. If discovery volume matters and follow-up is cheap, use Benjamini-Hochberg. If there is one pre-registered ship/no-ship metric, test it once at full alpha and label the rest exploratory. Confidence Intervals & the Bootstrap do not magically remove multiplicity; simultaneous intervals also need adjusted coverage when many are interpreted together.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read A/B Testing & p-values for the single comparison, Statistical Power & Sample Size for the power price of stricter alpha, and Data Leakage & Contamination for the ML version of repeated peeking. Cross-Validation & Honest Evaluation and Hyperparameter Search show how the same false-discovery logic appears outside classical statistics.`,
      ],
    },
  ],
};
