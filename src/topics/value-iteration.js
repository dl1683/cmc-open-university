// Reinforcement learning's foundation, watchable: a grid world where value
// leaks backward from the reward, one sweep at a time, until a policy —
// a way to act — crystallizes out of nothing but numbers.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'value-iteration',
  title: 'Value Iteration (Reinforcement Learning)',
  category: 'AI & ML',
  summary: 'Watch value flow backward from the goal until the best route to act simply falls out of the numbers.',
  controls: [
    { id: 'living', label: 'Cost per step', type: 'select', options: ['-0.4 (urgent)', '-0.04 (relaxed)'], defaultValue: '-0.4 (urgent)' },
  ],
  run,
};

const ROWS = 3;
const COLS = 4;
const GOAL = [0, 3];
const PIT = [1, 3];
const WALL = [1, 1];
const START = [2, 0];
const GAMMA = 0.9;
const WALL_SENTINEL = -99;

const isAt = (cell, [r, c]) => cell[0] === r && cell[1] === c;
const fmt = (v) => (v === WALL_SENTINEL ? '█' : v === 10 ? 'G +10' : v === -10 ? 'P −10' : v.toFixed(1));

export function* run(input) {
  const living = String(input.living).startsWith('-0.4') ? -0.4 : String(input.living).startsWith('-0.04') ? -0.04 : null;
  if (living === null) throw new InputError('Pick a living cost.');

  const V = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) =>
      isAt([r, c], GOAL) ? 10 : isAt([r, c], PIT) ? -10 : isAt([r, c], WALL) ? WALL_SENTINEL : 0));

  const rows = Array.from({ length: ROWS }, (_, r) => ({ id: `r${r}`, label: `row ${r}` }));
  const cols = Array.from({ length: COLS }, (_, c) => ({ id: `c${c}`, label: `col ${c}` }));
  const snapshot = (title) => matrixState({ title, rows, columns: cols, values: V.map((row) => [...row]), format: fmt });
  const cellId = (r, c) => `r${r}:c${c}`;

  yield {
    state: snapshot('The grid world: goal +10, pit −10, wall █, agent starts bottom-left'),
    highlight: { found: [cellId(...GOAL)], swap: [cellId(...PIT)], active: [cellId(...START)] },
    explanation: `Reinforcement learning's setup, in miniature: an agent in a world, a REWARD signal (+10 at the goal, −10 in the pit), and NO instructions — nobody labels the right move (contrast every supervised topic on this site). Each step also costs ${living} (time is money). The question RL answers: how good is it to STAND in each square? That number is the square's VALUE.`,
  };

  const neighbors = (r, c) => [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
    .filter(([nr, nc]) => nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !isAt([nr, nc], WALL));
  const isTerminal = (r, c) => isAt([r, c], GOAL) || isAt([r, c], PIT) || isAt([r, c], WALL);

  for (let sweep = 1; sweep <= 7; sweep += 1) {
    const changed = [];
    const next = V.map((row) => [...row]);
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        if (isTerminal(r, c)) continue;
        const best = Math.max(...neighbors(r, c).map(([nr, nc]) => living + GAMMA * V[nr][nc]));
        if (Math.abs(best - V[r][c]) > 0.01) changed.push(cellId(r, c));
        next[r][c] = best;
      }
    }
    for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) V[r][c] = next[r][c];
    yield {
      state: snapshot(`Sweep ${sweep}: V(s) ← max over moves of [${living} + ${GAMMA}·V(next)]`),
      highlight: changed.length ? { active: changed } : { found: [cellId(...GOAL)] },
      explanation: sweep === 1
        ? `Sweep 1 — the Bellman update: each square's value becomes the best it can reach: step cost plus ${GAMMA}× the neighbor's value. Only the squares TOUCHING the goal and pit learn anything yet — value can only flow one step per sweep.`
        : changed.length
          ? `Sweep ${sweep}: the value gradient creeps ${sweep === 2 ? 'two steps' : 'further'} from the terminals. ${sweep === 3 ? 'Notice the pit\'s NEGATIVE value repelling its neighbors while the goal\'s positive value attracts — the landscape is forming hills and valleys.' : 'Each square now summarizes the long-term consequences of standing there.'}`
          : `Sweep ${sweep}: nothing moved more than 0.01 — CONVERGED. The Bellman equation is satisfied everywhere: every value equals the best one-step lookahead. This fixed-point-by-iteration is the same trick as PageRank.`,
      invariant: 'V(s) converges to the true expected total reward from s under optimal play.',
    };
    if (!changed.length) break;
  }

  // derive the greedy policy path from START
  const path = [];
  let [r, c] = START;
  while (!isAt([r, c], GOAL) && path.length < 10) {
    path.push(cellId(r, c));
    const options = neighbors(r, c).filter(([nr, nc]) => !isAt([nr, nc], PIT));
    [r, c] = options.sort((a, b) => V[b[0]][b[1]] - V[a[0]][a[1]])[0];
  }
  path.push(cellId(...GOAL));

  yield {
    state: snapshot('The policy: from anywhere, step toward the highest-valued neighbor'),
    highlight: { found: path, swap: [cellId(...PIT)] },
    explanation: `Now the magic: a POLICY falls out for free. From any square, just step to the highest-valued neighbor — greedy on V. The agent's route from start is highlighted: it climbs the value gradient${living === -0.4 ? ', taking the efficient path because every step hurts' : ' at leisure, since steps are nearly free — try the urgent setting and compare'}, and it gives the pit a wide berth without ever being told to. The numbers ARE the strategy.`,
  };

  yield {
    state: snapshot('From this grid to AlphaGo and RLHF'),
    highlight: {},
    explanation: 'Everything beyond this is scaling. Q-LEARNING runs this same Bellman update without a map — learning from experienced transitions while exploring (the famous explore-vs-exploit trade). Replace the value table with a neural network (see Neural Network Forward Pass) and you get DQN, which learned Atari from pixels in 2013; add search and you reach AlphaGo. And when LLMs are tuned with reinforcement learning from feedback, the foundations are these: actions, rewards, and values propagating backward from what worked.',
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `Value iteration is reinforcement learning's most direct attack on the problem: given a map of the world, how do you compute the value of standing in each square without being told the right moves? The answer is recursive: a square's value is the immediate cost of living there, plus a discounted (0.9×) echo of its neighbor's value. That recursive definition, run backward from the goal, solves itself.`,
        `The algorithm fills a table where each entry V(s) is the expected total reward you can collect by starting in state s and then acting optimally. The goal yields +10, the pit yields −10, and every step costs something (−0.4 or −0.04, your choice). The agent learns nothing about moves — only values. But from values, the optimal move crystallizes instantly: step toward the neighbor with the highest value, greedily, and you get the best path for free.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `You begin with initial guesses: the goal is worth +10, the pit −10, all others are 0. Then you sweep through the grid repeatedly. In each sweep, you update every non-terminal square using the Bellman equation: V(s) ← max over neighbors of [cost + 0.9 × V(neighbor)]. This says: stand in s, pay the living cost, then move to the neighbor with the highest value. The 0.9 multiplier (gamma) says: next step's reward is worth 90% of this step's. This discounting is crucial — it prevents infinite loops and reflects that distant futures matter less.`,
        `Each sweep propagates value one step backward from the terminals. Squares touching the goal and pit change immediately. Their neighbors see those changes next sweep. By sweep three, the pit's negative value repels its neighbors while the goal's positive value attracts — a landscape of hills and valleys emerges. After seven or so sweeps, the values stabilize: each square now holds the sum of all discounted rewards reachable by optimal play. The algorithm converges because it is finding the fixed point of the Bellman recurrence, just like PageRank finds a fixed point by iterating.`,
        `Once values converge, the policy is trivial: from any square, look at your neighbors' values and step toward the one with the highest value, avoiding the pit without being told. That greedy choice IS optimal because the values encode all future consequences. If steps are cheap (−0.04), the agent wanders; if urgent (−0.4), it takes the shortest path, because the cost of delay competes with the length of the route.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Value iteration runs O(S × A) per sweep, where S is the number of states and A is the average number of actions (neighbors). With a 3×4 grid, that is roughly 60 operations per sweep. You typically need O(log(1/ε) / (1 − γ)) sweeps to converge within ε error; with γ = 0.9, that is about 20–100 sweeps depending on precision, yielding thousands of updates to solve a tiny world perfectly. The space cost is O(S) to store the value table — one number per square. This scales well to moderate state spaces (millions of states) but is useless for problems with enormous or continuous state spaces (chess, robotics, Atari), where the state table does not fit or is impossible to enumerate.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Value iteration is the theoretical foundation of modern reinforcement learning. In practice, the world rarely hands you a perfect map: you must learn values by trial and error. Q-learning replaces the Bellman update with samples from real transitions, so an agent playing a game can learn values on the fly. Neural Q-networks (DQN, 2013) replace the discrete table with a neural network that predicts Q-values from pixels, opening Atari and beyond. AlphaGo (2016) combines a learned value function with Monte Carlo tree search, and modern large language models are tuned using reinforcement learning from human feedback, where the value function measures how much humans prefer one response over another. Every step of that scaling preserves the core Bellman equation you see here: V(s) = max[action of (reward + γ × V(next_state))].`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The algorithm converges to the optimal value table for the environment you model — but only if that model is correct. A wrong map leads to a wrong solution, no matter how many sweeps you run. In the real world, the agent must explore to discover rewards, transitions, and even the state space structure. Value iteration assumes you already know all of that. Also, gamma = 0.9 is arbitrary — changing it reshapes the entire landscape, favoring short-term wins (gamma near 0) or long-term returns (gamma near 1). There is no universal "right" gamma; it encodes how much you care about the future relative to now. Finally, the greedy policy (step to the best neighbor) is optimal under the assumption that you already have the optimal values; if you use greedy during learning instead of exploration, you may lock into a suboptimal route before values converge.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `If you want to see how values guide choices, trace through Gradient Descent to see how neural networks minimize loss by following gradients — the same intuition of "slide toward the valley." Read about PageRank to understand fixed-point iteration on a graph: PageRank and value iteration are structural twins. For the statistical foundation, learn Memoization (Dynamic Programming), where subproblems are solved once and reused — value iteration is dynamic programming applied to Markov decision processes. To see values fed into a neural net, study Neural Network Forward Pass. Finally, if you want to plan paths with estimated costs, explore A* Search, which uses a heuristic value (like an estimated distance to the goal) to prune the search space intelligently, complementing value iteration's exhaustive approach.`,
      ],
    },
  ],
};
