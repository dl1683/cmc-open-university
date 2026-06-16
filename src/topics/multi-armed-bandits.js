// Multi-armed bandits: A/B testing that learns WHILE it runs. Instead of
// splitting traffic evenly until a verdict, shift traffic toward whatever
// is winning — and pay only a small "exploration tax" to stay honest.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'multi-armed-bandits',
  title: 'Multi-Armed Bandits',
  category: 'AI & ML',
  summary: 'Explore a little, exploit a lot — adaptive experiments that stop wasting traffic on losers.',
  controls: [
    { id: 'epsilon', label: 'Exploration rate ε', type: 'select', options: ['20%', '10%'], defaultValue: '20%' },
  ],
  run,
};

// True (unknown to the algorithm!) conversion rates of three button variants.
const ARMS = [
  { id: 'A', rate: 0.04 },
  { id: 'B', rate: 0.06 },
  { id: 'C', rate: 0.05 },
];
const ROUND_TRAFFIC = 300;
const ROUNDS = 6;

export function* run(input) {
  const eps = String(input.epsilon) === '20%' ? 0.2 : String(input.epsilon) === '10%' ? 0.1 : null;
  if (eps === null) throw new InputError('Pick an exploration rate.');

  const pulls = [0, 0, 0];
  const wins = [0, 0, 0];
  const est = (i) => (pulls[i] === 0 ? 0 : (wins[i] / pulls[i]) * 100);
  const rows = ARMS.map((a) => ({ id: `arm${a.id}`, label: a.id }));
  const cols = [{ id: 'pulls', label: 'visitors' }, { id: 'wins', label: 'converted' }, { id: 'est', label: 'est. %' }];
  const snapshot = (title) => matrixState({
    title, rows, columns: cols,
    values: ARMS.map((_, i) => [pulls[i], wins[i], Math.round(est(i) * 10) / 10]),
  });

  yield {
    state: snapshot('Three variants, three unknown conversion rates'),
    highlight: {},
    explanation: `Three checkout buttons; their TRUE conversion rates (4%, 6%, 5%) are unknown to us. Classic A/B Testing & p-values splits traffic evenly until significance — rigorous, but every visitor sent to a loser while you wait is money burned. The bandit asks: why not LEARN while serving? ε-greedy, the simplest version: send ε = ${eps * 100}% of traffic to explore all arms evenly, and the rest to whichever arm currently LOOKS best.`,
  };

  let uniformWins = 0;
  for (let round = 1; round <= ROUNDS; round += 1) {
    const explore = Math.floor((eps * ROUND_TRAFFIC) / ARMS.length);
    const best = est(0) >= est(1) && est(0) >= est(2) ? 0 : est(1) >= est(2) ? 1 : 2;
    const alloc = ARMS.map((_, i) => explore + (i === best ? ROUND_TRAFFIC - explore * ARMS.length : 0));
    ARMS.forEach((arm, i) => {
      pulls[i] += alloc[i];
      wins[i] += Math.round(arm.rate * alloc[i]);
      uniformWins += Math.round(arm.rate * (ROUND_TRAFFIC / ARMS.length));
    });
    yield {
      state: snapshot(`Round ${round}: ${alloc.map((a, i) => `${ARMS[i].id}:${a}`).join('  ')}`),
      highlight: { active: [`arm${ARMS[best].id}:pulls`], found: rows.map((r) => `${r.id}:est`) },
      explanation: `Round ${round} (${ROUND_TRAFFIC} visitors): ${round === 1 ? `no estimates yet, so the exploit share goes to the first arm by default — early rounds are noisy and that's fine` : `current leader is ${ARMS[best].id} (estimated ${est(best).toFixed(1)}%), so it receives ${alloc[best]} visitors while ${explore} each keep auditing the others`}. The explore share is the honesty tax: without it, a lucky early streak on a bad arm could lock in forever.`,
      invariant: 'Every arm keeps receiving some traffic — estimates never stop improving.',
    };
  }

  const banditWins = wins.reduce((a, b) => a + b, 0);
  const bestArm = ARMS.reduce((m, a, i) => (est(i) > est(m.i) ? { i, id: a.id } : m), { i: 0, id: 'A' });
  yield {
    state: snapshot('After 1,800 visitors'),
    highlight: { found: [`arm${bestArm.id}:pulls`, `arm${bestArm.id}:wins`, `arm${bestArm.id}:est`] },
    explanation: `The bandit found B (estimates: ${ARMS.map((a, i) => `${a.id} ${est(i).toFixed(1)}%`).join(', ')} — true rates 4/6/5) AND earned while learning: ${banditWins} conversions versus ${uniformWins} from an even three-way split — ${banditWins - uniformWins} extra sales that classic testing would have burned as "experiment cost". The gap between what you earned and what all-B-from-day-one would have earned is called REGRET; bandit algorithms are judged by how slowly it grows.`,
  };

  yield {
    state: snapshot('The explore/exploit spectrum'),
    highlight: {},
    explanation: 'ε-greedy explores blindly; smarter bandits explore PROPORTIONALLY TO UNCERTAINTY — UCB picks the arm with the highest plausible value ("optimism under uncertainty"), Thompson sampling draws from each arm\'s belief distribution. This is the explore/exploit dilemma of Value Iteration (Reinforcement Learning) in its purest form, and it runs everywhere decisions repeat: headline selection at news sites, ad ranking, Netflix artwork. The honest trade-off versus A/B Testing & p-values: bandits maximize earnings but their adaptive traffic makes clean statistical inference harder — optimize with bandits, PROVE with fixed experiments.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Multi-armed bandits are adaptive experiments. Instead of splitting traffic evenly until a final A/B verdict, a bandit keeps learning while sending more traffic to the arm that currently looks best. The page uses three checkout buttons with hidden true rates: A = 4%, B = 6%, C = 5%. Each round has 300 visitors, and the epsilon-greedy policy pays a fixed exploration tax of either 20% or 10%.`,
        `The objective is not a clean p-value; it is low regret. Regret is the gap between what you earned and what you would have earned by always serving the best arm from the start. A/B Testing & p-values is for proof; Multi-Armed Bandits are for earning while learning.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Epsilon-greedy is deliberately simple. Split epsilon traffic evenly across all arms so every estimate keeps improving, then send the rest to the current leader. The visualization begins with no evidence, so the exploit share defaults to A; after the estimates update, B usually pulls ahead and receives most of the traffic. The table shows pulls, wins, and estimated conversion after each batch.`,
        `Better bandits explore according to uncertainty. Thompson Sampling samples from a belief distribution; UCB chooses the arm with the highest plausible upside. LinUCB Personalized News Case Study extends that UCB idea to contextual actions by adding a linear reward model and a confidence bonus. Softmax & Temperature is another exploration mechanism: high temperature spreads probability across arms, low temperature behaves greedily. The common theme is the explore/exploit trade from Value Iteration (Reinforcement Learning), stripped down to a one-state problem.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `For k arms, epsilon-greedy costs O(k) per decision and O(k) memory. The statistical cost is harder: adaptive allocation means the data were not produced by a fixed randomized design. Estimating final causal effects or counterfactual policy value may require Importance Sampling & Off-Policy Estimation, Doubly Robust Estimation, or the full Contextual Bandit Logged Policy Evaluation Case Study, especially when logs were collected under an older policy.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Bandits allocate headlines, ads, recommendations, onboarding flows, notification copy, and clinical trial treatments. A Load Balancer has a related operational flavor when it probes servers while favoring healthy ones, though the reward and safety constraints differ. Policy Gradients: REINFORCE to PPO generalizes the idea from independent arms to sequential actions where today's choice changes tomorrow's state.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Bandits assume rewards are measured quickly enough to update decisions. Delayed conversions, seasonality, novelty effects, and changing user mix can fool the estimates. They also optimize the metric you give them; if short-term clicks harm retention, the algorithm will not know. Do not declare "B is statistically proven" from an adaptive table without an inference plan. Optimize with a bandit, then confirm with a fixed experiment when proof matters.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read Thompson Sampling for Bayesian uncertainty, LinUCB Personalized News Case Study for contextual confidence bonuses, A/B Testing & p-values for fixed-sample proof, and Value Iteration (Reinforcement Learning) for delayed rewards. Importance Sampling & Off-Policy Estimation and Doubly Robust Estimation explain the estimators; Contextual Bandit Logged Policy Evaluation Case Study explains the production log contract that makes those estimators valid after adaptivity has already happened.`,
      ],
    },
  ],
};
