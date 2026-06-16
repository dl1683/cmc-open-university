// Adaptive Computation Time: recurrently refine a state, accumulate halting
// probability, and penalize unnecessary pondering so easy inputs stop early.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'adaptive-computation-time-halting-primer',
  title: 'Adaptive Computation Time Halting',
  category: 'AI & ML',
  summary: 'A halting-probability data structure for neural networks: cumulative halt mass, remainder, ponder cost, and recurrent-depth transformer states.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['halting mass', 'recurrent depth'], defaultValue: 'halting mass' },
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

function actGraph(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'input', x: 0.6, y: 3.8, note: 'state' },
      { id: 'core', label: 'core', x: 2.3, y: 3.8, note: 'recur' },
      { id: 'halt', label: 'halt unit', x: 4.1, y: 2.4, note: 'p_t' },
      { id: 'accum', label: 'accum', x: 5.9, y: 2.4, note: 'sum p' },
      { id: 'state', label: 'new state', x: 4.1, y: 5.2, note: 'h_t' },
      { id: 'emit', label: 'emit', x: 7.7, y: 2.4, note: 'done' },
      { id: 'loop', label: 'loop', x: 7.7, y: 5.2, note: 'again' },
    ],
    edges: [
      { id: 'e-input-core', from: 'input', to: 'core', weight: 'step' },
      { id: 'e-core-halt', from: 'core', to: 'halt', weight: 'score' },
      { id: 'e-halt-accum', from: 'halt', to: 'accum', weight: 'add' },
      { id: 'e-core-state', from: 'core', to: 'state', weight: 'update' },
      { id: 'e-accum-emit', from: 'accum', to: 'emit', weight: '>= 1' },
      { id: 'e-state-loop', from: 'state', to: 'loop', weight: '< 1' },
      { id: 'e-loop-core', from: 'loop', to: 'core', weight: 'next' },
    ],
  }, { title });
}

function universalGraph(title) {
  return graphState({
    nodes: [
      { id: 'tok', label: 'tokens', x: 0.6, y: 3.8, note: 'all pos' },
      { id: 'attn', label: 'self attn', x: 2.4, y: 2.4, note: 'shared' },
      { id: 'ffn', label: 'transition', x: 4.3, y: 2.4, note: 'shared' },
      { id: 'halt', label: 'halt', x: 6.1, y: 2.4, note: 'per pos' },
      { id: 'copy', label: 'copy', x: 6.1, y: 5.1, note: 'halted' },
      { id: 'next', label: 'next step', x: 8.2, y: 3.8, note: 'depth' },
    ],
    edges: [
      { id: 'e-tok-attn', from: 'tok', to: 'attn', weight: 'parallel' },
      { id: 'e-attn-ffn', from: 'attn', to: 'ffn', weight: 'refine' },
      { id: 'e-ffn-halt', from: 'ffn', to: 'halt', weight: 'p_t' },
      { id: 'e-halt-copy', from: 'halt', to: 'copy', weight: 'done' },
      { id: 'e-halt-next', from: 'halt', to: 'next', weight: 'active' },
      { id: 'e-copy-next', from: 'copy', to: 'next', weight: 'carry' },
      { id: 'e-next-attn', from: 'next', to: 'attn', weight: 'repeat' },
    ],
  }, { title });
}

