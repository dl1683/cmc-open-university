// Markov chains: a system that only remembers TODAY — and yet, iterated,
// develops unshakable long-run habits. The chain forgets where it started;
// the stationary distribution is where every history converges.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'markov-chains',
  title: 'Markov Chains & Steady States',
  category: 'Concepts',
  summary: 'Remember only today, iterate forever: every starting point converges to the same long-run habits — computed live.',
  controls: [
    { id: 'view', label: 'Run', type: 'select', options: ['the chain finds its habits', 'absorbing states & the family'], defaultValue: 'the chain finds its habits' },
  ],
  run,
};

// Weather: sunny / cloudy / rainy. Rows = today, columns = tomorrow.
const P = [[0.7, 0.25, 0.05], [0.3, 0.5, 0.2], [0.2, 0.5, 0.3]];
const STATES = ['sunny', 'cloudy', 'rainy'];
const stepDist = (pi) => [0, 1, 2].map((j) => pi.reduce((a, p, i) => a + p * P[i][j], 0));
const evolve = (start, days) => {
  let pi = [...start];
  for (let d = 0; d < days; d++) pi = stepDist(pi);
  return pi;
};

function* habits() {
  yield {
    state: graphState({
      nodes: [
        { id: 'sunny', label: 'SUNNY', x: 2, y: 5.5, note: 'stays sunny 70%' },
        { id: 'cloudy', label: 'CLOUDY', x: 7.5, y: 5.5, note: 'coin-flip-ish' },
        { id: 'rainy', label: 'RAINY', x: 4.75, y: 1.2, note: 'rarely lingers (30%)' },
      ],
      edges: [
        { id: 'sc', from: 'sunny', to: 'cloudy', weight: 0.25 },
        { id: 'cr', from: 'cloudy', to: 'rainy', weight: 0.2 },
        { id: 'rs', from: 'rainy', to: 'sunny', weight: 0.2 },
        { id: 'cs', from: 'cloudy', to: 'sunny', weight: 0.3 },
        { id: 'rc', from: 'rainy', to: 'cloudy', weight: 0.5 },
        { id: 'sr', from: 'sunny', to: 'rainy', weight: 0.05 },
      ],
    }),
    highlight: { active: ['sunny'] },
    explanation: `A toy climate: ${STATES.length} states, and arrows carrying probabilities — ${STATES[0]} stays ${STATES[0]} ${P[0][0] * 100}% of the time, ${STATES[1]} is a near coin flip, rain rarely lingers. The defining rule is what the model FORGETS: tomorrow's probabilities depend on today's state and NOTHING else — not yesterday, not the streak, not the season. That amnesia is the MARKOV PROPERTY, and it looks like a crippling simplification until you watch what iteration builds out of it. (You have met this shape before: Finite State Machines with probabilities on the arrows.)`,
    invariant: `Markov property: P(tomorrow | entire history) = P(tomorrow | today). The ${STATES.length}-state chain's only memory is the current state.`,
  };

  const DAYS = [0, 1, 2, 3, 5, 10];
  yield {
    state: matrixState({
      title: 'Start from a sunny day and iterate — computed live',
      rows: DAYS.map((d) => ({ id: `d${d}`, label: `day ${d}` })),
      columns: STATES.map((s) => ({ id: s, label: s })),
      values: DAYS.map((d) => evolve([1, 0, 0], d)),
      format: (v) => v.toFixed(3),
    }),
    highlight: { compare: ['d10:sunny', 'd10:cloudy', 'd10:rainy'], visited: ['d0:sunny'] },
    explanation: `Day 0: certainly ${STATES[0]} — the distribution is (1, 0, 0). Push it through the ${STATES.length}x${STATES.length} transition matrix (this module does it live): day ${DAYS[1]} splits ${evolve([1, 0, 0], 1).map(v => v.toFixed(2)).join(' / ')}; by day ${DAYS[3]} the rows are visibly settling; by day ${DAYS[5]} the numbers have stopped moving at three decimals: (${evolve([1, 0, 0], 10).map(v => v.toFixed(3)).join(', ')}). The chain has found its HABITS — the long-run fraction of days that are ${STATES.join(', ')}. Note what the iteration is doing mechanically: multiplying a vector by the same matrix again and again. You watched that exact loop converge once before, on the Eigenvalues & Eigenvectors page — hold that thought.`,
  };

  yield {
    state: matrixState({
      title: 'Start from RAIN instead — same destination',
      rows: [
        { id: 'fromSun', label: 'started sunny, day 10' },
        { id: 'fromRain', label: 'started rainy, day 10' },
        { id: 'stat', label: 'the stationary distribution Ï€' },
      ],
      columns: STATES.map((s) => ({ id: s, label: s })),
      values: [evolve([1, 0, 0], 10), evolve([0, 0, 1], 10), evolve([1, 0, 0], 200)],
      format: (v) => v.toFixed(3),
    }),
    highlight: { found: ['stat:sunny', 'stat:cloudy', 'stat:rainy'] },
    explanation: `The punchline: start from a ${STATES[2]} day instead — by day 10 the distribution is IDENTICAL. The ${STATES.length}-state chain forgets its origin completely; every starting point flows to the same STATIONARY DISTRIBUTION π = (10/21, 8/21, 3/21). Stationary means self-reproducing: πP = π — push the resting distribution through one more day and nothing changes. Read that equation again with Eigenvalues & Eigenvectors fresh in mind: π is an EIGENVECTOR of the ${STATES.length}x${STATES.length} transition matrix with eigenvalue exactly 1, and the day-by-day convergence you watched was power iteration finding it. (Fine print: guaranteed when the chain can't get trapped or locked in a cycle — irreducible and aperiodic.)`,
    invariant: `πP = π: the stationary distribution is the ${STATES.length}x${STATES.length} transition matrix's eigenvalue-1 eigenvector, and mixing erases the start.`,
  };

  yield {
    state: matrixState({
      title: 'PageRank, finished properly',
      rows: [
        { id: 'surfer', label: 'the random surfer' },
        { id: 'trap', label: 'the problem' },
        { id: 'teleport', label: 'the fix' },
        { id: 'rank', label: 'the ranking' },
      ],
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'a Markov chain: state = current page, transitions = links', 'dead ends and link-cycles trap the surfer — no clean Ï€', '15% chance: teleport to a random page (makes it irreducible & aperiodic)', 'Ï€ itself — a page\'s rank IS its stationary probability'][v],
    }),
    highlight: { found: ['rank:what'] },
    explanation: `Now the payoff this page owes PageRank: the "random surfer" IS a Markov chain — pages are states, links are transitions — and a page's importance is defined as the fraction of eternity the surfer spends there: the stationary distribution. The famous 15% teleportation isn't a hack; it is exactly the fine print above, engineered in — teleporting makes the web-chain irreducible (no trap pages) and aperiodic (no cycles), GUARANTEEING one unique π for power iteration to find. Three pages of this site — PageRank, Eigenvalues & Eigenvectors, and ${topic.title} — turn out to be one idea wearing three hats.`,
  };
}

