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
        { id: 'stat', label: 'the stationary distribution π' },
      ],
      columns: STATES.map((s) => ({ id: s, label: s })),
      values: [evolve([1, 0, 0], 10), evolve([0, 0, 1], 10), evolve([1, 0, 0], 200)],
      format: (v) => v.toFixed(3),
    }),
    highlight: { found: ['stat:sunny', 'stat:cloudy', 'stat:rainy'] },
    explanation: 'The punchline: start from a rainy day instead — by day 10 the distribution is IDENTICAL. The chain forgets its origin completely; every starting point flows to the same STATIONARY DISTRIBUTION π = (10/21, 8/21, 3/21). Stationary means self-reproducing: πP = π — push the resting distribution through one more day and nothing changes. Read that equation again with Eigenvalues & Eigenvectors fresh in mind: π is an EIGENVECTOR of the transition matrix with eigenvalue exactly 1, and the day-by-day convergence you watched was power iteration finding it. (Fine print: guaranteed when the chain can\'t get trapped or locked in a cycle — irreducible and aperiodic.)',
    invariant: 'πP = π: the stationary distribution is the transition matrix\'s eigenvalue-1 eigenvector, and mixing erases the start.',
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
      format: (v) => ['', 'a Markov chain: state = current page, transitions = links', 'dead ends and link-cycles trap the surfer — no clean π', '15% chance: teleport to a random page (makes it irreducible & aperiodic)', 'π itself — a page\'s rank IS its stationary probability'][v],
    }),
    highlight: { found: ['rank:what'] },
    explanation: 'Now the payoff this page owes PageRank: the "random surfer" IS a Markov chain — pages are states, links are transitions — and a page\'s importance is defined as the fraction of eternity the surfer spends there: the stationary distribution. The famous 15% teleportation isn\'t a hack; it is exactly the fine print above, engineered in — teleporting makes the web-chain irreducible (no trap pages) and aperiodic (no cycles), GUARANTEEING one unique π for power iteration to find. Three pages of this site — PageRank, Eigenvalues & Eigenvectors, and this one — turn out to be one idea wearing three hats.',
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
    explanation: 'Iterate the funnel live: by month 1, 9% of trial users have upgraded; by month 6, 24.7%; and the curve flattens toward its ceiling at 36%. The closed form drops out of one self-referential equation: an active user upgrades with probability u = 0.15 + 0.75u (upgrade now, or survive and face the same odds) → u = 0.6, times the 60% who survive the trial = 36%. The other 64% pool in churn. The same machinery prices the EXPECTED DURATION (a geometric ~4 months active) — and the same absorbing-chain algebra computes board-game lengths, gambler\'s-ruin odds, and how long a Gossip Protocol takes to infect a cluster.',
    invariant: 'Absorption probabilities solve self-consistent equations: u = (chance now) + (chance to survive)·u.',
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
      format: (v) => ['', 'state = last n−1 words; transitions = corpus counts — pre-LLM autocomplete', 'DESIGN a chain whose π is the distribution you want, then just run it', 'state = queue length; arrivals/services move it — Hot Rows lived here', 'hidden state walks a chain; you observe only noisy emissions', 'an MDP = Markov chain + choices: Value Iteration (Reinforcement Learning) optimizes the walk'][v],
    }),
    highlight: { active: ['mcmc:how'] },
    explanation: 'The family album. N-gram models — autocomplete before transformers — are literal Markov chains over words (and an LLM generating token-by-token is the same loop with a context-window-sized state). MCMC inverts this whole page brilliantly: instead of finding a given chain\'s π, it ENGINEERS a chain whose stationary distribution is some impossible-to-sample posterior, then wanders it — the workhorse of Bayesian statistics. Queues, hidden Markov models, and the MDPs under Value Iteration (Reinforcement Learning) round out the set. One amnesiac rule, iterated: the long-run behavior of half the systems on this site.',
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
      heading: `What it is`,
      paragraphs: [
        `A Markov chain is a system with amnesia. It has states, probabilities for moving between them, and one strict rule: tomorrow depends on today, not on the whole path that brought you here. The visualization uses a toy climate with sunny, cloudy, and rainy states. Sunny stays sunny 70% of the time, cloudy splits its probability, and rainy rarely lingers. Start from certain sun or certain rain; after about 10 days both starts land near the same long-run mix, (0.476, 0.381, 0.143).`,
        `That resting mix is the stationary distribution. It is a probability vector that reproduces itself when multiplied by the transition matrix: pi P = pi. This is the same idea behind PageRank, where pages are states and links are transitions. The page's second view shows a different species, an absorbing chain, where trial users eventually pool in upgraded or churned states.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Build a matrix P where row i contains the probabilities of leaving state i. Each row sums to 1. A current distribution like (1, 0, 0) means "certainly sunny." One step is matrix multiplication: pi P. Day 1 becomes (0.7, 0.25, 0.05); day 2 multiplies again; day 10 has nearly stopped changing. Eigenvalues & Eigenvectors explains the hidden reason: power iteration is finding the eigenvector with eigenvalue 1.`,
        `Absorbing states never let probability leave. In the subscription funnel, trial users go active 60% of the time or churn 40%. Active users upgrade 15%, churn 10%, and otherwise stay active. The eventual upgrade probability solves one self-consistent equation: u = 0.15 + 0.75u, so active users eventually upgrade with probability 0.6. Since only 60% reach active, 36% of trials eventually upgrade.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `A dense chain with S states stores S squared probabilities and each step costs O(S squared). Most real chains are sparse, so storage and one step are O(E), where E is the number of nonzero transitions. Convergence speed depends on the spectral gap, not just S; the weather chain is tiny and settles to three decimals by day 10. Absorbing probabilities can be found by iteration or by solving a linear system, typically O(S cubed) with Gaussian elimination for dense matrices.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Markov chains model queues, customer funnels, board games, weather, speech, and sampling. A Queue can be studied by making the state "how many jobs are waiting." Gossip Protocol asks how a random message-spreading process mixes through a cluster. Value Iteration (Reinforcement Learning) adds choices and rewards, turning a fixed chain into a Markov decision process. MCMC reverses the goal: design a chain whose stationary distribution is the distribution you want to sample from, then walk it.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Do not assume every chain converges to one friendly answer. Reducible chains can get trapped in a subset of states; periodic chains can bounce forever. PageRank adds teleportation precisely to avoid those failures. Also, a stationary distribution is a long-run average, not a near-term forecast. The demo's day 1 weather is still (0.7, 0.25, 0.05), even though the long-run mix is different.`,
        `Finite State Machines look similar because they also walk a graph of states, but their arrows are deterministic rather than probabilistic. A Markov chain says "70% this way, 25% that way"; an FSM says "on this symbol, go exactly there." Mixing up those two models leads to wrong guarantees.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read Eigenvalues & Eigenvectors for the fixed-point proof, PageRank for the web-scale version, and Finite State Machines for the deterministic cousin. Graph BFS helps with state-graph intuition, while Gossip Protocol and Value Iteration (Reinforcement Learning) show how the same probability flow becomes distributed-systems spread and decision-making under uncertainty.`,
      ],
    },
  ],
};
