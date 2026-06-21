// Regression discontinuity: a scholarship cutoff at score 70 means the kids
// at 69 and 70 are practically twins — and the JUMP in outcomes at the line
// is the causal effect, read straight off the graph. Computed live.

import { matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'regression-discontinuity',
  title: 'Regression Discontinuity',
  category: 'Concepts',
  summary: 'A deterministic cutoff manufactures a local experiment: fit a line on each side and read the gap at the threshold.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['the jump at the cutoff', 'bandwidth, bunching & fuzzy RD'], defaultValue: 'the jump at the cutoff' },
  ],
  run,
};

// The synthetic world, fully known: scholarship iff score ≥ 70.
//   earnings = 20 + 0.5·score + 8·scholarship  → TRUE effect = +8.
// Ability rises smoothly with score (the 0.5 slope) — the confounder that
// wrecks every global comparison and cancels in a local one.
const CUT = 70;
const TRUE_EFFECT = 8;
const earn = (s) => 20 + 0.5 * s + (s >= CUT ? TRUE_EFFECT : 0);
const SCORES = [];
for (let s = 40; s <= 100; s += 1) SCORES.push(s);

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
// OLS line fit through (score, earnings) points; returns value at the cutoff.
function fitAt(points, x0) {
  const mx = mean(points.map((p) => p.x));
  const my = mean(points.map((p) => p.y));
  let cov = 0;
  let varX = 0;
  for (const p of points) {
    cov += (p.x - mx) * (p.y - my);
    varX += (p.x - mx) ** 2;
  }
  const slope = cov / varX;
  return my + slope * (x0 - mx);
}
const side = (lo, hi, f = earn) => SCORES.filter((s) => s >= lo && s <= hi).map((s) => ({ x: s, y: f(s) }));

// Naive global comparison: everyone with vs without the scholarship.
const NAIVE = mean(SCORES.filter((s) => s >= CUT).map(earn)) - mean(SCORES.filter((s) => s < CUT).map(earn));
// Local means in a ±5 band: better, still slope-contaminated.
const H = 5;
const LOCAL_MEANS = mean(side(CUT, CUT + H - 1).map((p) => p.y)) - mean(side(CUT - H, CUT - 1).map((p) => p.y));
// The real estimator: fit a line on each side, take the gap AT the cutoff.
const RD = fitAt(side(CUT, CUT + H - 1), CUT) - fitAt(side(CUT - H, CUT - 1), CUT);

// A curved world for the bandwidth lesson: earnings bow upward away from
// the cutoff, so wide windows import curvature the straight lines miss.
const curved = (s) => 20 + 0.5 * s + 0.02 * (s - CUT) ** 2 + (s >= CUT ? TRUE_EFFECT : 0);
const rdAt = (h, f) => fitAt(side(CUT, CUT + h - 1, f), CUT) - fitAt(side(CUT - h, CUT - 1, f), CUT);
const RD_WIDE = rdAt(25, curved);
const RD_NARROW = rdAt(5, curved);

const fmt = (v, d = 2) => v.toFixed(d);

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

