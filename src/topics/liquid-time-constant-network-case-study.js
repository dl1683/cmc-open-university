// Liquid time-constant networks and Liquid Foundation Model design:
// adaptive dynamics, compact state, and edge-first architecture search.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'liquid-time-constant-network-case-study',
  title: 'Liquid Time-Constant Network Case Study',
  category: 'Papers',
  summary: 'Liquid networks make recurrent dynamics adaptive: gates change time constants, state evolves continuously, and newer LFM designs push the lesson toward edge-efficient backbones.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['liquid neuron', 'LFM hybrid', 'edge ledger'], defaultValue: 'liquid neuron' },
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

function liquidGraph(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'x(t)', x: 0.7, y: 3.7, note: 'signal' },
      { id: 'gate', label: 'gate net', x: 2.4, y: 2.5, note: 'modulates' },
      { id: 'tau', label: 'tau(x,h)', x: 4.2, y: 2.5, note: 'time scale' },
      { id: 'state', label: 'h(t)', x: 4.2, y: 4.9, note: 'state' },
      { id: 'ode', label: 'ODE step', x: 6.1, y: 3.7, note: 'integrate' },
      { id: 'next', label: 'h(t+dt)', x: 7.9, y: 3.7, note: 'new state' },
      { id: 'out', label: 'y(t)', x: 9.3, y: 3.7, note: 'output' },
    ],
    edges: [
      { id: 'e-input-gate', from: 'input', to: 'gate' },
      { id: 'e-gate-tau', from: 'gate', to: 'tau' },
      { id: 'e-tau-ode', from: 'tau', to: 'ode' },
      { id: 'e-state-ode', from: 'state', to: 'ode' },
      { id: 'e-input-ode', from: 'input', to: 'ode' },
      { id: 'e-ode-next', from: 'ode', to: 'next' },
      { id: 'e-next-out', from: 'next', to: 'out' },
      { id: 'e-next-state', from: 'next', to: 'state', weight: 'carry' },
    ],
  }, { title });
}

function lfmGraph(title) {
  return graphState({
    nodes: [
      { id: 'tokens', label: 'tokens', x: 0.7, y: 3.7, note: 'text' },
      { id: 'conv1', label: 'gated conv', x: 2.3, y: 2.6, note: 'local' },
      { id: 'conv2', label: 'gated conv', x: 4.0, y: 2.6, note: 'fast' },
      { id: 'gqa', label: 'GQA block', x: 5.7, y: 4.8, note: 'global' },
      { id: 'moe', label: 'small/edge', x: 7.4, y: 2.6, note: 'searched' },
      { id: 'out', label: 'logits', x: 9.2, y: 3.7, note: 'serve' },
    ],
    edges: [
      { id: 'e-tokens-conv1', from: 'tokens', to: 'conv1' },
      { id: 'e-conv1-conv2', from: 'conv1', to: 'conv2' },
      { id: 'e-conv2-gqa', from: 'conv2', to: 'gqa' },
      { id: 'e-gqa-moe', from: 'gqa', to: 'moe' },
      { id: 'e-moe-out', from: 'moe', to: 'out' },
    ],
  }, { title });
}

