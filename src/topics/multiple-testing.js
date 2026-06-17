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
      heading: `Why this exists`,
      paragraphs: [
        `Multiple testing exists because the single p-value contract is easy to break accidentally. A test at alpha = 0.05 says this: if there is no real effect, this procedure will still call something significant about 5% of the time. That is tolerable when the question was chosen before the data and tested once. It becomes misleading when a dashboard, notebook, or experiment platform quietly asks many questions and reports the luckiest one.`,
        `The practical setting is familiar. A product team ships a button change and watches conversion, revenue, retention, session length, mobile users, desktop users, Tuesday signups, new users, returning users, and a dozen guardrail metrics. A data scientist screens thousands of genes. An ML engineer compares many feature slices after looking at validation errors. Each question may be individually honest. The family of questions is not honest unless the analysis accounts for how many chances noise had to win.`,
      ],
    },
    {
      heading: `The naive approach`,
      paragraphs: [
        `The naive approach is to run every comparison at p < 0.05 and celebrate the smallest p-value. This is not foolish at first. The rule is simple, common, and connected to a real false-alarm guarantee for one pre-declared test. If the team only had one primary metric and one launch decision, the usual test would be the right starting point.`,
        `The wall appears when the analyst scans for any significant result. With k independent null tests at alpha = 0.05, the chance of at least one false positive is 1 - 0.95^k. Five tests give about a 22.6% chance. Twenty give about 64.2%. One hundred give about 99.4%. The dashboard is not discovering more truth. It is giving randomness more doors to enter through.`,
        `The hidden version is worse because the count of tests is often not written down. Trying a metric, then a subgroup, then a time window, then excluding an outlier, then checking one more cohort is still a sequence of tests. The data suggested the fork, and the analyst followed it. That choice must be counted because it was another chance to turn noise into a story.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `The core insight is that the unit of error control is the decision family, not the individual p-value. A family can be the set of metrics judged for one product launch, the set of genes screened in one experiment, or the set of model slices used to claim a performance improvement. Once the family is named, the question becomes precise: do we need to keep the chance of any false positive small, or do we need a bounded fraction of false discoveries among the results we accept?`,
        `Family-wise error rate, or FWER, controls the chance that the family contains even one false positive. Bonferroni does this by dividing the alpha budget across the family: with 20 tests and alpha = 0.05, each p-value must be below 0.0025. Holm keeps the same family-wise guarantee but uses the sorted p-values and step-down thresholds, so it is usually less wasteful than plain Bonferroni.`,
        `False discovery rate, or FDR, answers a different question. Benjamini-Hochberg sorts p-values, compares the ith p-value with (i/k) times q, and accepts through the largest rank that passes. It does not promise that every accepted result is clean. It promises that the expected fraction of false discoveries among accepted discoveries is bounded by q under its assumptions. That is often the right bargain when screening many candidates and follow-up is possible.`,
      ],
    },
    {
      heading: `How the methods work`,
      paragraphs: [
        `Bonferroni is the simplest mechanism. Count k tests, divide alpha by k, and require each individual p-value to clear that smaller threshold. Its proof is the union bound: the chance that any false null slips through is no more than the sum of the per-test error budgets. The tests do not need to be independent for the bound to hold. That is why Bonferroni is blunt but dependable.`,
        `Holm starts the same way by sorting p-values from smallest to largest. It checks the smallest against alpha/k, then the next against alpha/(k - 1), then the next against alpha/(k - 2), stopping when one fails. All later hypotheses are kept. The early tests face the strictest bars because they are the most tempting discoveries. Later bars loosen because fewer possible false positives remain in the unresolved family. Holm dominates plain Bonferroni for the same family-wise target.`,
        `Benjamini-Hochberg also sorts p-values, but its threshold rises with rank. If the fourth p-value among ten is 0.020 and q is 0.05, then it sits exactly at (4/10) * 0.05. The method accepts ranks one through four if rank four is the last passing point. The earlier ranks are accepted as a block because they are even smaller than the selected cutoff. The mechanism is simple; the important part is that the guarantee changed from any false positive to the expected impurity of the accepted set.`,
      ],
    },
    {
      heading: `What the visual is proving`,
      paragraphs: [
        `The first view proves that the one-test promise does not survive repeated use. The k = 1 row is the familiar 5% false-alarm rate. The k = 20 and k = 100 rows show the family-level risk created by asking many null questions. The curve has the same shape as fan-out risk in tail latency: many individually rare events become likely when the system gives them many independent chances.`,
        `The corrections view proves that the shape of the threshold expresses the policy. Bonferroni is a flat low bar because every test receives the same small slice of alpha. Holm is a step-down family-wise procedure that spends the same budget more carefully. Benjamini-Hochberg is a rising line because later ranks are allowed to pass only if enough stronger evidence appeared before them. The visual is not just drawing formulas. It is showing which error promise each formula is willing to make.`,
      ],
    },
    {
      heading: `Why the methods work`,
      paragraphs: [
        `Bonferroni works because it refuses to spend more total false-positive budget than the family can afford. If each of 20 null tests can falsely pass with probability at most 0.0025, then even in the worst overlap case the chance that at least one passes is at most 0.05. The guarantee is conservative because the bound can overcount overlapping events, but conservatism is the point when any false positive is expensive.`,
        `Holm works by using the same family-wise logic after each successful rejection. Once the smallest p-value passes the strictest test, the procedure has handled the hardest possible first false-positive event. The remaining family is smaller, so the next threshold can be less severe without exceeding the original family-wise budget. The step-down stop rule protects the later decisions from being interpreted after a weak earlier result.`,
        `Benjamini-Hochberg works because a high-ranked p-value is more convincing when many smaller p-values appear before it. Real signal clusters can pull the cutoff upward. A pile of null p-values usually cannot justify many discoveries.`,
      ],
    },
    {
      heading: `Cost and tradeoffs`,
      paragraphs: [
        `The arithmetic is cheap. Bonferroni needs a count and a division. Holm and Benjamini-Hochberg need sorting, so they cost O(k log k) for k tests, which is trivial compared with collecting the data. The real cost is statistical power. A stricter threshold means a true effect needs more data to become detectable. With fixed sample size, stronger error control converts some real effects into non-discoveries.`,
        `Governance is the harder cost. Someone must define the family before looking, record the primary metric, separate confirmatory analysis from exploratory analysis, and decide which correction matches the decision. A vague notebook full of after-the-fact choices cannot be repaired perfectly by a formula. The formula needs an honest count of the chances the analyst gave luck.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Use family-wise control when one false positive can cause a bad decision. Drug approval, safety claims, security alerts that page a human, and ship/no-ship product metrics often belong here. If the decision is binary and costly, Holm is usually the better default than plain Bonferroni because it keeps the same guarantee with more power.`,
        `Use false discovery rate when discovery volume matters and follow-up exists. Genomics, feature screening, anomaly triage, search relevance experiments, and model-slice investigations often need a useful list rather than a single pristine claim. A small controlled impurity is acceptable if later validation, replication, or human review catches the misses.`,
        `Use pre-registration when the real question is known in advance. One primary metric tested once at full alpha has more power than a corrected family of retrospective stories. Secondary metrics can still be useful, but they should be labeled exploratory and used to design the next experiment rather than to justify the current claim.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Multiple-testing correction can be too severe when applied without judgment. If one primary endpoint was honestly chosen before the experiment, correcting it together with every diagnostic chart wastes power. If a hundred exploratory charts were inspected after the fact, pretending that only one test happened is worse. The boundary between confirmatory and exploratory work must be part of the design, not a story added after results appear.`,
        `Corrections also do not fix biased data. Confounding, leakage, bad randomization, p-hacking, optional stopping, and broken measurement can produce small p-values that are not meaningful under any multiplicity rule. Confidence intervals have the same issue when many intervals are interpreted together: simultaneous coverage needs adjustment, and a single unadjusted interval pulled from a large search is not a clean claim.`,
        `The method can also be mismatched to dependence. Bonferroni and Holm are conservative under broad conditions. Benjamini-Hochberg is more powerful, but its standard guarantee relies on assumptions about the p-values. Correlated metrics, repeated users, overlapping cohorts, and adaptive analysis plans deserve more care than simply pasting a BH line over the output.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study A/B Testing & p-values first for the single-test contract, then Statistical Power & Sample Size for the price of stricter thresholds. Confidence Intervals & the Bootstrap explains why interval interpretation also needs a family when many intervals are reported. Causal Graphs, Confounding & Simpson's Paradox helps separate planned causal questions from subgroup fishing.`,
        `For the ML version, study Cross-Validation & Honest Evaluation, Hyperparameter Search, and Data Leakage & Contamination. They teach the same law in a different language: every time the evaluation signal influences a choice, the signal is being spent. Multiple testing is the statistics name for that spending becoming visible.`,
      ],
    },
  ],
};
