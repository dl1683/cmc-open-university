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
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Thompson Sampling. Beta-distribution beliefs that sharpen with data — exploration that fades automatically as certainty grows..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: `Why Bandits Need This`,
      paragraphs: [
        `A bandit problem asks you to choose among options while learning which option pays best. A product team might choose between checkout pages. A recommender might choose between article cards. A trial might choose between treatments. Every choice both serves a user and teaches the system something.`,
        `The hard part is the explore-exploit tradeoff. If you only exploit the current winner, you can get stuck on an option that looked lucky early. If you explore too much, you keep sending traffic to worse options after the evidence is already clear. Thompson sampling exists to make exploration shrink when uncertainty shrinks.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The first reasonable solution is an A/B test. Split traffic evenly, wait for enough data, then ship the winner. That is clean when the experiment has a fixed horizon and the cost of showing a worse option is acceptable. It also gives a simple analysis story.`,
        `Another common solution is epsilon-greedy. Most of the time it sends traffic to the arm with the best observed average. A fixed fraction of the time, epsilon, it explores randomly. That is easy to implement and often beats doing nothing, but the exploration rate is a knob outside the evidence.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `Fixed exploration wastes traffic after the answer is obvious. If epsilon is 10 percent, the system still sends one in ten users to random arms even after millions of observations. Lowering epsilon helps later, but it can make the learner too timid early.`,
        `Pure averages fail in the opposite direction. An arm with one success in one try has a 100 percent observed conversion rate, but that estimate is fragile. The missing quantity is uncertainty. A decision rule needs to know not only what each arm's current average is, but how much evidence supports that average.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `Thompson sampling represents each arm as a belief distribution over its unknown reward rate. Instead of asking "which arm has the largest point estimate," it asks "if I sampled one plausible world from my current beliefs, which arm would be best in that world?"`,
        `That one sampled-world trick turns uncertainty into traffic allocation. An arm with little data has a wide distribution, so it sometimes draws a high plausible value and gets explored. An arm with lots of bad evidence has a narrow low distribution, so it rarely wins a sample. Exploration is no longer a fixed tax; it is the probability that the arm could still be best.`,
      ],
    },
    {
      heading: `Beta-Bernoulli Beliefs`,
      paragraphs: [
        `For yes/no rewards such as clicked or not clicked, converted or not converted, the Beta distribution is a convenient belief over an unknown probability. Beta(alpha, beta) can be read as successes plus failures. A success increments alpha. A failure increments beta.`,
        `The demo starts both arms at Beta(1,1), a flat prior. That means the learner begins with no preference. As visitors arrive, each arm's curve shifts and narrows. A curve centered farther right means a higher likely conversion rate. A narrower curve means the system has more evidence and less uncertainty.`,
      ],
    },
    {
      heading: `The Decision Loop`,
      paragraphs: [
        `For each decision, sample one possible conversion rate from every arm's current distribution. Serve the arm with the largest sampled rate. Observe the reward. Update only the chosen arm's distribution. Repeat. The algorithm is small because the belief state carries the exploration policy.`,
        `The page's batch display uses a deterministic shortcut for teaching: it estimates the probability that B beats A and routes that share of the 200-visitor batch to B. A live implementation usually samples per request. Both versions expose the same idea: traffic share follows posterior probability of being the best arm.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The curves are beliefs, not historical conversion-rate lines. Wide overlap means the learner still has a real chance of being wrong, so both arms keep receiving traffic. When B's curve shifts right and the overlap shrinks, B wins more samples and receives more traffic.`,
        `The visual also proves why early randomness is not a bug. At the start, the curves are flat and symmetric, so traffic naturally splits. Later, the worse arm still gets some traffic only where the distributions overlap. That overlap is the remaining uncertainty, not an arbitrary exploration quota.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The algorithm is probability matching. If the posterior belief says arm B has a 70 percent chance of being the best arm, then B wins roughly 70 percent of posterior samples. The traffic share is tied to the learner's current uncertainty about optimality.`,
        `This is useful because uncertain arms get tested in proportion to how plausible they are. A new arm is explored because its distribution is wide, not because a fixed epsilon command says "explore now." A bad arm fades because evidence moves and narrows its distribution, not because a scheduler manually turns it off.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `For k Bernoulli arms, the memory cost is two numbers per arm: alpha and beta. Updating a chosen arm is O(1). Choosing among k arms is O(k) if you draw one sample from each distribution. The algorithm is cheap enough to run per request in many product systems.`,
        `The cost grows when the reward model grows. Contextual bandits need features, uncertainty estimates, and logged propensities. Delayed rewards need attribution windows. Non-binary rewards need different likelihood models. The core idea remains the same, but the tidy Beta update stops being enough.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Thompson sampling fits online allocation problems where serving the current best option matters while learning continues. Ads, recommendations, email subject lines, ranking widgets, and adaptive experimentation all have this shape. The algorithm reduces regret by moving traffic toward good arms before a fixed-horizon test would be over.`,
        `It is especially attractive when each decision has low individual risk and feedback arrives quickly. Fast feedback lets beliefs sharpen quickly. Low risk makes adaptive allocation acceptable because the system will intentionally test uncertain options while it learns.`,
        `It is also useful when the opportunity cost of waiting is high. If a fixed experiment would spend two weeks evenly splitting traffic across a weak arm, Thompson sampling can shift traffic away as evidence accumulates while still leaving enough exploration to detect a surprise recovery.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `The simple version assumes independent users, stable reward rates, and quick binary feedback. Real products violate those assumptions. Users return, campaigns age, inventory changes, rewards are delayed, and one choice can affect later behavior. Those conditions need contextual models, time decay, guardrails, or a different experiment design.`,
        `Thompson sampling also does not replace statistical reporting. An adaptive allocation can be excellent for serving users and still require care when making a public ship/no-ship claim. If the goal is inference rather than allocation, study fixed A/B tests, confidence intervals, sequential testing, and logged-policy evaluation.`,
        `The reward definition can fail too. If the algorithm optimizes clicks, it may favor clickbait over long-term satisfaction. If it optimizes immediate purchases, it may miss refunds, churn, or support cost. Thompson sampling chooses according to the reward signal it is given, so the reward window, guardrail metrics, and stop rules are part of the algorithm in practice.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Start with Multi-Armed Bandits for regret, epsilon-greedy, and UCB. Then study A/B Testing for the fixed-horizon contrast, Softmax Temperature for another way to turn scores into exploration, and Calibration Curves for checking whether probabilities mean what they claim.`,
        `For production systems, study Contextual Bandit Logged Policy Evaluation, LinUCB, Policy Gradients, and Delayed Feedback Attribution Windows. Those topics show what changes when actions have features, rewards arrive late, or the decision affects a longer trajectory.`,
      ],
    },
      {
      heading: 'Why this exists',
      paragraphs: [
        "State the real constraint this topic fixes before introducing the mechanism.",
        "A good opening says what gets too slow, too fragile, or too hard to reason about under baseline behavior.",
        "Without that, every optimization appears decorative.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Thompson Sampling moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

