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
      heading: 'What it is',
      paragraphs: [
        'Hebbian plasticity is the family of local learning rules inspired by the phrase "cells that fire together wire together." A synapse changes based on local activity: what the sending neuron did, what the receiving neuron did, and sometimes a modulatory signal. In meta-learning and evolutionary settings, the rule itself can be learned or evolved so an agent adapts during its own lifetime.',
        'This matters for self-organizing AI because fixed policies are brittle. If a robot loses a limb, a maze changes, or an opponent behaves differently, a purely fixed network may fail. A plastic network can keep updating locally while acting, potentially recovering behavior without a full retraining job.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A simple Hebbian update might increase a weight when pre-synaptic and post-synaptic activities are both high. More general learned plasticity rules combine terms such as pre x post, pre-only, post-only, and constants, often gated by neuromodulatory signals. The outer loop searches for coefficients or network parameters that make lifetime learning useful across tasks.',
        'The distinction between training and lifetime adaptation is crucial. Training or evolution sets the initial weights and plasticity rule. During deployment, the rule changes weights from local signals. That lets the system adapt quickly, but it also makes verification harder because the model state is not fixed.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The local update can be cheap: O(number of plastic synapses) per step. The expensive part is the outer loop, which must evaluate performance over whole lifetimes, often across many tasks or perturbations. Credit assignment is also weaker than full backpropagation. Local rules see local activity, not the entire future consequence of a weight change, so the outer loop must shape rules that are robust rather than perfectly informed.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Plasticity-based meta-learning appears in reinforcement learning, adaptive robotics, artificial life, continual learning, and research on agents that recover from morphology changes. It connects to Neural Cellular Automata because both rely on local rules repeated over time. It connects to Quality Diversity because a repertoire of plastic behaviors can be more robust than one optimized behavior. It connects to Gradient Flow because local plasticity can avoid backpropagating through extremely long developmental traces.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Local plasticity does not automatically solve adaptation. A bad rule can drift, amplify noise, or forget useful behavior. A rule that adapts in simulation may fail on real hardware. Safety analysis is harder because the deployed agent keeps changing. Serious evaluations should include held-out tasks, perturbations, ablations with plasticity disabled, and stability checks over long horizons.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Differentiable Plasticity at https://arxiv.org/abs/1804.02464, Evolving Neural Networks with Differentiable Plasticity at https://arxiv.org/abs/1806.02472, and Meta-Learning through Hebbian Plasticity in Random Networks at https://arxiv.org/abs/2007.02686. For the self-organizing AI framing, see Sebastian Risi at https://sebastianrisi.com/self_assembling_ai/. Study Neural Cellular Automata, Quality Diversity: MAP-Elites, Self-Organizing AI Design Pattern, Evolutionary Search, Policy Gradients, Gradient Flow, and Multi-Armed Bandits next.',
      ],
    },
  ],
};
