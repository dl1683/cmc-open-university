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

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A permutation test answers the hardest question in statistics: is my result real, or just the luck of which data fell into which group? Instead of assuming your data follows a normal distribution or trusting a formula, it shuffles the group labels 200 times and counts how often pure chance beats your observed difference. If your result is so extreme that it appears in fewer than 5 percent of shuffles, you declare it significant — not because a table told you to, but because you built the answer yourself from the data.`,
        `The null hypothesis, taken literally, is this: if the treatment did nothing, then these numbers were coming anyway, and the labels "control" and "new" are arbitrary stickers you can peel off and re-deal. Pool all the data, shuffle it, deal it back into groups at random, and recompute your test statistic. The p-value emerges from counting: it is the fraction of shuffles that matched or beat reality. For the two five-day workflows in this module, the observed difference is +5.4 tickets per day. Only 3 of 200 shuffles produced a difference that extreme, so p = 3/200 = 0.015 — well below the conventional 0.05 threshold, suggesting the new workflow likely matters.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start with your data: ten ticket counts split into control (12, 15, 9, 14, 11) and new workflow (18, 21, 16, 14, 19). The observed difference in means is +5.4. Now, the shuffle: combine all ten numbers into one pool. Use a fixed-seed random number generator (deterministic, so everyone's shuffles match) and Fisher–Yates to rearrange the pool. Deal the first five values to the "control" group and the last five to the "new" group, even though the labels are now meaningless. Compute the difference in means under this re-dealt assignment. Store it. Repeat 200 times.`,
        `Each shuffle answers one question: in a world where labels mean nothing and the null is true, what difference does pure chance produce? The shuffles cluster near zero — when you randomly divide numbers, halves usually balance — but occasionally extreme shuffles spike upward or downward. The distribution you build is called the null distribution; it is the complete menu of outcomes chance can serve. Your observed +5.4 sits at the extreme edge of this distribution. Count how many shuffles were at least as extreme as +5.4 in absolute value (either direction): 3 shuffles qualified. That count, divided by 200, is your p-value.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Computing a permutation test is brutally simple: pool N values, shuffle K times (typically 200 to 10,000 to shrink Monte Carlo error), and count. Each shuffle is O(N log N) for Fisher–Yates, so K shuffles cost O(K N log N). For the ten values here, that is negligible. For 10,000 observations, 10,000 shuffles still completes in seconds on a laptop — well within reach for exploratory statistics.`,
        `The only constraint is that there are N! possible label permutations. With ten observations, there are 3,628,800 exact reassignments. With 20, there are 2.4 quintillion — too vast to enumerate. So permutation tests sample via Monte Carlo: you draw 10,000 random shuffles and estimate the true p-value from that sample. The sample p-value carries a tiny statistical error (shrinkable by shuffling more), but for practical inference, 1,000–10,000 shuffles suffice. Storage is O(N) for the data and O(K) for storing shuffle statistics; memory is never the bottleneck.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `The permutation test is the gold standard for small samples and exotic statistics. Fisher developed the exact version in the 1930s for the famous tea-tasting lady experiment, which had only 8 cups — impossible for a t-test to verify. Today, it is the weapon of choice in A/B Testing & p-values when you cannot assume normality or have unequal sample sizes. Genomics uses permutation tests to ask: is this SNP truly associated with disease, or label-shuffling, when testing thousands of genetic markers? Machine learning deploys it for model comparison: permute which model made each test-set prediction and ask "does Model A truly beat Model B, or is the 2-point difference just re-sampling luck?" The beauty is indifference: it does not care what statistic you chose — difference of means, of medians, of AUC, of p99 latencies. Pool, shuffle, recompute, count. Any test statistic permutes the same way.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The critical assumption is exchangeability: under the null, every re-labeling must be equally plausible. For independent observations, this holds. But time series break it — shuffling a Tuesday into next month destroys the auto-correlation that makes the time series a time series, introducing the same Data Leakage & Contamination trap. Instead, permute contiguous blocks (block permutations) to preserve the temporal structure. Paired data (before and after) must permute within each pair, flipping signs — you cannot swap person A's "before" with person B's "after."`,
        `A second trap: p = 0.05 does not mean a 5 percent chance the null is true. It means: if the null is true, we would see this result 5 percent of the time by chance. These are not the same thing — Bayesian and frequentist worlds disagree on what probability means. Also, the permutation p-value from 200 shuffles carries Monte Carlo error (if 3 of 200 shuffles are extreme, the true p might be 1.2 percent or 2.1 percent, not exactly 1.5 percent). Shuffle more if precision matters. Finally, do not confuse this with Confidence Intervals & the Bootstrap, which resample to measure spread — a sibling move from the resampling family, but answering a different question.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Permutation tests detect whether an effect is real; Confidence Intervals & the Bootstrap measure how big the effect is and how much noise surrounds it. A/B Testing & p-values grounds the language of significance and p-thresholds; Multiple Testing & False Discoveries shows why declaring "significant" 20 times on a dashboard is not 20 truths — many are false positives requiring correction. Statistical Power & Sample Size asks the forward question: before the experiment, could my design even see the effect if it is real? Master these four tools — they form the complete resampling and inference toolkit on this site.`,
      ],
    },
  ],
};

