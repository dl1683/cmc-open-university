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
      heading: 'Problem',
      paragraphs: [
        'Many sequence models have a fixed idea of time. A vanilla recurrent network applies the same transition rule at every step. A convolution uses a fixed local window. A transformer can compare every token with every other token, but it pays for that broad view with large activation memory and attention cost. Those choices are reasonable when the input arrives in clean, evenly spaced tokens. They are weaker when a system must react to irregular sensor data, robot control loops, financial streams, medical signals, or tiny on-device language workloads where the right memory length changes from moment to moment.',
        'Liquid time-constant networks attack the temporal part of that problem. They ask the model to learn not only what state to store, but how quickly that state should change. A useful hidden unit should behave like a fast detector when a sharp event arrives and like a slow integrator when the signal is noisy or context should persist. That is the central educational point: memory is not only a vector of values. It is also a policy for how rapidly those values are allowed to move.',
      ],
    },
    {
      heading: 'Naive approach',
      paragraphs: [
        'The naive recurrent design uses one learned transition for all conditions. If the model needs longer memory, it must learn to keep the hidden state stable through gates or weights. If it needs quick reaction, it must learn to push the state hard. LSTMs and GRUs improve the situation with learned gates, but the update is still a discrete step wrapped around a sequence index. The model knows token order, not continuous time.',
        'Another naive answer is to make the model bigger or use full attention. That often helps quality, but it is not the same as solving temporal adaptation. Full attention lets a model search over many past positions, but every context extension increases serving cost. For edge devices, the wall appears quickly: memory bandwidth, battery use, thermal throttling, and time-to-first-token become product constraints, not minor implementation details.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The liquid-network insight is to make the effective time constant part of the learned computation. In a physical first-order system, the time constant controls how quickly the system approaches a new value. A small time constant produces a fast response. A large time constant produces inertia. Liquid time-constant networks borrow that idea for neural state. The hidden state follows a continuous-time differential equation whose parameters depend on the current input and hidden state.',
        'That gives each neuron a local speed control. If the input looks important, the model can shrink the time constant and move rapidly. If the input looks like noise, it can enlarge the time constant and preserve memory. The same unit can therefore act differently in different regimes. This is why the word "liquid" is useful: the dynamics are not frozen after training as a single fixed recurrence speed. They flow around the current signal.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A liquid neuron keeps a hidden value h(t). It receives an input x(t), uses a small neural network or parameterized expression to compute conductance-like terms, and updates h through an ordinary differential equation. You can think of the update as a tug between the current state, the new input, and a learned target value, scaled by a learned time constant. The solver advances the state by a small time increment. The output is produced from the new hidden state.',
        'The animation separates that path into signal, gate network, tau, ODE step, next state, and output. The important object is tau, the time-scale control. A fixed RNN step says "apply this transition now." An LTC step says "given this input and current state, decide how quickly the internal state should move, then integrate." That extra degree of freedom is powerful, but it also makes numerical stability and solver choice part of the architecture.',
        'Closed-form continuous-time variants and state-space models sit nearby in the design space. They keep the continuous-time lesson but try to make computation cheaper or easier to parallelize. Modern Liquid Foundation Model style work should be understood in that larger lineage: compact state, adaptive or carefully chosen sequence operators, and architectures searched under deployment constraints. A current hybrid backbone may contain gated convolutions, grouped-query attention, distillation, and quantization rather than literal LTC neurons in every block.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a small robot receives a stream from a distance sensor. Most readings change slowly as the robot moves through open space. Occasionally the sensor jumps because a person steps into the path. A fixed slow recurrence will smooth the jump and react too late. A fixed fast recurrence will react quickly, but it will also chase sensor noise and forget stable context. A liquid neuron can use the input and hidden state to choose a small time constant during the sudden obstacle event and a larger one during ordinary motion.',
        'The same reasoning appears in compact language models, although the operators differ. A phone assistant does not have the memory budget of a server GPU. Cheap local mixing can handle nearby token patterns, while a smaller number of attention blocks can preserve selective global interaction. The architectural problem becomes a ledger: which blocks earn their latency and memory cost under the exact device budget? The liquid-network lesson is not "always use an ODE." It is "make temporal and memory behavior adaptive to the workload and hardware."',
      ],
    },
    {
      heading: 'Animation lesson',
      paragraphs: [
        'The liquid-neuron view highlights the gate, tau, and ODE step because those are the moving parts that make the state adaptive. The response plot compares a small time constant with a large one. The fast curve reaches the new value quickly; the slow curve keeps memory longer. That picture is the simplest mental model for LTCs: tau is the learned speed dial.',
        'The LFM hybrid and edge-ledger views shift from a single neuron to a deployed model. The highlighted operators are not decorative boxes. They are competing ways to spend compute. Gated convolutions buy cheap local mixing. Grouped-query attention buys selective global recall. Hardware search, distillation, and quantization try to preserve quality inside a strict latency, memory, and energy envelope. The final ledger frame is the operational interpretation: an efficient edge model must be measured by time-to-first-token, tokens per second, peak memory, energy, thermal behavior, and privacy boundaries.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because time-scale adaptation is a compact way to express several behaviors. Fast response, slow memory, noise filtering, and event sensitivity can all be represented by changing the same control variable. A fixed-step recurrence needs to encode those behaviors indirectly in weights and gates. An LTC exposes the speed of change as a first-class learned quantity.',
        'For edge foundation models, the related reason is economic rather than purely mathematical. Not every token interaction deserves full attention. Not every quality gain is worth the same latency. Hybrid designs work when they route common local work through cheap operators and reserve more expensive global machinery for the places where it matters. That is why these topics connect to inference rooflines, state budgets, and quantization: the best model is the one that spends scarce memory bandwidth and compute on useful information movement.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Continuous-time neural dynamics are expressive, but they introduce solver cost, step-size policy, stability constraints, and implementation complexity. A model that looks elegant on a benchmark can be awkward if its numerical integration is expensive or hard to batch. Training can also become sensitive to parameterization because time constants that become too small or too large can create unstable or frozen behavior.',
        'Hybrid edge backbones move the tradeoff to operator selection. Gated convolutions are cheap and cache-friendly, but they see mostly local context. Attention is flexible, but it is memory hungry. Distillation can make a small model better, but it inherits the limits and biases of the teacher. Quantization reduces memory and bandwidth, but it can damage accuracy or require careful calibration. Architecture search can find good Pareto points, but only if the measurement loop uses the real target hardware and realistic prompts.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Liquid dynamics are attractive for irregular time series, control systems, robotics, embedded sensing, and other workloads where the relevant memory horizon changes over time. They are also useful as a teaching case because they make the hidden cost of temporal modeling visible. A sequence model is always deciding what to remember and how quickly to overwrite it; LTCs make that decision explicit.',
        'The edge-model lineage wins when the product constraint is stronger than the leaderboard constraint. Offline assistants, private local summarizers, keyboard models, field devices, and low-power agents need useful behavior without assuming a server-class GPU. In those settings, compact adaptive state and hardware-aware operator mixes can matter more than raw parameter count.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'An LTC is not automatically better than an RNN, transformer, or state-space model. If the data is not truly temporal, if the sampling interval is simple, or if the task benefits from broad exact context, the added continuous-time machinery may not pay for itself. Solver overhead can erase the benefit of compact state. Poorly constrained time constants can make learning brittle.',
        'Edge-first hybrid models can fail in a more practical way: they may look efficient in a report but miss the product envelope. A model that fits memory but drains the battery, streams too slowly, overheats after a few minutes, or depends on unsupported kernels is not deployable. The failure mode is often measurement drift between the benchmark machine and the device customers actually use.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Liquid Time-constant Networks at https://arxiv.org/abs/2006.04439, Liquid AI research overview at https://www.liquid.ai/research/liquid-neural-networks-research, and the LFM2 technical report at https://arxiv.org/abs/2511.23404.',
        'After this, study Selective State Space Models: Mamba for scan-friendly long-context state, RWKV Recurrent Transformer for recurrence inside language modeling, xLSTM Matrix Memory Case Study for learned memory matrices, Kimi Linear Attention for hybrid efficient attention, Quantization for model compression, Transformer Inference Roofline for serving bottlenecks, and Hybrid Attention State Budget Case Study for deciding where exact attention is worth its cost.',
      ],
    },
  ],
};
