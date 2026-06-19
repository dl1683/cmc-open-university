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
    explanation: 'A/B Testing & p-values set the contract: at α = 0.05, a single test cries wolf 5% of the time when nothing is there. Now run the arithmetic this module just computed for MANY tests, all on pure noise: five tests â†’ 22.6% chance of at least one fake significant result; twenty â†’ 64.2%; a hundred â†’ 99.4%, a guarantee. Each test kept its individual promise; the FAMILY of tests broke it together. This compounding is the FAMILY-WISE ERROR RATE, and it is the same merciless formula as Tail Latency & p99 Thinking\'s fan-out — 1 âˆ’ (1 âˆ’ p)áµ — pointed at your statistics instead of your servers.',
    invariant: 'FWER = 1 âˆ’ (1 âˆ’ α)áµ: per-test honesty compounds into family-level deceit.',
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
    explanation: 'How the trap springs in practice: ship a button-color change with NO real effect, and watch a dashboard tracking twenty metrics. Sixteen come back quiet… but "signups from the Tuesday cohort" flashes p = 0.04, and the team celebrates a discovery that is pure sampling noise wearing a costume. The subtler version is the GARDEN OF FORKING PATHS: you didn\'t plan to check Tuesday cohorts — the data suggested it, you tested it, it "worked." Subgroups, time windows, metric variants: each fork is another silent test, and nobody is counting them. (xkcd\'s green-jellybean comic is this slide, funnier.)',
    invariant: 'Every metric, subgroup, and peek is a test — counted or not, it compounds the family-wise error.',
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
      format: (v) => ['', 'test each at α/k instead of α', 'each test must clear p < 0.0025', 'FWER â‰¤ 5%, no assumptions, ever', 'brutal power loss — real effects need ~2Ã— the n to clear the higher bar'][v],
    }),
    highlight: { found: ['guarantee:what'], removed: ['price:what'] },
    explanation: 'Cure 1 — BONFERRONI, the bluntest honest instrument: divide the error budget among the family. Twenty tests share the 5%, so each must clear p < 0.0025. The guarantee is ironclad and assumption-free; the price is paid in POWER — Statistical Power & Sample Size showed that a stricter α pushes required sample sizes up steeply, so at fixed n, Bonferroni silently converts true discoveries into "not significant." (Holm\'s step-down refinement — test the smallest p against α/k, the next against α/(kâˆ’1), and so on — keeps the identical guarantee while rescuing a little power; there is no reason to ever prefer plain Bonferroni over Holm.)',
    invariant: 'Bonferroni: per-test bar α/k caps the family-wise error at α — bought entirely with power.',
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
    explanation: 'Cure 2 — BENJAMINI–HOCHBERG, the modern workhorse, applied live to ten p-values: sort them, draw the rising line (i/k)Â·q for target q = 5%, and find the LAST p-value under the line — rank 4 here (p = 0.02 â‰¤ 0.020) — then declare ranks 1 through 4 discoveries. Compare: Bonferroni\'s flat bar at 0.005 accepts only two. The philosophical shift is the whole point: BH stops promising "probably zero false positives" and instead controls the FALSE DISCOVERY RATE — among your accepted discoveries, at most ~5% are expected to be fakes. Four discoveries with a small, known impurity, instead of two pristine ones.',
    invariant: 'BH: accept up to the largest i with pâ‚áµ¢â‚Ž â‰¤ (i/k)Â·q — the expected fraction of fake discoveries stays â‰¤ q.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'The first view builds a table of family-wise error rates for growing numbers of null tests. Active cells show the current computation. Removed cells (red) flag the rows where the false-positive risk has become unacceptable. The curve that follows plots the same formula continuously so you can see the shape: steep early, asymptotic to 100%.',
        'The second view applies Bonferroni and Benjamini-Hochberg to a concrete set of p-values. The BH threshold line rises with rank. Found markers (green) are discoveries that survive the correction. Removed markers (red) are results that a naive analysis would celebrate but the correction rejects. At each frame, ask: which error guarantee is this threshold enforcing, and what power is it costing?',
        'The dashboard frame between them shows a realistic experiment with twenty metrics and one false "win." That frame is the motivation for everything that follows.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A single hypothesis test at alpha = 0.05 promises a 5% false-alarm rate when nothing is real. That contract is sound for one pre-declared question tested once. It breaks silently when a dashboard, notebook, or screening pipeline asks many questions and reports the best-looking answer.',
        'The practical settings are everywhere. A product team ships a button-color change and watches twenty metrics. A genomics study tests 20,000 genes. An ML engineer slices validation error by region, device, and cohort. Each individual test keeps its promise; the family of tests compounds false-positive risk until a fake discovery is nearly guaranteed.',
        {
          type: 'quote',
          text: 'The increased number of hypotheses to be tested, each at a prescribed level, inflates the probability of erroneously rejecting some of them beyond any reasonable bound. [...] We suggest controlling the expected proportion of falsely rejected hypotheses -- the false discovery rate.',
          attribution: 'Yoav Benjamini and Yosef Hochberg, "Controlling the False Discovery Rate," Journal of the Royal Statistical Society B, 1995',
        },
        'Benjamini and Hochberg reframed the problem. Instead of demanding zero false positives in a family (an increasingly expensive promise), they proposed bounding the expected fraction of false discoveries among accepted results. That single idea unlocked large-scale screening in genomics, neuroscience, and industry experimentation.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Run every comparison at p < 0.05 and flag anything that clears the bar. This is not stupid -- it is the correct procedure when the analyst truly has one pre-declared question. The threshold is connected to a real guarantee, the logic is simple, and every introductory statistics course teaches it.',
        'The approach works exactly when two conditions hold: the question was chosen before the data, and only one question is tested. A confirmatory clinical trial with a single primary endpoint fits perfectly. The trouble begins when either condition fails.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'With k independent null tests at alpha = 0.05, the chance of at least one false positive is 1 - (1 - 0.05)^k. Five tests: 22.6%. Twenty tests: 64.2%. One hundred tests: 99.4%. The per-test contract holds perfectly; the family-level contract is shattered.',
        'The hidden version is worse. The count of tests is often not written down. Trying a metric, then a subgroup, then a time window, then excluding an outlier is a sequence of tests with no official registry. The analyst followed a fork the data suggested, and that fork was another chance for noise to dress up as signal. Researcher degrees of freedom, the garden of forking paths, and p-hacking are all names for the same compounding.',
        'This is the multiple comparisons crisis in science. Ioannidis (2005) argued that most published research findings are false, and one of the primary mechanisms is exactly this: many comparisons tested, few reported, and the survivors presented as if they were the only question asked. The replication crisis in psychology, cancer biology, and economics traces back in large part to uncorrected multiplicity.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Three corrections dominate practice. Each trades power for a different error guarantee.',
        'Bonferroni (1936): divide alpha by k and test each p-value against alpha/k. With 20 tests at alpha = 0.05, each must clear p < 0.0025. The proof is the union bound: P(any false positive) <= sum of per-test error rates = k * (alpha/k) = alpha. No independence assumption is needed. The cost is brutal power loss -- real effects need roughly sqrt(k) times the sample size to survive the higher bar.',
        'Holm (1979): sort p-values smallest to largest. Test the smallest against alpha/k, the next against alpha/(k-1), and so on, stopping at the first failure. All later hypotheses are retained as non-significant. Holm provides the identical FWER guarantee as Bonferroni but rejects at least as many hypotheses. There is no reason to prefer plain Bonferroni over Holm.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Benjamini-Hochberg step-up procedure\nfunction benjaminiHochberg(pValues, q) {\n  const n = pValues.length;\n  // Pair each p-value with its original index, then sort ascending\n  const sorted = pValues\n    .map((p, i) => ({ p, i }))\n    .sort((a, b) => a.p - b.p);\n\n  // Find the largest rank k where p_(k) <= (k/n) * q\n  let cutoff = -1;\n  for (let k = 0; k < n; k++) {\n    const threshold = ((k + 1) / n) * q;\n    if (sorted[k].p <= threshold) cutoff = k;\n  }\n\n  // Reject all hypotheses with rank <= cutoff\n  const rejected = new Array(n).fill(false);\n  for (let k = 0; k <= cutoff; k++) {\n    rejected[sorted[k].i] = true;\n  }\n  return rejected;\n}',
        },
        'Benjamini-Hochberg (1995): sort p-values ascending. Draw a rising line where the threshold at rank i is (i/k) * q. Find the largest rank where the p-value falls below its threshold. Accept all ranks up to and including that point. The guarantee is different: among accepted discoveries, the expected fraction of false positives is at most q. This is the false discovery rate (FDR).',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Bonferroni works because the union bound caps total error. If each of k null tests can falsely reject with probability at most alpha/k, the probability that any of them rejects is at most k * (alpha/k) = alpha. The bound can overcount when tests are correlated, making it conservative, but conservatism is the point when any false positive triggers an expensive decision.',
        'Holm works by spending the same budget more carefully. Once the smallest p-value passes the strictest test (alpha/k), the worst-case first false positive has been handled. The remaining family is smaller, so the next threshold can relax to alpha/(k-1) without exceeding the original FWER budget. The step-down stop rule prevents later results from being interpreted after a weak earlier result.',
        {
          type: 'diagram',
          label: 'P-value distribution under null vs alternative hypotheses',
          text: 'Under H0 (null true):     p-values are Uniform(0,1)\n|####|####|####|####|####|    equal density across [0, 1]\n0   0.2  0.4  0.6  0.8  1.0\n\nUnder H1 (real effect):   p-values pile up near zero\n|################|##|#| |     heavy left skew\n0   0.2  0.4  0.6  0.8  1.0\n\nMixture (some null, some real):\n|############|####|##|#|#|    spike near 0 from real effects\n0   0.2  0.4  0.6  0.8  1.0  + uniform floor from nulls\n\nBH exploits this shape: the rising threshold (i/k)*q\ntracks the expected null contribution at each rank.\nReal signals cluster at low ranks, lifting the cutoff.',
        },
        'BH works because true effects produce p-values concentrated near zero, while null hypotheses produce p-values uniformly spread across [0, 1]. When the sorted p-values are compared against the rising line (i/k)*q, genuine signals cluster at low ranks and pull the cutoff upward. A family of pure null p-values rarely generates enough small values to push the cutoff past a few ranks. Under independence (or positive regression dependence), the expected false discovery proportion among rejections stays at or below q.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Computation is negligible. Bonferroni costs O(k) -- one division and k comparisons. Holm and BH cost O(k log k) for the sort. In every practical setting, collecting the data dwarfs the correction arithmetic by orders of magnitude.',
        'The real cost is statistical power. A stricter threshold means a true effect needs more evidence to be detected. Bonferroni with k = 100 tests requires each p-value below 0.0005, which at fixed sample size converts many genuine effects into non-discoveries. BH recovers power by accepting a controlled impurity: four discoveries with an expected 5% false rate, instead of two pristine ones.',
        'The governance cost is hardest. Someone must define the family before looking at results, record which metric is primary, and separate confirmatory from exploratory analysis. A notebook full of after-the-fact choices cannot be repaired by any formula. The formula needs an honest count of every chance the analyst gave to noise.',
        {
          type: 'table',
          headers: ['Method', 'Error controlled', 'Power', 'Independence required?', 'Best for'],
          rows: [
            ['Bonferroni', 'FWER <= alpha', 'Lowest -- divides alpha by k', 'No', 'Few tests, any false positive is costly'],
            ['Holm step-down', 'FWER <= alpha', 'Strictly better than Bonferroni', 'No', 'Same as Bonferroni, no reason not to upgrade'],
            ['Benjamini-Hochberg', 'FDR <= q', 'Much higher than FWER methods', 'Yes (or PRDS)', 'Large screens with follow-up validation'],
            ['Benjamini-Yekutieli', 'FDR <= q', 'Lower than BH, higher than Bonferroni', 'No', 'Correlated tests where BH assumptions fail'],
          ],
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Use FWER control (Holm) when one false positive triggers an expensive irreversible decision. Drug approval by the FDA requires FWER control over co-primary endpoints. Ship/no-ship decisions on a product launch where the wrong call costs engineering quarters belong here. Security alerts that page a human at 3 AM belong here. The cost of a false alarm is concrete and high.',
        'Use FDR control (BH) when discovery volume matters and follow-up exists. Genomics screens 20,000 genes and needs a workable shortlist for wet-lab validation. Feature mining over hundreds of signals needs candidates for the next experiment. Anomaly triage in production logs needs a prioritized list, not a single verdict. A small, bounded impurity is the right bargain when downstream review catches the fakes.',
        'Use pre-registration when the real question is known in advance. Declare one primary metric before the experiment starts; judge the launch decision on it alone at full alpha; label everything else exploratory. No correction needed, full power preserved, forking paths fenced off. This is the cheapest and most powerful "correction" -- discipline applied to the question rather than to the arithmetic.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Corrections can be too conservative when applied without judgment. If one primary endpoint was honestly chosen before the experiment, correcting it jointly with every diagnostic chart wastes power on a problem that does not exist. If a hundred exploratory charts were inspected after the fact, pretending only one test happened is worse -- the correction is too lenient. The boundary between confirmatory and exploratory work must be part of the design, not a narrative added after results appear.',
        'Corrections do not fix biased data. Confounding, data leakage, bad randomization, optional stopping, and broken measurement can produce small p-values that are meaningless under any multiplicity rule. A beautifully corrected analysis of a confounded experiment is still wrong. The correction controls the rate of false discoveries from sampling noise; it says nothing about systematic errors.',
        'BH can be mismatched to dependence structure. Its standard proof requires independence or positive regression dependence on each null (PRDS). Correlated metrics, repeated-measures designs, overlapping cohorts, and adaptive analysis plans can violate these assumptions. Benjamini-Yekutieli (BY) provides FDR control under arbitrary dependence, but at a further power cost. Permutation-based FDR or hierarchical testing may be more appropriate for complex dependence.',
        {
          type: 'note',
          text: 'No correction can recover from a poorly defined family. If the analyst decides which tests belong to the family after seeing results, the correction is applied to a gerrymandered set and its guarantee is void. The family must be declared before the data are examined.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Bonferroni, C. E. (1936). "Teoria statistica delle classi e calcolo delle probabilita." The original union-bound argument for dividing alpha across a family of tests.',
            'Holm, S. (1979). "A simple sequentially rejective multiple test procedure." Scandinavian Journal of Statistics. The step-down improvement that dominates Bonferroni for the same FWER guarantee.',
            'Benjamini, Y. and Hochberg, Y. (1995). "Controlling the False Discovery Rate: A Practical and Powerful Approach to Multiple Testing." Journal of the Royal Statistical Society B. The foundational FDR paper.',
            'Benjamini, Y. and Yekutieli, D. (2001). "The Control of the False Discovery Rate in Multiple Testing under Dependency." Annals of Statistics. FDR control without independence assumptions.',
            'Ioannidis, J. P. A. (2005). "Why Most Published Research Findings Are False." PLoS Medicine. The paper that brought the multiple comparisons crisis to broad scientific attention.',
          ],
        },
        'Prerequisite: study A/B Testing and p-values for the single-test contract that multiplicity breaks. Study Statistical Power and Sample Size to understand why stricter thresholds cost sample size. Extension: study Causal Graphs, Confounding, and Simpson\'s Paradox to separate planned causal questions from subgroup fishing. For the ML version, study Cross-Validation and Honest Evaluation and Data Leakage -- they teach the same law in a different language: every time the evaluation signal influences a choice, the signal is being spent.',
      ],
    },
  ],
};

