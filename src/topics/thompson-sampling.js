// Thompson sampling: don't track one number per option — track a whole
// BELIEF about each, and let the width of your uncertainty decide how much
// you explore. Bayesian bandits, 1933, still the production standard.

import { plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'thompson-sampling',
  title: 'Thompson Sampling',
  category: 'AI & ML',
  summary: 'Beta-distribution beliefs that sharpen with data — exploration that fades automatically as certainty grows.',
  controls: [
    { id: 'rounds', label: 'Run', type: 'select', options: ['4 rounds', '8 rounds'], defaultValue: '4 rounds' },
  ],
  run,
};

const ARM_A = 0.04;
const ARM_B = 0.06;
const BATCH = 200;
const GRID = 240;
const X_MAX = 0.14;

// numeric Beta machinery (deterministic; no gamma function needed)
function betaPdf(alpha, beta) {
  const xs = Array.from({ length: GRID }, (_, i) => ((i + 0.5) / GRID) * X_MAX);
  const raw = xs.map((x) => (alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x));
  const peak = Math.max(...raw);
  const ys = raw.map((v) => Math.exp(v - peak));
  return { xs, ys };
}
function probBBeatsA(aA, bA, aB, bB) {
  // P(B > A) by numeric integration over the grid
  const A = betaPdf(aA, bA);
  const B = betaPdf(aB, bB);
  const sumA = A.ys.reduce((s, v) => s + v, 0);
  const sumB = B.ys.reduce((s, v) => s + v, 0);
  let cdfA = 0;
  let p = 0;
  for (let i = 0; i < GRID; i += 1) {
    cdfA += A.ys[i] / sumA;
    p += (B.ys[i] / sumB) * cdfA;
  }
  return Math.min(1, Math.max(0, p));
}

