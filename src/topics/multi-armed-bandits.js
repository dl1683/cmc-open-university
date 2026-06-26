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
      explanation: `Round ${round} (${ROUND_TRAFFIC} visitors): ${round === 1 ? `no estimates yet, so the exploit share goes to the first arm by default -- early rounds are noisy and that is fine` : `current leader is ${ARMS[best].id} (estimated ${est(best).toFixed(1)}%), so it receives ${alloc[best]} visitors while ${explore} each keep auditing the others`}. The explore share is the honesty tax: without it, a lucky early streak on a bad arm could lock in forever.`,
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
    explanation: 'ε-greedy explores blindly; smarter bandits explore PROPORTIONALLY TO UNCERTAINTY -- UCB picks the arm with the highest plausible value ("optimism under uncertainty"), Thompson sampling draws from each arm belief distribution. This is the explore/exploit dilemma of Value Iteration (Reinforcement Learning) in its purest form, and it runs everywhere decisions repeat: headline selection at news sites, ad ranking, Netflix artwork. The honest trade-off versus A/B Testing & p-values: bandits maximize earnings but their adaptive traffic makes clean statistical inference harder -- optimize with bandits, PROVE with fixed experiments.',
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        {type: 'callout', text: 'A bandit policy is an experiment ledger that turns uncertainty into traffic allocation every round.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Slot_machine.jpg', alt: 'Slot machine front panel with spinning reels', caption: 'The bandit name comes from choosing among slot-machine arms with unknown payoff rates. Source: Wikimedia Commons, Jeff Kubina, CC BY-SA 2.0.'},
        'Read each arm as an option with an unknown reward rate. Active marks the arm receiving traffic this round, and found marks the updated estimate after rewards arrive.',
        'The safe inference rule is statistical humility. The best-looking arm is only the current estimate, so a policy must reserve some traffic for learning until uncertainty is small enough.',
        {type: 'image', src: './assets/gifs/multi-armed-bandits.gif', alt: 'Animated walkthrough of the multi armed bandits visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A multi-armed bandit models repeated choices with unknown payoffs. An arm is one option, such as a headline, ad creative, model route, or checkout button.',
        'The goal is to earn reward while learning. Regret is the reward lost compared with always choosing the best arm from the start, which the learner does not know.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a fixed A/B/n test. Split traffic evenly, collect enough samples, analyze the result, and then send future traffic to the winner.',
        'That is the right shape when the goal is clean causal inference. Equal exposure makes the statistical analysis easier to defend.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is opportunity cost. If arm A converts at 4 percent and arm B converts at 6 percent, equal traffic keeps paying for A even after B has strong evidence.',
        'With 1,000 visitors per arm, A yields about 40 conversions and B yields about 60. Every extra 1,000 visitors sent to A instead of B costs about 20 conversions in expectation.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A bandit policy merges experimentation and deployment. It sends more traffic to arms with better evidence while keeping some traffic on uncertain arms.',
        'Different policies define uncertainty differently. Epsilon-greedy uses a fixed exploration share, UCB uses a confidence bonus, and Thompson sampling draws from a belief distribution.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Epsilon-greedy keeps counts and rewards for each arm. With probability epsilon it explores, usually by choosing a random arm; otherwise it exploits by choosing the arm with the highest estimated reward.',
        'UCB chooses the arm with empirical mean plus a bonus based on sqrt(log(t) / n_i), where t is total pulls and n_i is pulls for that arm. Under-sampled arms receive larger bonuses until their uncertainty shrinks.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Normal_Distribution_PDF.svg', alt: 'Normal distribution probability density functions', caption: 'Uncertainty-aware bandits keep testing arms whose plausible payoff range is still wide. Source: Wikimedia Commons, Inductiveload, public domain.'},
        'Correctness is not a guarantee that every early choice is right. The invariant is that the policy keeps enough evidence flowing to correct mistaken estimates.',
        'In stationary settings, repeated samples make empirical means converge toward true means. UCB and Thompson sampling reduce waste by sending exploration toward arms whose uncertainty can still affect the decision.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg', alt: 'Standard deviation regions under a normal distribution', caption: 'The engineering cost is not arithmetic; it is logging enough uncertainty and exposure information to analyze adaptive decisions later. Source: Wikimedia Commons, M. W. Toews, public domain.'},
        'For k arms, epsilon-greedy and UCB need O(k) time to choose and O(k) memory for counts and reward totals. The reward update is O(1) for the selected arm.',
        'The real cost is behavioral. A fixed epsilon keeps spending exploration forever, while UCB spends less on arms once their uncertainty is small. Production systems must log the chosen arm, eligible arms, action probability, reward, delay, and policy version.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Bandits fit ad allocation, headline testing, notification copy, recommender slots, model routing, and online hyperparameter choices. The access pattern is repeated decisions with rewards that arrive soon enough to update the policy.',
        'They are useful when serving a weak option has a real cost. The policy can shift traffic toward winners before a fixed experiment would finish.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Bandits fail when rewards are delayed, nonstationary, or poorly aligned with the real goal. A click-optimized headline policy can learn to attract clicks while harming trust.',
        'They also complicate inference because exposure probabilities change over time. If the organization needs a clean causal estimate, use a fixed experiment or analyze adaptive logs with propensity-aware methods.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose three buttons have true conversion rates A=4 percent, B=6 percent, and C=5 percent. With 300 visitors per round and epsilon = 0.2, exploration sends 20 visitors to each arm and the remaining 240 to the current leader.',
        'If B is the leader, the expected conversions are A:0.8, B:15.6, and C:1.0, for 17.4 total that round. Equal split would send 100 visitors to each and expect 4 + 6 + 5 = 15 conversions. The bandit earns more while still buying data from A and C.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Robbins on sequential experiments, Auer et al. on finite-time bandit analysis, Chapelle and Li on Thompson sampling, and Slivkins for a broad bandit text. The core mathematical object is regret.',
        'Next study A/B Testing for inference, Upper Confidence Bound, Thompson Sampling, Importance Sampling for adaptive logs, and Reinforcement Learning for decisions that change future state.',
      ],
    },
  ],
};