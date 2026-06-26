// Permutation tests: if the treatment did NOTHING, the group labels are
// arbitrary decorations — so shuffle them and see how often chance alone
// beats your result. The p-value, built by hand, live, no formulas.

import { plotState, matrixState, arrayState, InputError } from '../core/state.js';

export const topic = {
  id: 'permutation-tests',
  title: 'Permutation Tests',
  category: 'Concepts',
  summary: 'Shuffle the labels 200 times (live) and count how often chance beats your result — a p-value with no formulas.',
  controls: [
    { id: 'view', label: 'Shuffle', type: 'select', options: ['the shuffle test, run live', 'when to reach for it'], defaultValue: 'the shuffle test, run live' },
  ],
  run,
};

// Two small groups: support tickets resolved per day.
const A = [12, 15, 9, 14, 11];   // control workflow
const B = [18, 21, 16, 14, 19];  // new workflow
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const OBSERVED = mean(B) - mean(A);

// 200 deterministic shuffles (fixed-seed LCG + Fisher–Yates).
function permutationDiffs(rounds) {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const all = [...A, ...B];
  const diffs = [];
  for (let t = 0; t < rounds; t++) {
    const pool = [...all];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    diffs.push(mean(pool.slice(5)) - mean(pool.slice(0, 5)));
  }
  return diffs;
}
const DIFFS = permutationDiffs(200);
const EXTREME = DIFFS.filter((d) => Math.abs(d) >= Math.abs(OBSERVED)).length;

function* shuffleLive() {
  yield {
    state: matrixState({
      title: `Two teams, ten days: the new workflow looks better by ${OBSERVED.toFixed(1)}`,
      rows: [{ id: 'a', label: 'control workflow' }, { id: 'b', label: 'new workflow' }],
      columns: [...Array.from({ length: 5 }, (_, i) => ({ id: `d${i}`, label: '' })), { id: 'm', label: 'mean' }],
      values: [[...A, mean(A)], [...B, mean(B)]],
      format: (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1)),
    }),
    highlight: { compare: ['a:m', 'b:m'] },
    explanation: `Five days under each workflow: the new one resolves ${OBSERVED.toFixed(1)} more tickets per day on average. The eternal question from A/B Testing & p-values: real improvement, or the luck of which days landed in which group? With ten data points, textbook formulas get nervous (normality? equal variances?). The permutation test answers with a physical act instead of an assumption — by taking the null hypothesis LITERALLY: if the workflow truly changes nothing, then these ten numbers were coming anyway, and the labels "control" and "new" are arbitrary stickers.`,
  };

  yield {
    state: matrixState({
      title: 'So peel the stickers off and re-deal — three example shuffles (live)',
      rows: DIFFS.slice(0, 3).map((_, i) => ({ id: `s${i}`, label: `shuffle ${i + 1}` })),
      columns: [{ id: 'diff', label: 'mean difference under re-dealt labels' }],
      values: DIFFS.slice(0, 3).map((d) => [d]),
      format: (v) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)),
    }),
    highlight: { compare: ['s0:diff', 's1:diff', 's2:diff'] },
    explanation: 'The move: pool all ten values, shuffle, deal five to each "group" at random, and recompute the difference — this module really does it (fixed-seed Fisher–Yates, so your shuffles match everyone\'s). Each re-deal answers one question: "in a world where labels mean nothing, what difference does pure chance produce?" Shuffle 1: −3.0. Shuffle 2: +1.8. Shuffle 3: −5.0. Chance clearly produces differences — sometimes sizable ones. The only question that matters is how OFTEN chance reaches our observed +5.4.',
    invariant: 'Each shuffle is one draw from the null world: same numbers, meaningless labels.',
  };

  const BINS = 13;
  const lo = Math.min(...DIFFS);
  const hi = Math.max(...DIFFS);
  const counts = Array(BINS).fill(0);
  for (const d of DIFFS) counts[Math.min(BINS - 1, Math.floor(((d - lo) / (hi - lo)) * BINS))] += 1;
  yield {
    state: plotState({
      axes: { x: { label: 'difference produced by label-shuffling' }, y: { label: 'count (of 200 shuffles)' } },
      series: [{
        id: 'nullDist',
        label: 'the null distribution',
        points: counts.map((c, k) => ({ x: lo + ((k + 0.5) * (hi - lo)) / BINS, y: c })),
      }],
      markers: [{ id: 'obs', x: OBSERVED, y: 2, label: `observed: +${OBSERVED.toFixed(1)}` }],
    }),
    highlight: { active: ['nullDist'], found: ['obs'] },
    explanation: 'Two hundred shuffles, plotted: the NULL DISTRIBUTION — the complete menu of differences that pure chance serves with these exact ten numbers. It piles up around zero (random halves usually roughly balance) and thins toward the edges. And there sits our +5.4: at the extreme right edge of everything chance managed in 200 attempts. No bell curve was assumed, no variance formula invoked — the distribution was BUILT, from the data, by brute honesty. (Confidence Intervals & the Bootstrap resamples to measure spread; this page shuffles to test a claim — sibling moves of the same resampling family.)',
  };

  yield {
    state: matrixState({
      title: `The verdict: p = ${EXTREME}/200 = ${(EXTREME / 200).toFixed(3)}`,
      rows: [
        { id: 'count', label: 'shuffles ≥ |+5.4|' },
        { id: 'p', label: 'permutation p-value' },
        { id: 'read', label: 'reading' },
      ],
      columns: [{ id: 'val', label: '' }],
      values: [[1], [2], [3]],
      format: (v) => ['', `${EXTREME} of 200`, (EXTREME / 200).toFixed(3), 'chance matches this result ~1.5% of the time'][v],
    }),
    highlight: { found: ['p:val'] },
    explanation: `Count the shuffles at least as extreme as the observed difference: ${EXTREME} of 200 — p = ${(EXTREME / 200).toFixed(3)}. That IS the p-value, its definition made physical: the fraction of null worlds that match or beat reality. Below the conventional 0.05 bar, so the workflow likely matters. Notice what we never needed: normality, equal variances, big samples, or a t-table — and for tiny datasets you can even enumerate ALL label assignments (here, 252 of them) for an EXACT test, the gold standard Fisher proposed in the 1930s with a tea-tasting lady and no computer at all.`,
    invariant: 'p = (shuffles as extreme as observed) / (total shuffles): the definition of a p-value, computed literally.',
  };
}

