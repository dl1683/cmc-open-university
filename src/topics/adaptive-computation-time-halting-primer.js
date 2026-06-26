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
    explanation: `Adaptive Computation Time makes the model emit a halting probability at each of ${4} recurrent steps. At step 1 the halt probability ${'p_t'} is ${'0.42'}, accumulating to ${'0.42'}; by step 4 the cumulative ${'cum p'} reaches ${'1.00'} and the action flips to ${'emit'}. The runtime accumulates that mass, uses the final remainder to make the weights sum to one, and then stops spending compute on this item.`,
    invariant: `Halting is differentiable because the output is a weighted mixture of ${4} step states plus a final remainder — ${3} highlighted ${'p_t'} cells (active) lead to the found ${'emit'} action.`,
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
    explanation: `The ${'easy'} series halts at step ${2} (y=${1.0}) while the ${'hard'} series needs all ${5} steps to reach the ${'halt'} target line at y=${1.0}. The same network can halt quickly for easy inputs (marker: ${'easy stop'} at x=${2}) and keep refining hard inputs (marker: ${'hard stop'} at x=${5}). The promise is variable compute; the limit is that the halt policy must be calibrated, capped, and measured by hard-case quality.`,
  };

  yield {
    state: actGraph('The ACT state machine'),
    highlight: { active: ['halt', 'accum', 'e-halt-accum'], found: ['emit'], compare: ['loop'] },
    explanation: `The ${'ACT state machine'} graph has ${7} nodes — the active path runs through ${'halt'} (note: ${'p_t'}), ${'accum'} (note: ${'sum p'}), and their connecting edge, leading to ${'emit'} (note: ${'done'}) when the threshold ${'>= 1'} is reached, or back through ${'loop'} (note: ${'again'}) otherwise. The data structure is tiny but load-bearing: recurrent state, p_t, cumulative halt mass, final remainder, ponder count, and an active mask. If any buffer is wrong, the model may keep updating halted examples or lose the gradient path for stopping.`,
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
    explanation: `The ${'ACT buffers'} table tracks ${5} buffers across ${'stores'} and ${'purpose'} columns: ${'state h'} stores ${'hidden vec'} for ${'refine'}, ${'halt buf'} stores ${'p_t series'} for ${'when stop'}, ${'remainder'} stores ${'last mass'} for ${'grad path'}, ${'active mask'} stores ${'unfinished'} for ${'skip done'}, and ${'ponder cost'} stores ${'steps used'} for ${'regularize'}. The ponder cost matters because otherwise the model can spend too many recurrent steps. ACT is not just a halting rule; it is a loss term that makes compute part of the optimization target.`,
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
    explanation: `The ${'PonderNet reframes halting'} table compares ${4} mechanisms: ${'ACT'} uses ${'cum mass'} (risk: ${'bias tuning'}), ${'PonderNet'} uses ${'halt dist'} (risk: ${'variance'}), ${'early exit'} uses ${'conf gate'} (risk: ${'miscalib'}), and ${'MoD'} uses ${'top-k cap'} (risk: ${'route bug'}). PonderNet learns a distribution over halting steps rather than relying on exactly the ACT accumulator. It keeps the same product question: how much compute should this input receive before the answer is worth emitting?`,
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
    explanation: `The ${'When ACT helps'} table lists ${4} tasks: ${'parity'} benefits because it ${'needs loops'} (warning: ${'data small'}), ${'sorting'} is ${'iterative'} (warning: ${'max steps'}), ${'reasoning'} because ${'hard varies'} (warning: ${'overthink'}), and ${'plain LM'} is ${'ambiguous'} (warning: ${'may not gain'}). ACT shines when examples genuinely need different numbers of internal steps. It is less compelling when fixed-depth parallel compute already solves the task efficiently or when halting is harder to train than the base model.`,
  };
}

