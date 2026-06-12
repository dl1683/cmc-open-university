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
      heading: 'What it is',
      paragraphs: [
        `Multi-armed bandits solve the explore-versus-exploit dilemma. You have k choices (arms), each with an unknown payoff rate — say, three button designs with different conversion rates, or news headlines with different click-through rates. Run a classic A/B test? You'd split traffic evenly across all variants and wait for statistical significance, watching money burn as visitors get sent to losers. The bandit algorithm does something wiser: learn which arm is best, WHILE serving it more traffic, paying only a small "exploration tax" to stay honest.`,
        `The breakthrough insight is that exploration doesn't have to be random or even-handed — it can be proportional to uncertainty. If arm A looks 4% good, arm B looks 6% good, and arm C looks 5% good, dump most traffic on B immediately, but keep auditing A and C just enough to catch early lucky streaks that aren't real. The gap between what you earned and what you would have earned by picking the single-best arm from the start is called REGRET; this metric judges how wasteful the algorithm is.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The simplest version is ε-greedy. You pick a small exploration rate — say, ε = 10%. On each round, 10% of traffic is split evenly among all arms (pure audit), and 90% goes to whichever arm currently has the highest estimated payoff rate. As you accumulate samples, estimates sharpen and regret flattens because you're sending most traffic to the real winner. The ε term is the honesty tax: without it, a bad arm that gets lucky early could earn a high estimate, monopolize traffic, and never be beaten.`,
        `Smarter algorithms explore proportional to uncertainty. Upper Confidence Bound (UCB) computes a "plausible upper limit" on each arm's true rate — a width that shrinks as you get more samples — then picks the arm with the highest upper limit. This way, arms you know less about (wider confidence bands) get explored, and arms you know well get exploited. Thompson sampling goes further: maintain a belief distribution over each arm's rate, draw a sample from each distribution, and pick the arm with the highest sample. Both handle the explore-exploit trade-off automatically without a tunable ε knob.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `ε-greedy takes O(k) time per round (k arms) — just track pulls and wins for each, and compute estimates. Thompson sampling is also O(k) per round if you use conjugate priors (Beta distribution for Bernoulli payoffs). Memory is O(k) always. The real cost is conceptual: adaptive algorithms make statistical inference harder. Your traffic allocation is no longer independent of outcomes, which violates the randomization assumption that A/B Testing & p-values rely on. Use bandits to optimize (earn money now) and fixed experiments to prove (publish clean results).`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Yahoo tested ε-greedy on their homepage headlines in 2009: by switching from even-split testing to bandit allocation, they earned 12% more clicks while finding the best headline faster. Netflix uses contextual bandits (arms depend on user metadata) to pick which artwork to show for each film — the same movie gets different posters for different audiences, and Thompson sampling learns online which combination clicks best. Ad ranking systems use bandits to balance showing high-revenue ads against learning new cheaper-but-converting ads. Content recommendation, dynamic pricing, and medication dosing in clinical trials all use variants of this logic.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Bandits assume payoffs are stationary (rates don't drift). In practice, user preferences, seasonality, and market shifts change arm quality — the best button today might flop tomorrow. Some systems address this with "discount factors" that fade old data. Another trap: correlation. If three buttons differ only in color, they're not truly independent arms; a bandit will learn slower than a system that tests color generically. Worst misconception: bandits replace hypothesis testing. They don't. A bandit tells you how to allocate traffic efficiently given unknown payoffs. If you need to know WHETHER a difference is real (not just profitable), run a fixed-size experiment afterward and report significance — this separates "what we earned" from "what we proved."`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Learn A/B Testing & p-values to understand the statistical foundation that bandits improve upon, and why bandits trade clean inference for live earnings. Value Iteration (Reinforcement Learning) formalizes the explore-exploit dilemma in MDPs (Markov Decision Processes); bandits are a special case where the state space is just "which arm," and there's no delay between action and reward. Softmax & Temperature scales exploration dynamically: higher temperature means more randomness, lower means more greed — another knob for tuning exploration. Reservoir Sampling teaches you how to update estimates over infinite streams, which some bandit variants use to forget old stale data. Load Balancer connects to Softmax: cloud systems use softmax-weighted load distribution to balance between high-performing servers (exploit) and trying new ones (explore).`,
      ],
    },
  ],
};

