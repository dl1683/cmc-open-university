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
    explanation: 'A Hebbian-style rule updates a synapse from local signals: pre-synaptic activity, post-synaptic activity, and sometimes a modulatory signal. The rule can run during the agent lifetime.',
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
    explanation: 'The agent does not need a full gradient update after every event. A local plasticity rule can adjust synapses online using activity and feedback.',
    invariant: 'The update rule is local even when the behavior is global.',
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
    explanation: 'Differentiable plasticity and evolved Hebbian rules often parameterize the update as a weighted combination of local terms. Evolution or gradient descent can tune the rule coefficients.',
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
    explanation: 'Training shapes the starting network or plasticity rule. Lifetime plasticity changes weights during deployment so the agent can adapt to a new body, maze, or opponent.',
  };
}

function* lifetimeAdaptation() {
  yield {
    state: plotState({
      axes: { x: { label: 'timesteps after damage', min: 0, max: 100 }, y: { label: 'task performance', min: 0, max: 1 } },
      series: [
        { id: 'fixed', label: 'fixed policy', points: [
          { x: 0, y: 0.78 }, { x: 10, y: 0.28 }, { x: 30, y: 0.25 }, { x: 60, y: 0.24 }, { x: 100, y: 0.24 },
        ] },
        { id: 'plastic', label: 'plastic rule', points: [
          { x: 0, y: 0.76 }, { x: 10, y: 0.32 }, { x: 30, y: 0.48 }, { x: 60, y: 0.65 }, { x: 100, y: 0.72 },
        ] },
      ],
      markers: [
        { id: 'damage', x: 10, y: 0.32, label: 'damage' },
      ],
    }),
    highlight: { active: ['plastic'], compare: ['fixed'], found: ['damage'] },
    explanation: 'The self-organizing AI source highlights agents that recover after morphological damage. The core idea is lifetime adaptation: performance can climb again without retraining the whole model.',
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
    explanation: 'The benefit is adaptation without a full training run. The cost is weaker global credit assignment and harder safety analysis, because the deployed system keeps changing.',
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
    explanation: 'Outer-loop search evaluates how well the local rule lets the agent learn during its lifetime. The score is not just initial performance; it is adaptability across episodes.',
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
    explanation: 'Hebbian meta-learning sits between neural training, evolutionary search, reinforcement learning, and self-organizing systems. The shared theme is adaptation under limited information.',
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
      heading: 'Why this exists',
      paragraphs: [
        'Hebbian plasticity for meta-learning exists because a fixed policy can be brittle. A robot loses a leg, a game opponent changes strategy, a sensor drifts, or a task distribution shifts. Waiting for a full offline training run may be too slow or impossible. The deployed agent needs a way to adapt during its own lifetime.',
        {type: 'callout', text: 'Hebbian meta-learning moves adaptation into the lifetime loop: the outer loop learns which local weight changes remain useful after the world shifts.'},
        'Classical Hebbian learning is often summarized as cells that fire together wire together. The modern meta-learning version is more careful. It asks whether a local synapse-update rule can be learned, evolved, or parameterized so that online adaptation is useful rather than random drift.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Transient_Dendritic_Spine_Growth_following_High-Frequency_Stimulation.jpg/330px-Transient_Dendritic_Spine_Growth_following_High-Frequency_Stimulation.jpg', alt: 'Microscopy sequence showing dendritic spine growth after stimulation', caption: 'Biological plasticity motivates local activity-driven connection changes. Source: Wikimedia Commons, transient dendritic spine growth after high-frequency stimulation.'},
        'This is an important design alternative to global gradient updates. Backpropagation is powerful when you have batches, labels or rewards, stable compute, and permission to change the whole model. Many embodied or interactive systems do not have that luxury. Plasticity moves part of adaptation into the running system.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to train a policy offline and freeze it. That is simple to deploy and easy to evaluate, but it assumes the world at deployment matches the world in training. When the environment changes, the frozen policy can keep making the same wrong move because nothing inside it is allowed to change.',
        'The second obvious approach is to keep doing full backpropagation online. That is often too expensive, too centralized, and too dangerous. Online gradient updates can require storing trajectories, computing losses, propagating credit across the entire network, and protecting against catastrophic forgetting. For real-time control, that may be the wrong timescale.',
        'Hebbian plasticity takes a narrower path. A synapse changes from local signals such as pre-synaptic activity, post-synaptic activity, a modulatory reward or novelty signal, and learned coefficients. The whole system may have been trained globally, but the lifetime update itself is local.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that the update rule can be meta-learned. The outer loop does not merely optimize the starting weights. It optimizes how the agent changes during experience. A good score is not only high initial performance; it is performance after damage, novelty, practice, or environmental change.',
        'That creates three timescales. The outer loop, through evolution or gradient-based meta-learning, shapes the architecture, initial weights, plasticity coefficients, and modulatory pathways. The lifetime loop changes synapses while the agent acts. The fast activity loop maps current inputs through current weights into actions.',
        'The separation is the whole subject. A policy can be born with an update law that is useful for the kinds of problems it expects to face. The system is not hand-coded to recover from one exact damage pattern. It is trained to have a local adaptation mechanism that tends to improve behavior across a family of situations.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A simple differentiable plasticity rule might update a synapse using terms such as pre * post, pre alone, post alone, and a constant drift term. Learned coefficients decide how much each term matters. A modulatory signal can gate the update so correlation only changes weights when reward, surprise, error, or context says the change is meaningful.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes and edges', caption: 'Plastic traces can be viewed as mutable state attached to neural connections. Source: Wikimedia Commons, Colored neural network.'},
        'In an agent, this means a network can act and change at the same time. Sensor activity flows into hidden units, hidden units produce actions, a feedback signal modulates plasticity, and selected synapses update. The update does not need to know the entire future. It uses the local evidence available at that moment.',
        'The outer loop evaluates full episodes or lifetimes. It may test the agent across mazes, bodies, opponents, or task switches, then adjust the plasticity rule so the agent adapts better next time. This is why the method belongs to meta-learning: the learned object is partly a way of learning.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The plastic-synapse view shows the data available to a local update: sender activity, receiver activity, a modulator, and a weight delta. The point is not that every useful rule is exactly pre times post. The point is that the update can be computed at the synapse without running a full global optimizer after every event.',
        'The network graph shows the deployed-system idea. The agent is not just executing fixed weights. It is changing selected weights while it senses, acts, and receives feedback. That makes the policy a dynamical system whose behavior depends on lifetime experience.',
        'The lifetime-adaptation plot is the real test. After damage, the fixed policy collapses and stays bad. The plastic policy initially drops too, but then performance recovers. The visual is proving why plasticity matters: the important metric is not the first action after shock, but the trajectory of recovery.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works when useful adaptation can be driven by local correlations plus a small amount of global context. If a sensor-action pathway consistently helps after a body change, strengthening it locally can improve behavior before an offline trainer would even start. If a reward-like modulator gates the change, the agent can avoid strengthening every accidental correlation.',
        'It also works because the outer loop can discover update rules that humans would not write by hand. Evolution or gradient-based meta-learning can tune coefficients, plasticity masks, initial weights, and modulatory circuits so the local rule has the right biases before deployment.',
        'The deeper lesson is that learning does not have to live only in the training phase. Some systems should have a learned policy and a learned way to revise the policy. Hebbian meta-learning makes that second object explicit.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'A local plasticity update can be cheap at runtime: O(number of plastic synapses) per update step, often fused into the ordinary forward pass. The expensive part is the outer loop. To know whether a plasticity rule is good, you may need to simulate whole lifetimes across many tasks, perturbations, seeds, and damage patterns.',
        'The tradeoff is credit assignment. Backpropagation can assign credit through a whole computational graph. A local plasticity rule sees only local activity and optional modulatory signals. That makes it fast and biologically suggestive, but weaker when the right decision depends on delayed, global consequences.',
        'Another tradeoff is safety. A fixed policy can be audited at a fixed set of weights. A plastic policy keeps changing after deployment. That may be necessary for adaptation, but it complicates verification, reproducibility, rollback, and incident analysis.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Plasticity-based meta-learning is useful for adaptive robotics, artificial life, reinforcement learning, continual learning, embodied agents, damaged-body recovery, and environments where the same agent must improve within an episode. It is especially compelling when a small number of online interactions can reveal a changed local relationship.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg', alt: 'State transition diagram for process states', caption: 'Lifetime adaptation is a stateful process: experience changes later behavior without rerunning the full outer training loop. Source: Wikimedia Commons, Process states.'},
        'It also connects directly to self-organizing systems. Neural Cellular Automata learn local update rules over cells. Hebbian plasticity learns local update rules over synapses. Quality Diversity searches for many useful behaviors rather than one winner. All three shift attention from a single static solution to an adaptive process.',
        'In research, it is valuable even when it is not the final production method. It forces a clean question: which parts of adaptation require global optimization, and which can be pushed into local rules that run continuously?',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'A bad plasticity rule can amplify noise, drift away from useful behavior, forget the original skill, or learn unsafe shortcuts. Online change is not automatically intelligence. It is additional degrees of freedom that can help or harm depending on the update law and the environment.',
        'Simulation success can be misleading. A rule that recovers from one damage pattern in one simulator may fail on different damage, real hardware, longer horizons, delayed rewards, or distribution shift. Serious claims need held-out task families, damage sweeps, plasticity-disabled ablations, seed variation, and long-horizon stability tests.',
        'Another failure is confusing biological inspiration with engineering proof. Hebbian language can make a method sound natural, but naturalness is not a validation metric. The deployed question is whether the plastic system adapts faster, more safely, or more robustly than a fixed policy or an explicit online optimizer.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Differentiable Plasticity at https://arxiv.org/abs/1804.02464, Evolving Neural Networks with Differentiable Plasticity at https://arxiv.org/abs/1806.02472, Meta-Learning through Hebbian Plasticity in Random Networks at https://arxiv.org/abs/2007.02686, and Sebastian Risi on self-organizing AI at https://sebastianrisi.com/self_assembling_ai/.',
        'Study Neural Cellular Automata for learned local rules over grids, Quality Diversity: MAP-Elites for searching many adaptive niches, Evolutionary Search for outer-loop optimization, Policy Gradients for reward-driven learning, Gradient Flow for global training dynamics, and Multi-Armed Bandits for the explore-exploit problem that appears inside adaptation.',
      ],
    },
  ],
};