function* liquidNeuron() {
  yield {
    state: liquidGraph('A liquid neuron changes its own time scale'),
    highlight: { active: ['gate', 'tau', 'state', 'ode', 'e-gate-tau', 'e-tau-ode'], found: ['next'] },
    explanation: 'Liquid time-constant networks model state as continuous dynamics. A gate network changes the effective time constant tau, so the state can react quickly or slowly depending on input and hidden state.',
    invariant: 'The memory policy is dynamic: the model learns not only what to store, but how quickly state should move.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'time after input change', min: 0, max: 10 }, y: { label: 'state response', min: 0, max: 1.05 } },
      series: [
        { id: 'fast', label: 'small tau', points: [
          { x: 0, y: 0.00 }, { x: 1, y: 0.55 }, { x: 2, y: 0.80 }, { x: 4, y: 0.96 }, { x: 8, y: 1.00 }, { x: 10, y: 1.00 },
        ] },
        { id: 'slow', label: 'large tau', points: [
          { x: 0, y: 0.00 }, { x: 1, y: 0.14 }, { x: 2, y: 0.25 }, { x: 4, y: 0.45 }, { x: 8, y: 0.70 }, { x: 10, y: 0.78 },
        ] },
      ],
      markers: [
        { id: 'adapt', x: 4, y: 0.96, label: 'adaptive speed' },
      ],
    }),
    highlight: { active: ['fast', 'slow', 'adapt'] },
    explanation: 'This is the core intuition. A small time constant lets state snap to new evidence. A large time constant preserves memory. Liquid networks let that time scale depend on the current situation.',
  };

  yield {
    state: labelMatrix(
      'Continuous-time recurrent recipe',
      [
        { id: 'state', label: 'state h' },
        { id: 'input', label: 'input x' },
        { id: 'tau', label: 'tau' },
        { id: 'solver', label: 'solver' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['memory', 'drift'],
        ['forcing', 'noise'],
        ['time scale', 'stability'],
        ['integrate', 'cost'],
      ],
    ),
    highlight: { active: ['tau:role', 'solver:role'], compare: ['solver:risk'] },
    explanation: 'The original LTC framing is a neural differential equation system. That gives expressive temporal dynamics, but it also makes numerical stability and solver cost part of the model design.',
  };

  yield {
    state: labelMatrix(
      'Where the idea fits',
      [
        { id: 'rnn', label: 'RNN' },
        { id: 'ltc', label: 'LTC' },
        { id: 'ssm', label: 'SSM' },
        { id: 'lfm', label: 'LFM' },
      ],
      [
        { id: 'memory', label: 'memory' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['hidden vector', 'state over time'],
        ['adaptive tau', 'dynamic speed'],
        ['linear state', 'scan and kernels'],
        ['hybrid blocks', 'edge constraints'],
      ],
    ),
    highlight: { found: ['ltc:memory', 'lfm:lesson'], compare: ['rnn:memory', 'ssm:lesson'] },
    explanation: 'Liquid networks are not just a single architecture. They are a design lineage around adaptive dynamics, compact state, and hardware-aware sequence modeling.',
  };
}

function* lfmHybrid() {
  yield {
    state: lfmGraph('LFM-style design turns the lesson into an edge backbone'),
    highlight: { active: ['conv1', 'conv2', 'gqa', 'e-tokens-conv1', 'e-conv1-conv2', 'e-conv2-gqa'], found: ['out'] },
    explanation: 'Newer Liquid Foundation Model materials describe compact hybrid backbones. The important systems lesson is not that every block is an LTC ODE; it is that architecture is searched under latency and memory constraints.',
  };

  yield {
    state: labelMatrix(
      'Hybrid component roles',
      [
        { id: 'conv', label: 'gated conv' },
        { id: 'gqa', label: 'GQA' },
        { id: 'search', label: 'HW search' },
        { id: 'distill', label: 'distill' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'why', label: 'why' },
      ],
      [
        ['local mixing', 'cheap CPU path'],
        ['global recall', 'selective exactness'],
        ['choose blocks', 'edge latency'],
        ['small quality', 'deployable'],
      ],
    ),
    highlight: { active: ['conv:job', 'gqa:job', 'search:why'], found: ['distill:why'] },
    explanation: 'The LFM2-style recipe is a hardware-constrained memory design: use cheap local operators where possible, keep a small amount of attention where global interaction is worth the cost, and train the small model hard.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'edge latency budget', min: 0, max: 100 }, y: { label: 'quality retained', min: 0.5, max: 1.0 } },
      series: [
        { id: 'small', label: 'small dense baseline', points: [
          { x: 20, y: 0.60 }, { x: 40, y: 0.68 }, { x: 60, y: 0.73 }, { x: 80, y: 0.76 },
        ] },
        { id: 'hybrid', label: 'searched hybrid', points: [
          { x: 20, y: 0.66 }, { x: 40, y: 0.76 }, { x: 60, y: 0.84 }, { x: 80, y: 0.88 },
        ] },
      ],
      markers: [
        { id: 'budget', x: 40, y: 0.76, label: 'device budget' },
      ],
    }),
    highlight: { active: ['hybrid', 'budget'], compare: ['small'] },
    explanation: 'This stylized frontier is the right way to read edge-first model design: the winning architecture is not the biggest model, but the best quality under a strict latency and memory envelope.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'phone', label: 'phone CPU', x: 0.8, y: 3.8, note: 'slow matmul' },
        { id: 'ops', label: 'op mix', x: 2.8, y: 3.8, note: 'conv + GQA' },
        { id: 'memory', label: 'memory', x: 4.7, y: 2.6, note: 'fits' },
        { id: 'prefill', label: 'prefill', x: 4.7, y: 5.0, note: 'fast enough' },
        { id: 'decode', label: 'decode', x: 6.8, y: 3.8, note: 'streaming' },
        { id: 'product', label: 'product', x: 9.0, y: 3.8, note: 'offline use' },
      ],
      edges: [
        { id: 'e-phone-ops', from: 'phone', to: 'ops' },
        { id: 'e-ops-memory', from: 'ops', to: 'memory' },
        { id: 'e-ops-prefill', from: 'ops', to: 'prefill' },
        { id: 'e-memory-decode', from: 'memory', to: 'decode' },
        { id: 'e-prefill-decode', from: 'prefill', to: 'decode' },
        { id: 'e-decode-product', from: 'decode', to: 'product' },
      ],
    }, { title: 'On-device inference is a different bottleneck' }),
    highlight: { active: ['phone', 'ops', 'memory', 'prefill'], found: ['decode', 'product'] },
    explanation: 'On a server GPU, decode often fights memory bandwidth. On a phone CPU, raw compute and memory are both tight. Edge architectures therefore need fewer expensive operations, not only smaller weights.',
  };
}

