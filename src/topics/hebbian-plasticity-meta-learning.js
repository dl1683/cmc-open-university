// Hebbian plasticity for meta-learning: evolve or learn local synapse-update
// rules so an agent can adapt during its own lifetime.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'hebbian-plasticity-meta-learning',
  title: 'Hebbian Plasticity Meta-Learning',
  category: 'AI & ML',
  summary: 'Local synapse updates such as pre x post plasticity can be evolved or learned so agents adapt quickly after environment or body changes.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['plastic synapse rule', 'lifetime adaptation'], defaultValue: 'plastic synapse rule' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function* plasticSynapseRule() {
  const preVal = 0.8;
  const postVal = 0.6;
  const modVal = 0.5;
  const hebbTerms = ['pre x post', 'pre', 'post', 'const'];

  yield {
    state: labelMatrix(
      'Hebbian update: local signals change a weight',
      [
        { id: 'pre', label: 'pre' },
        { id: 'post', label: 'post' },
        { id: 'mod', label: 'mod' },
        { id: 'dw', label: 'dw' },
      ],
      [
        { id: 'value', label: 'val' },
        { id: 'role', label: 'role' },
      ],
      [
        ['0.8', 'sender'],
        ['0.6', 'receiver'],
        ['0.5', 'gate'],
        ['+', 'weight up'],
      ],
    ),
    highlight: { active: ['pre:value', 'post:value', 'mod:value'], found: ['dw:role'] },
    explanation: `A Hebbian-style rule updates a synapse from local signals: pre-synaptic activity (${preVal}), post-synaptic activity (${postVal}), and a modulatory gate (${modVal}). The product pre*post = ${(preVal * postVal).toFixed(2)} drives the weight change during the agent lifetime.`,
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'sensor', label: 'sensor', x: 0.8, y: 3.8, note: 'input' },
        { id: 'hidden', label: 'hidden', x: 3.2, y: 2.5, note: 'activity' },
        { id: 'action', label: 'action', x: 5.6, y: 3.8, note: 'move' },
        { id: 'reward', label: 'signal', x: 3.2, y: 5.2, note: 'modulator' },
        { id: 'rule', label: 'rule', x: 8.0, y: 3.8, note: 'update W' },
      ],
      edges: [
        { id: 'e-sensor-hidden', from: 'sensor', to: 'hidden', weight: 'W' },
        { id: 'e-hidden-action', from: 'hidden', to: 'action', weight: 'W' },
        { id: 'e-reward-hidden', from: 'reward', to: 'hidden', weight: '' },
        { id: 'e-hidden-rule', from: 'hidden', to: 'rule', weight: '' },
        { id: 'e-reward-rule', from: 'reward', to: 'rule', weight: '' },
      ],
    }, { title: 'The network changes while it is acting' }),
    highlight: { active: ['sensor', 'hidden', 'reward', 'rule'], found: ['e-sensor-hidden', 'e-hidden-action'] },
    explanation: `The agent does not need a full gradient update after every event. A local plasticity rule can adjust synapses online using activity (pre=${preVal}, post=${postVal}) and feedback (mod=${modVal}).`,
    invariant: `The update rule is local — computed from ${hebbTerms.length} terms — even when the behavior is global.`,
  };

  yield {
    state: labelMatrix(
      'What can be meta-learned',
      [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
        { id: 'd', label: 'D' },
      ],
      [
        { id: 'term', label: 'term' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['pre x post', 'correlation'],
        ['pre', 'sender bias'],
        ['post', 'receiver bias'],
        ['const', 'drift'],
      ],
    ),
    highlight: { active: ['a:term', 'b:term', 'c:term', 'd:term'] },
    explanation: `Differentiable plasticity parameterizes the update as a weighted combination of ${hebbTerms.length} local terms (${hebbTerms.join(', ')}). Evolution or gradient descent can tune the ${hebbTerms.length} rule coefficients.`,
  };

  yield {
    state: labelMatrix(
      'Plasticity is not the same as training',
      [
        { id: 'train', label: 'training' },
        { id: 'life', label: 'lifetime' },
        { id: 'evolve', label: 'evolve' },
      ],
      [
        { id: 'updates', label: 'updates' },
        { id: 'goal', label: 'goal' },
      ],
      [
        ['slow global', 'set initial policy'],
        ['fast local', 'adapt now'],
        ['rule search', 'discover update law'],
      ],
    ),
    highlight: { found: ['life:updates', 'evolve:updates'], compare: ['train:updates'] },
    explanation: `Training shapes the starting network or plasticity rule across ${hebbTerms.length} learnable terms. Lifetime plasticity changes weights during deployment so the agent can adapt to a new body, maze, or opponent.`,
  };
}

