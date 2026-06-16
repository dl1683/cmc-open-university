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
      heading: `What it is`,
      paragraphs: [
        `Value iteration is dynamic programming for a Markov decision process: if you know the states, actions, rewards, transition probabilities, and discount factor, compute how good each state is under optimal play. Bellman's 1957 recurrence says a state's value equals the best immediate reward plus discounted future value. Run that recurrence repeatedly and the values converge.`,
        `In the grid demo, the goal is positive, the pit is negative, and every move has a small living cost. The agent is not copying a demonstrated path. It is backing up consequences from terminal states until every square contains a number summarizing the future. Once those numbers are accurate, the policy is simple: choose the action leading to the highest expected value.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Initialize V(s), often to zero except for terminal states. Then sweep over states. For each state, compute every action's expected return: immediate reward plus gamma times the value of possible next states, weighted by transition probability. Replace V(s) with the maximum action return. Gamma between 0 and 1 discounts distant rewards and makes the Bellman operator a contraction, which is the mathematical reason repeated sweeps converge.`,
        `The deterministic grid is the easiest case because each action leads to one next square. In stochastic worlds, moving north might go north 80% of the time and slip sideways 20%, so the update must average over outcomes. This is where Markov Chains & Steady States becomes useful background: future state distributions matter. PageRank is another fixed-point iteration, though it ranks graph nodes instead of choosing reward-maximizing actions.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `For a sparse MDP, one sweep costs O(number of transition edges), often written O(S * A * next) for S states, A actions, and a small number of next states per action. A dense transition table can cost O(S * S * A) per sweep. Convergence to epsilon accuracy scales roughly with log(1/epsilon) / (1 - gamma), so gamma close to 1 makes planning slower. Space is O(S) for values, or O(S * A) if you store action-values. This is excellent for small grids and impossible for raw Atari frames or open-ended robotics without approximation.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Exact value iteration is used in small planning domains, inventory models, queueing examples, grid navigation, and teaching reinforcement learning. Larger systems preserve the Bellman idea while replacing tables with samples or function approximators. Q-learning learns action values from experience. DQN used a Neural Network Forward Pass to approximate Q-values from Atari pixels in 2013. AlphaGo and later systems combine learned value functions with search, while robotics planners often use approximate dynamic programming when the state space is too large to enumerate.`,
        `The same explore-versus-exploit question appears in Multi-Armed Bandits, but bandits remove state transitions. Value iteration handles sequential consequences: today's action changes tomorrow's state.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The algorithm is only as correct as the model. If rewards are wrong, transition probabilities are wrong, or important state variables are missing, value iteration converges confidently to the wrong policy. It also assumes full knowledge of the environment. Reinforcement learning in the wild often starts without that model and must explore to learn it. Greedy action selection is optimal only after the values are accurate; using greed too early can block discovery.`,
        `Gamma is not a harmless constant. Low gamma makes the agent short-sighted; gamma near 1 values long-term reward but slows convergence and can make reward design mistakes severe. Also, do not confuse value backup with Gradient Descent. Value iteration repeatedly applies a Bellman max operator; neural RL may train value networks with gradients, but the table algorithm itself is not following a differentiable loss surface.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read Memoization (Dynamic Programming) for the reuse pattern, Markov Chains & Steady States for transition dynamics, and PageRank for another fixed-point iteration. A* Search gives a graph-planning contrast with heuristic costs. Neural Network Forward Pass explains function approximation for deep RL, Multi-Armed Bandits isolates exploration without the complication of changing states, and RL Experiment Reproducibility Ledger shows what must be recorded once RL leaves the toy grid.`,
      ],
    },
  ],
};