function* haltingMass() {
  yield {
    state: labelMatrix(
      'ACT turns stopping into accumulated probability',
      [
        { id: 's1', label: 'step 1' },
        { id: 's2', label: 'step 2' },
        { id: 's3', label: 'step 3' },
        { id: 's4', label: 'step 4' },
      ],
      [
        { id: 'halt', label: 'p_t' },
        { id: 'cum', label: 'cum p' },
        { id: 'action', label: 'action' },
      ],
      [
        ['0.42', '0.42', 'continue'],
        ['0.31', '0.73', 'continue'],
        ['0.19', '0.92', 'continue'],
        ['0.08', '1.00', 'emit'],
      ],
    ),
    highlight: { active: ['s1:halt', 's2:halt', 's3:halt'], found: ['s4:action'] },
    explanation: 'Adaptive Computation Time makes the model emit a halting probability at each recurrent step. The runtime accumulates that mass until it reaches the halt threshold, then emits a weighted output and stops spending compute on this item.',
    invariant: 'Halting is differentiable because the output is a weighted mixture of step states plus a final remainder.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'ponder step', min: 0, max: 6 }, y: { label: 'halt mass', min: 0, max: 1 } },
      series: [
        { id: 'easy', label: 'easy', points: [
          { x: 1, y: 0.72 }, { x: 2, y: 1.0 }, { x: 3, y: 1.0 }, { x: 4, y: 1.0 }, { x: 5, y: 1.0 },
        ] },
        { id: 'hard', label: 'hard', points: [
          { x: 1, y: 0.18 }, { x: 2, y: 0.35 }, { x: 3, y: 0.58 }, { x: 4, y: 0.82 }, { x: 5, y: 1.0 },
        ] },
        { id: 'target', label: 'halt', points: [
          { x: 0, y: 1.0 }, { x: 6, y: 1.0 },
        ] },
      ],
      markers: [
        { id: 'easyStop', x: 2, y: 1.0, label: 'easy stop' },
        { id: 'hardStop', x: 5, y: 1.0, label: 'hard stop' },
      ],
    }),
    highlight: { active: ['easy', 'easyStop'], compare: ['hard', 'hardStop'], found: ['target'] },
    explanation: 'The same network can halt quickly for easy inputs and keep refining hard inputs. This is the old adaptive-compute promise behind modern early exit, dynamic depth, and variable test-time compute.',
  };

  yield {
    state: actGraph('The ACT state machine'),
    highlight: { active: ['halt', 'accum', 'e-halt-accum'], found: ['emit'], compare: ['loop'] },
    explanation: 'The data structure is tiny but load-bearing: current recurrent state, halting probability p_t, cumulative halt mass, final remainder, ponder step count, and a mask telling which examples are still active.',
  };

  yield {
    state: labelMatrix(
      'ACT buffers',
      [
        { id: 'state', label: 'state h' },
        { id: 'halt', label: 'halt buf' },
        { id: 'remain', label: 'remainder' },
        { id: 'mask', label: 'active mask' },
        { id: 'cost', label: 'ponder cost' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'purpose', label: 'purpose' },
      ],
      [
        ['hidden vec', 'refine'],
        ['p_t series', 'when stop'],
        ['last mass', 'grad path'],
        ['unfinished', 'skip done'],
        ['steps used', 'regularize'],
      ],
    ),
    highlight: { active: ['halt:stores', 'remain:purpose', 'cost:purpose'], compare: ['mask:stores'] },
    explanation: 'The ponder cost matters because otherwise the model can spend too many recurrent steps. ACT is not just a halting rule; it is a loss term that makes compute part of the optimization target.',
  };

  yield {
    state: labelMatrix(
      'PonderNet reframes halting',
      [
        { id: 'act', label: 'ACT' },
        { id: 'ponder', label: 'PonderNet' },
        { id: 'early', label: 'early exit' },
        { id: 'mod', label: 'MoD' },
      ],
      [
        { id: 'halt', label: 'halt form' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['cum mass', 'bias tuning'],
        ['halt dist', 'variance'],
        ['conf gate', 'miscalib'],
        ['top-k cap', 'route bug'],
      ],
    ),
    highlight: { active: ['act:halt', 'ponder:halt'], found: ['early:risk', 'mod:risk'] },
    explanation: 'PonderNet learns a distribution over halting steps rather than relying on exactly the ACT accumulator. It keeps the same product question: how much compute should this input receive before the answer is worth emitting?',
  };

  yield {
    state: labelMatrix(
      'When ACT helps',
      [
        { id: 'parity', label: 'parity' },
        { id: 'sort', label: 'sorting' },
        { id: 'reason', label: 'reasoning' },
        { id: 'plainLM', label: 'plain LM' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'warning', label: 'warning' },
      ],
      [
        ['needs loops', 'data small'],
        ['iterative', 'max steps'],
        ['hard varies', 'overthink'],
        ['ambiguous', 'may not gain'],
      ],
    ),
    highlight: { active: ['parity:why', 'reason:why'], compare: ['plainLM:warning'] },
    explanation: 'ACT shines when examples genuinely need different numbers of internal steps. It is less compelling when fixed-depth parallel compute already solves the task efficiently or when halting is harder to train than the base model.',
  };
}

