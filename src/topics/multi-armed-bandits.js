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
      heading: 'Why it exists',
      paragraphs: [
        'A multi-armed bandit is the smallest useful model of learning while acting. There are several choices, called arms. Pulling an arm gives a reward drawn from an unknown distribution. The learner wants high reward now, but it also needs information about arms it has not tried enough. That tension is the explore-exploit problem.',
        'The problem exists because many real systems cannot afford to freeze learning while they run a clean experiment. A website choosing checkout copy, a news site choosing headlines, an ad system choosing creatives, or a recommender choosing artwork all face the same pressure: every visitor sent to a weak option is an opportunity cost, but every option ignored too early may hide the best choice.',
        'The right objective is therefore not only statistical certainty. It is regret. Regret is the reward lost compared with a policy that knew the best arm from the beginning. A bandit algorithm is judged by how much reward it gives up while learning. Low regret means the system found useful information without spending too many decisions on losers.',
      ],
    },
    {
      heading: 'The reasonable first approach',
      paragraphs: [
        'The natural first answer is a fixed A/B or A/B/n experiment. Randomly split traffic evenly, wait until the sample is large enough, estimate conversion rates, and choose the winner. This is attractive because the data collection rule is simple. Each arm receives comparable exposure, and standard inference tools are easier to apply.',
        'For pure measurement, that design is hard to beat. If the goal is to convince a skeptical analyst that variant B caused an increase, a fixed randomized design is cleaner than an adaptive one. It separates exploration from rollout: first learn, then exploit.',
        'The wall is that fixed traffic allocation can be expensive. If an arm is obviously weak after the first few thousand visitors, an even split keeps feeding it anyway. The experiment may be statistically tidy while the business outcome is wasteful. Bandits ask whether the system can keep enough randomization to learn while moving most traffic toward the currently best evidence.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that uncertainty has value. A high observed conversion rate after ten visitors is not the same kind of evidence as a high observed conversion rate after ten thousand visitors. A bandit policy should not only ask which arm looks best; it should ask which action best balances immediate reward and information gain.',
        'Epsilon-greedy is the simplest version of that idea. With probability epsilon, explore. With probability 1 - epsilon, exploit the arm with the highest current estimated reward. In batch form, a fixed share of traffic is spread across all arms and the remaining share goes to the current leader. The invariant is continued support: every arm keeps receiving some observations, so a bad early estimate does not become permanent without more evidence.',
        'More advanced bandits make exploration depend on uncertainty. Upper confidence bound methods choose the arm with the highest optimistic plausible value. Thompson sampling draws a random value from each arm belief distribution and plays the arm whose sampled value is best. Softmax policies convert estimated values into probabilities. All of these policies are different answers to the same question: how much should the system pay now to learn what will pay later?',
      ],
    },
    {
      heading: 'Mechanism in the example',
      paragraphs: [
        'The topic uses three checkout buttons with hidden true conversion rates: A at 4 percent, B at 6 percent, and C at 5 percent. The learner does not know those rates. It only sees visitors and conversions. Each round sends 300 visitors according to an epsilon-greedy allocation.',
        'At the beginning, every estimate is empty. The implementation breaks ties by choosing the first arm for the exploit share, which is intentionally imperfect. The exploration share still gives the other arms traffic. After rewards accumulate, the estimated conversion rates usually push B to the top, and B starts receiving most of the visitors while A and C continue receiving audit traffic.',
        'The table is an experiment ledger. Visitors are pulls, conversions are rewards, and the estimated percentage is the current empirical mean. The final comparison against an even split demonstrates reward during learning. The bandit is not magic: it did not know B in advance. It earned more by shifting traffic as evidence arrived.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The visual proves that the state of a bandit is not a final verdict. It is a live allocation ledger. The current leader is the arm with the best evidence so far, not a proven permanent winner. That distinction matters because early rewards are noisy. If exploration vanished entirely, the first lucky arm could capture all traffic and prevent the correction that would reveal a better option.',
        'The visual also proves the economic difference between fixed experiments and adaptive allocation. A fixed three-way split preserves clean symmetry but keeps spending equally on the worst arm. Epsilon-greedy accepts a continuing exploration tax so most traffic can move toward the best observed arm. The tax is visible in the rows that keep receiving visitors even after they stop leading.',
        'The final row shows the central trade. The bandit earns more than a uniform split in this toy environment, but it does not produce the same kind of simple p-value story. The data were collected adaptively. The policy changed the exposure probabilities based on earlier outcomes, so downstream inference must account for the logging policy.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Epsilon-greedy works in plain language because it prevents total ignorance while allowing exploitation. The exploration part makes every arm observable. The exploitation part converts accumulated evidence into reward. If the reward distributions are stationary and enough exploration continues, the estimates can correct early noise over time.',
        'The method is not regret-optimal. A fixed epsilon keeps spending traffic on weak arms forever, so its long-run regret can grow linearly unless epsilon decays or the task ends. Too little exploration can lock in a wrong leader. Too much exploration wastes traffic. The parameter is therefore not cosmetic; it encodes how much reward the system is willing to spend on information.',
        'UCB and Thompson sampling work by making the uncertainty term more intelligent. UCB gives under-sampled arms a confidence bonus that shrinks as evidence accumulates. Thompson sampling naturally tries uncertain arms because their sampled belief sometimes looks best. Both approaches make exploration responsive rather than blind, which is why they are often preferred when the cost of mistakes is high.',
      ],
    },
    {
      heading: 'Cost and data structures',
      paragraphs: [
        'For k arms, epsilon-greedy needs O(k) memory for counts and reward totals, and O(k) time to choose the current empirical leader if implemented directly. A heap or incremental leader can reduce constant work, but most product experiments have a small enough arm count that the bottleneck is measurement quality, not CPU time.',
        'The important data structure is the log. A production bandit log should record decision id, timestamp, user or context features when allowed, eligible arms, chosen arm, action probability, reward definition, reward delay, policy version, and guardrail metrics. Without the probability of the logged action, later off-policy evaluation becomes much harder or impossible.',
        'Contextual bandits add a feature model. Instead of one mean reward per arm, the policy estimates reward conditioned on context: user segment, query type, page location, device, or other safe features. That makes the algorithm more powerful and more dangerous. It can personalize decisions, but it can also learn biased allocation patterns if the features, rewards, or eligibility rules encode hidden confounders.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Bandits win when decisions repeat, rewards arrive soon enough to update the policy, arms are cheap to try, and the cost of serving a weak arm is real. Common uses include ad creative allocation, headline testing, recommendation slots, notification copy, onboarding flows, ranking exploration, model routing, and parameter tuning.',
        'They are especially useful before a system has enough certainty to hard-code a winner. A bandit can act as a controlled rollout mechanism: try candidates, shift toward winners, keep auditing alternatives, and retire arms that are clearly dominated. In online products, that can convert experimentation from a separate phase into part of normal operation.',
        'Bandits are also a conceptual bridge to reinforcement learning. In a bandit, the action affects only the immediate reward distribution. In reinforcement learning, the action also changes the future state. Learning bandits first isolates exploration, uncertainty, regret, and logging before adding the extra complexity of delayed consequences.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Bandits fail when rewards are delayed beyond the decision cycle. If a purchase arrives days after the click, a policy that updates on immediate clicks may optimize the wrong signal. They also struggle with nonstationarity: weekday traffic, seasonality, novelty effects, inventory changes, and competitor events can make old estimates misleading.',
        'They fail ethically and operationally when the reward is too narrow. A headline bandit can maximize clicks while damaging trust. A recommender can maximize watch time while reducing user welfare. An ad system can exploit demographic correlations. A treatment allocation system can harm people if safety constraints are not stronger than reward maximization.',
        'They also fail as proof machinery. Adaptive allocation can be analyzed, but not with the same casual assumptions as a fixed experiment. If the organization needs a defensible causal estimate, use a proper inference plan: randomized holdouts, logged propensities, off-policy estimators, doubly robust methods, or a follow-up fixed experiment. Optimize with bandits; prove with designs built for proof.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Thompson Sampling for Bayesian uncertainty, Upper Confidence Bound for optimism under uncertainty, LinUCB Personalized News Case Study for contextual confidence bonuses, Softmax and Temperature for probability-shaped exploration, and A/B Testing & p-values for fixed-sample inference.',
        'Then study Importance Sampling and Off-Policy Estimation, Doubly Robust Estimation, and Contextual Bandit Logged Policy Evaluation Case Study. Those topics explain how to learn from adaptive logs without pretending they came from a fixed randomized split. For the larger family, continue to Value Iteration, Policy Gradients from REINFORCE to PPO, and reinforcement-learning safety constraints where actions change future states rather than only immediate rewards.',
      ],
    },
  ],
};
