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
        'Read the animation as the state machine for liquid time-constant networks. Active items are the current decision point, found items are committed results, and removed items are paths ruled out by the invariant. The first safe inference is to name what state changed and why that move is legal.',
        {type: 'callout', text: 'Liquid networks make memory speed adaptive, so the model can react fast to sharp signals and integrate slowly when stability matters.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/cc/Adult_Caenorhabditis_elegans.jpg', alt: 'Microscope image of an adult C. elegans worm', caption: 'Adult C. elegans, a biological reference point for compact neural dynamics. Zeynep F. Altun, WormAtlas, via Wikimedia Commons, CC BY-SA 2.5.'},
        'This topic is a case study, so the visual is not decoration. It shows which records, counters, queues, maps, or gates must agree before the system can return a trustworthy result.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'liquid time-constant networks exists because a simple implementation works on a small example but fails when scale, latency, privacy, or correctness constraints arrive. The system needs a data structure that keeps the useful fast path without hiding the boundary conditions.',
        'The practical problem is not only speed. Cost, auditability, rollback, freshness, and slice-level behavior all affect whether the design is usable in production.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep one global rule, one score, one cache, one dashboard, or one list. That is easy to build and easy to explain. It often works until traffic shape or correctness requirements become more specific.',
        'The next obvious approach is to add capacity or widen the search. That may improve the average case, but it usually fails to encode the rule that decides which work is allowed, fresh, fair, or safe.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the missing boundary. A system can look correct globally while a narrow slice is wrong, stale, unfair, or too expensive. Once the boundary is missing, more throughput can make the failure faster.',
        'The concrete failure is usually visible as mixed state: one version reads another version cache, one user receives another user answer, one queue loses priority, or one metric hides a failing slice. The design needs an invariant that prevents that mixture.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make the boundary a first-class data structure in liquid time-constant networks. Keys, clocks, queues, ledgers, folds, or gates are not metadata; they are the mechanism that preserves correctness.',
        'The invariant should be checkable from stored state. If an operator cannot reconstruct why a result was allowed, denied, filled, scored, or rolled back, the system is relying on memory instead of design.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The mechanism starts by normalizing the input into records with stable identities. It then routes those records through the smallest structure that can answer the current decision: a map lookup, ordered queue, version gate, slice table, or witness search.',
        'Each step writes enough state for the next step to be local. Local means a cancel finds one order id, a cache gate checks one record, a rollout query joins one packet id, or a checker advances one legal candidate. That locality is what turns a broad problem into an executable workflow.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is preservation. Before a step, the invariant names which records may interact. The step reads only allowed state, writes the result, and leaves the invariant true for the next step.',
        'This is stronger than a dashboard claim. A dashboard can show an average after the fact; the invariant prevents an illegal result from being served in the first place. When the invariant fails, the system should produce a denial, rollback, miss, or counterexample instead of a quiet answer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is extra state. Maps, ledgers, clocks, slice tags, fold maps, queues, and audit rows consume memory and engineering time. The payoff is that expensive work becomes targeted instead of global.',
        'Cost behaves with the number of records, versions, slices, or live candidates. Doubling traffic does not only double compute; it can double cache pressure, queue length, audit rows, or search width. The dominant operation is the one on the hot path for the real workload.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'liquid time-constant networks fits systems where correctness is operational, not just mathematical. Fraud models, retrieval systems, matching engines, model-serving stacks, evaluation gates, and rollout systems all need stored evidence for why one result was chosen.',
        'The access pattern determines fit. Repeated decisions benefit from maps and caches, ordered fairness needs queues and sequence numbers, release safety needs ledgers, and concurrent correctness needs histories that can be searched.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the boundary is chosen for convenience instead of the product promise. Random folds fail for time-forward prediction, global canaries fail for slice-specific regressions, and similarity search fails when authorization is the real question.',
        'It also fails when evidence is not versioned. A stale record can be more dangerous than a miss because it looks supported. The design needs no-store, deny, rollback, or human-review paths for cases outside the invariant.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose base tau = 10 and the gate output f is 0.1 during calm driving. The effective tau is 10 / (1 + 10 * 0.1) = 5, so the hidden state changes slowly and filters small sensor noise. The model behaves like a stable integrator.',
        'At a sharp obstacle, suppose f rises to 4. The effective tau becomes 10 / (1 + 40) = 0.244, so the state can move about 20 times faster than in the calm regime. One neuron has changed behavior because the input changed, not because the architecture changed.',
        'For a 100 Hz sensor, that difference matters. A fixed tau=5 state may need several samples to reflect the obstacle, adding tens of milliseconds. A dynamic tau near 0.244 can shift the control state within one or two samples.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Hasani et al., Liquid Time-constant Networks, https://arxiv.org/abs/2006.04439; Hasani et al., Closed-form Continuous-time Neural Models, https://arxiv.org/abs/2106.13898; and Chen et al., Neural Ordinary Differential Equations, https://arxiv.org/abs/1806.07366. Study Recurrent Neural Networks, LSTM and GRU, Neural ODE, Selective State Space Models, and Transformer Inference Roofline next.',
      ],
    },
  ],
};

