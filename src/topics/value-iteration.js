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
      heading: 'Why This Exists',
      paragraphs: [
        `Value iteration exists for decisions where an action matters because of the future state it creates. A shortest path algorithm can choose a route when every edge cost is known. Supervised learning can copy labeled examples. Reinforcement learning problems are different: an agent acts, the world changes, rewards arrive later, and a good choice may look bad for a few steps before it pays off.`,
        `The grid in the demo is a small Markov decision process. Each square is a state, each move is an action, the goal and pit are terminal rewards, and each step has a living cost. The question is not where the agent has walked. The question is how good it is to stand in each square if the agent will act optimally from there.`,
      ],
    },
    {
      heading: 'The Obvious Approach',
      paragraphs: [
        `The obvious approach is to be greedy over immediate rewards. Move toward the goal, avoid the pit, and treat every other square as neutral. That works in a tiny open grid when the goal is visible and nothing surprising happens. It fails as soon as a short route passes near danger, a long route earns more reward, or actions are stochastic.`,
        `Another reasonable attempt is breadth-first search. BFS is correct when each step has the same cost and there are no delayed rewards beyond reaching a target. Value iteration handles a richer problem. A state can be good because it leads to future reward, bad because it leads to future loss, or ambiguous because the best action depends on transition probabilities and the discount factor.`,
      ],
    },
    {
      heading: 'The Wall',
      paragraphs: [
        `The wall is delayed consequence. A square beside the goal is valuable even before the agent receives the reward. A square beside the pit is dangerous even if the immediate step has not failed yet. A table of immediate rewards cannot represent that. The reward must flow backward from the future into earlier states.`,
        `The second wall is repeated choice. The value of a state assumes the agent will keep choosing well afterward. That makes the definition recursive: the best move from here depends on the values of the next states, and those values depend on their next states. Value iteration solves that recursion by repeated approximation until the table stops changing.`,
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        `The core insight is the Bellman optimality equation. The value of a state is the best expected return from one action plus the discounted value of whatever state comes next. Written plainly: a state is worth the reward you can get now, plus the future you can buy by choosing the best action.`,
        `Value iteration turns that equation into an algorithm. Start with rough values, often zero for nonterminal states. Sweep over the state space. Replace each value with the best one-step lookahead using the previous values. Repeat. Each sweep pushes reward information one layer farther through the world until every state agrees with its own best future.`,
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        `For each nonterminal state s, consider every action a. For each possible next state s2, multiply the transition probability by the quantity reward(s, a, s2) + gamma * V(s2). Sum those terms to get the expected return for that action. The new value V(s) is the maximum expected return over actions.`,
        `In the deterministic grid, each action has one next square, so the update is easy: step cost plus gamma times the neighbor value. In a stochastic grid, moving up might go up with probability 0.8 and slip sideways with probability 0.1 each. The same update works, but it averages all possible outcomes before choosing the best action.`,
      ],
    },
    {
      heading: 'What the Visual Proves',
      paragraphs: [
        `The grid is a value table. The highlighted cells are not visited cells; they are cells whose estimated future changed during that sweep. In the first sweep, only states next to the goal or pit learn anything. Later sweeps carry reward and danger farther away. This shows why planning is a propagation problem, not a path-drawing problem.`,
        `The final highlighted route is the greedy policy after convergence. The agent can simply step to the neighbor with the highest value because those values already include future consequences. The pit is avoided without a hand-written rule because nearby states inherited negative future value from the terminal loss.`,
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        `The proof idea is a fixed point. The Bellman update defines an operator on the value table. With a discount factor gamma below 1, applying that operator pulls value estimates closer together instead of letting errors grow. Repeated sweeps converge to the unique value table that satisfies the Bellman optimality equation.`,
        `Once the value table is correct, the greedy policy is optimal. If a state value equals the best expected one-step return plus discounted future value, then choosing the action that achieved that maximum cannot be improved by another first action. The rest of the plan is already included in the next state's value.`,
      ],
    },
    {
      heading: 'Cost and Behavior',
      paragraphs: [
        `One sweep costs the work needed to evaluate every action in every state. For a sparse MDP this is often O(S * A * K), where S is states, A is actions, and K is possible next states per action. A dense transition table can cost O(S * S * A) per sweep. Space is O(S) for the value table, or O(S * A) if action values are stored too.`,
        `The number of sweeps depends on the discount factor and accuracy target. Gamma close to 1 makes far future reward matter, which is often desirable, but it also slows convergence. Doubling the number of states roughly doubles each sweep. Increasing branching or stochastic outcomes multiplies the cost of each action evaluation.`,
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        `Exact value iteration wins when the model is known and the state space is small enough to enumerate. It is useful for grid worlds, simple robot planning, inventory control, queueing models, maintenance policies, small games, and teaching because every assumption is visible in the table.`,
        `It also wins as a conceptual foundation. Q-learning keeps the Bellman backup but learns from sampled experience instead of a complete transition model. Dynamic programming planners, approximate value methods, and many deep reinforcement learning systems still rely on the idea that future reward can be backed up into earlier states.`,
      ],
    },
    {
      heading: 'Failure Modes',
      paragraphs: [
        `Value iteration converges to the wrong answer if the MDP is wrong. Bad rewards, missing state variables, inaccurate transition probabilities, or hidden constraints all produce a policy that is optimal for the model and bad for the world. Reward design mistakes are especially dangerous because the algorithm will exploit whatever objective it is given.`,
        `The table also explodes. Raw images, continuous robot joints, user histories, and open-ended software tasks cannot be enumerated directly. Function approximation helps, but then the clean convergence guarantee changes. Greedy action selection is another trap: greed is justified after values have converged, not while the table is still mostly guesses.`,
      ],
    },
    {
      heading: 'Implementation Notes',
      paragraphs: [
        `Use two value arrays when teaching or debugging: read from the old table and write into the new table. In-place updates can converge faster in some cases, but they make the sweep order part of the behavior. Keep terminal states fixed, and keep walls or invalid states out of the action set.`,
        `Track the largest value change in a sweep. Stop when that delta is below a threshold tied to the reward scale. For stochastic transitions, make sure probabilities for each action sum to 1. For episodic tasks, be explicit about whether terminal rewards are stored as state values or delivered on entering the terminal state.`,
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        `Study Dynamic Programming and Memoization for the reuse pattern behind repeated backups. Study Markov Chains for transition dynamics, PageRank for another fixed-point iteration, and A* Search for a graph-planning contrast where a heuristic guides search instead of sweeping every state.`,
        `Then study Multi-Armed Bandits to isolate exploration without state transitions, Q-Learning for model-free Bellman backups, Neural Network Forward Pass for value-function approximation, and RL Experiment Reproducibility Ledger for the records needed once rewards, seeds, environments, and policies become experimental artifacts.`,
      ],
    },
  ],
};