function* recurrentDepth() {
  yield {
    state: universalGraph('Universal Transformer recurs in depth'),
    highlight: { active: ['attn', 'ffn', 'next', 'e-next-attn'], found: ['halt'] },
    explanation: `The ${'Universal Transformer recurs in depth'} graph has ${6} nodes: ${'tokens'} (note: ${'all pos'}) feed through ${'self attn'} (note: ${'shared'}) and ${'transition'} (note: ${'shared'}), then the ${'halt'} node (note: ${'per pos'}) decides whether to ${'copy'} (note: ${'halted'}) or continue to ${'next step'} (note: ${'depth'}) — with ${4} active nodes and the ${'halt'} node found. Positions are processed in parallel at each step, while the halt policy decides which positions keep refining and which ones are copied forward.`,
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
    explanation: `The ${'Different symbols need different revisions'} table shows ${4} tokens: ${'I'} has ${'low'} ambiguity (${'1-2'} steps), ${'arrived'} has ${'low'} ambiguity (${'2'} steps), ${'bank'} has ${'high'} ambiguity (${'4-5'} steps), and ${'river'} has ${'medium'} ambiguity (${'3'} steps). Google Research uses the sentence with ${'bank'} and ${'river'} to explain the point: some positions need extra contextual refinement, while unambiguous symbols like ${'I'} can halt earlier.`,
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
    explanation: `The plot of ${'recurrent steps'} by ${'position'} shows ${5} data points: position ${3} peaks at ${5} steps (marked ${'ambiguous'}), while positions ${1}, ${2}, and ${5} each need only ${2} steps. A recurrent-depth transformer can allocate more revisions to hard positions while keeping the sequence-level representation synchronized through attention at each step.`,
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
    explanation: `The ${'Halting policy failure modes'} table lists ${5} failure modes across ${'symptom'} and ${'control'} columns: ${'shallow trap'} (${'halts early'}, control: ${'bias warmup'}), ${'overthink'} (${'too costly'}, control: ${'ponder loss'}), ${'mask bug'} (${'done updates'}, control: ${'active mask'}), ${'grad path'} (${'no signal'}, control: ${'remainder'}), and ${'max steps'} (${'infinite loop'}, control: ${'hard cap'}). Adaptive depth is trainable only if the halt initialization, active mask, remainder gradient path, and maximum-step cap are all correct.`,
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
    explanation: `The ${'Adaptive compute becomes a control plane'} graph connects ${6} nodes with ${6} edges: ${'ACT'} (note: ${'halt'}) feeds ${'UT'} (note: ${'depth'}, edge: ${'per pos'}) and ${'PonderNet'} (note: ${'dist'}, edge: ${'latent halt'}), which feed ${'early exit'} (note: ${'layers'}) and ${'MoD'} (note: ${'top-k'}), converging at ${'ctl'} (note: ${'budget'}). The modern serving story turns old halting math into a compute controller. Early exit manages latency, MoD manages FLOPs by token and layer, and routing systems decide where extra computation is worth the cost.`,
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
    explanation: `The ${'Choosing the mechanism'} table compares ${5} approaches across ${'best when'} and ${'cost'}: ${'ACT'} is best when ${'steps vary'} (cost: ${'sequential'}), ${'UT'} for ${'loop depth'} (cost: ${'shared block'}), ${'PonderNet'} for ${'latent halt'} (cost: ${'train variance'}), ${'early exit'} for ${'decode speed'} (cost: ${'calibration'}), and ${'MoD'} for ${'static budget'} (cost: ${'routing ops'}). The right mechanism depends on the product bottleneck. ACT and Universal Transformer are modeling tools. Early exit and MoD are closer to inference economics. PonderNet sits between them as a learned halting distribution.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. In the halting-mass view, each row is one recurrent step. The cumulative probability column climbs toward one. Active highlights mark the halt probability cells that contribute mass; the found marker appears on the final action cell when cumulative mass reaches one and the model emits its answer.',
        'In the recurrent-depth view, positions process in parallel but halt independently. Ambiguous tokens stay active longer (more highlighted steps) while simple tokens freeze early. The graph uses shared weights applied in a loop -- not a fixed stack of distinct layers.',
        'At each frame, track three quantities: how much halt mass has accumulated so far, which examples or positions are still active, and how the ponder cost changes if the model continues versus stops. The final row always uses a remainder -- not the raw halt probability -- so the output weights sum to exactly one.',
        {type: 'callout', text: 'ACT turns compute depth into trainable state: halt mass, remainder, active mask, and ponder cost decide when thinking stops.'},

        {type: 'image', src: './assets/gifs/adaptive-computation-time-halting-primer.gif', alt: 'Animated walkthrough of the adaptive computation time halting primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Fixed-depth neural networks spend the same compute on every input. A trivial addition like 2+3 and a five-step logical deduction like "if A implies B and B implies C and C implies D, does A imply D?" both pass through the same number of layers. That uniformity simplifies GPU batching but wastes work on easy inputs and starves hard ones.',
        {
          type: 'quote',
          text: 'An RNN should learn how many computational steps to take between receiving an input and emitting an output.',
          attribution: 'Alex Graves, "Adaptive Computation Time for Recurrent Neural Networks," 2016',
        },
        'Alex Graves proposed Adaptive Computation Time (ACT) in 2016 to make computation depth a learned variable. The model emits a halting probability at each recurrent step, accumulates that probability mass, and stops when the total reaches one. The result is a network that can spend two steps on "2+3" and eight steps on a multi-hop logic chain -- without a human writing the branching rule.',
        'The idea extends far beyond RNNs. Every modern system that adjusts how hard it thinks -- chain-of-thought reasoning, early-exit inference, test-time compute scaling -- descends from this framing. ACT turned "think longer on hard problems" from a vague aspiration into a differentiable mechanism backed by concrete data structures: hidden state, halt probability, cumulative mass, remainder, active mask, and ponder cost.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable attempt is a fixed compute budget. Build an RNN that always runs for T steps, or a Transformer with L layers, and send every input through the full stack. Implementation is simple, GPU batching is trivial, and latency is predictable: every forward pass takes exactly the same time.',
        'A slightly better attempt is a hand-coded confidence threshold. Run the model, check the output distribution after each layer or step, and stop early if the top class has probability above 0.95. This saves compute on easy cases without changing the architecture or retraining.',
        'Both are defensible starting points. Fixed depth works when most inputs have similar difficulty -- say, classifying MNIST digits, where a "7" is about as hard to recognize as a "3." Confidence thresholds work when the model is well-calibrated and its output distribution reliably tracks internal certainty.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Fixed depth hits a wall when difficulty varies widely. Suppose T=3 steps suffice for 80% of inputs but the hard 20% need T=8. Setting T=8 wastes five steps on the easy majority. Setting T=3 damages the hard tail. There is no single budget that serves both populations without wasting compute or sacrificing accuracy.',
        'Confidence thresholds hit a different wall: the stopping rule is not trained jointly with the model. The threshold is a post-hoc rule applied to an output distribution that was never optimized to be a reliable halting signal. Miscalibrated models can be confidently wrong (halt too early on adversarial inputs) or perpetually uncertain (never halt on ambiguous ones). The stopping policy has no gradient -- the model cannot learn to produce better halting signals from task loss.',
        'Both approaches treat computation depth as a hyperparameter chosen before training. Neither lets the model learn, from data, how many steps each input actually needs. ACT closes this gap by making the halting decision differentiable and jointly trained with the task objective.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that stopping can be treated as probability mass. Instead of a binary "stop or continue" gate, each recurrent step emits a scalar halt probability p_t between 0 and 1. These probabilities accumulate across steps, and the model stops when the total mass reaches one. The final output is a weighted average of all intermediate states, with weights equal to the halt probabilities (and a remainder on the last step to make them sum to exactly one).',
        'This turns halting into a differentiable operation. The weights form a convex combination, so the output changes smoothly as the halt probabilities change, and gradients flow backward through the "when to stop" path just as they flow through the "what to compute" path. The model can learn both what to compute and when to stop from the same task loss.',
        'A ponder cost penalty -- a loss term proportional to the number of steps used -- completes the mechanism by giving the optimizer a reason to halt early. Without it, more steps are always free. With it, each additional step must justify its cost by improving the task loss more than the penalty charges. The penalty weight tau controls the tradeoff: high tau compresses computation, low tau allows generous thinking.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At each recurrent step t, the core network reads the current hidden state and produces two outputs: an updated state h_t and a scalar halt probability p_t (produced by a linear layer followed by a sigmoid). The runtime maintains a running sum of halt probabilities across steps.',
        'If the cumulative sum is still below one, the example stays active: the hidden state is updated to h_t and another step runs. When the next p_t would push the cumulative sum past one, the runtime does not use p_t directly. Instead it assigns the final step a remainder weight: R = 1 - (sum of all previous p values). This guarantees the output weights sum to exactly one.',
        'The model\'s final prediction is the weighted combination: y = p_1*h_1 + p_2*h_2 + ... + R*h_N, where N is the number of steps actually taken.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A directed graph clarifies the recurrent control loop: update state, add halt mass, emit or loop. Source: Wikimedia Commons, David W., public domain.'},
        {
          type: 'code',
          language: 'python',
          text: '# Halting probability accumulation (simplified)\ncum_prob = 0.0\nstep_weights = []\nfor t in range(max_steps):\n    h_t = core_network(state)       # updated hidden state\n    p_t = sigmoid(halt_head(h_t))   # halt probability\n    if cum_prob + p_t >= 1.0:\n        remainder = 1.0 - cum_prob\n        step_weights.append(remainder)\n        break\n    step_weights.append(p_t)\n    cum_prob += p_t\n    state = h_t\n# output = sum(w_t * h_t for each step t)',
        },
        'An active mask tracks which examples in the batch are still computing. Halted examples are frozen -- their states are not updated by later steps, even though the batch continues running for other examples. The ponder cost adds a loss term proportional to the number of steps used (or equivalently the cumulative halt mass), giving the optimizer pressure to stop early when extra steps do not improve the answer. A hard cap on maximum steps prevents unbounded loops when the halt unit is uncertain.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The output is a convex combination of intermediate states, with weights summing to one by construction. This makes the output a smooth, differentiable function of the halt probabilities. Gradients flow through both the "what to compute" path (the recurrent core producing h_t) and the "when to stop" path (the halt unit producing p_t). The model can improve its task accuracy and its halting decisions simultaneously.',
        'The remainder is the critical mechanism detail. Without it, halt probabilities could overshoot (weights sum to more than one, breaking the convex combination) or leave mass unassigned (weights sum to less than one, producing an unnormalized mixture). The remainder absorbs the difference: R = 1 - sum(p_1 ... p_{N-1}), keeping the mixture valid regardless of what the halt unit produces.',
        'The ponder penalty converts halting into an explicit accuracy-versus-compute tradeoff. Without the penalty, more steps are always weakly better -- extra computation is free from the optimizer\'s perspective. With it, the total loss is L_task + tau * N(x), where N(x) is the number of steps for input x. The model must earn each additional step by reducing task loss more than tau penalizes. The penalty weight tau is the tuning knob: tau = 0.01 allows generous thinking; tau = 1.0 forces aggressive compression.',
        'The active mask ensures halting has runtime consequences. If halted states could be silently updated by later steps, the model would learn that the halt decision is meaningless -- the gradient signal for the halt unit would decouple from actual compute savings. The mask makes training behavior match deployed behavior: once halted, the state is frozen.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'ACT adds per-step overhead: one sigmoid computation for the halt head (a single linear layer mapping d-dimensional hidden state to a scalar), one comparison against the cumulative threshold, and bookkeeping for the active mask and remainder. These costs are negligible relative to the recurrent core. The real cost is sequential depth -- each step depends on the previous state, so the maximum step count directly bounds worst-case latency.',
        {
          type: 'table',
          headers: ['Component', 'Cost', 'Note'],
          rows: [
            ['Halt head', 'O(d) per step', 'One linear layer + sigmoid on hidden state'],
            ['Accumulator', 'O(B) per step', 'One addition and comparison per batch item'],
            ['Active mask', 'O(B) per step', 'Boolean mask update'],
            ['Ponder loss', 'O(B) per batch', 'Sum of step counts or cumulative mass'],
            ['Max steps cap', 'Constant', 'Hard upper bound prevents runaway'],
          ],
        },
        'The savings come from early halting. Consider a batch of 128 examples with max_steps = 10. If 90 examples halt after 2 steps and the remaining 38 need all 10, the average steps per example is (90*2 + 38*10) / 128 = 4.4 -- a 56% reduction versus running all 128 for 10 steps. But on accelerators, the batch runs until the last active example finishes: wall-clock time is bounded by the slowest example, not the average. The theoretical FLOP savings only translate to real wall-clock gains if the batch is reorganized -- e.g., by sorting inputs by predicted difficulty or using dynamic batching to retire halted examples early.',
        'Training is more expensive than fixed-depth models because the halt policy introduces four new hyperparameters: ponder weight tau, maximum steps cap, halt sigmoid bias initialization, and active mask implementation. Getting these wrong produces models that halt too eagerly (accuracy drops) or too late (no compute savings). The search space is manageable but nontrivial.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Graves demonstrated ACT on parity (bit strings of varying length require different numbers of XOR operations), sorting (longer sequences need more comparisons), and logic (deeper formulas need more evaluation steps). In each case, the number of internal operations needed is a function of the input, not a constant. The parity task showed the clearest adaptive behavior: 8-bit strings halted in 8 steps, 16-bit strings in roughly 16, with compute scaling proportionally to problem size.',
        'The Universal Transformer (Dehghani et al., 2018) applied ACT to Transformer depth, letting each position in a sequence halt at a different layer. This produced strong results on algorithmic tasks like copying and reversing, where some positions (e.g., the first symbol vs. the last) require genuinely different amounts of processing. PonderNet (Banino et al., 2021) replaced the cumulative-mass accumulator with a learned geometric halting distribution, reducing sensitivity to the ponder weight tau.',
        'In production, ACT\'s pattern appears wherever a system allocates variable compute under a budget. Speculative decoding tries cheap draft tokens and falls back to expensive verification. Early-exit inference skips later Transformer layers when intermediate representations are already confident. Mixture-of-depths routing sends only a subset of tokens through expensive layers. These are all descendants of the same core question: how much work does this input deserve?',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'ACT fails silently when the halt unit is poorly initialized. If the sigmoid bias starts too positive (say, +3), the initial halt probability is near 1.0 for every input, so the model halts after one step and never explores deeper computation. If the bias starts too negative (say, -3), every input runs to the maximum cap and the ponder penalty dominates learning. Both look like training -- loss decreases -- but the model has not learned adaptive behavior. The fix is deliberate bias initialization: Graves used a bias of +1, which gives an initial halt probability around 0.73.',
        'The remainder gradient path is fragile. If the remainder is accidentally detached from the computation graph (a common autograd bug when implementing the "break out of the loop" logic), the model receives no gradient signal about when to stop. The forward pass runs correctly and predictions look fine, but the halt unit never learns. This failure is invisible unless you inspect step-count distributions and notice every example taking the same number of steps.',
        'Variable depth creates evaluation traps. Average accuracy can improve while tail accuracy degrades -- the model learns to spend less compute on hard cases because the ponder penalty outweighs the accuracy gain on rare inputs. Evaluating ACT requires quality-by-difficulty-slice reporting. Mean accuracy alone hides the problem.',
        'For large-scale LLM serving, ACT-style mechanisms are usually too fine-grained. Production systems prefer coarser controls: early exit at the layer level, speculative decoding at the token level, or routing at the request level. These give operators explicit knobs for latency budgets and SLA compliance, which a learned halt unit does not directly provide.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a 256-dimensional RNN with ACT processes the input "bank" in a sentence-disambiguation task. The halt head is a single linear layer mapping 256 dimensions to 1 scalar, followed by sigmoid. Max steps = 6, ponder weight tau = 0.01.',
        'Step 1: The core network reads the initial embedding and produces h_1. The halt head outputs sigmoid(-0.8) = 0.31. Cumulative mass: 0.31. Still below 1.0, so the example stays active.',
        'Step 2: The core reads h_1 plus the original input and produces h_2. The halt head outputs sigmoid(-0.4) = 0.40. Cumulative mass: 0.31 + 0.40 = 0.71. Still active.',
        'Step 3: The core produces h_3. The halt head outputs sigmoid(0.1) = 0.52. But 0.71 + 0.52 = 1.23, which exceeds 1.0. The runtime does not use 0.52. Instead it computes the remainder: R = 1.0 - 0.71 = 0.29. The example halts.',
        'The final output is: y = 0.31 * h_1 + 0.40 * h_2 + 0.29 * h_3. The weights sum to 0.31 + 0.40 + 0.29 = 1.00 exactly. The ponder cost for this example is N(x) = 3 steps, contributing 0.01 * 3 = 0.03 to the total loss.',
        'Compare an easy input like "the" in the same batch. Step 1: halt probability = sigmoid(1.2) = 0.77. Step 2: halt probability = sigmoid(0.6) = 0.65, but 0.77 + 0.65 > 1.0, so remainder R = 0.23. Output: y = 0.77 * h_1 + 0.23 * h_2. Only 2 steps, ponder cost = 0.02. The ambiguous word "bank" consumed 50% more compute than the unambiguous word "the" -- exactly the adaptive behavior ACT is designed to produce.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Method', 'Halting mechanism', 'Granularity', 'Train signal', 'Best for'],
          rows: [
            ['ACT (Graves 2016)', 'Cumulative halt mass + remainder', 'Per example or position', 'Ponder cost loss term', 'RNNs with variable-difficulty inputs'],
            ['Universal Transformer (2018)', 'ACT applied to shared-weight depth', 'Per position', 'Ponder cost + shared weights', 'Sequence tasks needing adaptive depth'],
            ['Early exit', 'Confidence threshold at intermediate layers', 'Per example', 'Not jointly trained (post-hoc)', 'Inference latency reduction'],
            ['Mixture of Depths (2024)', 'Top-k routing per layer', 'Per token per layer', 'Router auxiliary loss', 'Static FLOP budgets at scale'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Primary: Graves, "Adaptive Computation Time for Recurrent Neural Networks" (2016) -- https://arxiv.org/abs/1603.08983',
            'Universal Transformer: Dehghani et al. (2018) -- https://arxiv.org/abs/1807.03819',
            'PonderNet: Banino et al. (2021) -- https://arxiv.org/abs/2107.05407',
            'Depth-Adaptive Transformer: Elbayad et al. (2019) -- https://arxiv.org/abs/1910.10073',
            'Google Research blog on Universal Transformer -- https://research.google/blog/moving-beyond-translation-with-the-universal-transformer/',
          ],
        },
        {
          type: 'note',
          text: 'The connection to modern LLM "thinking time" is direct. When a model decides to produce more chain-of-thought tokens before answering, it is spending adaptive computation time. The mechanism differs (token generation vs. recurrent depth), but the core question is identical: how much internal work should this input receive before the answer is worth emitting?',
        },
        'Prerequisite: study Transformer Block and Attention Mechanism to understand what the recurrent core is transforming. Extension: study Mixture-of-Depths Token Routing and Early-Exit Transformer Layer Skipping for production descendants. Contrast: study Mixture of Experts, which allocates variable capacity (different parameters per input) rather than variable depth (different steps per input).',
      ],
    },
  ],
};
