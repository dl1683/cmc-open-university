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
    explanation: 'A toy climate: three states, and arrows carrying probabilities — sunny stays sunny 70% of the time, cloudy is a near coin flip, rain rarely lingers. The defining rule is what the model FORGETS: tomorrow\'s probabilities depend on today\'s state and NOTHING else — not yesterday, not the streak, not the season. That amnesia is the MARKOV PROPERTY, and it looks like a crippling simplification until you watch what iteration builds out of it. (You have met this shape before: Finite State Machines with probabilities on the arrows.)',
    invariant: 'Markov property: P(tomorrow | entire history) = P(tomorrow | today). The state is the only memory.',
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
    explanation: 'Day 0: certainly sunny — the distribution is (1, 0, 0). Push it through the transition matrix (this module does it live): day 1 splits 0.70 / 0.25 / 0.05; by day 3 the rows are visibly settling; by day 10 the numbers have stopped moving at three decimals: (0.476, 0.381, 0.143). The chain has found its HABITS — the long-run fraction of days that are sunny, cloudy, rainy. Note what the iteration is doing mechanically: multiplying a vector by the same matrix again and again. You watched that exact loop converge once before, on the Eigenvalues & Eigenvectors page — hold that thought.',
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
    explanation: 'The punchline: start from a rainy day instead — by day 10 the distribution is IDENTICAL. The chain forgets its origin completely; every starting point flows to the same STATIONARY DISTRIBUTION Ï€ = (10/21, 8/21, 3/21). Stationary means self-reproducing: Ï€P = Ï€ — push the resting distribution through one more day and nothing changes. Read that equation again with Eigenvalues & Eigenvectors fresh in mind: Ï€ is an EIGENVECTOR of the transition matrix with eigenvalue exactly 1, and the day-by-day convergence you watched was power iteration finding it. (Fine print: guaranteed when the chain can\'t get trapped or locked in a cycle — irreducible and aperiodic.)',
    invariant: 'Ï€P = Ï€: the stationary distribution is the transition matrix\'s eigenvalue-1 eigenvector, and mixing erases the start.',
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
    explanation: 'Now the payoff this page owes PageRank: the "random surfer" IS a Markov chain — pages are states, links are transitions — and a page\'s importance is defined as the fraction of eternity the surfer spends there: the stationary distribution. The famous 15% teleportation isn\'t a hack; it is exactly the fine print above, engineered in — teleporting makes the web-chain irreducible (no trap pages) and aperiodic (no cycles), GUARANTEEING one unique Ï€ for power iteration to find. Three pages of this site — PageRank, Eigenvalues & Eigenvectors, and this one — turn out to be one idea wearing three hats.',
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
    explanation: 'A second species of chain: a subscription funnel with ABSORBING states — once a user churns or upgrades, they never leave that state (a self-loop with probability 1). Trial users convert to active (60%) or churn (40%); active users each month upgrade (15%), churn (10%), or stay active (75%). The questions a business asks are exactly the questions absorbing-chain math answers: what fraction of trials EVENTUALLY upgrade? How many months does the journey take? No simulation needed — the structure itself contains the answers.',
    invariant: 'An absorbing state, once entered, is never left: all long-run probability pools in the absorbers.',
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
    explanation: 'Iterate the funnel live: by month 1, 9% of trial users have upgraded; by month 6, 24.7%; and the curve flattens toward its ceiling at 36%. The closed form drops out of one self-referential equation: an active user upgrades with probability u = 0.15 + 0.75u (upgrade now, or survive and face the same odds) â†’ u = 0.6, times the 60% who survive the trial = 36%. The other 64% pool in churn. The same machinery prices the EXPECTED DURATION (a geometric ~4 months active) — and the same absorbing-chain algebra computes board-game lengths, gambler\'s-ruin odds, and how long a Gossip Protocol takes to infect a cluster.',
    invariant: 'Absorption probabilities solve self-consistent equations: u = (chance now) + (chance to survive)Â·u.',
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
    explanation: 'The family album. N-gram models — autocomplete before transformers — are literal Markov chains over words (and an LLM generating token-by-token is the same loop with a context-window-sized state). MCMC inverts this whole page brilliantly: instead of finding a given chain\'s Ï€, it ENGINEERS a chain whose stationary distribution is some impossible-to-sample posterior, then wanders it — the workhorse of Bayesian statistics. Queues, hidden Markov models, and the MDPs under Value Iteration (Reinforcement Learning) round out the set. One amnesiac rule, iterated: the long-run behavior of half the systems on this site.',
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
        'States are nodes; transition probabilities label the edges. The highlighted node is the current state. In the weather view, the table rows show the full probability distribution after each round of matrix multiplication. Watch the numbers settle: when successive rows stop changing, the chain has found its stationary distribution.',
        'In the absorbing-chain view, probability flows into states with no exits (churned, upgraded). The percentages answer "what fraction eventually lands here?" without simulating individual paths. Active nodes are live states; removed nodes are absorbers already holding their final mass.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'In 1906 Andrey Markov studied letter sequences in Pushkin\'s Eugene Onegin to prove the law of large numbers beyond independent trials. His key move: model the next letter as depending only on the current letter, not the full history. That deliberate amnesia -- the memoryless property -- turned a combinatorially impossible sequence model into a tractable matrix problem. Every system where the present state carries enough information for the next step is a Markov chain: weather, queues, customer funnels, web surfing, molecular diffusion, board games.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Model the full history. Tomorrow\'s weather depends on today, yesterday, the day before, and the entire streak before that: P(X_t | X_{t-1}, X_{t-2}, ..., X_0). A customer\'s next action depends on every prior touchpoint. This is the most accurate model in principle -- it throws away nothing.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Full-history models grow exponentially. A system with k states and a history of length T has k^T possible pasts. With 3 weather states and 30 days of history, that is 3^30 -- over 200 billion distinct histories, each needing its own transition probability. You cannot estimate that many parameters from data. You cannot store the matrix. You cannot multiply it. The history-dependent model is correct in theory and useless in practice.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The Markov property collapses all history into the current state: P(X_{t+1} | X_t, X_{t-1}, ..., X_0) = P(X_{t+1} | X_t). Instead of k^T histories, you need one k-by-k transition matrix P, where P[i][j] is the probability of moving from state i to state j. Each row sums to 1. The entire long-run behavior of the system -- its stationary distribution, its mixing time, its absorption probabilities -- is encoded in this single matrix.',
        'The stationary distribution pi satisfies pi*P = pi: push the distribution through one more step and nothing changes. It is the eigenvector of P with eigenvalue 1. Power iteration -- multiplying any starting distribution by P repeatedly -- converges to pi geometrically. The animation shows this convergence live.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build the transition matrix P. Row i holds the probabilities of leaving state i; each row sums to 1. The weather chain uses P = [[0.7, 0.25, 0.05], [0.3, 0.5, 0.2], [0.2, 0.5, 0.3]]. A starting distribution like (1, 0, 0) -- certainly sunny -- becomes (0.7, 0.25, 0.05) after one multiplication. Multiply again for day 2. By day 10 the distribution reads (0.476, 0.381, 0.143) regardless of whether you started from sun or rain. The chain has forgotten its origin.',
        'Absorbing chains have states with no exits. In the subscription funnel, trial users go active (60%) or churn (40%); active users upgrade (15%), churn (10%), or stay (75%). The eventual upgrade probability for an active user solves one self-consistent equation: u = 0.15 + 0.75*u, giving u = 0.6. Only 60% of trials reach active, so 36% of all trials eventually upgrade. The remaining 64% pool in churn. No simulation needed -- the algebra gives exact answers.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Convergence to a unique stationary distribution is guaranteed when the chain is irreducible (every state can reach every other state) and aperiodic (no forced cycle length). The Perron-Frobenius theorem proves that such a matrix has exactly one eigenvalue equal to 1, and all other eigenvalues have magnitude strictly less than 1. Power iteration amplifies the eigenvalue-1 component and shrinks everything else, so every starting distribution converges to the same pi. The convergence rate is geometric, governed by the spectral gap: the difference between 1 and the second-largest eigenvalue magnitude.',
        'PageRank\'s 15% teleportation is not a hack -- it is precisely the engineering move that makes the web-link chain irreducible and aperiodic, guaranteeing a unique pi for power iteration to find.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Transition matrix storage: O(k^2) for k states, or O(E) when sparse (E = number of nonzero transitions). One distribution step: multiply a length-k vector by the matrix, costing O(k^2) dense or O(E) sparse. Full-distribution propagation over T steps: O(T*k^2). Finding the stationary distribution exactly requires solving the eigenvalue problem pi*P = pi, which costs O(k^3) by Gaussian elimination. Power iteration is cheaper per step but needs enough rounds to converge -- the spectral gap determines how many.',
        'The weather chain is tiny (k = 3) and settles in about 10 steps. A web-scale PageRank chain with billions of pages uses sparse iteration because the link matrix has far fewer than k^2 nonzero entries.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'PageRank: the random surfer is a Markov chain over web pages; a page\'s rank is its stationary probability. MCMC (Metropolis-Hastings, Gibbs sampling): instead of finding a given chain\'s pi, you engineer a chain whose pi is the distribution you need to sample from, then walk it -- the workhorse of Bayesian statistics. Hidden Markov Models: the state walks a chain but you only observe noisy emissions -- used in speech recognition and gene finding. N-gram language models: state = last n-1 words, transitions = corpus counts -- autocomplete before transformers. Queueing theory: state = queue length, arrivals and departures move it. Financial models: credit rating transitions form a Markov chain for default probability. Reinforcement learning MDPs: a Markov chain plus actions and rewards.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The memoryless assumption is often wrong. A user who has failed three payments behaves differently from a user in the same account state with zero failures -- the history matters, but the chain ignores it. Higher-order Markov chains (condition on the last n states) exist but grow the state space to k^n, bringing back the exponential problem. Continuous state spaces (e.g., stock prices, particle positions) require different machinery: Markov processes with transition kernels instead of matrices.',
        'Not every chain converges to one friendly answer. Reducible chains trap probability in a subset of states; periodic chains bounce in a cycle and never settle. The stationary distribution is a long-run average, not a near-term forecast: the demo\'s day-1 distribution is still (0.7, 0.25, 0.05) even though pi is different. Transition probabilities can also drift -- weather changes with the season, customer behavior shifts with product updates. A matrix estimated last quarter may not describe this quarter.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Three-state weather: Sunny, Cloudy, Rainy. Transition matrix P = [[0.7, 0.25, 0.05], [0.3, 0.5, 0.2], [0.2, 0.5, 0.3]]. Start from rain: day 0 = (0, 0, 1). Day 1 = (0, 0, 1) * P = (0.2, 0.5, 0.3). Day 2 = (0.2, 0.5, 0.3) * P = (0.29, 0.4, 0.31). Each step mixes further. By day 10, the distribution is approximately (0.476, 0.381, 0.143) -- the same result you get starting from sun or cloud.',
        'To find the stationary distribution exactly, solve pi*P = pi with the constraint that entries sum to 1. This gives the system: 0.7*pi_s + 0.3*pi_c + 0.2*pi_r = pi_s; 0.25*pi_s + 0.5*pi_c + 0.5*pi_r = pi_c; pi_s + pi_c + pi_r = 1. The solution is pi = (10/21, 8/21, 3/21), which is approximately (0.476, 0.381, 0.143). Over a long enough run, about 48% of days are sunny, 38% cloudy, and 14% rainy -- regardless of today\'s weather.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Markov, A.A. (1906), "Extension of the law of large numbers to dependent quantities" -- the original paper proving convergence for dependent variables. Norris, J.R. (1997), Markov Chains (Cambridge University Press) -- the standard modern textbook. Brin & Page (1998), "The anatomy of a large-scale hypertextual web search engine" -- PageRank as a Markov chain application.',
        'Prerequisites: Eigenvalues & Eigenvectors (stationary distribution is an eigenvector), Finite State Machines (the deterministic cousin -- same graph, no probabilities). Extensions: PageRank (web-scale application), Value Iteration (Reinforcement Learning) (Markov chain + choices = MDP). Related: Gossip Protocol (probability flow through a cluster), Graph BFS (state-graph traversal intuition).',
      ],
    },
  ],
};