function* lifetimeAdaptation() {
  const damageStep = 10;
  const recoveryEnd = 100;
  const fixedFinalPerf = 0.24;
  const plasticFinalPerf = 0.72;
  const metaStages = ['outer search', 'plastic rule', 'agent life', 'score'];

  yield {
    state: plotState({
      axes: { x: { label: 'timesteps after damage', min: 0, max: recoveryEnd }, y: { label: 'task performance', min: 0, max: 1 } },
      series: [
        { id: 'fixed', label: 'fixed policy', points: [
          { x: 0, y: 0.78 }, { x: damageStep, y: 0.28 }, { x: 30, y: 0.25 }, { x: 60, y: fixedFinalPerf }, { x: recoveryEnd, y: fixedFinalPerf },
        ] },
        { id: 'plastic', label: 'plastic rule', points: [
          { x: 0, y: 0.76 }, { x: damageStep, y: 0.32 }, { x: 30, y: 0.48 }, { x: 60, y: 0.65 }, { x: recoveryEnd, y: plasticFinalPerf },
        ] },
      ],
      markers: [
        { id: 'damage', x: damageStep, y: 0.32, label: 'damage' },
      ],
    }),
    highlight: { active: ['plastic'], compare: ['fixed'], found: ['damage'] },
    explanation: `After damage at step ${damageStep}, the plastic rule recovers to ${plasticFinalPerf} by step ${recoveryEnd} while the fixed policy stays at ${fixedFinalPerf}. The core idea is lifetime adaptation: performance can climb again without retraining the whole model.`,
  };

  yield {
    state: labelMatrix(
      'Why local plasticity helps',
      [
        { id: 'fast', label: 'fast' },
        { id: 'local', label: 'local' },
        { id: 'cheap', label: 'cheap' },
        { id: 'risky', label: 'risky' },
      ],
      [
        { id: 'property', label: 'property' },
        { id: 'caution', label: 'caution' },
      ],
      [
        ['few steps', 'can overreact'],
        ['no global backprop', 'limited credit'],
        ['online update', 'may drift'],
        ['adaptive', 'hard to verify'],
      ],
    ),
    highlight: { found: ['fast:property', 'local:property', 'cheap:property'], compare: ['risky:caution'] },
    explanation: `The benefit is adaptation without a full training run — recovering from ${fixedFinalPerf} to ${plasticFinalPerf} in ${recoveryEnd - damageStep} steps. The cost is weaker global credit assignment and harder safety analysis, because the deployed system keeps changing.`,
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'meta', label: 'outer search', x: 0.8, y: 3.8, note: 'evolve rule' },
        { id: 'rule', label: 'plastic rule', x: 3.2, y: 3.8, note: 'local law' },
        { id: 'agent', label: 'agent life', x: 5.6, y: 3.8, note: 'act+adapt' },
        { id: 'score', label: 'score', x: 8.0, y: 3.8, note: 'after trials' },
      ],
      edges: [
        { id: 'e-meta-rule', from: 'meta', to: 'rule', weight: '' },
        { id: 'e-rule-agent', from: 'rule', to: 'agent', weight: '' },
        { id: 'e-agent-score', from: 'agent', to: 'score', weight: '' },
        { id: 'e-score-meta', from: 'score', to: 'meta', weight: '' },
      ],
    }, { title: 'Meta-learning evaluates the whole lifetime' }),
    highlight: { active: ['meta', 'rule', 'agent'], found: ['score'] },
    explanation: `Outer-loop search evaluates how well the local rule lets the agent learn during its lifetime through ${metaStages.length} stages: ${metaStages.join(' → ')}. The score is not just initial performance; it is adaptability across episodes.`,
  };

  yield {
    state: labelMatrix(
      'Read this with nearby topics',
      [
        { id: 'nca', label: 'NCA' },
        { id: 'qd', label: 'QD' },
        { id: 'rl', label: 'RL' },
        { id: 'grad', label: 'grad' },
      ],
      [
        { id: 'link', label: 'link' },
        { id: 'question', label: 'question' },
      ],
      [
        ['local rules', 'what changes per step?'],
        ['many niches', 'which adaptations exist?'],
        ['feedback', 'what signal guides change?'],
        ['backprop', 'when is it too costly?'],
      ],
    ),
    highlight: { found: ['nca:question', 'qd:question', 'rl:question', 'grad:question'] },
    explanation: `Hebbian meta-learning sits between neural training, evolutionary search, reinforcement learning, and self-organizing systems. With ${metaStages.length} meta-learning stages and ${plasticFinalPerf - fixedFinalPerf > 0 ? 'clear' : 'unclear'} recovery advantage, the shared theme is adaptation under limited information.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'plastic synapse rule') yield* plasticSynapseRule();
  else if (view === 'lifetime adaptation') yield* lifetimeAdaptation();
  else throw new InputError('Pick a Hebbian plasticity view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "plastic synapse rule" view walks through the data a single synapse sees during a local Hebbian update. A matrix shows pre-synaptic activity (the sender\'s firing rate), post-synaptic activity (the receiver\'s firing rate), and a modulatory gate (a reward or novelty signal). Their product drives a weight change dw. A network graph then shows the same idea at system scale: sensor, hidden unit, action output, feedback signal, and a rule node that updates weights while the agent acts. The final frames show which terms can be meta-learned and how lifetime plasticity differs from ordinary training.',
        {type: 'image', src: './assets/gifs/hebbian-plasticity-meta-learning.gif', alt: 'Animated walkthrough of the hebbian plasticity meta learning visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The "lifetime adaptation" view plots task performance over time for two agents: one with a fixed (frozen) policy and one with a plastic update rule. After damage strikes at timestep 10, the fixed agent collapses and stays low, while the plastic agent recovers toward its pre-damage level. The important metric is not the first action after the shock but the trajectory of recovery. A meta-learning loop diagram then shows how the outer search evaluates entire lifetimes, not single actions.',
        'In both views, "active" highlights mark the inputs driving the current computation, "found" marks the result or output, and "compare" marks the control condition. Step through slowly the first time to see exactly which signals flow into each update.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A fixed policy is brittle. A robot loses a leg, a game opponent changes strategy, a sensor drifts, or a task distribution shifts. Waiting for a full offline retraining run may be too slow or outright impossible. The deployed agent needs a way to adapt during its own lifetime, using only signals available in real time.',
        {type: 'callout', text: 'Hebbian meta-learning moves adaptation into the lifetime loop: the outer loop learns which local weight changes remain useful after the world shifts.'},
        'Classical Hebbian learning is often summarized as "cells that fire together wire together." The modern meta-learning version asks a sharper question: can a local synapse-update rule be learned, evolved, or parameterized so that online adaptation is reliably useful rather than random drift? The answer turns out to be yes, and the mechanism is surprisingly simple.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Transient_Dendritic_Spine_Growth_following_High-Frequency_Stimulation.jpg/330px-Transient_Dendritic_Spine_Growth_following_High-Frequency_Stimulation.jpg', alt: 'Microscopy sequence showing dendritic spine growth after stimulation', caption: 'Biological plasticity motivates local activity-driven connection changes. Source: Wikimedia Commons, transient dendritic spine growth after high-frequency stimulation.'},
        'This matters as a design alternative to global gradient updates. Backpropagation is powerful when you have batches, labels or rewards, stable compute, and permission to modify the whole model. Many embodied or interactive systems lack that luxury. Plasticity moves part of adaptation into the running system itself, where change happens at the speed of experience rather than the speed of retraining.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first obvious approach is to train a policy offline and freeze it. That is simple to deploy and easy to evaluate, but it assumes the world at deployment matches the world during training. When the environment changes, the frozen policy keeps making the same wrong move because nothing inside it is allowed to change. A hexapod robot trained on six legs has no mechanism to compensate after losing one.',
        'The second obvious approach is full online backpropagation. Keep the training loop running during deployment, feeding new experience into the gradient pipeline. That is often too expensive, too centralized, and too dangerous. Online gradient updates require storing trajectories, computing losses, propagating credit across the entire network, and protecting against catastrophic forgetting. For real-time control at millisecond timescales, the full gradient machinery is the wrong tool.',
        'Hebbian plasticity takes a narrower path. Each synapse changes based on local signals: the pre-synaptic neuron\'s activity, the post-synaptic neuron\'s activity, a modulatory reward or novelty signal, and a set of learned coefficients. The whole system may have been trained globally once, but the lifetime update itself is local and cheap. The question becomes whether local changes can produce globally useful adaptation.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Local rules face a hard credit-assignment barrier. A Hebbian update at synapse s sees only the activities of two neurons and possibly a broadcast modulator. It cannot know whether strengthening this particular connection will help or harm a behavioral goal that depends on the coordinated output of thousands of other synapses. The correlation between pre and post activity may be accidental, driven by the environment rather than by useful computation.',
        'This is the same problem that motivated backpropagation in the first place. Gradient descent solves credit assignment by computing how each weight contributed to the final loss, then adjusting proportionally. A local rule throws that away. If the task requires routing information through a chain of five hidden layers, a purely local pre*post rule at layer two has no signal about what layer five needed. Adaptation can only work if useful behavior happens to correlate with local activity patterns.',
        'The wall gets worse with scale. In a 1000-neuron network with 10,000 plastic synapses, each synapse is adjusting independently. Without coordination, the collective drift can be destructive: one synapse strengthens a pathway while another weakens the same pathway from the other end. Modulation helps -- gating plasticity with a reward signal so changes only happen when something good occurred -- but the modulator is still a scalar broadcast, not a per-synapse credit signal.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that the update rule itself can be meta-learned. The outer loop does not merely optimize the starting weights. It optimizes how the agent changes during experience. A good fitness score is not just high initial performance; it is performance after damage, novelty, practice, or environmental change. The rule is evaluated on its lifetime consequences, not on any single step.',
        'That creates three nested timescales. The outer loop (evolution or gradient-based meta-learning, running over generations or meta-episodes) shapes the architecture, initial weights, plasticity coefficients, and modulatory pathways. The lifetime loop (running during a single episode or deployment) changes synapses while the agent acts. The fast activity loop (running at inference speed) maps current inputs through current weights into actions.',
        'The separation is the whole subject. A policy can be born with an update law that is useful for the family of problems it expects to face. The system is not hand-coded to recover from one exact damage pattern. It is trained to have a local adaptation mechanism that tends to improve behavior across a distribution of perturbations. The outer loop solves the credit-assignment problem that the local rule cannot: it tests many candidate rules across many lifetimes and keeps the ones whose local changes produce good global outcomes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A differentiable plasticity rule parameterizes the weight update as a weighted sum of local terms. The standard 4-term form is dw = eta * mod * (A * pre * post + B * pre + C * post + D), where pre and post are the activities of the two connected neurons, mod is a modulatory signal (reward, surprise, or error), and A, B, C, D are learned coefficients. The coefficient A controls correlation-based strengthening, B controls sender-driven bias, C controls receiver-driven bias, and D controls constant drift. The learning rate eta and the coefficients are fixed during the agent\'s lifetime -- they were set by the outer loop.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes and edges', caption: 'Plastic traces can be viewed as mutable state attached to neural connections. Source: Wikimedia Commons, Colored neural network.'},
        'In a deployed agent, this means the network acts and changes simultaneously. Sensor activity flows into hidden units, hidden units produce actions, a feedback signal modulates plasticity, and selected synapses update their weights. Each update costs one multiply-add per plastic synapse, often fused into the forward pass. The update does not store trajectories, compute losses, or propagate gradients. It uses only the local evidence available at that synapse at that moment.',
        'The outer loop evaluates full episodes or lifetimes. It spawns agents with candidate plasticity rules, tests them across mazes, body configurations, opponents, or task switches, then scores each rule by total lifetime performance. The rules that produce agents capable of adaptation survive; the rest are discarded. This is why the method belongs to meta-learning: the learned object is not just a policy but a way of revising the policy.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works when useful adaptation can be driven by local correlations plus a small amount of global context. If a sensor-action pathway consistently helps after a body change, strengthening it locally can improve behavior before an offline trainer would even start collecting data. If a reward-like modulator gates the change, the agent avoids strengthening every accidental correlation -- only changes that co-occur with positive feedback get consolidated.',
        'It also works because the outer loop can discover update rules that humans would not write by hand. Evolution or gradient-based meta-learning can tune the four coefficients, decide which synapses are plastic (plasticity masks), set initial weights, and wire modulatory circuits so the local rule has the right inductive biases before deployment. The meta-learner has seen thousands of lifetimes and shaped the rule to match the statistics of the task family.',
        'The deeper lesson is that learning does not have to live only in the training phase. Some systems benefit from having both a learned policy and a learned way to revise the policy. Hebbian meta-learning makes that second object -- the revision rule -- explicit and optimizable. The fixed-vs-plastic distinction maps onto the biological distinction between innate circuitry (shaped by evolution) and experience-dependent plasticity (shaped by lifetime activity).',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A local plasticity update costs O(number of plastic synapses) per timestep, often fused into the ordinary forward pass with negligible overhead. For a network with 10,000 plastic connections, each step adds 10,000 multiply-adds -- trivial compared to the forward pass itself. The runtime cost of plasticity is cheap. The expensive part is the outer loop.',
        'To evaluate whether a plasticity rule is good, the outer loop must simulate whole lifetimes across many tasks, perturbations, seeds, and damage patterns. If each lifetime is 1,000 steps and the outer loop tests 100 candidate rules across 50 task variations with 5 seeds each, that is 25 million forward passes per generation. Evolutionary methods may need hundreds of generations. The cost of meta-learning is measured in GPU-hours of simulation, not in the runtime cost of the rule itself.',
        'The fundamental tradeoff is credit assignment fidelity versus computational cost. Backpropagation assigns per-weight credit in O(d) time but requires storing the full computational graph and running a backward pass. A 4-term Hebbian rule assigns credit using only local signals in O(1) per synapse but cannot distinguish helpful correlations from accidental ones without the modulator. The outer loop compensates by shaping the rule over many lifetimes, trading offline meta-learning compute for cheap online adaptation.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Adaptive robotics is the most direct application. A hexapod robot with plastic synapses can recover locomotion after losing a leg without retraining: the local rule detects that the damaged leg\'s motor neurons no longer produce useful torque, and over tens of timesteps, neighboring pathways strengthen to compensate. Cully et al. (2015) demonstrated similar recovery using quality-diversity maps, and Hebbian plasticity offers a complementary online mechanism.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg', alt: 'State transition diagram for process states', caption: 'Lifetime adaptation is a stateful process: experience changes later behavior without rerunning the full outer training loop. Source: Wikimedia Commons, Process states.'},
        'Continual learning and reinforcement learning both benefit when an agent must improve within an episode rather than across episodes. A game-playing agent facing a new opponent strategy can adjust its response weights during the match. An embodied agent navigating a novel environment can strengthen sensor-action pathways that correlate with progress. In both cases, the plasticity rule provides a fast inner loop that complements the slower outer training loop.',
        'The method also connects to self-organizing systems. Neural Cellular Automata learn local update rules over grid cells. Hebbian plasticity learns local update rules over synapses. Quality Diversity searches for many useful behaviors rather than one winner. All three shift attention from a single static solution to an adaptive process, and understanding one illuminates the others.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A bad plasticity rule can amplify noise, drift away from useful behavior, forget the original skill, or learn unsafe shortcuts. Online change is not automatically intelligence -- it is additional degrees of freedom that can help or harm depending on the update law and the environment. A rule that works in simulation may destabilize on real hardware where sensor noise, actuator delays, and physical constraints differ from the training distribution.',
        'Simulation transfer is the most common failure mode. A plasticity rule evolved to recover from leg damage in a rigid-body simulator may fail on a real robot with compliant joints, sensor latency, and floor friction the simulator did not model. Serious deployment claims need held-out task families, damage sweeps, plasticity-disabled ablations, seed variation, and long-horizon stability tests. Short-horizon success in one simulator is not evidence of general adaptability.',
        'Biological plausibility is not an engineering argument. Hebbian language can make a method sound natural, but naturalness is not a validation metric. The deployed question is whether the plastic system adapts faster, more safely, or more robustly than a fixed policy or an explicit online optimizer such as online SGD with experience replay. In many practical settings, the explicit optimizer wins because it has stronger credit assignment, even though it costs more per step.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a single synapse with a 4-term Hebbian rule. The outer loop has meta-learned coefficients A = 0.6, B = -0.1, C = 0.05, D = -0.02, learning rate eta = 0.1, and the synapse starts at weight w = 0.5. The agent encounters three timesteps of experience with different local signals.',
        'Timestep 1: pre = 0.8, post = 0.6, mod = 1.0 (reward present). The update is dw = 0.1 * 1.0 * (0.6 * 0.8 * 0.6 + (-0.1) * 0.8 + 0.05 * 0.6 + (-0.02)) = 0.1 * (0.288 - 0.08 + 0.03 - 0.02) = 0.1 * 0.218 = 0.0218. New weight: w = 0.5 + 0.0218 = 0.5218. The positive A*pre*post term dominates because both neurons are active and reward is present, so the synapse strengthens.',
        'Timestep 2: pre = 0.9, post = 0.1, mod = 0.0 (no reward). The update is dw = 0.1 * 0.0 * (...) = 0.0. New weight: w = 0.5218. The modulator gates the entire update to zero. Even though pre is high, no reward means no plasticity. This prevents accidental strengthening from correlated noise.',
        'Timestep 3: pre = 0.3, post = 0.7, mod = 1.0 (reward present). The update is dw = 0.1 * 1.0 * (0.6 * 0.3 * 0.7 + (-0.1) * 0.3 + 0.05 * 0.7 + (-0.02)) = 0.1 * (0.126 - 0.03 + 0.035 - 0.02) = 0.1 * 0.111 = 0.0111. New weight: w = 0.5218 + 0.0111 = 0.5329. The update is smaller because pre*post is lower -- the neurons are less correlated -- so the synapse strengthens less. Over 90 steps of a post-damage episode, these small local updates accumulate: a plastic agent recovers from performance 0.28 to 0.72, while a fixed agent stays at 0.24.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Miconi et al., "Differentiable Plasticity" (2018) at https://arxiv.org/abs/1804.02464 introduced backpropagation through plastic traces. Miconi et al., "Backpropamine" (2018) at https://arxiv.org/abs/1806.02472 added neuromodulated plasticity gating. Najarro & Risi, "Meta-Learning through Hebbian Plasticity in Random Networks" (2020) at https://arxiv.org/abs/2007.02686 showed that even random-weight networks with evolved plasticity rules can solve RL tasks. Sebastian Risi\'s overview of self-organizing AI at https://sebastianrisi.com/self_assembling_ai/ connects plasticity to broader developmental computation.',
        'Study Neural Cellular Automata for learned local update rules over grid cells -- the same idea applied to spatial patterns instead of synapses. Study Quality Diversity (MAP-Elites) for outer-loop search that maintains many diverse solutions instead of collapsing to one winner. Study Evolutionary Search for the optimization methods that typically drive the outer loop. Study Policy Gradients for the reward-driven learning that plasticity complements. Study Gradient Flow for the global training dynamics that plasticity avoids at runtime.',
      ],
    },
  ],
};