function* jump() {
  yield {
    state: table(`Scholarship iff score ≥ ${CUT}: a rule, not a coin (truth = +${TRUE_EFFECT})`, [
      ['world', 'the world'],
      ['naive', 'compare recipients vs non-recipients'],
      ['gift', 'the gift inside the rule'],
    ], [['detail', '']], [
      [`earnings rise smoothly with score (ability), plus +${TRUE_EFFECT} for the scholarship — assignment is DETERMINISTIC in the score, the opposite of a lottery`],
      [`${fmt(NAIVE, 1)}, computed live — wildly above the true ${TRUE_EFFECT}, because recipients are simply higher-ability students: the smooth slope masquerades as treatment effect`],
      [`right AT the cutoff, the rule becomes luck: a 69 and a 70 differ by one careless answer on one morning — in every other respect they are statistical twins. The threshold manufactures a local experiment out of pure bureaucracy`],
    ]),
    highlight: { removed: ['naive:detail'], found: ['gift:detail'] },
    explanation: `The setting defeats both standard tools. Adjustment fails because ability is unobserved (the Instrumental Variables & Natural Experiments problem again), and there's no lottery in sight — the scholarship rule is perfectly deterministic. Regression discontinuity's insight is that the determinism IS the lottery, locally: nobody can aim their score precisely enough to choose which side of ${CUT} they land on, so just-above and just-below students are exchangeable — same ability distribution, same everything, except the scholarship. The global comparison (${fmt(NAIVE, 1)}, live) is junk; the LOCAL comparison at the line is gold.`,
    invariant: 'A sharp cutoff randomizes locally: crossing it is luck for those near it, even though assignment is rule-bound for everyone.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'test score', min: 38, max: 102 }, y: { label: 'later earnings', min: 38, max: 82 } },
      series: [
        { id: 'below', label: 'no scholarship', points: side(40, CUT - 1) },
        { id: 'above', label: 'scholarship', points: side(CUT, 100) },
        { id: 'cutline', label: `cutoff (${CUT})`, points: [{ x: CUT, y: 38 }, { x: CUT, y: 82 }] },
      ],
    }),
    highlight: { compare: ['below', 'above'], active: ['cutline'] },
    explanation: `The whole design in one picture. Earnings climb smoothly with score on BOTH sides — that's ability, and RD never denies it. The action is the vertical JUMP exactly at ${CUT}: smooth things don't jump. Ability, family income, motivation — every confounder varies CONTINUOUSLY across the threshold, because students at 69.9 and 70.1 are the same kinds of people. The only thing that changes discontinuously at the line is the scholarship itself. So whatever height the outcome jumps at the cutoff belongs to the treatment — there is nothing else it could be.`,
    invariant: 'Confounders are continuous at the cutoff; treatment is not: any discontinuity in the outcome is the treatment\'s signature.',
  };

  yield {
    state: table(`Measuring the jump: two estimators inside a ±${H} band`, [
      ['means', 'compare local MEANS'],
      ['lines', 'fit a LINE per side, read the gap at the cutoff'],
      ['why', 'why the slope must be modeled'],
    ], [['result', '']], [
      [`${fmt(LOCAL_MEANS, 2)} — closer than the global ${fmt(NAIVE, 1)}, but still inflated: the just-above group averages ~${H / 2} points more score, and the 0.5 ability slope rides along (0.5 × ${H} = ${fmt(0.5 * H, 1)} of contamination)`],
      [`${fmt(RD, 2)} — the true effect EXACTLY: each side's line extrapolates to the cutoff itself, so both estimates describe the same student, the one standing on the line`],
      ['inside any finite window the running variable still tilts the outcome; fitting the tilt and evaluating both sides AT the threshold removes the last confounded inch'],
    ]),
    highlight: { removed: ['means:result'], found: ['lines:result'] },
    explanation: `The estimator, refined live. Naively averaging the band's two halves still smuggles in slope: even within ±${H} points, the scholarship kids score a bit higher, and ability pays 0.5 per point — hence ${fmt(LOCAL_MEANS, 2)} instead of ${TRUE_EFFECT}. The fix is the design's namesake REGRESSION: fit a line through each side's points and evaluate both lines at exactly score = ${CUT}. Now the comparison is between two predictions for the SAME hypothetical student at the threshold, and the gap is ${fmt(RD, 2)} — exact in this linear world. In practice this is "local linear regression at the cutoff," and it is the published-paper standard.`,
    invariant: 'RD = lim from above − lim from below, both evaluated AT the cutoff: fit the slope so the threshold student is compared to herself.',
  };
}

