// Reinforcement learning's foundation, watchable: a grid world where value
// leaks backward from the reward, one sweep at a time, until a policy �
// a way to act � crystallizes out of nothing but numbers.

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
    explanation: `The reinforcement learning setup, in miniature: an agent in a world, a REWARD signal (+10 at the goal, −10 in the pit), and NO instructions � nobody labels the right move (contrast every supervised topic on this site). Each step also costs ${living} (time is money). The question RL answers: how good is it to STAND in each square? That number is the square value.`,
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
        ? `Sweep 1 � the Bellman update: the value of each square becomes the best it can reach: step cost plus ${GAMMA}× the neighbor value. Only the squares TOUCHING the goal and pit learn anything yet � value can only flow one step per sweep.`
        : changed.length
          ? `Sweep ${sweep}: the value gradient creeps ${sweep === 2 ? 'two steps' : 'further'} from the terminals. ${sweep === 3 ? 'Notice the negative value of the pit repelling its neighbors while the positive value of the goal attracts � the landscape is forming hills and valleys.' : 'Each square now summarizes the long-term consequences of standing there.'}`
          : `Sweep ${sweep}: nothing moved more than 0.01 � CONVERGED. The Bellman equation is satisfied everywhere: every value equals the best one-step lookahead. This fixed-point-by-iteration is the same trick as PageRank.`,
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
    explanation: `Now the magic: a POLICY falls out for free. From any square, just step to the highest-valued neighbor � greedy on V. The route from start is highlighted: it climbs the value gradient${living === -0.4 ? ', taking the efficient path because every step hurts' : ' at leisure, since steps are nearly free � try the urgent setting and compare'}, and it gives the pit a wide berth without ever being told to. The numbers ARE the strategy.`,
  };

  yield {
    state: snapshot('From this grid to AlphaGo and RLHF'),
    highlight: {},
    explanation: 'Everything beyond this is scaling. Q-LEARNING runs this same Bellman update without a map � learning from experienced transitions while exploring (the famous explore-vs-exploit trade). Replace the value table with a neural network (see Neural Network Forward Pass) and you get DQN, which learned Atari from pixels in 2013; add search and you reach AlphaGo. And when LLMs are tuned with reinforcement learning from feedback, the foundations are these: actions, rewards, and values propagating backward from what worked.',
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The grid is a Markov decision process, or MDP: a set of states, actions, rewards, and transition rules where the next state depends only on the current state and chosen action. A cell number is V(s), the expected discounted reward from state s if the agent acts optimally from there.',
        {
          type: 'callout',
          text: 'Value iteration works by turning every state into a one-step lookahead equation and applying that equation until it stops changing.',
        },
        'Active cells are the states updated during the current sweep. When reward moves one cell farther from the goal on each sweep, the animation is showing a safe inference: if a neighbor is worth 10 and gamma is 0.9, then stepping to it is worth 9 before any move cost.',
        'The final highlighted arrows are the greedy policy, which means the action chosen from each state by looking at the highest-valued successor. Convergence means the largest value change has fallen below the threshold, so another sweep would not change the policy in the displayed grid.',
      
        {type: 'image', src: './assets/gifs/value-iteration.gif', alt: 'Animated walkthrough of the value iteration visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Value iteration exists because some decisions are only good after their future consequences are counted. A robot may need to move away from a charger to reach a door, and a game agent may need to accept a small penalty now to avoid a large loss later.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Reinforcement_learning_diagram.svg', alt: 'Reinforcement learning loop with agent actions environment state and reward', caption: 'The agent-environment loop is the operational setting behind value functions: action changes state, and reward flows back as training signal. Source: Wikimedia Commons, Megajuice, CC BY-SA 4.0.'},
        'The value function is the accounting system for those delayed consequences. It converts a future stream of rewards into one number per state, so a local action can be chosen using global consequences.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to write rules by hand: move toward the goal, avoid the pit, and prefer shorter paths. That works in a toy grid because a human can inspect the whole map and encode the right habit.',
        'A second approach is to enumerate policies, where a policy maps every state to an action. In a 10-state grid with 4 possible actions per state, there are 1,048,576 policies, which is already too many for a lesson-sized map and becomes absurd in real control problems.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that local rules do not compose into optimal long-term behavior. A rule like move toward the goal can step into a pit when the safe path begins with a detour.',
        'Policy enumeration grows exponentially with the number of states. If 10 states have about one million policies, 30 states have about 1.15e18 policies before considering stochastic transitions or continuous coordinates.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is the Bellman optimality equation. A state is worth the best immediate reward plus the discounted value of the next state, averaged over possible outcomes.',
        'Value iteration starts with a rough table, usually all zeros, then repeatedly replaces each entry with the Bellman backup computed from the previous table. The table becomes trustworthy because reward information can only move through legal transitions, one step at a time.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each state s, the algorithm tests every action a. It computes R(s,a) + gamma times the expected value of the resulting state, then keeps the maximum over actions.',
        'A full pass over all states is one sweep. Sweeps continue until the largest absolute change is below epsilon, such as 0.01, then the policy is extracted by choosing the maximizing action in each state.',
        'Q-learning uses the same backup idea without a known transition model. It learns Q(s,a), the value of taking action a in state s, by updating a table from experienced transitions instead of sweeping a known map.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is fixed-point convergence. When gamma is less than 1, the Bellman backup is a contraction: each sweep shrinks the maximum possible value error by at least a factor of gamma.',
        'If the table stops changing, every state already equals the best one-step return plus the discounted value of what follows. A greedy policy from that fixed point is optimal because any alternative action was already included in the maximum and lost.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'One value-iteration sweep costs O(|S| * |A| * b), where |S| is the number of states, |A| is actions per state, and b is the number of possible next states per action. Space is O(|S|) for the value table, or O(|S| * |A|) for Q-learning.',
        'Cost behaves like repeated global accounting. Doubling the number of states doubles the work per sweep; raising gamma from 0.9 to 0.99 usually increases the number of sweeps because future rewards fade more slowly.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Value iteration is useful when the model is known and the state space is small enough to sweep: grid navigation, inventory planning, queue control, and teaching reinforcement learning. It is also the clean model behind more complex methods.',
        'Q-learning and deep Q-networks use the same target in environments where the model is learned from experience. Game agents, simulators, robot policies, and recommendation systems all rely on value estimates when a choice must account for delayed reward.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Tabular value iteration fails when the state table is too large to store or sweep. A 1000 by 1000 grid already has one million states before velocity, inventory, or uncertainty are added.',
        'It also fails when rewards are sparse or the model is wrong. If the only reward appears after 200 steps, many sweeps or episodes are needed before early states receive useful signal, and a bad transition model will propagate the wrong values with confidence.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use four states: S, A, B, and terminal G. Actions from S lead to A or B with reward 0; A to G gives +10; B to G gives +1; gamma is 0.9 and all values start at 0.',
        'After the first sweep, V(A) = 10 because A can step into G, and V(B) = 1 for the same reason. V(S) is still 0 if the sweep used the previous all-zero table.',
        'After the second sweep, S compares right to A as 0 + 0.9 * 10 = 9 against down to B as 0 + 0.9 * 1 = 0.9. The greedy policy chooses right, and the 10-to-1 future reward difference has become a local decision at S.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are Bellman, Dynamic Programming (1957); Watkins, Learning from Delayed Rewards (1989); Watkins and Dayan, Q-Learning (1992); Sutton and Barto, Reinforcement Learning: An Introduction; and Mnih et al., Human-Level Control through Deep Reinforcement Learning (2015). Read these for the Bellman equation, tabular convergence, and the move from tables to neural value functions.',
        'Study dynamic programming first if the backup rule feels magical. Then study Markov chains, policy iteration, Q-learning, policy gradients, actor-critic methods, and Monte Carlo tree search as progressively different ways to estimate or use the same future-return idea.',
      ],
    },
  ],
};
