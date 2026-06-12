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
        `A Markov chain is a system that forgets — a system with a finite set of states and probabilities for jumping between them, such that tomorrow depends only on today. Not on yesterday, not on the entire history, not on whether you have been here before. That amnesiac rule is the MARKOV PROPERTY, and it is the most limiting and the most useful simplification in applied probability. Despite remembering nothing, the chain develops unshakable long-run habits. Start anywhere; iterate long enough; every starting point converges to the same place — the stationary distribution π, a probability vector that reproduces itself: πP = π. The site's weather chain (sunny/cloudy/rainy) is the template: sunny stays sunny 70%, each state sends probability mass to the others by fixed rules, and after 10 days the distribution locks to (0.476, 0.381, 0.143) regardless of whether you started sunny or rainy. The chain forgets where it came from.`,
        `This is not physics — Markov chains are mathematical abstractions — but they are everywhere. Speech is a Markov chain with hidden states (HMMs). Web pages are states; links are transitions, and Google's PageRank is a chain's stationary distribution. Customers move through trial→active→churn, and the algebra of absorbing states tells a business exactly what fraction will convert and how long it takes. Queues, MCMC sampling, language-model autocomplete, reinforcement learning: all are Markov chains in disguise, and they all reduce to the same question: iterate the transition matrix, find the eigenvector with eigenvalue 1, and read the long-run behavior.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Build a transition matrix P where entry P[i][j] is the probability of jumping from state i to state j. The weather chain has P[0][0] = 0.7 (sunny stays 70% sunny), P[0][1] = 0.25 (sunny goes cloudy 25%), P[0][2] = 0.05 (sunny becomes rainy 5%). Each row sums to 1 — from any state you must go somewhere. Start with a probability distribution π over the states: (1, 0, 0) means "certainly sunny." To evolve one step, compute πP: each new probability is a weighted sum of transitions from the current state. Iterate: πP, then (πP)P = πP², then πP³, and so on. Each multiplication pushes the distribution forward one time-step. After enough iterations, the result stabilizes: πP = π. The chain has reached equilibrium.`,
        `The remarkable truth, hidden in that matrix multiplication, is linear algebra. Iterate a vector by the same matrix, and you are computing power iteration — the algorithm that finds an eigenvector of P. The stationary distribution π is the eigenvector with eigenvalue exactly 1. Watch the demo: day 0 is (1, 0, 0), day 1 multiplies by P to get (0.7, 0.25, 0.05), day 2 multiplies again, and the sequence converges to π. You are watching power iteration at work, though you never wrote down a characteristic polynomial. (Fine print: the chain must be irreducible — you can reach any state from any other, eventually — and aperiodic — not locked in a cycle. The weather chain has both properties; so does the web-graph chain when Google adds 15% random teleportation.)`,
        `Absorbing states are a second species: once you enter them, you never leave. The subscription funnel has two: churned and upgraded. An active user each month converts to upgraded (15%), to churned (10%), or stays active (75%). A trial user goes active (60%) or churned (40%). The business asks: what fraction of trials eventually upgrade? The answer emerges not from simulation but from solving one self-consistent equation. An active user becomes upgraded with probability u = 0.15 + 0.75u (upgrade this month, or survive it and face the same odds). Solving: u = 0.6. Times the 60% who pass the trial: 36% of trials convert. The ceiling is inescapable; no amount of iteration changes it.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Building the chain: define states and transitions. Done. Storing the chain: one matrix of size S × S, where S is the number of states. The weather chain needs 3 × 3 = 9 entries. PageRank on a billion-page web needs more memory, but sparsity saves it — most web pages link to only a handful of others, so you store only the nonzero transitions. One iteration: S² matrix-vector multiplication in the dense case, S operations in the sparse case. Iterate to convergence: typically O(log(1/ε)) iterations where ε is your tolerance, since the convergence is exponential. The weather demo converges by day 10 to three decimals. Absorbing-state math (solving for the conversion probability) is a single linear-system solve — O(S³) with Gaussian elimination, fast for small S, necessary for big systems.`,
        `Practically: the visualization runs live in JavaScript, computing each day's distribution from the previous one in microseconds. Computing PageRank on the real web means distributing the matrix-vector multiply across a cluster of servers, but the mathematics is identical. The only scale issue is memory for storing the transition matrix; with a billion states and sparsity, clever data structures (like a hash of outgoing edges per state) keep it practical.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `PageRank: a page's rank IS the stationary probability that a random web-surfer visits it. The surfer clicks links (transitions follow the graph) and occasionally teleports to a random page (the 15% repair that ensures irreducibility and aperiodicity). Google powers its ranking by solving πP = π. HMMs (hidden Markov models) are chains where you see noisy observations instead of the true state — speech recognition, gene sequencing, biological signal analysis all live here. Queueing theory studies chains where the state is queue length; arrivals and services are transitions. Hospitals use it to staff emergency rooms; telecom uses it to predict congestion. MCMC (Markov Chain Monte Carlo) inverts the whole problem: you want to sample from some posterior probability that is hard to compute directly, so you engineer a chain whose stationary distribution is that posterior, run it, and the samples tell you the distribution. It is the workhorse of Bayesian statistics and neural-network sampling. Reinforcement learning (Value Iteration) treats the problem as an MDP — a Markov chain where you choose transitions, and you optimize the long-run reward. Gossip protocols spread information through a peer-to-peer network by having each peer send random messages; the state is "who knows"; the chain is memoryless infection, and the math predicts how many rounds until everyone is informed.`,
        `Every one of these — ranking, speech, queues, sampling, optimization, gossip — solves the same puzzle: how does the system evolve? The answer is always the same: multiply by the transition matrix, find the eigenvector, or solve the absorption probability. One rule, infinite applications.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest trap is assuming convergence happens. It does not, if the chain is reducible (you can get trapped in a set of states and never escape) or periodic (you cycle: state A → B → A → B, never settling). PageRank avoids this by engineering both properties into the chain via the teleportation mechanic. A less famous trap: forgetting that π is a long-run average, not a guarantee at any finite time. The weather chain reaches (0.476, 0.381, 0.143) by day 10 to three decimals, but day 1 is (0.7, 0.25, 0.05). If you are deciding whether to plan an outdoor event on day 1, using π is foolish — you need the actual forecast. Conversely, at stationary state, the chain has total amnesia; πP = π means shuffling the transition probabilities between states does not change the long-run distribution (as long as π is still an invariant of the new matrix). Beginners sometimes treat the stationary distribution as a cause of convergence, when in fact it is a consequence: the limiting behavior caused by the transition structure.`,
        `A third misconception: conflating the matrix P with the concept. The transition matrix is the DATA; the chain is the DYNAMICS. Different data (different probabilities on the edges) means a different chain and a different π. The equations, the algebra, the power-iteration loop — all remain the same. Stationary state is not the "stable" or "best" state either; it is just where the long-run probability mass pools. In the subscription funnel, the stationary state is 36% converted and 64% churned, with no more active users. That is not good; it is inevitable.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `The transition matrix is only a matrix, and iterating it is power iteration. Study Eigenvalues & Eigenvectors to see that π is the eigenvector with eigenvalue 1, and that the rate of convergence is set by the second-largest eigenvalue. PageRank takes the Markov chain and adds rank interpretation: go read that page to see how stationary distributions rank web pages. Finite State Machines are chains with zero probabilities (deterministic), so FSM reasoning applies: if your chain is acyclic, you can compute absorption probabilities without iteration. Gossip Protocol shows how randomness and chain-mixing (aperiodicity) guarantee information spread. Value Iteration (Reinforcement Learning) extends this to the controlled case: instead of a fixed chain, you choose transitions to maximize expected reward. The absorbing-state funnel algebra you saw here is identical to the Markov Decision Process backward-induction that RL uses. Finally, the family album on the visualization (n-gram autocomplete, MCMC, HMMs, queues) showcases the breadth; each is its own deep topic waiting for you.`,
      ],
    },
  ],
};