function* finePrint() {
  yield {
    state: table('The bandwidth dilemma, computed in a curved world', [
      ['wide', `wide band (±25)`],
      ['narrow', `narrow band (±5)`],
      ['trade', 'the trade'],
    ], [['estimate', '']], [
      [`${fmt(RD_WIDE, 2)} — the world now curves (earnings bow upward away from the cutoff), straight lines fitted over 25 points miss the bend, and the missed bend lands in the gap: bias ${fmt(RD_WIDE - TRUE_EFFECT, 2)}`],
      [`${fmt(RD_NARROW, 2)} — within ±5 the curve is nearly straight: bias ${fmt(RD_NARROW - TRUE_EFFECT, 2)}. In noisy real data, the narrow window pays for its honesty with variance: fewer students, wider error bars`],
      ['wide = smooth and confidently wrong; narrow = honest and noisy. Modern practice picks the bandwidth by criterion (Imbens–Kalyanaraman), reports several, and prays they agree'],
    ]),
    highlight: { compare: ['wide:estimate', 'narrow:estimate'] },
    explanation: `RD's version of every nonparametric dilemma. Lines are only locally honest: bend the true earnings curve (here a gentle 0.02·(score−${CUT})² bow, computed live) and a ±25 window's straight-line fit misreads curvature as jump — estimate ${fmt(RD_WIDE, 2)} against a truth of ${TRUE_EFFECT}. Shrink to ±5 and the bias nearly vanishes (${fmt(RD_NARROW, 2)}), but real data inside a sliver is scarce and noisy. There is no free setting: bandwidth choice is a bias-variance dial, and credible RD papers show the estimate is stable across reasonable choices rather than cherry-picking the window that flatters the result.`,
    invariant: 'Bandwidth = bias-variance dial: lines lie about curvature in proportion to window width; data thins in proportion to narrowness.',
  };

  yield {
    state: table('The integrity check: nobody gets to choose their side', [
      ['assume', 'the assumption'],
      ['break', 'how it breaks'],
      ['mccrary', 'the McCrary density test'],
      ['examples', 'caught in the wild'],
    ], [['detail', '']], [
      ['scores just below and just above the cutoff occur with SMOOTH frequency — landing at 69 vs 70 is luck, not choice'],
      ['retakes until passing, graders nudging 69s to 70s, applicants told the threshold in advance — the marginal population SORTS itself across the line, and the twins assumption dies'],
      ['plot the HISTOGRAM of the running variable: manipulation shows up as a dip just below the cutoff and a pile just above — a discontinuity in density where there should be none'],
      ['reported incomes bunch exactly at tax-bracket edges; marathon finishing times pile up just under 4:00:00 — humans sort against any threshold they can see and influence'],
    ]),
    highlight: { active: ['mccrary:detail'], removed: ['break:detail'] },
    explanation: 'RD\'s twins argument has one enemy: SORTING. If students can retake until they cross, or graders mercy-bump 69s, then the people just above the line are no longer the people just below it plus luck — they are the persistent, the connected, the informed; selection is back in through the side door (the same collider-flavored poison as Causal Graphs, Confounding & Simpson\'s Paradox warned about for gates). The beautiful thing is that this failure is VISIBLE: choice distorts the density of the running variable at exactly the cutoff, and the McCrary test reads the histogram for that signature. Marathon times bunching under four hours is the proof that humans sort across visible thresholds whenever they possibly can.',
    invariant: 'Manipulation leaves fingerprints in the density: a smooth histogram at the cutoff is RD\'s admission ticket.',
  };

  yield {
    state: table('Fuzzy RD: when the cutoff only CHANGES THE ODDS', [
      ['sharp', 'sharp RD (this page so far)'],
      ['fuzzy', 'fuzzy RD'],
      ['math', 'the estimator'],
      ['family', 'what it secretly is'],
    ], [['detail', '']], [
      ['crossing the line flips treatment 0% → 100%: the outcome jump IS the effect'],
      ['crossing raises take-up 30% → 80% (some eligible skip it, some ineligible appeal in): the outcome jump now reflects only the 50-point swing in probability'],
      [`divide: (outcome jump) / (treatment-probability jump) — e.g. a ${fmt(TRUE_EFFECT * 0.5, 1)} outcome jump over a 0.5 take-up jump recovers ${fmt((TRUE_EFFECT * 0.5) / 0.5, 1)}`],
      ['Instrumental Variables & Natural Experiments at a point: crossing the cutoff is the instrument, the Wald ratio is the math, and the answer is a LATE — the effect for cutoff-compliers'],
    ]),
    highlight: { active: ['math:detail', 'family:detail'] },
    explanation: `Real cutoffs are rarely absolute — eligibility is not enrollment. When crossing the threshold merely raises the PROBABILITY of treatment, the raw outcome jump understates the effect (it averages in the unmoved). The repair is an old friend: treat "crossed the cutoff" as an instrument for "actually treated" and divide the outcome jump by the take-up jump — the Wald ratio, evaluated at a single point. Everything from the IV page imports: the answer is a LATE (compliers at the cutoff), weak take-up jumps amplify every flaw, and exclusion (crossing affects outcomes only via treatment) is the assumption doing the work. Sharp RD, fuzzy RD, IV: one family, increasingly honest about who complies.`,
    invariant: 'Fuzzy RD = IV at the cutoff: (jump in outcome) / (jump in take-up) — a Wald ratio whose instrument is the threshold itself.',
  };

  yield {
    state: table('The quasi-experimental toolkit, complete', [
      ['ab', 'A/B test'],
      ['adjust', 'adjustment'],
      ['iv', 'instrumental variables'],
      ['did', 'difference-in-differences'],
      ['rd', 'regression discontinuity'],
    ], [['randomness', 'where the randomness comes from'], ['bet', 'the untestable bet']], [
      ['you flip the coin', 'none — the design IS the proof (A/B Testing & p-values)'],
      ['none: you model your way out', 'the graph is right and every back door measured'],
      ['a lottery nature ran', 'exclusion: one road into the outcome'],
      ['a policy that hit one group, a clock that hit both', 'parallel trends: the control\'s slope is the missing counterfactual (Difference-in-Differences)'],
      ['bureaucratic arbitrariness at a threshold', 'no sorting at the line — checkable in the density, uniquely among these designs'],
    ]),
    highlight: { active: ['rd:bet'] },
    explanation: 'The causal-inference shelf, now complete on this site, sorted by where each design finds its randomness. RD\'s seat at the table is special for two reasons. First, its key threat (sorting) leaves a VISIBLE fingerprint — the McCrary density check — making its central assumption closer to testable than DiD\'s parallel trends or IV\'s exclusion, which fail silently. Second, its honesty about locality: the estimate describes threshold students, full stop — extrapolating the scholarship effect from 70-scorers to 90-scorers is a new assumption, not a finding. Thresholds are everywhere bureaucracy lives: class-size caps, pension ages, vote shares at 50%, exam cutoffs. Wherever a rule draws an arbitrary line through a smooth population, there is an experiment lying on the ground.',
    invariant: 'Each design = found randomness + an untestable bet; RD\'s bet is uniquely auditable, and its answer is honestly local.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the jump at the cutoff') yield* jump();
  else if (view === 'bandwidth, bunching & fuzzy RD') yield* finePrint();
  else throw new InputError('Pick a view.');
}