function* edgeLedger() {
  yield {
    state: labelMatrix(
      'Edge deployment ledger',
      [
        { id: 'latency', label: 'latency' },
        { id: 'memory', label: 'memory' },
        { id: 'battery', label: 'battery' },
        { id: 'privacy', label: 'privacy' },
      ],
      [
        { id: 'metric', label: 'metric' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['TTFT + tok/s', 'feels slow'],
        ['RAM peak', 'swap or kill'],
        ['joules/query', 'thermal throttle'],
        ['local data', 'cloud leak'],
      ],
    ),
    highlight: { active: ['latency:metric', 'memory:metric', 'battery:metric'], found: ['privacy:metric'] },
    explanation: 'A good edge-model case study is an operations ledger. Measure time-to-first-token, tokens per second, peak memory, energy, thermal behavior, and privacy boundaries.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'model size', min: 0, max: 9 }, y: { label: 'mobile practicality', min: 0, max: 1.0 } },
      series: [
        { id: 'dense', label: 'dense attention', points: [
          { x: 0.5, y: 0.72 }, { x: 1.5, y: 0.62 }, { x: 3, y: 0.42 }, { x: 7, y: 0.15 },
        ] },
        { id: 'edge', label: 'edge hybrid', points: [
          { x: 0.5, y: 0.78 }, { x: 1.5, y: 0.74 }, { x: 3, y: 0.65 }, { x: 7, y: 0.38 },
        ] },
      ],
      markers: [
        { id: 'sweet', x: 1.5, y: 0.74, label: 'small model zone' },
      ],
    }),
    highlight: { active: ['edge', 'sweet'], compare: ['dense'] },
    explanation: 'This stylized chart captures the LFM motivation from the local corpus: on-device models need architecture-level efficiency, not only quantized versions of large server models.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'measure', label: 'measure', x: 0.8, y: 3.7, note: 'device' },
        { id: 'search', label: 'search', x: 2.6, y: 3.7, note: 'blocks' },
        { id: 'train', label: 'train', x: 4.4, y: 3.7, note: 'distill' },
        { id: 'quant', label: 'quantize', x: 6.2, y: 2.6, note: 'fit' },
        { id: 'eval', label: 'eval', x: 6.2, y: 4.9, note: 'quality' },
        { id: 'ship', label: 'ship', x: 8.4, y: 3.7, note: 'only if both' },
      ],
      edges: [
        { id: 'e-measure-search', from: 'measure', to: 'search' },
        { id: 'e-search-train', from: 'search', to: 'train' },
        { id: 'e-train-quant', from: 'train', to: 'quant' },
        { id: 'e-train-eval', from: 'train', to: 'eval' },
        { id: 'e-quant-ship', from: 'quant', to: 'ship' },
        { id: 'e-eval-ship', from: 'eval', to: 'ship' },
      ],
    }, { title: 'Hardware-in-the-loop architecture search as a data structure' }),
    highlight: { active: ['measure', 'search', 'train'], found: ['quant', 'eval', 'ship'] },
    explanation: 'The architecture search loop itself is a data structure: a frontier of candidate blocks, device measurements, quality scores, and deployment constraints. The winning model is chosen from that Pareto set.',
  };

  yield {
    state: labelMatrix(
      'Read the claims precisely',
      [
        { id: 'ltc', label: 'LTC' },
        { id: 'cfcs', label: 'CfC' },
        { id: 'lfm', label: 'LFM2' },
        { id: 'product', label: 'product' },
      ],
      [
        { id: 'claim', label: 'claim' },
        { id: 'caution', label: 'caution' },
      ],
      [
        ['adaptive ODE', 'solver cost'],
        ['closed form', 'task scope'],
        ['hybrid backbone', 'not pure LTC'],
        ['edge useful', 'measure live'],
      ],
    ),
    highlight: { active: ['ltc:claim', 'lfm:caution', 'product:caution'] },
    explanation: 'The precise lesson matters. Liquid Foundation Models inherit an efficiency philosophy, but newer LFM backbones should be evaluated by their actual blocks and device measurements, not by slogans.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'liquid neuron') yield* liquidNeuron();
  else if (view === 'LFM hybrid') yield* lfmHybrid();
  else if (view === 'edge ledger') yield* edgeLedger();
  else throw new InputError('Pick a liquid-network view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The liquid-neuron view shows the dataflow inside one adaptive neuron. Active nodes (gate, tau, ODE step) are the components that make the time constant input-dependent. The found node (h(t+dt)) is the new state produced after integration. The carry edge from h(t+dt) back to h(t) is the recurrence.',
        'The response plot compares two regimes: a small tau curve that snaps to new evidence in one or two steps, and a large tau curve that preserves memory across ten steps. The marker at step 4 labels the adaptive speed -- in a liquid neuron, that speed is not fixed but chosen by the gate network at each moment.',
        'The LFM hybrid view shifts from one neuron to a deployed backbone. Each node is a competing way to spend compute: gated convolutions buy cheap local mixing, grouped-query attention buys selective global recall. The edge-ledger view turns deployment into a data structure -- a table of metrics, failure modes, and hardware constraints that must all pass before a model ships.',
        {
          type: 'note',
          text: 'If a node is active in the animation, that component is executing. If it is found, it has just been produced. If two nodes are in compare state, the animation is asking you to contrast their cost or behavior.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Sequence models must decide what to remember and how quickly to forget it. A vanilla RNN applies the same transition at every step regardless of whether the input just changed sharply or has been flat for a hundred steps. An LSTM improves this with learned gates, but those gates still operate on a discrete step index -- the model knows token order, not continuous time. A transformer avoids the recurrence problem entirely by comparing every token with every other token, but that costs O(n^2) memory in attention and makes edge deployment expensive.',
        'These designs share a hidden assumption: the right memory speed is fixed at architecture time. For regularly sampled text, that assumption is tolerable. For irregular sensor data, robot control loops, medical signals, or tiny on-device language workloads, it is not. The memory horizon that matters changes from moment to moment. A distance sensor on a robot needs fast reaction when an obstacle appears and slow integration when the path is clear. A phone-based language model needs cheap local processing for common patterns and expensive global attention only where it earns its latency cost.',
        {
          type: 'quote',
          attribution: 'Hasani et al., AAAI 2021',
          text: 'The resulting models are causal, compact, and interpretable. LTCs can capture the dynamics of a nonlinear dynamical system with considerably fewer neurons compared to other continuous-time models.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable attempt is to make the recurrence bigger. Add more hidden units, stack more layers, use LSTM or GRU gates. If the model needs long memory, train the gates to hold state stable. If it needs quick reaction, train them to push state hard. This works surprisingly well for fixed-interval sequences -- LSTMs dominated NLP and speech for years.',
        'The second attempt is to replace recurrence with attention. A transformer can look at any past position, so it does not need to compress history into a fixed-size state. That solves the memory-length problem but introduces a new one: attention cost grows quadratically with sequence length, and the KV cache grows linearly. On a server GPU with 80 GB of HBM, this is manageable. On a phone with 6 GB of shared RAM, a 3B-parameter transformer with a 32k context window would need over 48 GB just for the KV cache.',
        {
          type: 'table',
          headers: ['Approach', 'Memory policy', 'Limitation'],
          rows: [
            ['Vanilla RNN', 'Fixed transition, same speed always', 'Vanishing gradients, no temporal adaptation'],
            ['LSTM / GRU', 'Learned gates, discrete steps', 'Knows token order, not continuous time'],
            ['Transformer', 'Full attention over all positions', 'O(n^2) cost, KV cache grows with context'],
            ['Make it bigger', 'More parameters, same operators', 'Does not solve temporal adaptation, just hides it'],
          ],
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is temporal rigidity. An LSTM gate learns a single transition speed during training and applies it uniformly at inference. Consider a robot distance sensor sampling at 100 Hz. For 99 of those samples, the reading barely changes -- the robot is cruising through open space. On sample 100, a person steps into the path and the reading drops by 2 meters in 10 ms. A slow gate smooths the jump and the robot reacts 200 ms late. A fast gate catches the obstacle but also chases every vibration and sensor noise spike during the 99 calm samples, corrupting the stable context the planner needs.',
        'No single fixed speed handles both regimes. The model needs the equivalent of a variable-speed clutch: fast when the signal demands it, slow when stability matters. Bigger models do not solve this -- they just hide the problem behind more parameters. Full attention solves it at inference time by looking at all past positions, but the cost is prohibitive on edge hardware.',
        {
          type: 'note',
          text: 'The invariant that must hold: the effective memory time scale should match the input regime. When this invariant breaks, the model either reacts too slowly to sharp events or forgets too quickly during stable periods. No fixed-speed recurrence can satisfy both simultaneously.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Make the time constant itself a learned function of input and hidden state. In a physical first-order system like an RC circuit, the time constant tau controls how quickly voltage approaches a new value. A small tau produces fast response. A large tau produces inertia. Liquid time-constant networks borrow this idea for neural state: instead of fixing tau at architecture time, they compute it dynamically at every step.',
        'The hidden state follows a continuous-time ordinary differential equation whose coefficients depend on the current input x(t) and the current state h(t). The gate network produces conductance-like terms that modulate tau. When the gate sees a sharp input change, it shrinks tau and the state snaps to new evidence. When the gate sees noise or stability, it enlarges tau and the state holds. The same neuron acts as a fast event detector or a slow integrator depending on the current situation.',
        {
          type: 'diagram',
          alt: 'The LTC state update as a variable-speed clutch',
          body: [
            'Input x(t) ----> Gate network f(x, h, theta)',
            '                     |',
            '                     v',
            '              tau_sys = tau / (1 + tau * f(...))',
            '                     |',
            '                     v',
            '  h(t) --------> ODE step: dh/dt = -[1/tau + f] * h + f * A',
            '                     |',
            '                     v',
            '                  h(t+dt) -----> output y(t)',
            '                     |',
            '                     +---------> carry back to h(t)',
          ].join('\n'),
        },
        'The word "liquid" captures the idea precisely: the dynamics are not frozen after training. They flow around the current signal. A fixed RNN is ice -- one shape. An LTC is water -- it takes the shape of what it encounters.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The LTC neuron is grounded in biophysics. The ODE models a non-spiking neuron membrane potential with conductance-based synapses, following the Hodgkin-Huxley framework simplified for continuous synaptic dynamics. The core equation from Hasani et al. (AAAI 2021):',
        {
          type: 'code',
          language: 'text',
          body: 'dh/dt = -[1/tau + f(h, x, theta)] * h(t) + f(h, x, theta) * A\n\nwhere:\n  h(t)   = hidden state (membrane potential)\n  x(t)   = input signal\n  tau    = learnable base time constant\n  f(...) = neural network computing conductance\n  A      = reversal potential (learned bias)',
        },
        'The system time constant is not tau alone -- it is modulated by the input-dependent conductance f:',
        {
          type: 'code',
          language: 'text',
          body: 'tau_sys = tau / (1 + tau * f(h, x, theta))\n\nBounded: tau / (1 + tau * W) <= tau_sys <= tau\n\nwhere W = max magnitude of f',
        },
        'This bound is a stability guarantee. No matter how large the input, the system time constant stays between a known minimum and the base tau. The state itself is also bounded: it stays between min(0, A_min) and max(0, A_max). These are provable properties -- Theorems 1 and 2 in the original paper -- and they distinguish LTCs from generic neural ODEs, which can diverge.',
        'The biological inspiration comes from Caenorhabditis elegans, a nematode with exactly 302 neurons whose complete connectome has been mapped since 1986. Despite only 302 neurons, the worm generates locomotion, chemotaxis, mating behavior, and learned responses. The Neural Circuit Policy (NCP) wiring architecture directly mimics the four-layer hierarchy found in C. elegans: sensory neurons, interneurons, command neurons (highly recurrent), and motor neurons. Connections are sparse -- roughly 90% of possible synapses are absent, matching the biological model.',
        {
          type: 'table',
          headers: ['Component', 'Role', 'Risk'],
          rows: [
            ['State h(t)', 'Membrane potential / memory', 'Drift if tau is too large'],
            ['Input x(t)', 'External forcing signal', 'Noise amplification if tau is too small'],
            ['Gate f(...)', 'Conductance modulation', 'Training instability if unconstrained'],
            ['Time constant tau', 'Speed dial for state evolution', 'Frozen or explosive dynamics at extremes'],
            ['Reversal potential A', 'Target attractor for state', 'Bias if poorly initialized'],
            ['ODE solver', 'Numerical integration', 'Computational cost scales with stiffness'],
          ],
        },
      ],
    },
    {
      heading: 'The closed-form shortcut',
      paragraphs: [
        'The LTC ODE has no known exact closed-form solution, so the original design requires a numerical solver. That solver iterates through many micro-steps per state update, making training O(nkp) where p is the solver order -- compared to O(nk) for a standard RNN. Hasani et al. (Nature Machine Intelligence 2022) found a tightly-bounded closed-form approximation that eliminates the solver entirely.',
        {
          type: 'code',
          language: 'text',
          body: 'Closed-form Continuous-time (CfC) approximation:\n\nh(t) = sigma(-f(h, x; theta_f) * t) . g(h, x; theta_g)\n     + [1 - sigma(-f(h, x; theta_f) * t)] . h_tilde(h, x; theta_h)\n\nwhere:\n  sigma = sigmoid (plays a gating role)\n  .     = element-wise multiplication\n  f     = time-constant network\n  g     = fast-response branch\n  h_tilde = slow-memory branch',
        },
        'The approximation error decays exponentially: |h(t) - h_approx(t)| <= |h(0) - A| * exp(-w_tau * t). After a few time steps, the closed form and the true ODE solution are indistinguishable.',
        {
          type: 'table',
          headers: ['Benchmark', 'CfC time/epoch', 'ODE-RNN time/epoch', 'Speedup'],
          rows: [
            ['PhysioNet (mortality)', '0.1 min', '16.5 min', '160x'],
            ['Walker2D (dynamics)', '0.08 min', '0.79 min', '~10x'],
            ['Bit-Stream XOR', '0.75 min', '4.11 min', '~5.5x'],
          ],
        },
        'CfC brings training complexity back to O(nk) -- the same as a standard RNN -- while preserving adaptive time constants. The tradeoff: the approximation introduces a small bounded error, and some tasks where the exact ODE dynamics matter may see slightly different behavior.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A research group at MIT tested a Neural Circuit Policy with 19 control neurons connected by 253 synapses -- roughly 4,000 trainable parameters in the CfC variant. The task: autonomous lane-keeping from a front-facing camera. The NCP mapped raw pixels to steering angle.',
        {
          type: 'table',
          headers: ['Model', 'Neurons', 'Parameters', 'Sparsity vs. NCP'],
          rows: [
            ['NCP (CfC)', '19', '~4,000', '1x (baseline)'],
            ['LSTM', '64', '~260,000', '970x denser'],
            ['CT-RNN', '64', '~65,000', '241x denser'],
            ['End-to-end ConvNet', '~millions', '~250,000', '63x larger'],
          ],
        },
        'The 19-neuron NCP matched or exceeded the larger models on lane-keeping accuracy. More striking, it was interpretable: its attention pattern focused on the road horizon and lane borders -- the same features a human driver uses. The LSTM and ConvNet required 2-3 principal components just to represent basic driving (straight, left turn, right turn); the NCP captured all of these in its first principal component alone.',
        'The reason 19 neurons suffice is the adaptive time constant. During straight driving, the NCP keeps large tau values and integrates smoothly. When the car approaches a curve, the gate network detects the changing visual flow, shrinks tau, and the steering state snaps to track the new heading. A fixed-speed 19-neuron RNN could not do this -- it would need to be much larger to encode both regimes in static weights.',
        {
          type: 'note',
          text: 'Vanilla LTCs can fail catastrophically on certain irregular-time tasks. On the Bit-Stream XOR benchmark, LTCs scored 49.11% (essentially random) while CfC achieved 99.42%. The ODE solver struggled with the task structure. Always evaluate on your actual workload, not on the elegance of the formulation.',
        },
      ],
    },
    {
      heading: 'From neuron to foundation model',
      paragraphs: [
        'The Liquid Foundation Model (LFM) lineage extends the adaptive-dynamics philosophy from single neurons to billion-parameter language models, but the architecture changes substantially. LFM backbones do not literally solve LTC ODEs in every layer. They use structured operators -- gated convolutions, grouped-query attention, and linear input-varying (LIV) systems -- that preserve the core idea (input-dependent time constants) while being hardware-friendly.',
        {
          type: 'diagram',
          alt: 'LFM2 hybrid backbone block structure',
          body: [
            'LFM2-1.2B architecture (16 blocks total):',
            '',
            '  tokens --> [gated conv] x 10 --> [GQA attn] x 6 --> logits',
            '              |                     |',
            '              |-- local mixing       |-- global recall',
            '              |-- cheap, O(n)        |-- selective, O(n^2)',
            '              |-- kernel size k=3    |-- grouped queries',
            '',
            '  Each block: RMSNorm -> operator -> SwiGLU FFN',
            '',
            '  Gated conv implements a parametric form of LTC:',
            '  (B, C, h) = Linear(input)',
            '  y = B . h              -- multiplicative gate',
            '  z = Conv_k(y)          -- depthwise 1D convolution',
            '  out = Linear(C . z)    -- second gate + projection',
          ].join('\n'),
        },
        'The mathematical connection is real, not just marketing. Through Taylor expansion, the gated short convolution in LFM2 can be viewed as a parametric form of LTC systems. The exponential memory decay in the convolution blocks implements a dynamic forgetting mechanism analogous to LTC input-dependent time constants. The convolution blocks create linear first-order systems that converge to zero after a finite time -- exactly the bounded-state property that LTC Theorem 2 guarantees.',
        'The key difference from the original LTC: instead of a numerical ODE solver, the decay is built into the operator structure. Instead of adaptive tau per neuron, the architecture search engine (STAR) decides which blocks get cheap local convolutions and which get expensive global attention. The adaptation moves from neuron-level dynamics to architecture-level block selection.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'At the neuron level, the design works because time-scale adaptation is a compact encoding of multiple behaviors. Fast event detection, slow context integration, noise filtering, and sharp-transition tracking are all expressed by modulating one control variable (tau). A fixed-step RNN must encode all of these behaviors indirectly through static weights and gates, requiring far more parameters to cover the same behavioral range.',
        'The stability theorems provide the correctness guarantee. The system time constant is bounded between tau/(1 + tau*W) and tau -- it cannot explode or collapse to zero regardless of input magnitude. The state is bounded between min(0, A_min) and max(0, A_max). These bounds mean the ODE is well-posed: it always has a solution, that solution is unique, and it stays in a known range. Generic neural ODEs lack these guarantees.',
        'At the foundation model level, the design works because not every token interaction deserves the same operator cost. Common local patterns (adjacent-word dependencies, phrase structure) are handled cheaply by gated convolutions. Rare but critical long-range dependencies (coreference, logical chains) get expensive attention blocks. The STAR architecture search optimizes this allocation against real hardware measurements, not proxy metrics.',
        {
          type: 'quote',
          attribution: 'LFM2 design principle',
          text: 'The winning architecture is not the biggest model, but the best quality under a strict latency and memory envelope.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Method', 'Training complexity', 'Inference memory', 'Key overhead'],
          rows: [
            ['Standard RNN', 'O(nk)', 'O(k) fixed state', 'Vanishing gradients'],
            ['LTC with ODE solver', 'O(nkp), p = solver order', 'O(k) fixed state', 'Solver micro-steps, stiffness'],
            ['CfC (closed-form)', 'O(nk)', 'O(k) fixed state', 'Approximation error (exponentially decaying)'],
            ['Transformer', 'O(n^2 d)', 'O(n * d) KV cache', 'Quadratic attention, linear cache growth'],
            ['LFM2 hybrid', 'O(n * d) conv + O(n^2 d) attn', 'Near-constant state', 'Architecture search cost (one-time)'],
          ],
        },
        'For the original LTC, the dominant cost is the ODE solver. Adaptive-step solvers (like Dormand-Prince) adjust step size to maintain accuracy, but in stiff regimes they may need many micro-steps per input sample. This makes training time unpredictable and hard to batch efficiently. CfC eliminates this entirely by replacing the solver with a single closed-form evaluation.',
        'For LFM2, the cost profile is different. Ten gated convolution blocks run in O(n) time with small constant. Six GQA attention blocks run in O(n^2) time but with grouped queries that reduce the constant. The architecture search (STAR) is expensive -- it evaluates thousands of candidate architectures on real hardware -- but it runs once. The deployed model benefits from that search at every inference.',
        {
          type: 'table',
          headers: ['Model', 'Params', 'Prefill 1K tok/s (Galaxy S25)', 'Decode 1K tok/s (Galaxy S25)'],
          rows: [
            ['LFM2-350M', '350M', '1,067', '194'],
            ['LFM2-700M', '700M', '522', '104'],
            ['LFM2-1.2B', '1.2B', '335', '70'],
            ['LFM2-2.6B', '2.6B', '143', '34'],
          ],
        },
        'LFM2-1.2B decodes at 70 tokens per second on a phone CPU. That is fast enough for a real-time assistant. A comparably-sized transformer would need over 3x the memory for its KV cache at 32k context, pushing past the phone RAM budget.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Autonomous driving: 19-neuron NCPs perform lane-keeping from camera input with 63x fewer parameters than ConvNet baselines, while remaining interpretable -- attention focuses on road horizon and lane borders.',
            'Irregular time series: medical monitoring (ICU vitals sampled at varying rates), financial tick data, seismic sensors. The adaptive time constant handles irregular sampling naturally because the ODE is defined in continuous time, not step indices.',
            'Robotics and control: servo loops with variable-latency sensors benefit from neurons that react quickly to sharp changes and integrate smoothly during steady state.',
            'Edge language models: LFM2-1.2B outperforms Llama 3.2 1B on MMLU (55.2 vs. 46.6), IFEval (74.9 vs. 52.4), and GSM8K (58.3 vs. 35.7) while fitting in a phone memory budget. The use case is offline assistants, private summarizers, and keyboard prediction without cloud dependency.',
            'On-device speech: LFM2-Audio processes real-time speech-to-speech interaction on mobile hardware, competitive with models 3x larger.',
          ],
        },
        'The common thread is that the product constraint is stronger than the leaderboard constraint. These use cases need useful behavior without assuming a server-class GPU, stable connectivity, or unlimited battery.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'table',
          headers: ['Failure mode', 'What goes wrong', 'When it bites'],
          rows: [
            ['Solver overhead', 'ODE micro-steps erase the benefit of compact state', 'Stiff dynamics, high-frequency input, LTC without CfC'],
            ['Irregular-time collapse', 'Vanilla LTC scores 49% on Bit-Stream XOR (random chance)', 'When the task structure defeats the ODE parameterization'],
            ['Frozen dynamics', 'Time constants grow too large, state stops updating', 'Poor initialization, unconstrained tau learning'],
            ['Explosive gradients', 'State is bounded but gradient flow is not', 'Long sequences with many solver steps'],
            ['Edge measurement drift', 'Model fits benchmark device but fails on customer hardware', 'Different SoC, thermal profile, or kernel support'],
            ['Distillation ceiling', 'Small model inherits teacher biases', 'Teacher errors propagate to student without correction'],
          ],
        },
        'The most insidious failure is measurement drift. A model benchmarked on a Samsung Galaxy S25 at room temperature may throttle on the same phone in a hot car, producing 40% fewer tokens per second. Architecture search that uses proxy hardware measurements instead of real target devices produces models that look efficient in reports but miss the product envelope.',
        'LTCs are also not the right tool when the data is not truly temporal. For bag-of-words classification, static embeddings, or tasks where token order barely matters, the continuous-time machinery adds complexity without payoff. And for tasks requiring exact long-range context (retrieval, multi-hop reasoning over thousands of tokens), attention-based models still win because they can look back at any position without lossy compression into a fixed-size state.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Hasani, Lechner, Amini, Rus, Grosu. "Liquid Time-constant Networks." AAAI 2021. https://arxiv.org/abs/2006.04439 -- the original LTC formulation with stability theorems and benchmarks.',
            'Hasani, Lechner, Amini, et al. "Closed-form Continuous-time Neural Models." Nature Machine Intelligence 2022. https://arxiv.org/abs/2106.13898 -- eliminates the ODE solver with a provably bounded closed-form approximation.',
            'Liquid AI. "LFM2: Liquid Foundation Models v2." 2025. https://arxiv.org/abs/2511.23404 -- hybrid backbone with STAR architecture search, edge deployment results on Galaxy S25 and AMD Ryzen.',
            'Chen, Rubanova, Bettencourt, Duvenaud. "Neural Ordinary Differential Equations." NeurIPS 2018 Best Paper. https://arxiv.org/abs/1806.07366 -- the neural ODE framework that LTCs build on.',
            'Hasani, Lechner, et al. "Neural Circuit Policies." Nature Machine Intelligence 2020. -- 19-neuron lane-keeping with C. elegans-inspired wiring.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Recurrent Neural Networks', 'Understand discrete-time state transitions before continuous-time ones'],
            ['Prerequisite', 'Neural ODE', 'The adjoint method and continuous-depth networks that LTCs extend'],
            ['Sibling', 'Selective State Space Models: Mamba', 'Scan-friendly alternative to attention with linear state'],
            ['Sibling', 'RWKV Recurrent Transformer', 'Recurrence inside language modeling without quadratic attention'],
            ['Extension', 'Hybrid Attention State Budget Case Study', 'Deciding where exact attention is worth its cost in hybrid designs'],
            ['Extension', 'Transformer Inference Roofline', 'Understanding the memory bandwidth bottleneck that edge models fight'],
            ['Application', 'Quantization', 'Compression technique used in LFM2 deployment pipeline'],
          ],
        },
      ],
    },
  ],
};