function* recurrentDepth() {
  yield {
    state: universalGraph('Universal Transformer recurs in depth'),
    highlight: { active: ['attn', 'ffn', 'next', 'e-next-attn'], found: ['halt'] },
    explanation: 'Universal Transformer applies the same transformation function repeatedly across depth. Positions are processed in parallel, but each position can keep refining over recurrent steps and may halt at a different depth.',
  };

  yield {
    state: labelMatrix(
      'Different symbols need different revisions',
      [
        { id: 'i', label: 'I' },
        { id: 'arrived', label: 'arrived' },
        { id: 'bank', label: 'bank' },
        { id: 'river', label: 'river' },
      ],
      [
        { id: 'ambiguity', label: 'ambiguity' },
        { id: 'steps', label: 'steps' },
      ],
      [
        ['low', '1-2'],
        ['low', '2'],
        ['high', '4-5'],
        ['medium', '3'],
      ],
    ),
    highlight: { active: ['bank:steps', 'river:steps'], compare: ['i:steps'] },
    explanation: 'Google Research uses the sentence with bank and river to explain the point: some positions need extra contextual refinement, while unambiguous symbols can halt earlier.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'position', min: 0, max: 5 }, y: { label: 'recurrent steps', min: 0, max: 6 } },
      series: [
        { id: 'steps', label: 'steps', points: [
          { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 5 }, { x: 4, y: 3 }, { x: 5, y: 2 },
        ] },
      ],
      markers: [
        { id: 'ambig', x: 3, y: 5, label: 'ambiguous' },
      ],
    }),
    highlight: { active: ['steps', 'ambig'] },
    explanation: 'A recurrent-depth transformer can allocate more revisions to hard positions while keeping the sequence-level representation synchronized through attention at each step.',
  };

  yield {
    state: labelMatrix(
      'Halting policy failure modes',
      [
        { id: 'shallow', label: 'shallow trap' },
        { id: 'deep', label: 'overthink' },
        { id: 'mask', label: 'mask bug' },
        { id: 'grad', label: 'grad path' },
        { id: 'max', label: 'max steps' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'control', label: 'control' },
      ],
      [
        ['halts early', 'bias warmup'],
        ['too costly', 'ponder loss'],
        ['done updates', 'active mask'],
        ['no signal', 'remainder'],
        ['infinite loop', 'hard cap'],
      ],
    ),
    highlight: { active: ['shallow:control', 'deep:control', 'max:control'], compare: ['mask:symptom'] },
    explanation: 'Adaptive depth is trainable only if the halt initialization, active mask, remainder gradient path, and maximum-step cap are all correct. Otherwise the model learns to stop too soon or never learns that stopping matters.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'act', label: 'ACT', x: 0.8, y: 3.8, note: 'halt' },
        { id: 'ut', label: 'UT', x: 2.6, y: 2.6, note: 'depth' },
        { id: 'ponder', label: 'PonderNet', x: 2.6, y: 5.0, note: 'dist' },
        { id: 'exit', label: 'early exit', x: 4.9, y: 2.6, note: 'layers' },
        { id: 'mod', label: 'MoD', x: 4.9, y: 5.0, note: 'top-k' },
        { id: 'router', label: 'ctl', x: 7.5, y: 3.8, note: 'budget' },
      ],
      edges: [
        { id: 'e-act-ut', from: 'act', to: 'ut', weight: 'per pos' },
        { id: 'e-act-ponder', from: 'act', to: 'ponder', weight: 'latent halt' },
        { id: 'e-ut-exit', from: 'ut', to: 'exit', weight: 'depth' },
        { id: 'e-ut-mod', from: 'ut', to: 'mod', weight: 'routing' },
        { id: 'e-exit-router', from: 'exit', to: 'router', weight: 'latency' },
        { id: 'e-mod-router', from: 'mod', to: 'router', weight: 'FLOPs' },
      ],
    }, { title: 'Adaptive compute becomes a control plane' }),
    highlight: { active: ['act', 'ut', 'ponder'], found: ['exit', 'mod', 'router'] },
    explanation: 'The modern serving story turns old halting math into a compute controller. Early exit manages latency, MoD manages FLOPs by token and layer, and routing systems decide where extra computation is worth the cost.',
  };

  yield {
    state: labelMatrix(
      'Choosing the mechanism',
      [
        { id: 'act', label: 'ACT' },
        { id: 'ut', label: 'UT' },
        { id: 'ponder', label: 'PonderNet' },
        { id: 'exit', label: 'early exit' },
        { id: 'mod', label: 'MoD' },
      ],
      [
        { id: 'best', label: 'best when' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['steps vary', 'sequential'],
        ['loop depth', 'shared block'],
        ['latent halt', 'train variance'],
        ['decode speed', 'calibration'],
        ['static budget', 'routing ops'],
      ],
    ),
    highlight: { active: ['act:best', 'ut:best', 'mod:best'], compare: ['ponder:cost', 'exit:cost'] },
    explanation: 'The right mechanism depends on the product bottleneck. ACT and Universal Transformer are modeling tools. Early exit and MoD are closer to inference economics. PonderNet sits between them as a learned halting distribution.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'halting mass') yield* haltingMass();
  else if (view === 'recurrent depth') yield* recurrentDepth();
  else throw new InputError('Pick an adaptive-computation view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Adaptive Computation Time (ACT) is a way for a neural network to learn how many internal computation steps to spend before producing an output. Instead of choosing a fixed number of recurrent updates, the model emits a halting probability at each step, accumulates halt mass, and stops once enough mass has been assigned.',
        'The data-structure view is simple: current state, step counter, halting probabilities, cumulative halt mass, final remainder, active mask, and ponder cost. The learning view is deeper: the network is trained not only to be correct, but also to avoid unnecessary internal work.',
      ],
    },
    {
      heading: 'Core data structures',
      paragraphs: [
        'The halting accumulator stores p_t for each recurrent step and adds it until the threshold is reached. The final step uses a remainder so the halt weights sum to one and gradients still flow. An active mask prevents halted examples or positions from being updated again. A ponder-cost term penalizes extra steps, turning compute into part of the loss.',
        'This is why ACT belongs with finite-state machines, Markov chains, and gradient flow: it is a small differentiable state machine that learns a stopping policy while preserving a path for training signal.',
      ],
    },
    {
      heading: 'Case study: ACT',
      paragraphs: [
        'Alex Graves introduced ACT for recurrent neural networks. The arXiv abstract says the method lets RNNs learn how many computational steps to take between receiving an input and emitting an output, with minimal architecture changes and deterministic differentiable behavior. The paper reports strong results on synthetic tasks such as parity, binary logic, addition, and sorting, and observes harder-to-predict transitions in character language modeling receiving more computation.',
        'The main lesson is still current: adaptive compute is valuable when difficulty varies per example or per position. If every example needs the same amount of work, fixed depth is simpler and easier to optimize.',
      ],
    },
    {
      heading: 'Case study: Universal Transformer',
      paragraphs: [
        'Universal Transformer applies recurrence in depth rather than time. It repeatedly applies a shared transformation function to all positions in parallel, using self-attention at each recurrent step. Google Research explains that the model can apply more computation to ambiguous symbols, such as bank in a sentence whose meaning depends on river, while spending fewer steps on less ambiguous symbols.',
        'The operational difference from a standard Transformer is that depth becomes a loop with possible per-position halting, not a fixed stack of different blocks. That gives more algorithmic flavor, but it also introduces halting initialization, maximum-step, and masking concerns.',
      ],
    },
    {
      heading: 'Case study: PonderNet',
      paragraphs: [
        'PonderNet revisits the halting problem as a learned distribution over computation steps. Its arXiv abstract frames the goal as adapting compute to problem complexity and balancing prediction accuracy, computational cost, and generalization. The reported results include improvements on complex synthetic problems, extrapolation tests, question answering with less compute, and a reasoning benchmark.',
        'PonderNet is useful to study because it separates the idea of adaptive compute from one specific ACT accumulator. The family resemblance is the important part: a controller learns when more internal computation is worth paying for.',
      ],
    },
    {
      heading: 'Production pitfalls',
      paragraphs: [
        'Adaptive halting can fail silently. A bad halt bias can trap the model in shallow computation. A weak ponder penalty can make it overthink every input. Incorrect masks can continue updating halted states. A missing hard cap can create unbounded loops. And if the remainder path is wrong, the model may not learn useful stopping behavior.',
        'For LLM serving, ACT is usually a conceptual ancestor rather than a drop-in speed trick. Early-Exit Transformer Layer Skipping, Mixture-of-Depths Token Routing, speculative decoding, and compute routers are the production-facing descendants that turn adaptive computation into latency, FLOP, and quality controls.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Adaptive Computation Time at https://arxiv.org/abs/1603.08983, Universal Transformers at https://arxiv.org/abs/1807.03819, Google Research on Universal Transformer at https://research.google/blog/moving-beyond-translation-with-the-universal-transformer/, PonderNet at https://arxiv.org/abs/2107.05407, Depth-Adaptive Transformer at https://arxiv.org/abs/1910.10073, and AdaTape at https://research.google/blog/adatape-foundation-model-with-adaptive-computation-and-dynamic-read-and-write/.',
        'Study Transformer Block, Attention Mechanism, Gradient Flow, Finite-State Machines, Markov Chains, Early-Exit Transformer Layer Skipping, Mixture-of-Depths Token Routing, AdaTape Adaptive Token Bank, Mixture of Experts, and Heterogeneous AI Compute Workload Router next.',
      ],
    },
  ],
};