const legacyArticle = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Regression discontinuity (RD) measures a causal effect when a sharp threshold divides treatment and control. The visualization: a scholarship rule (score ≥ 70). Assignment is deterministic, yet right at the line, a 69 and 70 are statistical twins — differing by one careless answer, not intent. Bureaucratic determinism becomes luck locally. The estimator: fit a line on each side and read the vertical jump where they meet.`,
      ],
    },
    {
      heading: `Legacy visual note`,
      paragraphs: [
        `Read the score axis as the running variable and the cutoff as the only place where treatment jumps. Away from the cutoff, score still captures ability and other confounders. Right at the cutoff, nearby units are treated as local twins. The two fitted lines remove smooth score trends and compare the predicted outcomes at the same threshold point. The invariant is continuity: anything other than treatment should move smoothly through the cutoff. The naive baseline is comparing all treated to all untreated, which mixes treatment with score. The failure views show the price: bandwidth controls bias versus variance, sorting breaks the twin argument, and fuzzy take-up turns the cutoff into an instrument.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The synthetic world: earnings = 20 + 0.5·score + 8·scholarship (score ≥ 70). Ability (slope 0.5) is the confounder wrecking naive comparisons: recipients score higher, mixing ability with effect, yielding 23.3 instead of true 8. RD exploits locality: scores just below and above 70 have identical ability distributions, differ only in treatment. Fit a line on each side, evaluate both AT the cutoff. Why? Naive means within ±5 points still smuggle slope contamination (0.5 × 5 = 2.5). Fitting the slope and evaluating both at the threshold removes it, recovering the true effect exactly via local linear regression.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The bandwidth dilemma: a wide window (±25) fits lines to curved data, missing the bend (bias 8.50 vs truth 8). A narrow window (±5) is honest about linearity (bias 8.10) but noisier. Imbens–Kalyanaraman criterion picks bandwidth; credible papers report several and check stability. RD trades its greatest strength (sharp local randomization) against nonparametric weakness (bandwidth as bias-variance dial).`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Thresholds everywhere: class-size caps (Angrist's Maimonides rule), pension ages, 50% vote shares, exam cutoffs. The McCrary density test audits RD's central threat (sorting): if students retake until passing or graders mercy-bump 69s, they self-select above the line, killing twins. But sorting leaves fingerprints — dips below and piles above the cutoff, uniquely visible here. Marathon times bunching under 4:00:00 prove it: humans sort across visible thresholds they influence.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `RD measures effects for the threshold population only (score ≈ 70), not everyone. Extrapolation is a new assumption. Sharp RD: treatment is all-or-nothing. Fuzzy RD (probability jumps from 30% to 80%) is Instrumental Variables at a point: divide outcome jump by take-up jump to get Wald ratio, the effect for compliers. Exclusion (threshold affects outcomes only via treatment) fails silently. RD's assumptions are hard to test except the density test.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read "Instrumental Variables & Natural Experiments" to see fuzzy RD as IV at a point. Study "Difference-in-Differences" for parallel-trends (compare to RD's auditable density check). Explore "Causal Graphs, Confounding & Simpson's Paradox" for why confounders must be continuous at the cutoff — RD's deep insight. Master "A/B Testing & p-values" to contrast quasi-experimental randomness with true lotteries. Together: the full toolkit for finding causal effects when nature has already randomized locally.`,
      ],
    },
  ],
};

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Regression discontinuity exists for the common case where treatment is assigned by a rule instead of by a randomized trial. Scholarships start above a test score. Benefits begin at an age threshold. A policy applies when vote share crosses 50 percent. The assignment is deterministic, but the threshold can still create a local experiment.',
        'The key is locality. A student at 69 and a student at 70 are usually much more similar than students at 50 and 95. If nobody can precisely manipulate which side of the cutoff they land on, then the tiny difference around the line is close to luck. Bureaucratic determinism becomes randomization at the margin.',
        'Regression discontinuity is useful because it turns a visible rule into causal evidence. It does not claim treated and untreated groups are globally comparable. It claims the units just below and just above the cutoff are comparable enough that a jump in the outcome at the cutoff can be attributed to the treatment.',
        {type: 'callout', text: 'RD works only at the edge: the cutoff must change treatment suddenly while every other cause stays smooth through the same point.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to compare everyone who received treatment with everyone who did not. In the scholarship example, that means comparing students above the score cutoff to students below it. That comparison is badly confounded because higher scores also proxy for preparation, income, school quality, motivation, and other traits that affect later outcomes.',
        'Another tempting approach is to compare local means in a narrow window. That is better, but not automatically clean. Inside a finite window, the treated side still has slightly higher scores on average. If the outcome rises smoothly with score, a simple local mean comparison can still mix treatment with the running variable.',
        'Regression discontinuity fixes that by modeling the smooth trend on each side and asking only about the vertical gap at the cutoff itself. The comparison is not average treated student versus average untreated student. It is the predicted treated and untreated outcome for the threshold student.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is discontinuity versus continuity. The treatment jumps at the cutoff. Confounders should not. Ability, family background, preparation, and motivation may all vary with score, but they should vary smoothly through the cutoff if students cannot sort precisely around the threshold.',
        'That gives the design its identifying logic: if every non-treatment factor moves smoothly through the cutoff, then any sudden jump in the outcome at that exact point belongs to the treatment. Smooth causes create smooth outcome changes. A discontinuous treatment can create a discontinuous outcome change.',
        'The estimate is local. RD estimates the effect for units near the cutoff, not for the whole population. A scholarship effect for threshold students may not equal the effect for very high-score or very low-score students. That limitation is not a weakness to hide; it is the honesty that makes the design credible.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The running variable is the assignment score. The cutoff is the threshold where treatment probability changes. In a sharp RD, treatment switches from no to yes at the cutoff. In a fuzzy RD, the cutoff only changes the probability of treatment, so the design becomes an instrumental-variables design at the threshold.',
        'The standard estimator fits separate local regressions on each side of the cutoff and evaluates both at the cutoff. The difference between those two fitted values is the estimated jump. Local linear regression is common because it removes the smooth slope in the running variable while keeping the estimate focused near the threshold.',
        {type: 'image', src: 'https://www.ncbi.nlm.nih.gov/books/NBK566228/bin/ch8f12.jpg', alt: 'Regression discontinuity scatter plot with a cutoff and separate fitted lines', caption: 'The estimated treatment effect is the vertical jump at the cutoff, not the average difference between all treated and untreated units. Source: https://www.ncbi.nlm.nih.gov/books/NBK566228/figure/ch8.fig12/.'},
        'Bandwidth controls how much data around the cutoff is used. A wide bandwidth gives more observations and lower variance, but it can import curvature that a simple local line cannot model. A narrow bandwidth is more locally honest, but it has fewer observations and wider uncertainty. Credible RD work reports sensitivity across bandwidth choices rather than presenting one flattering window.',
        'Fuzzy RD adds one more step. If crossing the threshold raises treatment take-up from 30 percent to 80 percent, the raw outcome jump is diluted by people whose treatment status did not change. Divide the outcome jump by the treatment-probability jump to estimate the effect for compliers near the cutoff.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The first view proves why the global comparison is junk. Recipients and non-recipients differ across the whole score range, so the naive difference mixes treatment with the smooth relationship between score and outcome.',
        'The jump plot proves the RD logic. The outcome trend can slope upward on both sides. RD does not deny that score matters. It asks whether the outcome has an extra vertical jump exactly where the treatment rule changes. That gap is the signal.',
        'The local-estimator table proves why fitting the slope matters. Even inside a narrow band, the just-above group can have slightly higher scores. Evaluating both fitted lines at the cutoff compares the same threshold point rather than two nearby but different score averages.',
        'The bandwidth and density views prove the two major threats. Too wide a window can turn curvature into bias. Sorting around the cutoff breaks the local-randomization story. If units can manipulate their score or administrators can nudge borderline cases, the density of the running variable may show a pile-up on one side.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'RD works because it changes the causal question. Instead of asking whether all treated units are comparable to all untreated units, it asks whether units infinitesimally close to the cutoff are comparable. That smaller claim is often much more plausible.',
        'It also works because its central threat leaves evidence. Sorting can show up as a discontinuity in the density of the running variable. If many people appear just above the threshold and too few just below it, the threshold may be manipulated. That does not prove every RD is valid, but it gives the design a visible diagnostic that many causal designs lack.',
        'The design is strongest when the cutoff is known, mechanically applied, hard to manipulate precisely, and unrelated variables look smooth through the line. It is weaker when the threshold is anticipated, retakes are common, administrators can override borderline cases, or the rule changes many things at once.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The main tradeoff is bias versus variance. Wide windows use more data but risk modeling the wrong shape of the outcome curve. Narrow windows stay closer to the local experiment but may be noisy. Polynomial choices, bandwidth rules, clustered errors, and sensitivity checks matter because the design lives at a boundary.',
        'The second tradeoff is credibility versus scope. RD can be very credible near the cutoff, but it estimates a local effect. If the policy question concerns people far from the threshold, the RD result may be only one piece of evidence.',
        'The third tradeoff is interpretability in fuzzy designs. Fuzzy RD estimates the effect for compliers whose treatment status is changed by crossing the cutoff. That can be exactly the policy-relevant group, but it is not automatically the average effect for everyone eligible.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'RD is useful anywhere a rule draws an arbitrary line through a smooth population: exam scores, age thresholds, vote shares, income cutoffs, class-size rules, admissions indexes, benefit eligibility, geographic boundaries, and regulatory thresholds.',
        'It is especially strong when the cutoff was chosen administratively rather than optimized around the outcome. A pension age, scholarship score, or narrow election threshold can create local comparison groups that are far more believable than a broad treated-versus-untreated comparison.',
        'The method is also useful pedagogically because it shows how causal inference often works in practice: find where the world accidentally created a narrow comparison that resembles randomization, then state exactly which population that comparison can speak for.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The biggest failure is sorting. If people can retake, appeal, time behavior, misreport, or otherwise position themselves around the threshold, the just-above and just-below groups may no longer be comparable. Density tests and covariate smoothness checks are essential.',
        'Another failure is a compound cutoff. If crossing the threshold changes several policies at once, the outcome jump cannot be attributed to one treatment without more structure. RD identifies the effect of the discontinuous bundle unless the bundle can be separated.',
        'A third failure is overgeneralization. The estimate belongs near the threshold. Treating it as the effect for the whole population turns a careful local design into a broad claim the evidence did not support.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Instrumental Variables & Natural Experiments to see fuzzy RD as IV at a cutoff. Study Difference-in-Differences for another quasi-experimental design with a different identifying assumption. Study Causal Graphs, Confounding & Simpson\'s Paradox for why smooth confounders matter. Study A/B Testing & p-values to contrast designed randomization with threshold-based local randomization.',
      ],
    },
  ],
};
