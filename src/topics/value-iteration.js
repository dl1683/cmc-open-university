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
const fmt = (v) => (v === WALL_SENTINEL ? 'â–ˆ' : v === 10 ? 'G +10' : v === -10 ? 'P âˆ’10' : v.toFixed(1));

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
    state: snapshot('The grid world: goal +10, pit âˆ’10, wall â–ˆ, agent starts bottom-left'),
    highlight: { found: [cellId(...GOAL)], swap: [cellId(...PIT)], active: [cellId(...START)] },
    explanation: `The reinforcement learning setup, in miniature: an agent in a world, a REWARD signal (+10 at the goal, âˆ’10 in the pit), and NO instructions — nobody labels the right move (contrast every supervised topic on this site). Each step also costs ${living} (time is money). The question RL answers: how good is it to STAND in each square? That number is the square value.`,
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
      state: snapshot(`Sweep ${sweep}: V(s) â† max over moves of [${living} + ${GAMMA}Â·V(next)]`),
      highlight: changed.length ? { active: changed } : { found: [cellId(...GOAL)] },
      explanation: sweep === 1
        ? `Sweep 1 — the Bellman update: the value of each square becomes the best it can reach: step cost plus ${GAMMA}Ã— the neighbor value. Only the squares TOUCHING the goal and pit learn anything yet — value can only flow one step per sweep.`
        : changed.length
          ? `Sweep ${sweep}: the value gradient creeps ${sweep === 2 ? 'two steps' : 'further'} from the terminals. ${sweep === 3 ? 'Notice the negative value of the pit repelling its neighbors while the positive value of the goal attracts — the landscape is forming hills and valleys.' : 'Each square now summarizes the long-term consequences of standing there.'}`
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
    explanation: `Now the magic: a POLICY falls out for free. From any square, just step to the highest-valued neighbor — greedy on V. The route from start is highlighted: it climbs the value gradient${living === -0.4 ? ', taking the efficient path because every step hurts' : ' at leisure, since steps are nearly free — try the urgent setting and compare'}, and it gives the pit a wide berth without ever being told to. The numbers ARE the strategy.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The grid is a Markov decision process. Each cell is a state. The green cell marked G is the goal (+10 reward). The red cell marked P is the pit (-10 reward). The dark cell is a wall the agent cannot enter. Every other cell starts at value zero.',
        {
          type: 'callout',
          text: 'Value iteration works by turning every state into a one-step lookahead equation and applying that equation until it stops changing.',
        },
        'Each number in a cell is V(s): how much total reward the agent expects to collect from that state onward, assuming it plays optimally. Active (highlighted) cells are the ones whose values changed during the current sweep. The final highlighted path is the greedy policy: from any state, step toward the highest-valued neighbor.',
        'Watch value propagate backward from the terminals. In sweep 1, only cells adjacent to the goal or pit update. Each subsequent sweep carries information one step farther. When no cell changes by more than 0.01, the Bellman equation is satisfied everywhere and the value table has converged.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some decisions cannot be judged by their immediate outcome. A chess move that loses a pawn may win the game. A robot step toward a wall may be the start of a detour around an obstacle. Reinforcement learning exists for exactly this class of problem: an agent takes actions, the world changes, rewards arrive later, and the right choice now depends on consequences that unfold over many future steps.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Reinforcement_learning_diagram.svg', alt: 'Reinforcement learning loop with agent actions environment state and reward', caption: 'The agent-environment loop is the operational setting behind value functions: action changes state, and reward flows back as training signal. Source: Wikimedia Commons, Megajuice, CC BY-SA 4.0.'},
        'The mathematical framework is the Markov decision process, or MDP (Bellman 1957). An MDP has a set of states S, a set of actions A, a reward function R, transition probabilities P, and a discount factor gamma. The job of the agent is to find a policy -- a mapping from states to actions -- that maximizes the expected sum of discounted future rewards. The 1998 textbook from Sutton and Barto (second edition 2018) consolidated the field around this framework and remains the standard reference.',
        'Value iteration solves the MDP when the model (transitions and rewards) is known. Q-learning (Watkins 1989) solves it when the model is unknown, learning from experience instead of a blueprint. Both rest on the same foundation: the Bellman equation.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable attempt is to hardcode rules. Move toward the goal, avoid the pit, prefer short paths. A human can write these rules for a 3x4 grid in a few minutes. For a known, small, static environment, hand-crafted rules work.',
        'A second reasonable attempt is exhaustive enumeration. List every possible policy (every assignment of an action to each state), simulate each one, and pick the policy with the highest total reward. For our 3x4 grid with 4 actions, that is 4^10 = about one million policies for the 10 non-terminal, non-wall cells. Brute-forceable, if slow.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'State spaces are too large for enumeration. Chess has roughly 10^47 legal positions. Go has roughly 10^170. A self-driving car state includes position, velocity, road geometry, and every nearby vehicle -- continuous and high-dimensional. Enumerating all policies is impossible, and hardcoding rules is brittle because the programmer must anticipate every situation.',
        'The second wall is that environment dynamics may be unknown. A robot does not ship with a physics simulator of every surface it will walk on. A game-playing agent does not start with the rules. Even when a model exists, it may be wrong. Value iteration requires a complete, correct model. Q-learning drops that requirement and learns from raw experience, but it needs a different mechanism to avoid getting stuck on the first decent-looking policy.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The Bellman optimality equation: the value of a state equals the immediate reward from the best action plus the discounted value of the resulting next state. In symbols: V*(s) = max_a [R(s,a) + gamma * sum over sPrime of P(sPrime|s,a) * V*(sPrime)]. A state is worth what you earn now plus the best future you can reach.',
        'This is recursive -- V* on the left depends on V* on the right. Value iteration resolves the recursion by starting with a guess (all zeros) and sweeping repeatedly: replace the value of each state with the best one-step lookahead using the previous values. Each sweep pushes reward information one layer farther through the state space. The contraction mapping theorem guarantees convergence when gamma < 1.',
        'Q-learning reformulates the same idea for the model-free case. Instead of V(s), learn Q(s,a): the value of taking action a in state s and then acting optimally. The update is Q(s,a) <- Q(s,a) + alpha * [r + gamma * max_aPrime Q(sPrime,aPrime) - Q(s,a)]. The term in brackets is the temporal-difference (TD) error: the difference between what actually happened (r + gamma * max Q at the next state) and what we predicted (the old Q value). Positive surprise raises Q; negative surprise lowers it.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The agent-environment loop: at time t, the agent observes state s_t, chooses action a_t, receives reward r_t, and transitions to state s_{t+1}. The goal is a policy pi(s) that maximizes the expected return G_t = r_t + gamma*r_{t+1} + gamma^2*r_{t+2} + ... where gamma (typically 0.9 to 0.99) discounts future rewards so nearby rewards matter more.',
        'Value iteration (model-based): initialize V(s) = 0 for all non-terminal states. Repeat: for each state s, for each action a, compute the expected return using the known transition model. Set V(s) = max over actions. Stop when the largest change across all states falls below a threshold. Extract the policy: pi(s) = argmax_a [R(s,a) + gamma * V(next state)].',
        'Q-learning (model-free): initialize Q(s,a) = 0 for all state-action pairs. The agent interacts with the environment. After each transition (s, a, r, sPrime), update: Q(s,a) <- Q(s,a) + alpha * [r + gamma * max_aPrime Q(sPrime,aPrime) - Q(s,a)]. The learning rate alpha (typically 0.1 to 0.001) controls how fast new experience overwrites old estimates.',
        'Exploration vs. exploitation: epsilon-greedy is the standard starting point. With probability epsilon, pick a random action (explore); otherwise pick argmax_a Q(s,a) (exploit). Start epsilon high (1.0: pure exploration) and decay it toward a small value (0.01) as the Q-table matures. Without exploration, the agent may lock onto the first decent path and never discover a better one.',
        'Deep Q-Networks (Mnih et al. 2015): when the state space is too large for a table (Atari screens are 210x160x3 pixels), replace the Q-table with a neural network that takes a state as input and outputs Q-values for all actions. Two key tricks make this stable: a replay buffer that stores past transitions and samples mini-batches to break correlation, and a target network that is updated slowly to prevent the moving target problem.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Value iteration converges because the Bellman operator is a contraction mapping under the infinity norm when gamma < 1. Each sweep reduces the maximum error between the current value table and the true optimal values by a factor of gamma. After k sweeps, the error is at most gamma^k times the initial error. With gamma = 0.9, ten sweeps reduce the worst-case error by a factor of about 3.5; twenty sweeps by about 8.1.',
        'Q-learning converges to the optimal Q* under two conditions proved by Watkins and Dayan (1992): every state-action pair must be visited infinitely often, and the learning rate must decay appropriately (sum of alpha_t = infinity, sum of alpha_t^2 < infinity). The intuition: the TD update is a stochastic approximation to the Bellman backup. Each sample is noisy, but with enough samples the noise averages out and Q converges to the fixed point of the Bellman optimality equation.',
        'The greedy policy extracted from a converged value table or Q-table is optimal. If V*(s) or Q*(s,a) satisfies the Bellman equation, then choosing the action that achieves the maximum cannot be improved -- any deviation would lower expected return because the values already encode all future consequences.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Tabular value iteration: each sweep is O(|S| * |A| * branch(S)) where branch(S) is the branching factor per action. Space is O(|S|) for the value table. The number of sweeps to reach error epsilon is O(log(1/epsilon) / log(1/gamma)). For the demo grid: 12 states, 4 actions, converges in about 6 sweeps.',
        'Tabular Q-learning: space is O(|S| * |A|) for the Q-table. Time complexity is harder to state because it depends on how the agent explores. Sample efficiency is the real bottleneck -- Q-learning may need millions of episodes to converge in environments with sparse rewards or long horizons. Each update is O(|A|) to compute the max.',
        'DQN: space is the network size (millions of parameters for Atari). Each update is a forward pass plus a backward pass through the network. The replay buffer adds O(buffer_size) memory. Training is orders of magnitude slower than tabular methods per state-action pair, but DQN handles state spaces where a table would require more entries than atoms in the universe.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Atari games (DQN, Mnih et al. 2015): a single architecture learned to play 49 different Atari games from raw pixels, reaching human-level performance on most. The Q-network generalized across visually similar states without any game-specific engineering.',
        'Go (AlphaGo, Silver et al. 2016): combined Monte Carlo tree search with value and policy networks trained via self-play reinforcement learning. AlphaGo defeated the world champion. AlphaZero (2017) dropped human game data entirely and learned from scratch.',
        'Robotics: RL trains locomotion controllers, grasping policies, and manipulation skills in simulation, then transfers to physical robots (sim-to-real). The value function encodes which configurations lead to task completion.',
        'Recommendation systems: each user session is a sequence of states (browsing history), actions (items to recommend), and rewards (clicks, purchases). Q-learning variants optimize long-term engagement rather than greedy click-through.',
        'RLHF for large language models: reinforcement learning from human feedback uses a reward model trained on human preferences, then optimizes the policy of the language model via PPO (a policy gradient method, not Q-learning, but built on the same MDP framework). This is how ChatGPT and Claude are fine-tuned for helpfulness.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Sparse rewards: if the agent only receives a reward at the very end of a long episode, Q-learning updates propagate information backward one step per episode. The agent may wander randomly for millions of steps before a useful signal reaches early states. Reward shaping and curiosity-driven exploration are partial fixes.',
        'High-dimensional continuous action spaces: Q-learning requires computing max_a Q(s,a). With discrete actions (Atari has 18 buttons), this is a simple argmax. With continuous actions (robot joint torques, steering angles), maximizing over an infinite action space is intractable. Policy gradient and actor-critic methods (A3C, SAC, PPO) handle continuous actions by parameterizing the policy directly.',
        'Sim-to-real gap: policies trained in simulation often fail on physical hardware because simulator physics, friction, lighting, and sensor noise do not match reality. Domain randomization (varying simulation parameters) helps but does not eliminate the problem.',
        'Reward hacking: the agent optimizes whatever objective it is given. A cleaning robot rewarded for not seeing dirt may learn to close its eyes. A game agent may find exploits the designer did not anticipate. Reward specification is an unsolved alignment problem.',
        'Sample inefficiency: model-free RL typically needs millions of environment interactions. Each interaction may be expensive (physical robots, expensive simulations). Model-based methods (learning a world model, then planning inside it) improve sample efficiency but introduce model error.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Four-state gridworld. States: S (start, top-left), A (top-right), B (bottom-left), G (goal, bottom-right). Two actions from each non-terminal state: right and down. Transitions: S-right->A (reward 0), S-down->B (reward 0), A-down->G (reward +10), B-right->G (reward +1). G is terminal. Discount gamma = 0.9. Learning rate alpha = 0.1. All Q-values start at zero.',
        'Episode 1: the agent follows the path S -> A -> G. First it takes action "right" in S, arrives at A, receives reward 0. Then it takes action "down" in A, arrives at G, receives reward 10. We update backward.',
        'Update Q(A, down): TD target = r + gamma * max_aPrime Q(G, aPrime) = 10 + 0.9 * 0 = 10. TD error = 10 - Q(A, down) = 10 - 0 = 10. New Q(A, down) = 0 + 0.1 * 10 = 1.0.',
        'Update Q(S, right): TD target = 0 + 0.9 * max(Q(A, down), Q(A, right)) = 0 + 0.9 * max(1.0, 0) = 0.9. TD error = 0.9 - 0 = 0.9. New Q(S, right) = 0 + 0.1 * 0.9 = 0.09.',
        'Episode 2: the agent follows S -> B -> G. Reward at B-right->G is only +1. Update Q(B, right) = 0 + 0.1 * [1 + 0.9*0 - 0] = 0.1. Update Q(S, down) = 0 + 0.1 * [0 + 0.9*0.1 - 0] = 0.009.',
        'After two episodes: Q(S, right) = 0.09, Q(S, down) = 0.009. The agent already prefers going right (toward the +10 reward through A) over going down (toward the +1 reward through B). Over hundreds of episodes with epsilon-greedy exploration, these values converge to their true optima and the gap widens. The Q-table encodes the optimal policy: always go right from S.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Bellman, R. (1957). Dynamic Programming. The mathematical foundation: optimal substructure and the Bellman equation. Watkins, C. (1989). Learning from Delayed Rewards. PhD thesis introducing Q-learning. Watkins and Dayan (1992). Q-Learning. Convergence proof for tabular Q-learning. Mnih et al. (2015). Human-Level Control through Deep Reinforcement Learning. The DQN paper that launched deep RL. Sutton and Barto (2018). Reinforcement Learning: An Introduction, 2nd edition. The standard textbook, freely available online.',
        'Prerequisites: study Dynamic Programming and Memoization for the reuse pattern behind Bellman backups. Study Markov Chains for transition dynamics without actions. Study Neural Network Forward Pass for the function approximation that makes DQN possible.',
        'Extensions: study Policy Gradients for the alternative that optimizes the policy directly instead of learning Q-values -- necessary for continuous action spaces. Study Actor-Critic methods (A2C, A3C, SAC) for combining value estimation with policy optimization. Study PPO for the algorithm used in RLHF. Study Multi-Armed Bandits to isolate the exploration-exploitation tradeoff without state transitions. Study Monte Carlo Tree Search for planning with simulated rollouts, the approach combined with RL in AlphaGo.',
      ],
    },
  ],
};