export function* run(input) {
  const rounds = String(input.rounds) === '4 rounds' ? 4 : String(input.rounds) === '8 rounds' ? 8 : null;
  if (rounds === null) throw new InputError('Pick a round count.');

  let aA = 1; let bA = 1; let aB = 1; let bB = 1;
  const axes = { x: { label: 'conversion rate' }, y: { label: 'relative belief' } };
  const curves = () => {
    const A = betaPdf(aA, bA);
    const B = betaPdf(aB, bB);
    return [
      { id: 'armA', label: 'A', points: A.xs.map((x, i) => ({ x, y: A.ys[i] })) },
      { id: 'armB', label: 'B', points: B.xs.map((x, i) => ({ x, y: B.ys[i] })) },
    ];
  };

  yield {
    state: plotState({ axes, series: curves() }),
    highlight: {},
    explanation: 'The Multi-Armed Bandits topic used ε-greedy: explore a FIXED fraction blindly, forever. Thompson sampling (1933!) is subtler: hold a full probability DISTRIBUTION over each arm\'s unknown conversion rate. For a yes/no outcome the natural choice is the Beta distribution: start at Beta(1,1) — the flat lines you see, total ignorance — then for every visitor, SAMPLE one plausible rate from each belief and serve whichever arm drew higher. That single trick makes exploration automatic.',
  };

  yield {
    state: plotState({ axes, series: curves() }),
    highlight: { active: ['armA', 'armB'] },
    explanation: `With both beliefs flat, samples from A and B beat each other equally often — traffic naturally splits ~50/50. No ε parameter chose that; ignorance itself did. As data arrives, the update is bookkeeping: Beta(α, β) â†’ wins add to α, losses add to β. The belief narrows around the evidence — and narrower beliefs win samples more consistently.`,
    invariant: 'An arm\'s share of traffic equals the probability — under current beliefs — that it is the best arm.',
  };

  for (let round = 1; round <= rounds; round += 1) {
    const pB = probBBeatsA(aA, bA, aB, bB);
    const nB = Math.round(pB * BATCH);
    const nA = BATCH - nB;
    aA += Math.round(ARM_A * nA);
    bA += nA - Math.round(ARM_A * nA);
    aB += Math.round(ARM_B * nB);
    bB += nB - Math.round(ARM_B * nB);
    yield {
      state: plotState({ axes, series: curves() }),
      highlight: { active: ['armB'], visited: ['armA'] },
      explanation: `Round ${round}: beliefs gave B a ${(pB * 100).toFixed(0)}% chance of being best, so sampling routed ${nB} of ${BATCH} visitors to B (true rates, unknown to the algorithm: A 4%, B 6%). After updating: A ~ Beta(${aA}, ${bA}), B ~ Beta(${aB}, ${bB}). Watch the curves ${round === 1 ? 'start to lean apart' : round === 2 ? 'sharpen — B\'s peak pulls right of A\'s' : 'separate decisively: overlap is where exploration lives, and it is vanishing'}.`,
    };
  }

  const finalPB = probBBeatsA(aA, bA, aB, bB);
  yield {
    state: plotState({ axes, series: curves() }),
    highlight: { active: ['armB'] },
    explanation: `After ${rounds * BATCH} visitors: P(B is best) â‰ˆ ${(finalPB * 100).toFixed(0)}%, and B's traffic share followed it — exploration DECAYED ITSELF as certainty grew, the behavior ε-greedy can never produce with its fixed blind tax. That self-regulation is why Thompson sampling is the production bandit at ad platforms, in Bing's experimentation papers, and across growth tooling: one mechanism, no exploration knob to mistune.`,
  };

  yield {
    state: plotState({ axes, series: curves() }),
    highlight: {},
    explanation: 'The deeper lesson outlives bandits: representing knowledge as DISTRIBUTIONS instead of point estimates buys calibrated decisions — narrow belief, act; wide belief, gather. The same Bayesian update underlies spam filters and medical trial designs (where Thompson allocation sends more patients to the apparently-better treatment mid-trial). Pair with A/B Testing & p-values for the frequentist contrast, and Softmax & Temperature for the other famous way of turning scores into exploration.',
  };
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: ['Read the animation as a choice-and-update loop. Each curve is a belief about one option, and wider curves mean more uncertainty. The selected option is the one that wins a random draw from current beliefs.', {type: 'callout', text: 'Thompson sampling explores in proportion to remaining doubt: an arm gets traffic only while its posterior can still plausibly win.'}, {type: 'image', src: './assets/gifs/thompson-sampling.gif', alt: 'Animated walkthrough of the thompson sampling visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},], },
    { heading: 'Why this exists', paragraphs: ['A bandit problem asks a system to choose while learning. Every choice is both service and experiment. Thompson sampling exists so uncertain options get tested and proven options get most selections.'], },
    { heading: 'The obvious approach', paragraphs: ['A fixed split test divides selections evenly until the experiment ends. That is simple, but it keeps spending selections on a weak option after evidence is already strong. A fixed random exploration rate has the same late-stage tax.'], },
    { heading: 'The wall', paragraphs: ['The wall is uncertainty. One success in one trial looks perfect but says little. A rule that uses only observed averages cannot tell a lucky tiny sample from a reliable winner.'], },
    { heading: 'The core insight', paragraphs: ['Keep a belief distribution for every option and sample from each belief before choosing. Options win selections in proportion to their chance of still being best. A bad option fades because its distribution moves low and narrow.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Beta_distribution_pdf.svg', alt: 'Beta distribution probability density curves', caption: 'Beta curves show how different alpha and beta counts encode both center and uncertainty. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Beta_distribution_pdf.svg.'},], },
    { heading: 'How it works', paragraphs: ['For binary rewards, use Beta(alpha, beta). Start at Beta(1, 1), draw one sample per option, choose the largest draw, observe success or failure, and update only the chosen option. Success adds to alpha; failure adds to beta.'], },
    { heading: 'Why it works', paragraphs: ['The rule is probability matching. If current evidence says option B has a 70 percent chance to be best, B wins about 70 percent of belief samples. As evidence grows, uncertainty shrinks and selections concentrate.'], },
    { heading: 'Cost and complexity', paragraphs: ['With k options, memory is two numbers per option and a choice costs O(k). Updating the chosen option is O(1). The behavior cost is regret: some selections still go to uncertain options so the system can learn.'], },
    { heading: 'Real-world uses', paragraphs: ['This fits repeated low-risk choices with quick feedback, such as recommendations, ranking modules, interface variants, and routing choices. It is useful when learning cannot wait for a fixed experiment to finish.'], },
    { heading: 'Where it fails', paragraphs: ['The simple version assumes stable binary rewards and quick feedback. Returning users, delayed outcomes, changing inventory, and long-term satisfaction need richer models or stricter experiment design. Bad reward definitions still produce bad behavior.'], },
    { heading: 'Worked example', paragraphs: ['Start A and B at Beta(1, 1). After 10 trials, A has 3 successes, so A is Beta(4, 8), and B has 5 successes, so B is Beta(6, 6). B is favored, but A can still win some samples because uncertainty remains.', 'After 1000 trials, A might be Beta(301, 701) and B Beta(501, 501). The curves are narrow, so B wins nearly every sample. Exploration faded because the evidence became sharp.'], },
    { heading: 'Sources and study next', paragraphs: ['Read Thompson 1933 and Russo et al. on Thompson sampling. Study multi-armed bandits, epsilon-greedy, UCB, fixed split testing, calibration, logged-policy evaluation, and contextual bandits next.'], },
  ],
};
