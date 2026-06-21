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
    {
      heading: 'Why this exists',
      paragraphs: [
        'Permutation tests exist for the moment when you want a significance test but do not want to lean on a fragile distribution formula. Instead of assuming a t distribution, normality, equal variances, or a large-sample approximation, the test builds the null distribution directly from the observed data.',
        { type: 'callout', text: 'A permutation test makes the null hypothesis physical: if labels mean nothing, shuffle them and count how extreme reality looks.' },
        'The question is simple: if the treatment labels did not matter, how unusual would the observed difference be? A permutation test answers by repeatedly shuffling labels, recomputing the statistic, and seeing where the real statistic falls among the shuffled worlds.',
        'This makes the method especially valuable pedagogically. A p-value stops being a mysterious table lookup and becomes a count: among the worlds where labels are irrelevant, how many produced a statistic at least this extreme?',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to compare two sample means and look up a p-value in a standard test. That is efficient and often right. It can also hide assumptions about sampling, variance, shape, and test statistic behavior.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Normal_Distribution_PDF.svg',
          alt: 'Normal distribution probability density functions',
          caption: 'Formula-based tests often start from a theoretical sampling curve; permutation tests build the reference curve by relabeling the observed data. Source: Wikimedia Commons, Inductiveload, public domain.',
        },
        'Another tempting approach is to eyeball the difference. That fails because noisy samples produce differences even when no real effect exists. A permutation test gives the noise a concrete shape by asking what differences appear when the labels are made irrelevant.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Under the null hypothesis of no treatment effect, the group labels are exchangeable. If treatment did nothing, the observed outcomes could have been assigned to treatment or control in many equally plausible ways. Shuffling labels simulates those equally plausible assignments.',
        'The statistic can be a mean difference, median difference, rank statistic, regression coefficient, accuracy gap, or any quantity the study cares about. The permutation test is a wrapper around the statistic: it asks whether the observed statistic is extreme under label exchangeability.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First compute the observed statistic using the real labels. Then shuffle the labels while keeping the outcome values fixed. For each shuffle, recompute the statistic. The shuffled statistics form the null distribution expected if labels carried no information.',
        'The p-value is the fraction of shuffled statistics at least as extreme as the observed statistic, with the tail direction chosen before looking at results. For a two-sided test, count values whose absolute distance from the null center is at least as large as the observed distance.',
        'Small datasets may allow exact enumeration of every possible label assignment. Larger datasets use Monte Carlo permutations. More permutations give a finer p-value resolution, but the method remains conceptually the same.',
        'Many implementations add one to the numerator and denominator for Monte Carlo tests: (extreme + 1) / (permutations + 1). That avoids reporting an impossible p-value of zero when a finite random sample simply did not happen to generate a more extreme shuffle.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The shuffle view proves that the test is not inventing a theoretical curve. It builds a reference distribution from the data itself under the rule that labels are exchangeable. Every bar in the histogram is a possible world where the null is true.',
        'The observed-statistic marker proves the p-value idea. If the real marker lies deep in the tail of the shuffled distribution, the real labeling produced a difference that label noise rarely produces. If it lies near the center, the data are compatible with no label effect.',
        'The visual should also make sample size visible. With tiny samples, there may be only a small number of distinct label assignments, so the null distribution is chunky. That chunkiness is not a rendering flaw; it is the real resolution of the design.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The test works when exchangeability is valid. If labels were randomly assigned and the null says labels do not affect outcomes, then relabeling creates outcomes that are just as plausible as the observed labeling. The shuffled distribution is therefore the right reference for the statistic.',
        'It is powerful because it separates the statistic from the null generator. You can test a statistic that is awkward to analyze algebraically, as long as you can compute it and the permutation scheme matches the study design.',
        'This is why the method is often called randomization inference when the labels came from an actual random assignment. The randomness used by the test is not imaginary; it mirrors the assignment mechanism that made treatment and control comparable in the first place.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The cost is computation. If each statistic is cheap, thousands of permutations are easy. If the statistic requires fitting a model, each permutation may be expensive. Exact tests can become impossible when the number of label assignments is huge.',
        'The tradeoff is assumption shape. Permutation tests avoid some parametric assumptions, but they add a design assumption: the data are exchangeable under the null. If the sampling design has blocks, pairs, clusters, time order, or repeated users, the permutation must respect that structure.',
        'There is also a resolution tradeoff. With 999 random permutations, the smallest practical p-value is about 0.001 if using the plus-one correction. If a study needs very small p-values, it needs many more permutations or an exact combinatorial calculation.',
        'For exact tests, the number of assignments grows combinatorially. A balanced ten-row example has only choose(10, 5) assignments, but a balanced hundred-row experiment has an astronomical number. That is why Monte Carlo permutation is the usual production tool.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Permutation tests are useful for A/B experiments, small samples, non-normal outcomes, robust statistics, rank-based comparisons, model-evaluation differences, and classroom demonstrations of p-values. They make the null distribution visible.',
        'They are especially good when the test statistic is custom. If a product team cares about the median change, a trimmed mean, a fairness gap, or a strange but predeclared utility metric, permutation can test that exact statistic instead of forcing the question into a canned formula.',
        'They also help debug surprising results. If a normal-theory test and a permutation test disagree sharply, that is a signal to inspect skew, outliers, unequal variance, dependency, or a statistic whose sampling behavior is not close to the textbook approximation.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The biggest failure is shuffling labels that should not be shuffled. Paired studies must shuffle signs or swap within pairs. Clustered studies must permute clusters. Time series may need block permutations or a different design. Breaking the dependency structure creates fake certainty.',
        'Another failure is choosing the statistic after trying many options. The test is honest only if the analysis plan is honest. If you search many statistics and report the smallest p-value, you need multiple-testing correction or a new validation set.',
        'A third failure is confusing statistical extremeness with practical importance. A tiny effect can be significant with enough data. A large-looking effect can be too uncertain to trust. Report the observed effect size alongside the permutation p-value.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Bootstrap Confidence Intervals for resampling aimed at uncertainty intervals rather than null tests. Study A/B Testing and p-values for experiment framing, Multiple Testing for many comparisons, Randomization Inference for design-based causal logic, and Cross-Validation for model evaluation workflows.',
        'A useful exercise is to run the same dataset through a t-test and a permutation test, then plot the permutation histogram. The goal is not to memorize which test is better, but to see which assumptions are doing work in each answer.',
        'Then repeat the exercise with paired data and force yourself to choose a valid permutation scheme. That step teaches the real skill: matching the shuffle to the design instead of treating permutation as a universal button.',
      ],
    },
  ],
};