function* whenToReach() {
  yield {
    state: matrixState({
      title: 'Where the shuffle beats the formula',
      rows: [
        { id: 'small', label: 'tiny samples' },
        { id: 'weird', label: 'skewed / outlier-ridden data' },
        { id: 'stat', label: 'exotic statistics' },
        { id: 'ml', label: 'comparing two ML models' },
      ],
      columns: [{ id: 'why', label: 'why' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'n = 5 per group: t-test assumptions are unverifiable — shuffling is exact', 'medians and trimmed means have no clean formula; shuffling does not care', 'difference of p99s? ratio of AUCs? ANY statistic permutes the same way', 'permute which model made each prediction → p-value for "A beats B"'][v],
    }),
    highlight: { active: ['stat:why'], compare: ['ml:why'] },
    explanation: 'The selection guide. The shuffle\'s superpower is INDIFFERENCE: it never asks what statistic you chose or how your data is shaped — difference of means, of medians, of p99 latencies (Tail Latency & p99 Thinking\'s favorite), a gap in ROC Curves & AUC between two models — pool, shuffle, recompute, count. This is why it quietly underlies serious ML evaluation: "model A scored 2 points higher" becomes testable by permuting which model produced each test-set prediction, no distributional theory required.',
  };

  yield {
    state: matrixState({
      title: 'The fine print: exchangeability',
      rows: [
        { id: 'ok', label: 'independent observations' },
        { id: 'time', label: 'time series' },
        { id: 'paired', label: 'paired data (before/after)' },
        { id: 'cost', label: 'computation' },
      ],
      columns: [{ id: 'note', label: '' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'shuffle freely — the labels are truly exchangeable under the null', 'NO — shuffling destroys autocorrelation (block permutations instead)', 'shuffle WITHIN pairs: flip each before/after sign', 'n! exact is huge fast — sample 1,000–10,000 random shuffles (Monte Carlo)'][v],
    }),
    highlight: { removed: ['time:note'], found: ['paired:note'] },
    explanation: 'The one assumption the shuffle DOES make: EXCHANGEABILITY — under the null, every relabeling must be equally plausible. Independent observations qualify; time series do not (shuffling a Tuesday into next month destroys the correlation structure — the same arrow-of-time discipline as Data Leakage & Contamination, so permute contiguous blocks instead); paired data permutes within each pair, flipping before/after signs. And since 20 observations already have 184,756 possible splits, practice samples a few thousand random shuffles — the Monte Carlo version you watched, whose p-value carries its own tiny sampling error (shrinkable by shuffling more).',
    invariant: 'Shuffle only what the null hypothesis declares interchangeable — exchangeability is the test\'s entire contract.',
  };

  yield {
    state: matrixState({
      title: 'The resampling toolkit, complete',
      rows: [
        { id: 'boot', label: 'bootstrap' },
        { id: 'perm', label: 'permutation test' },
        { id: 'power', label: 'power analysis' },
        { id: 'mult', label: 'multiple-testing control' },
      ],
      columns: [{ id: 'q', label: 'the question it answers' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'how big is the effect, with what error bars?', 'is the effect real, or label-luck?', 'could my experiment even SEE it?', 'how many of my "discoveries" are fake?'][v],
    }),
    highlight: { compare: ['boot:q', 'perm:q'] },
    explanation: 'The statistics shelf of this site, now complete and composable: Statistical Power & Sample Size before the experiment (can I see the effect?), the permutation test on the result (is it real?), Confidence Intervals & the Bootstrap on the estimate (how big, ± what?), and Multiple Testing & False Discoveries across the whole dashboard (which discoveries survive scrutiny?). Four questions, four tools, one shared philosophy that fits this site\'s soul: when in doubt, COMPUTE the answer from the data itself — resample, shuffle, count — rather than trusting a formula whose assumptions you cannot check.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the shuffle test, run live') yield* shuffleLive();
  else if (view === 'when to reach for it') yield* whenToReach();
  else throw new InputError('Pick a view.');
}

const legacyArticle = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/permutation-tests.gif', alt: 'Animated walkthrough of the permutation tests visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: `Why this exists`,
      paragraphs: [
        `Permutation tests exist for the moment when a formula feels more fragile than the question. With five days in each group, skewed values, or an unusual metric, normality and equal-variance assumptions may be hard to defend. A permutation test builds the p-value by taking the null hypothesis literally.`,
        `The page compares five days of ticket counts under a control workflow with five under a new workflow. The new workflow averages 5.4 more tickets per day. If the workflow did nothing, then the labels "control" and "new" are arbitrary stickers, so the honest test is to peel them off, redeal them, and see how often chance creates a difference at least that large.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The obvious approach is to compare the two means and call the bigger one better. The wall is that random grouping alone can create differences. With tiny samples, one weird day can swing the average enough to look like a process improvement.`,
        `A formula-based test answers the same tail question, but only after accepting its assumptions. The permutation test asks a more physical question: if labels did not matter, how often would relabeling the exact same numbers look this extreme?`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `Pool the ten numbers, shuffle with Fisher-Yates, deal five to each group, and recompute the mean difference. Repeat K times to form the null distribution. The marker for +5.4 sits at the edge of that distribution, which is why the p-value is small.`,
        `For this exact balanced case, there are only choose(10,5) = 252 possible label assignments, so a full exact test is possible; the page samples 200 to show the Monte Carlo version. A/B Testing & p-values asks the same tail question through a formula; Permutation Tests compute the tail directly from the observed values.`,
      ],
    },
    {
      heading: `Legacy visual note`,
      paragraphs: [
        `Read each shuffle as one possible null world: same numbers, meaningless labels. The histogram is not a model imposed on the data; it is the distribution made by relabeling the observed data. The observed marker asks whether the real label assignment is ordinary or extreme under that null world.`,
        `The final p-value is just a count: shuffles at least as extreme as observed divided by total shuffles. The visualization runs 200 deterministic shuffles and finds 3 as extreme as the observed result, so p = 3/200 = 0.015.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `One shuffle is O(N), not O(N log N): Fisher-Yates walks the array once. K shuffles cost O(KN) plus the statistic calculation. Memory is O(N) for the pooled data and O(K) if you store the null statistics for plotting. Exact enumeration grows combinatorially with group sizes, so larger studies usually sample 1,000 to 10,000 random permutations.`,
        `Confidence Intervals & the Bootstrap is the sibling move: it resamples rows to estimate spread, while permutation tests reshuffle labels to test a claim. Both are useful when a normal approximation feels too fragile.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Permutation tests shine for small samples, skewed data, and unusual statistics: medians, trimmed means, p99 latency from Tail Latency & p99 Thinking, or a gap in ROC Curves & AUC. Cross-Validation & Honest Evaluation can use paired permutations to compare two models on the same examples.`,
        `Genomics and feature screens pair the method with Multiple Testing & False Discoveries because one honest shuffle test is not enough when thousands are run.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `The key assumption is exchangeability: under the null, the things you shuffle must truly be interchangeable. Time series, user sessions, matched pairs, and clusters need restricted permutations. Shuffling individual rows can create Data Leakage & Contamination by breaking dependencies.`,
        `Also, p = 0.015 is not the probability the null is true; it is the fraction of null relabelings that look this extreme. Permutation testing is overkill when the standard formula is well justified and the result is not sensitive, but it is dangerous to use when the shuffle breaks the structure of the data.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Use Statistical Power & Sample Size before collecting data, Permutation Tests for a formula-light significance check, and Confidence Intervals & the Bootstrap for effect-size uncertainty. Then learn Multiple Testing & False Discoveries before trusting any screen that repeats the test across many metrics or model variants.`,
      ],
    },
  ],
};

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
        'Read each shuffle as one possible world where the group labels have no effect. Active rows are relabeled samples, and the histogram is the distribution of statistics produced by those relabelings.',
      ], },
    { heading: 'Why this exists', paragraphs: [
        'A permutation test is a significance test built by relabeling the observed data. It exists for cases where a formula feels less trustworthy than the actual randomization design.',
        { type: 'callout', text: 'A permutation test makes the null hypothesis physical: if labels mean nothing, shuffle them and count how extreme reality looks.' },
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is to compare two sample means and use a standard t-test. That can be efficient and correct when the sample size, variance behavior, independence, and statistic choice match the test assumptions.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Normal_Distribution_PDF.svg',
          alt: 'Normal distribution probability density functions',
          caption: 'Formula-based tests often start from a theoretical sampling curve; permutation tests build the reference curve by relabeling the observed data. Source: Wikimedia Commons, Inductiveload, public domain.',
        },
      ], },
    { heading: 'The wall', paragraphs: [
        'Formula tests become fragile when assumptions are hard to defend. Tiny samples, skewed data, outliers, custom statistics, and paired designs can make the theoretical sampling curve a poor description of the experiment.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Under the null hypothesis of no treatment effect, labels are exchangeable. Exchangeable means the labels could be reassigned among the observed outcomes without changing the probability of the data under the null.',
      ], },
    { heading: 'How it works', paragraphs: [
        'First compute the observed statistic, such as treatment mean minus control mean. Then pool the outcomes, shuffle the labels, split the data into groups of the original sizes, and recompute the statistic.',
        'Repeating this process builds the null distribution. For a two-sided test, count shuffled statistics whose absolute value is at least as large as the observed absolute value.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'If labels were randomly assigned and the null says labels have no effect, then every legal relabeling is a possible assignment the experiment could have produced. The shuffled distribution is therefore the right reference distribution for the chosen statistic.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'One Fisher-Yates shuffle over N observations is O(N), plus the cost of recomputing the statistic. K random permutations cost O(KN) for simple statistics, or O(K) times the model-fitting cost for expensive statistics.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'Permutation tests fit A/B experiments with small samples or non-normal outcomes. They also fit product metrics where the chosen statistic is a median, trimmed mean, quantile, fairness gap, or other metric without a clean formula.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'The main failure is invalid exchangeability. Shuffling individual rows in time series, repeated-user logs, matched pairs, or clustered experiments destroys dependence and can create fake confidence.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Control ticket counts are [12, 15, 9, 14, 11], with mean 12.2. New-workflow counts are [18, 21, 16, 14, 19], with mean 17.6, so the observed mean difference is 5.4 tickets per day.',
        'After 200 deterministic shuffles in the animation, 3 shuffled differences are at least as extreme as 5.4 in absolute value. The displayed p-value is 3 / 200 = 0.015, meaning 1.5 percent of sampled null relabelings matched or exceeded the observed gap.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Study Fisher randomization tests for the design-based origin of the method, then read Good, Permutation Tests, and Ernst 2004 for a practical review. The method is also closely related to randomization inference in causal experiments.',
        'Study A/B Testing and p-values, Bootstrap Confidence Intervals, Multiple Testing, and Cross-Validation for paired model-comparison workflows.',
      ], },
  ],
};