function* absorbing() {
  yield {
    state: graphState({
      nodes: [
        { id: 'trial', label: 'TRIAL', x: 1.5, y: 3.5, note: 'every user starts here' },
        { id: 'active', label: 'ACTIVE', x: 5, y: 3.5, note: 'paying monthly' },
        { id: 'churn', label: 'CHURNED', x: 8.5, y: 1.3, note: 'absorbing — no way out' },
        { id: 'upgrade', label: 'UPGRADED', x: 8.5, y: 5.7, note: 'absorbing — the goal' },
      ],
      edges: [
        { id: 'ta', from: 'trial', to: 'active', weight: 0.6 },
        { id: 'tc', from: 'trial', to: 'churn', weight: 0.4 },
        { id: 'au', from: 'active', to: 'upgrade', weight: 0.15 },
        { id: 'ac', from: 'active', to: 'churn', weight: 0.1 },
      ],
    }),
    highlight: { removed: ['churn'], found: ['upgrade'] },
    explanation: `A second species of chain: a subscription funnel with ABSORBING states — once a user churns or upgrades, they never leave that state (a self-loop with probability 1). Trial users convert to active (${0.6 * 100}%) or churn (${0.4 * 100}%); active users each month upgrade (${0.15 * 100}%), churn (${0.1 * 100}%), or stay active (${0.75 * 100}%). The questions a business asks are exactly the questions absorbing-chain math answers: what fraction of trials EVENTUALLY upgrade? How many months does the journey take? No simulation needed — the structure itself contains the answers.`,
    invariant: `An absorbing state, once entered, is never left: all long-run probability pools in the absorbers.`,
  };

  const upgradeProb = (months) => {
    let u = 0;
    for (let m = 0; m < months; m++) u = 0.15 + 0.75 * u;
    return 0.6 * u;
  };
  const MONTHS = [1, 3, 6, 12, 60];
  yield {
    state: matrixState({
      title: 'P(trial user has upgraded by month m) — iterated live',
      rows: MONTHS.map((m) => ({ id: `m${m}`, label: `by month ${m}` })),
      columns: [{ id: 'p', label: 'probability' }],
      values: MONTHS.map((m) => [upgradeProb(m) * 100]),
      format: (v) => `${v.toFixed(1)}%`,
    }),
    highlight: { found: ['m60:p'], visited: ['m1:p'] },
    explanation: `Iterate the funnel live: by month ${MONTHS[0]}, ${(upgradeProb(MONTHS[0]) * 100).toFixed(0)}% of trial users have upgraded; by month ${MONTHS[2]}, ${(upgradeProb(MONTHS[2]) * 100).toFixed(1)}%; and the curve flattens toward its ceiling at ${(upgradeProb(MONTHS[4]) * 100).toFixed(0)}%. The closed form drops out of one self-referential equation: an active user upgrades with probability u = 0.15 + 0.75u (upgrade now, or survive and face the same odds) → u = 0.6, times the 60% who survive the trial = 36%. The other 64% pool in churn. The same machinery prices the EXPECTED DURATION (a geometric ~4 months active) — and the same absorbing-chain algebra computes board-game lengths, gambler’s-ruin odds, and how long a Gossip Protocol takes to infect a cluster.`,
    invariant: `Absorption probabilities solve self-consistent equations: u = (chance now) + (chance to survive)·u. Checked across ${MONTHS.length} time horizons above.`,
  };

  yield {
    state: matrixState({
      title: 'The family album: chains you already use daily',
      rows: [
        { id: 'ngram', label: 'n-gram language models' },
        { id: 'mcmc', label: 'MCMC sampling' },
        { id: 'queue', label: 'queueing systems' },
        { id: 'speech', label: 'HMMs (speech, biology)' },
        { id: 'rl', label: 'reinforcement learning' },
      ],
      columns: [{ id: 'how', label: 'the chain inside' }],
      values: [[1], [2], [3], [4], [5]],
      format: (v) => ['', 'state = last nâˆ’1 words; transitions = corpus counts — pre-LLM autocomplete', 'DESIGN a chain whose Ï€ is the distribution you want, then just run it', 'state = queue length; arrivals/services move it — Hot Rows lived here', 'hidden state walks a chain; you observe only noisy emissions', 'an MDP = Markov chain + choices: Value Iteration (Reinforcement Learning) optimizes the walk'][v],
    }),
    highlight: { active: ['mcmc:how'] },
    explanation: `The family album. N-gram models — autocomplete before transformers — are literal ${topic.title.split(' ')[0]} chains over words (and an LLM generating token-by-token is the same loop with a context-window-sized state). MCMC inverts this whole page brilliantly: instead of finding a given chain's π, it ENGINEERS a chain whose stationary distribution is some impossible-to-sample posterior, then wanders it — the workhorse of Bayesian statistics. Queues, hidden Markov models, and the MDPs under Value Iteration (Reinforcement Learning) round out the set. One amnesiac rule over ${STATES.length} states (or millions), iterated: the long-run behavior of half the systems on this site.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the chain finds its habits') yield* habits();
  else if (view === 'absorbing states & the family') yield* absorbing();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'A state is one possible condition of the system, such as sunny, cloudy, or rainy. An edge is a transition probability, meaning the chance of moving from one state today to another state tomorrow. Active nodes show the current state or distribution being advanced.',
        'The tables show probability mass, not individual simulated paths. A row such as day 2 contains the probability of being in each state after two transitions. Found rows mark the stationary distribution, which is a distribution that stays unchanged after another transition.',
        {type: 'callout', text: 'A Markov chain is useful when the current state is enough memory to make the next-step distribution computable.'},
        {type: 'image', src: './assets/gifs/markov-chains.gif', alt: 'Animated walkthrough of the markov chains visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many systems move through states over time: weather, queues, customers, board games, web pages, and molecules. Modeling the full history is often impossible because the number of histories grows too fast. A Markov chain is the useful simplification where the current state contains enough information to predict the next-step distribution.',
        'The memoryless rule is called the Markov property. It says P(next state | full history) equals P(next state | current state). That trade loses detail, but it turns an unbounded history problem into a fixed transition matrix.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious model keeps the whole past. Tomorrow\'s weather could depend on today, yesterday, the current streak, and the season. A customer\'s next action could depend on every email, click, purchase, and failed payment.',
        'That approach is attractive because it throws away no evidence. If enough data and compute existed, a full-history model could represent subtle patterns. It fails because the state space becomes too large to estimate or store.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'With k possible states and a history length of T, there are k^T histories. Three weather states over 30 days produce 3^30 histories, which is more than 200 billion. Most of those histories will never be observed often enough to estimate a reliable transition probability.',
        'The wall is not just computation. It is data. A model with billions of parameters for rare histories will memorize noise while still being unable to answer common next-step questions robustly.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Collapse history into the current state. Store one k-by-k transition matrix P where P[i][j] is the probability of moving from state i to state j. Each row sums to 1 because the next state must be somewhere.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/2b/Markovkate_01.svg', alt: 'Two-state Markov chain diagram with transition probabilities and self loops', caption: 'A Markov chain is a directed probabilistic graph: edges carry transition probabilities and self-loops carry probability that stays in place. Source: Wikimedia Commons, Joxemai4, CC BY-SA 3.0 or GFDL.'},
        'A probability distribution row vector pi advances by multiplication: pi_next = pi * P. Repeating that multiplication shows how probability mass moves. If the chain is well behaved, the distribution settles into pi where pi * P = pi.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build the transition matrix from rules or data. In the weather animation, a sunny day stays sunny with probability 0.7, becomes cloudy with 0.25, and becomes rainy with 0.05. Starting from certainly sunny means pi0 = (1, 0, 0).',
        'One step gives pi1 = (0.7, 0.25, 0.05). Another step multiplies that distribution by the same matrix again. The arithmetic blends rows of P according to the current probability mass.',
        'Absorbing chains add states that cannot be left. In the funnel view, churned and upgraded are absorbing states. Probability eventually pools there, and equations over the transient states give eventual absorption probabilities without simulating every user.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The Markov property makes repeated matrix multiplication valid. Once you know the current distribution, earlier history has no extra role in the next step. That is why pi * P summarizes all possible one-step transitions at once.',
        'A unique stationary distribution is guaranteed for finite chains that are irreducible and aperiodic. Irreducible means every state can eventually reach every other state. Aperiodic means the chain is not trapped in a fixed cycle length.',
        'Under those conditions, every starting distribution converges to the same stationary distribution. The eigenvalue-1 component remains, while other components shrink during repeated multiplication. PageRank uses teleportation to force these conditions on the web graph.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A dense transition matrix costs O(k^2) space for k states, and one distribution step costs O(k^2). If the graph is sparse with E nonzero transitions, storage and one step can be O(E). Doubling the number of states can quadruple dense cost, so sparsity matters.',
        'Power iteration for a stationary distribution costs one matrix-vector multiply per round. The number of rounds depends on the spectral gap, which measures how much slower the second-largest eigenvalue decays compared with 1. A small gap means slow mixing.',
        'Absorbing-chain calculations can be done by solving linear equations over transient states. Exact solving costs roughly O(k^3) for dense systems, but small structured models are cheap. Large systems usually use sparse iterative methods.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'PageRank models a random surfer as a Markov chain over web pages. Queueing systems model queue length as the state, with arrivals and service completions as transitions. Credit-rating migration models move firms among ratings and default.',
        'MCMC methods reverse the usual question. Instead of analyzing a given chain, they design a chain whose stationary distribution is the distribution they want to sample. Hidden Markov Models add noisy observations on top of an unobserved Markov state.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The memoryless assumption can be wrong. A user with three failed payments may behave differently from a user in the same account state with none. If history changes the future, the state definition must include that history or the model will be biased.',
        'Some chains do not converge to one friendly distribution. Reducible chains can trap mass in separate classes. Periodic chains can oscillate forever. Estimated transition probabilities can also drift when the real system changes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use the weather matrix P = [[0.7, 0.25, 0.05], [0.3, 0.5, 0.2], [0.2, 0.5, 0.3]]. Start from rain: pi0 = (0, 0, 1). One step gives pi1 = (0.2, 0.5, 0.3).',
        'For day 2, compute the sunny probability as 0.2*0.7 + 0.5*0.3 + 0.3*0.2 = 0.35. Cloudy is 0.2*0.25 + 0.5*0.5 + 0.3*0.5 = 0.45. Rainy is 0.2*0.05 + 0.5*0.2 + 0.3*0.3 = 0.20.',
        'Solving pi * P = pi with entries summing to 1 gives pi = (10/21, 8/21, 3/21), about (0.476, 0.381, 0.143). In the long run, the model predicts about 48 percent sunny days, 38 percent cloudy days, and 14 percent rainy days.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Andrey Markov\'s 1906 work on dependent variables, then read a modern text such as Norris, Markov Chains. For PageRank, read Brin and Page, The Anatomy of a Large-Scale Hypertextual Web Search Engine.',
        'Study finite state machines for the graph shape without probabilities, eigenvectors for the stationary equation, PageRank for a web-scale application, and value iteration for the version with actions and rewards. Then study MCMC to see chains used as sampling engines.',
      ],
    },
  ],
};
