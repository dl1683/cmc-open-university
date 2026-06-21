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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation traces the ACT state machine step by step. Active nodes (highlighted) are the current computation point -- the recurrent core producing a new state and halt probability. Found markers show the moment cumulative halt mass reaches one and the model emits its answer. Compare markers show the alternative path: looping back for another recurrent step.',
        'In the halting-mass view, each row of the table is one recurrent step. Watch the cumulative probability column climb toward one. The final row uses a remainder -- not the raw halt probability -- so the weights sum exactly. The action column is not decoration; it is the runtime branch between "continue" and "emit."',
        'In the recurrent-depth view, positions process in parallel but halt independently. Ambiguous tokens stay active longer while simple tokens freeze early. The graph shows shared weights applied in a loop, not a fixed stack of distinct layers.',
        'At each frame, ask: how much halt mass has accumulated, which examples or positions are still active, and what the ponder cost would be if the model stopped here versus continuing.',
        {type: 'callout', text: 'ACT turns compute depth into trainable state: halt mass, remainder, active mask, and ponder cost decide when thinking stops.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Fixed-depth neural networks spend the same compute on every input. A trivial addition and a five-step logical deduction both pass through the same number of layers or recurrent steps. That uniformity simplifies batching and hardware utilization, but it wastes work on easy inputs and starves hard ones.',
        {
          type: 'quote',
          text: 'An RNN should learn how many computational steps to take between receiving an input and emitting an output.',
          attribution: 'Alex Graves, "Adaptive Computation Time for Recurrent Neural Networks," 2016',
        },
        'Graves proposed ACT to make computation depth a learned variable. The model emits a halting probability at each step, accumulates that mass, and stops when the total reaches one. The result is a network that can spend two steps on "2+2" and five steps on "is this sentence sarcastic?" -- without a human writing the branching rule.',
        'The idea matters beyond RNNs. Every modern system that adjusts how hard it thinks -- chain-of-thought reasoning, early-exit inference, test-time compute scaling -- descends from this framing. ACT turned "think longer on hard problems" from a vague aspiration into a differentiable mechanism with concrete buffers: hidden state, halt probability, cumulative mass, remainder, active mask, and ponder cost.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is a fixed compute budget. Build a Transformer with L layers or an RNN that runs for T steps, and send every input through the full stack. This is simple to implement, simple to batch on GPUs, and simple to reason about: every forward pass takes the same time.',
        'A slightly more sophisticated attempt is a hand-coded confidence threshold. Run the model, check the output distribution, and stop early if the top class has probability above 0.95. This saves compute on easy cases without changing the architecture.',
        'Both approaches are defensible starting points. Fixed depth works well when most inputs have similar difficulty. Confidence thresholds work when the model is well-calibrated and the output distribution is a reliable signal of internal certainty.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Fixed depth hits a wall when difficulty varies widely. If T=3 is enough for 80% of inputs but T=8 is needed for the hard 20%, you face a lose-lose choice. Setting T=8 wastes five steps on most inputs. Setting T=3 damages the hard tail. There is no single budget that serves both populations well.',
        'Confidence thresholds hit a different wall: they are not trained jointly with the model. The threshold is a post-hoc rule applied to an output distribution that was never optimized to be a reliable halting signal. Miscalibrated models can be confidently wrong (halt too early) or perpetually uncertain (never halt). The stopping policy has no gradient -- the model cannot learn to produce better halting signals from task loss.',
        'The core problem is that both approaches treat computation depth as a hyperparameter chosen before training, not as a variable the model learns during training. ACT closes this gap by making the halting decision differentiable.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At each recurrent step t, the core network reads the current hidden state and produces two outputs: an updated state h_t and a scalar halt probability p_t (passed through a sigmoid). The runtime maintains a running sum of halt probabilities. If the cumulative mass is still below one, the example stays active and another step runs.',
        'When the next p_t would push the cumulative sum past one, the runtime does not use p_t directly. Instead it assigns the final step a remainder weight: R = 1 - (sum of all previous p values). This guarantees the output weights sum to exactly one. The model\'s final prediction is the weighted combination: y = p_1*h_1 + p_2*h_2 + ... + R*h_N.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A directed graph clarifies the recurrent control loop: update state, add halt mass, emit or loop. Source: Wikimedia Commons, David W., public domain.'},
        {
          type: 'code',
          language: 'python',
          text: '# Halting probability accumulation (simplified)\ncum_prob = 0.0\nstep_weights = []\nfor t in range(max_steps):\n    h_t = core_network(state)       # updated hidden state\n    p_t = sigmoid(halt_head(h_t))   # halt probability\n    if cum_prob + p_t >= 1.0:\n        remainder = 1.0 - cum_prob\n        step_weights.append(remainder)\n        break\n    step_weights.append(p_t)\n    cum_prob += p_t\n    state = h_t\n# output = sum(w_t * h_t for each step t)',
        },
        'An active mask tracks which examples in the batch are still computing. Halted examples are frozen -- their states are not updated by later steps even though the batch continues running for other examples. The ponder cost adds a loss term proportional to the number of steps used (or the cumulative halt mass), giving the optimizer a reason to stop early when extra steps do not improve the answer. A hard cap on maximum steps prevents unbounded loops when the halt unit is uncertain.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The key correctness property is that the output is a convex combination of intermediate states, with weights summing to one by construction. This makes the output a smooth function of the halt probabilities, so gradients flow through both the "what to compute" path (the recurrent core) and the "when to stop" path (the halt unit).',
        'The remainder is the critical detail. Without it, halt probabilities could overshoot (weights sum to more than one) or leave mass unassigned (weights sum to less than one). Either breaks the convex combination. The remainder absorbs the difference, keeping the mixture well-formed regardless of what the halt unit produces.',
        'The ponder penalty converts the halting decision into an explicit accuracy-versus-compute tradeoff. Without it, the model would always prefer more steps -- extra computation is free. With it, the model must justify each additional step by improving the task loss more than the ponder cost penalizes. The penalty weight tau is the knob: large tau forces early halting; small tau allows generous computation.',
        'The active mask ensures that halting has runtime consequences. If halted states could be silently updated by later steps, the model would learn that halting is meaningless -- the gradient signal for the halt unit would decouple from actual compute savings. The mask makes the learned policy match the deployed behavior.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'ACT adds per-step overhead: one sigmoid computation for the halt head, one comparison against the cumulative threshold, and bookkeeping for the active mask and remainder. These costs are tiny relative to the recurrent core. The real cost is sequential depth -- each step depends on the previous state, so the maximum number of steps bounds latency.',
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
        'The savings come from early halting. If 70% of inputs halt after 2 steps and the max is 10, the average compute drops substantially. But on accelerators, variable-length computation within a batch creates padding waste. The theoretical FLOP savings may not translate to proportional wall-clock gains unless the batch is reorganized (e.g., by sorting inputs by predicted difficulty or using dynamic batching).',
        'Training is more expensive than fixed-depth models because the halt policy, ponder weight, maximum steps, and halt bias all become hyperparameters. Getting these wrong produces models that halt too eagerly (accuracy drops) or too late (no compute savings). The search space is manageable but nontrivial.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'ACT wins on tasks where input difficulty genuinely varies and extra internal steps improve hard cases. Graves demonstrated this on parity (bit strings of varying length need different numbers of XOR operations), sorting (longer sequences need more comparisons), and logic (deeper formulas need more evaluation steps). The common thread: the number of internal operations is a function of the input, not a constant.',
        'The idea also wins as a conceptual ancestor. Universal Transformer (Dehghani et al., 2018) applied ACT to Transformer depth, letting each position halt at a different layer. PonderNet (Banino et al., 2021) replaced the cumulative-mass accumulator with a learned halting distribution, reducing sensitivity to the ponder weight. Modern chain-of-thought and test-time compute systems -- where an LLM decides how many reasoning tokens to produce before answering -- are ACT\'s spiritual descendants.',
        'In production, the pattern appears whenever a system must allocate variable compute under a budget: speculative decoding (try cheap drafts, fall back to expensive verification), early-exit inference (skip later layers when intermediate representations are confident), and mixture-of-depths routing (send only some tokens through expensive layers).',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'ACT fails silently when the halt unit is poorly initialized. If the sigmoid bias starts too high, the model halts after one step on every input and never explores deeper computation. If it starts too low, every input runs to the maximum cap and the ponder penalty dominates learning. Both look like training -- loss decreases -- but the model has not learned adaptive behavior.',
        'The remainder path is fragile. If the remainder gradient is accidentally detached (a common implementation bug in autograd frameworks), the model receives no signal about when to stop. The forward pass runs correctly, but the halt unit does not learn. This failure is invisible at inference time unless you inspect step-count distributions.',
        'Variable depth also creates evaluation traps. Average accuracy can improve while tail accuracy degrades -- the model learns to spend less compute on hard cases because the ponder penalty outweighs the accuracy gain on rare inputs. Evaluating ACT requires quality-by-difficulty-slice reporting, not just mean metrics.',
        'For large-scale LLM serving, ACT-style mechanisms are usually too fine-grained. Production systems prefer coarser controls: early exit at the layer level, speculative decoding at the token level, or routing at the request level. These give operators explicit knobs for latency budgets and SLA compliance, which a learned halt unit does not directly provide.',
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
