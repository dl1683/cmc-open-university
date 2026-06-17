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
    explanation: 'Adaptive Computation Time makes the model emit a halting probability at each recurrent step. The runtime accumulates that mass, uses the final remainder to make the weights sum to one, and then stops spending compute on this item.',
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
    explanation: 'The same network can halt quickly for easy inputs and keep refining hard inputs. The promise is variable compute; the limit is that the halt policy must be calibrated, capped, and measured by hard-case quality.',
  };

  yield {
    state: actGraph('The ACT state machine'),
    highlight: { active: ['halt', 'accum', 'e-halt-accum'], found: ['emit'], compare: ['loop'] },
    explanation: 'The data structure is tiny but load-bearing: recurrent state, p_t, cumulative halt mass, final remainder, ponder count, and an active mask. If any buffer is wrong, the model may keep updating halted examples or lose the gradient path for stopping.',
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
    explanation: 'Universal Transformer applies the same transformation function repeatedly across depth. Positions are processed in parallel at each step, while the halt policy decides which positions keep refining and which ones are copied forward.',
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
      heading: 'Why this exists',
      paragraphs: [
        'Fixed-depth neural networks spend the same internal compute on easy and hard examples. A trivial input receives the same number of recurrent steps or layers as an ambiguous input. That is simple to batch, but it wastes work when difficulty varies.',
        'Adaptive Computation Time, or ACT, exists to make compute a learned resource. The model emits a halting probability at each recurrent step, accumulates halt mass, and stops once the example or position has received enough computation.',
        'The topic is useful because it turns a vague phrase, "think longer," into concrete state: hidden state, step count, halting probability, cumulative mass, final remainder, active mask, and ponder cost. Those buffers are small, but they decide how much computation the model buys for each input.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is a fixed compute budget. Run every example for T recurrent steps, or build a Transformer with L layers and send every token through all of them. This gives regular shapes, predictable latency, and straightforward training.',
        'The wall is uneven difficulty. A fixed budget may over-serve easy cases and under-serve hard ones. Raising the budget helps hard cases but makes every case more expensive. Lowering it saves compute but can damage the tail of difficult inputs.',
        'A second obvious approach is a hand-written confidence threshold. Stop when the classifier looks confident. That can help simple classifiers, but it does not train the internal computation policy as part of the model. ACT makes the stopping rule differentiable enough to learn with the task loss.',
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        'The core insight is to represent stopping as accumulated probability mass rather than as a hard branch with no gradient. Each recurrent step proposes a halt probability. The runtime keeps adding those probabilities until the total reaches one.',
        'The invariant is that the output weights sum to one. Early steps contribute their halt probabilities, and the final step contributes the remainder needed to reach the threshold. The final prediction is a weighted mixture of intermediate states.',
        'That invariant is what makes the method trainable. The network can learn both how to update the state and how much mass to assign at each step. The ponder cost then gives the optimizer a reason not to spend extra steps unless they improve the result.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'At step t, the recurrent core reads the current state and produces a new state plus a halt probability p_t. If the accumulated mass plus p_t is still below one, the example remains active and another recurrent step runs.',
        'When the next p_t would cross the threshold, the runtime uses a remainder instead of the raw p_t. If the accumulated mass is 0.92, the final weight is 0.08. The weighted output includes the states from each step using these halt weights.',
        'The active mask prevents halted examples or positions from being updated further. The ponder cost adds a penalty proportional to the number of steps or accumulated computation. A hard maximum step count prevents unbounded loops and forces a fallback when the halt unit is uncertain.',
        'Universal Transformer adapts the idea to depth. The same transformation block is applied repeatedly, with self-attention at each recurrent step. Positions can halt at different depths, and halted positions are copied forward while active positions continue to refine.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'ACT works because it avoids making the final output depend on a non-differentiable stop decision alone. The model does stop execution, but the training signal flows through a weighted mixture of the states that led to the stop.',
        'The remainder is the correctness detail that keeps the mixture well formed. Without it, halt probabilities could overshoot or leave missing mass. With it, the output is a convex mixture of step states, so the loss can shape early and late computation.',
        'The ponder penalty changes the optimization problem. Extra steps are no longer free. If another step improves the answer enough, the model can pay for it. If it does not, the model is rewarded for halting earlier. This is the core tradeoff: accuracy versus compute.',
        'The active mask preserves the runtime meaning of halting. Once an example or position halts, later recurrent work must not silently change its state. Otherwise the learned stop signal would not correspond to actual saved computation.',
      ],
    },
    {
      heading: 'What the readouts show',
      paragraphs: [
        'The halting-mass table is an accumulator. Each row adds probability mass. The last row uses a remainder so the total reaches one exactly. The action column is not just a label; it is the runtime decision to continue or emit.',
        'The easy-versus-hard plot shows the intended allocation pattern. Easy inputs reach the halt line early. Hard inputs spend more recurrent steps. A good model improves hard examples enough to justify that extra compute.',
        'The buffer table is the implementation checklist. State, halt buffer, remainder, active mask, and ponder cost must agree. Bugs in these buffers do not merely change the picture; they change the learned compute policy.',
        'The recurrent-depth view shows the same idea per position. Ambiguous tokens can receive more revisions while unambiguous tokens are copied forward. The limit is synchronization: attention still sees a sequence-level state at each recurrent step.',
      ],
    },
    {
      heading: 'ACT case study',
      paragraphs: [
        'Alex Graves introduced ACT for recurrent neural networks. The paper frames the method as a way for RNNs to learn how many computational steps to take between receiving an input and emitting an output, with small architecture changes and deterministic differentiable behavior.',
        'The reported tasks include parity, binary logic, addition, sorting, and character language modeling. Those examples matter because they have variable internal work: some inputs require short computation, while others benefit from extra recurrence.',
        'The lesson is still current. Adaptive compute is valuable when difficulty varies per example or per position. If every example needs the same amount of work, fixed depth is simpler and easier to optimize.',
      ],
    },
    {
      heading: 'Universal Transformer case study',
      paragraphs: [
        'Universal Transformer applies recurrence in depth rather than time. It repeatedly applies a shared transformation function to all positions in parallel, using self-attention at each recurrent step. Positions can halt independently, so ambiguous symbols may receive more revisions.',
        'The operational difference from a standard Transformer is that depth becomes a loop with possible per-position halting, not a fixed stack of different blocks. That adds algorithmic flavor, but it also adds halt initialization, maximum-step, and masking concerns.',
        'PonderNet is a related case study. It learns a distribution over computation steps rather than relying on the exact ACT accumulator. The family resemblance is the important part: a controller learns when more internal computation is worth paying for.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'ACT saves compute only when enough examples halt early and when the overhead of recurrence, masking, and bookkeeping is smaller than the skipped work. On accelerators, variable depth can also reduce batching regularity, so saved theoretical FLOPs may not become proportional wall-clock gains.',
        'The model pays training complexity. Halt bias, ponder penalty, maximum steps, and remainder handling all affect the learned policy. Tuning them is part of the model design, not a cosmetic setting.',
        'There is also an evaluation cost. Average compute can fall while rare hard cases get worse. A useful report needs quality and compute by difficulty slice, not just one mean accuracy and one mean step count.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Adaptive compute wins when difficulty truly varies and extra internal steps help the hard cases. Synthetic algorithmic tasks, recurrent reasoning tasks, ambiguous token disambiguation, and systems with a wide spread of input difficulty are natural fits.',
        'It is also a useful lens for modern descendants. Early-exit models skip later layers when confidence is high. Mixture-of-Depths routes only some tokens through a block. Test-time compute controllers decide when extra reasoning, verification, or search is worth the latency.',
        'The shared win is conditional work. Spend less on cases that are already resolved, and spend more on cases where refinement changes the answer.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'Adaptive halting can fail silently. A bad halt bias can trap the model in shallow computation. A weak ponder penalty can make it spend too many steps. Incorrect masks can continue updating halted states. A missing hard cap can create unbounded loops.',
        'The remainder path is another failure mode. If the final remainder is detached or miscomputed, the model may not learn a useful stopping policy even though the forward pass appears to run.',
        'A product can also fail by optimizing the wrong objective. Saving average FLOPs is not enough if the system stops early on rare but valuable cases. Improving hard cases is not enough if latency becomes unpredictable. The halt policy must be evaluated against the product budget.',
        'ACT is usually not a drop-in LLM serving speed trick. Modern serving systems often prefer early exit, layer skipping, speculative decoding, or routing policies because they expose clearer controls and simpler rollback behavior.',
      ],
    },
    {
      heading: 'Worked example and guidance',
      paragraphs: [
        'An easy input emits halt masses 0.72 then a remainder of 0.28 and stops after two steps. A harder input emits 0.18, 0.17, 0.23, 0.24, and a final remainder of 0.18 before stopping at five steps. Both produce weighted state mixtures, but the hard input buys more internal refinement.',
        'Use adaptive computation when easy cases are common, hard cases benefit from extra refinement, and the system can tolerate variable internal work. Avoid it when fixed-shape batching, predictable latency, or accelerator utilization matters more than per-example savings.',
        'Before shipping any adaptive-depth policy, log step counts, halt probabilities, remainders, maximum-step hits, quality by difficulty slice, latency by slice, and fallback decisions. If those fields are hidden, the halt curve is not debuggable.',
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
