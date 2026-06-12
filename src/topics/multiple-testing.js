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
        `Multiple testing happens whenever you run many statistical tests on the same data — testing twenty metrics for significance, exploring ten subgroups, peeking at your A/B test five times, or screening 20,000 genes for disease associations. Each test carries the usual contract: "if nothing is true, I will cry wolf (show significance) 5% of the time" at α = 0.05. But that contract is per-test, not per-family. Run twenty honest tests on pure noise and the question flips: "Will at least one of them cry wolf?" The answer, computed live on this page: 64.2% chance. Run a hundred tests and it is 99.4% — a near-guarantee of a fake discovery even if nothing is real. This compounding into false discoveries is the central problem of multiple testing, and corrections like Bonferroni, Holm, and Benjamini–Hochberg are the cures.`,
        `The trap is invisible until you see the numbers. A single metric at p = 0.04 feels like evidence; the dashboard with twenty metrics at p = 0.04 is a lie generator. The "garden of forking paths" (xkcd's green jellybean cartoon made this famous) adds invisible tests: every time you slice by subgroup, time window, or variant of the metric, you are running another silent test. Corrections enforce accounting — either declare how many tests you plan to run before you look (and pay the price in power), or accept a controlled rate of fake discoveries (and mark them as what they are: impure but detected).`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The foundation is the family-wise error rate (FWER): the probability of at least one false positive across the entire family of tests. The visualization computes it live using the formula FWER = 1 − (1 − α)^k, the same fan-out logic as Tail Latency & p99 Thinking applied to statistics instead of servers. One test at α = 0.05: 5% chance of a false positive. Five tests: 22.6% chance at least one lies. Twenty: 64.2%. The logic is inexorable: if each test independently succeeds at staying quiet 95% of the time, and you run twenty of them, the probability that ALL twenty stay quiet is 0.95^20 ≈ 0.36 — leaving a 64% chance that at least one spoke up falsely. This is not a subtle statistical artifact; it is arithmetic.`,
        `The corrections offer different philosophies. BONFERRONI divides the error budget equally: with k = 20 tests, each must clear the bar α/k = 0.0025 instead of 0.05. This keeps FWER ≤ 5% — a guarantee so ironclad it needs no assumptions. The price is steep: the stricter threshold crushes power, requiring roughly twice the sample size to detect a real effect. HOLM'S step-down refinement rescues some power by testing p-values in order: the smallest must clear α/k, the next must clear α/(k−1), and so on. It keeps Bonferroni's guarantee but quietly resurrects a few true discoveries. When you have thousands of tests (genomics screens, feature mining), FWER becomes a death sentence for power. BENJAMINI–HOCHBERG pivots the question: instead of "how many false positives?" ask "what fraction of my discoveries are fake?" The BH method sorts p-values, draws a rising line (i/k)·q for target q = 5%, and declares all p-values up to the last one crossing the line as discoveries. This controls the false discovery rate (FDR) — at most ~5% of accepted discoveries are expected to be fakes. The payoff: far more discoveries than Bonferroni, with a known impurity cost. The visualization shows both lines: Bonferroni's flat bar rejects most findings; the BH line rises and accepts more, trading certainty for detection volume.`,
        `The decision card — shown in the corrections view — reveals the third path: PRE-REGISTRATION. Declare your ONE primary metric before the experiment starts; test it at full α = 0.05; mark everything else exploratory (fuel for future tests, never evidence in this one). No correction needed, full power preserved, forking paths fenced off. This is the quiet champion because it aligns with Statistical Power & Sample Size's pre-committed sample size and Cross-Validation & Honest Evaluation's sealed test set — decide how you will judge BEFORE you look, because after you look, every choice is another silent test.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Applying a correction has no computational cost — Bonferroni divides a threshold, Benjamini–Hochberg sorts p-values and finds a cutoff, Holm increments through indices. The real cost is POWER: stricter thresholds demand larger samples. A real effect detectable at n = 1000 with α = 0.05 might require n = 2000 under Bonferroni with k = 20 tests. This is why you must decide the number of tests in advance — every test you add post-hoc amplifies the correction cost. Benjamini–Hochberg costs less in power than Bonferroni at equal k (rising threshold instead of flat) but still demands more samples than an uncorrected test. The only true escape from the power cost is pre-registration: one primary metric, full α, no correction, no penalty.`,
        `The hidden cost is organizational: you must know how many tests you are running. In modern systems, that number swells fast — a dashboard with twenty metrics, multiplied by geographic breakdowns, device types, time windows, and post-hoc slicing, silently becomes a thousand tests. Without instrumenting this accounting, no correction can save you. The better approach is discipline: lock your primary metric before looking; make exploratory findings explicitly secondary; run a follow-up experiment to confirm, rather than correcting and declaring it confirmed in the same data.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Drug approval is the gold standard: the FDA requires a primary efficacy endpoint (the ONE thing you care about, locked before the trial starts), tested at α = 0.05, no correction. Secondary endpoints are exploratory only. This structure has saved the process from decades of false discoveries. A/B Testing & p-values runs at every tech company as either a nightmare or a well-oiled machine depending on whether someone enforces pre-registration: strong companies lock metrics and declare the primary one before launch; weaker ones let engineers peek and find Tuesday-cohort effects. Genomics screens millions of genetic variants for disease associations — FWER at k = 1,000,000 is nonsensical, so the field switched to FDR control decades ago, accepting that 5% of reported variants are expected noise while detecting thousands that are likely real. High-frequency trading screens thousands of signals for alpha; corrected discovery is the alternative to endless backtesting (and overfitting). Feature engineering in machine learning is silent multiple testing: every new feature you try is another test. The best systems explicitly measure feature importance on a held-out set (Data Leakage & Contamination) rather than on the training data where overfitting guarantees spurious discoveries.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest misconception is thinking one finding at p = 0.04 is evidence. If you tested twenty metrics naively and found that ONE at p = 0.04, that finding is virtually certain to be noise — it is the exact outcome you expected from the garden of forking paths. The correction is not optional; the only escape is pre-registration (which this finding lacked). A second trap is overcorrection: applying Bonferroni to every statistical test in a project leads to ridiculous power loss. A/B tests should use pre-registration (one primary), not Bonferroni. Feature-importance screening should use FDR, not FWER. Picking the right tool for the problem matters; swinging Bonferroni at everything is like solving nail and screw problems with the same hammer.`,
        `Another pitfall is misunderstanding what FDR controls: Benjamini–Hochberg does NOT guarantee zero false positives — it controls the proportion, so at α = 0.05, expect ~5% of your accepted findings to be impure. If you accept ten discoveries, one of them might be noise. This is fine for exploration (you run follow-up tests to confirm) but catastrophic for drug approval (you cannot sell a drug on an expected 5% chance it does not work). Conversely, Bonferroni's "no false positives" promise is so expensive that it wastes true discoveries — many real effects slip below the bar because the bar is set too high. Finally, confusing the number of tests: your dashboard has twenty metrics, not one. Counting metrics, subgroups, and peeks together is how you arrive at the true family size. Undercounting is how the false discovery epidemic persists.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `A/B Testing & p-values is the gateway — understand p-values and the single-test contract before tackling multiple testing. Statistical Power & Sample Size explains why Bonferroni is so expensive (strict α inflates required n). Cross-Validation & Honest Evaluation teaches the sealed test set discipline that parallels pre-registration. Data Leakage & Contamination covers silent test multiplicity in machine learning — fitting on a test set that you peek at repeatedly is multiple testing in disguise. And Confidence Intervals & the Bootstrap offer an alternative framing (if you report 95% confidence intervals for all metrics, the intersection of those intervals is a corrected region — a different way to think about controlling error across a family).`,
      ],
    },
  ],
};

