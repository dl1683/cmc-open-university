// Recurrent Neural Networks and LSTM: the idea that gave neural networks
// memory — a hidden state carried from step to step so sequences of any
// length can be processed one token at a time.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'rnn-lstm',
  title: 'RNN & LSTM',
  category: 'AI & ML',
  summary: 'A hidden state carried forward at each time step gives a network memory over sequences — LSTM gates learn what to remember and what to forget.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['simple RNN', 'LSTM cell', 'GRU variant', 'vanishing gradient'], defaultValue: 'LSTM cell' },
  ],
  run,
};

// ---------------------------------------------------------------- helpers

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const tanh = (x) => Math.tanh(x);

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

// ----------------------------------------------------------- simple RNN

function* simpleRNN() {
  yield {
    state: graphState({
      nodes: [
        { id: 'x0', label: 'x₀', x: 1.0, y: 5.0, note: 'input' },
        { id: 'x1', label: 'x₁', x: 3.5, y: 5.0, note: 'input' },
        { id: 'x2', label: 'x₂', x: 6.0, y: 5.0, note: 'input' },
        { id: 'x3', label: 'x₃', x: 8.5, y: 5.0, note: 'input' },
        { id: 'h0', label: 'h₀', x: 1.0, y: 2.5, note: 'hidden' },
        { id: 'h1', label: 'h₁', x: 3.5, y: 2.5, note: 'hidden' },
        { id: 'h2', label: 'h₂', x: 6.0, y: 2.5, note: 'hidden' },
        { id: 'h3', label: 'h₃', x: 8.5, y: 2.5, note: 'hidden' },
      ],
      edges: [
        { id: 'e-x0-h0', from: 'x0', to: 'h0', weight: 'Wₓ' },
        { id: 'e-x1-h1', from: 'x1', to: 'h1', weight: 'Wₓ' },
        { id: 'e-x2-h2', from: 'x2', to: 'h2', weight: 'Wₓ' },
        { id: 'e-x3-h3', from: 'x3', to: 'h3', weight: 'Wₓ' },
        { id: 'e-h0-h1', from: 'h0', to: 'h1', weight: 'Wₕ' },
        { id: 'e-h1-h2', from: 'h1', to: 'h2', weight: 'Wₕ' },
        { id: 'e-h2-h3', from: 'h2', to: 'h3', weight: 'Wₕ' },
      ],
    }, { title: 'Simple RNN unrolled over 4 time steps' }),
    highlight: { active: ['h0', 'h1', 'h2', 'h3'], visited: ['x0', 'x1', 'x2', 'x3'] },
    explanation: 'An RNN unrolled in time. The same weight matrices Wₓ and Wₕ are reused at every step. Each hidden state hₜ depends on the current input xₜ AND the previous hidden state hₜ₋₁. This is the entire idea: the hidden state is the network\'s memory, carried forward through the sequence.',
    invariant: 'The same weights are shared across all time steps — the network sees one step at a time but accumulates context in hₜ.',
  };

  // Concrete forward pass with small numbers
  const Wx = 0.5, Wh = 0.8, b = 0.1;
  const inputs = [1.0, 0.5, -0.3, 0.7];
  const hiddens = [0];
  for (let t = 0; t < inputs.length; t++) {
    hiddens.push(r3(tanh(Wx * inputs[t] + Wh * hiddens[t] + b)));
  }

  yield {
    state: matrixState({
      title: 'Simple RNN forward pass: hₜ = tanh(Wₓ·xₜ + Wₕ·hₜ₋₁ + b)',
      rows: [
        { id: 'x', label: 'xₜ' },
        { id: 'prev', label: 'hₜ₋₁' },
        { id: 'z', label: 'raw sum' },
        { id: 'h', label: 'hₜ = tanh(z)' },
      ],
      columns: [
        { id: 't0', label: 't=0' },
        { id: 't1', label: 't=1' },
        { id: 't2', label: 't=2' },
        { id: 't3', label: 't=3' },
      ],
      values: [
        inputs.map(r2),
        [0, ...hiddens.slice(1, 4)].map(r3),
        inputs.map((x, t) => r3(Wx * x + Wh * hiddens[t] + b)),
        hiddens.slice(1).map(r3),
      ],
    }),
    highlight: { active: ['h:t0', 'h:t1', 'h:t2', 'h:t3'], compare: ['prev:t1', 'prev:t2', 'prev:t3'] },
    explanation: `Concrete numbers: Wₓ=${Wx}, Wₕ=${Wh}, b=${b}, h₋₁=0. At t=0: tanh(${Wx}·${inputs[0]} + ${Wh}·0 + ${b}) = tanh(${r3(Wx * inputs[0] + b)}) = ${hiddens[1]}. At t=1 the previous hidden state ${hiddens[1]} feeds back in, so the network remembers what it saw at t=0. Each step mixes new input with accumulated context.`,
    invariant: 'hₜ is a function of the entire history x₀…xₜ, compressed into a single vector.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'time step', min: -0.5, max: 4.5 }, y: { label: 'hidden state value', min: -1, max: 1 } },
      series: [
        { id: 'h', label: 'hₜ over time', points: hiddens.slice(1).map((h, t) => ({ x: t, y: h })) },
      ],
      markers: hiddens.slice(1).map((h, t) => ({ id: `m${t}`, x: t, y: h, label: `${r3(h)}` })),
    }),
    highlight: { active: ['h'], found: ['m0', 'm1', 'm2', 'm3'] },
    explanation: 'The hidden state trajectory shows how the network\'s internal memory evolves. Each value is a nonlinear mixture of every input seen so far. Older inputs have diminishing influence because tanh squashes everything into [-1, 1] and repeated multiplication through Wₕ shrinks early contributions — this is the vanishing gradient problem that LSTM was invented to fix.',
  };

  yield {
    state: labelMatrix(
      'Simple RNN: strengths and limits',
      [
        { id: 'pro', label: 'strength' },
        { id: 'con', label: 'weakness' },
      ],
      [
        { id: 'desc', label: 'description' },
        { id: 'effect', label: 'practical effect' },
      ],
      [
        ['handles variable-length sequences', 'one architecture for any sequence length'],
        ['gradient vanishes through long chains', 'cannot learn dependencies beyond ~10–20 steps'],
      ],
    ),
    highlight: { active: ['pro:desc'], removed: ['con:effect'] },
    explanation: 'The simple RNN (Elman 1990) was the first practical architecture for sequence processing. It works for short sequences, but the chain of tanh and matrix multiplications causes gradients to vanish exponentially with sequence length. A network that cannot propagate error signals backward through 50 steps cannot learn that "the cat" at position 3 determines "was hungry" at position 50.',
  };
}

// ----------------------------------------------------------- LSTM cell

function* lstmCell() {
  // Concrete LSTM computation with d=1 for clarity
  const x_t = 0.6;
  const h_prev = 0.4;
  const c_prev = 0.8;

  // Simplified scalar weights (in real LSTM these are matrices)
  const Wf_x = 0.7, Wf_h = 0.5, bf = -0.2;
  const Wi_x = 0.8, Wi_h = 0.3, bi = 0.1;
  const Wc_x = 0.6, Wc_h = 0.4, bc = 0.0;
  const Wo_x = 0.5, Wo_h = 0.6, bo = 0.1;

  const f_t = r3(sigmoid(Wf_x * x_t + Wf_h * h_prev + bf));
  const i_t = r3(sigmoid(Wi_x * x_t + Wi_h * h_prev + bi));
  const c_cand = r3(tanh(Wc_x * x_t + Wc_h * h_prev + bc));
  const o_t = r3(sigmoid(Wo_x * x_t + Wo_h * h_prev + bo));
  const c_new = r3(f_t * c_prev + i_t * c_cand);
  const h_new = r3(o_t * tanh(c_new));

  yield {
    state: graphState({
      nodes: [
        { id: 'xt', label: 'xₜ', x: 0.5, y: 4.0, note: `= ${x_t}` },
        { id: 'hprev', label: 'hₜ₋₁', x: 0.5, y: 2.0, note: `= ${h_prev}` },
        { id: 'cprev', label: 'cₜ₋₁', x: 0.5, y: 6.0, note: `= ${c_prev}` },
        { id: 'fg', label: 'forget gate', x: 3.0, y: 6.0, note: `σ → ${f_t}` },
        { id: 'ig', label: 'input gate', x: 3.0, y: 4.0, note: `σ → ${i_t}` },
        { id: 'cand', label: 'candidate', x: 3.0, y: 2.5, note: `tanh → ${c_cand}` },
        { id: 'og', label: 'output gate', x: 3.0, y: 1.0, note: `σ → ${o_t}` },
        { id: 'cnew', label: 'cₜ', x: 6.5, y: 5.0, note: `= ${c_new}` },
        { id: 'hnew', label: 'hₜ', x: 8.5, y: 3.0, note: `= ${h_new}` },
      ],
      edges: [
        { id: 'e-xt-fg', from: 'xt', to: 'fg', weight: '' },
        { id: 'e-xt-ig', from: 'xt', to: 'ig', weight: '' },
        { id: 'e-xt-cand', from: 'xt', to: 'cand', weight: '' },
        { id: 'e-xt-og', from: 'xt', to: 'og', weight: '' },
        { id: 'e-hprev-fg', from: 'hprev', to: 'fg', weight: '' },
        { id: 'e-hprev-ig', from: 'hprev', to: 'ig', weight: '' },
        { id: 'e-hprev-cand', from: 'hprev', to: 'cand', weight: '' },
        { id: 'e-hprev-og', from: 'hprev', to: 'og', weight: '' },
        { id: 'e-cprev-cnew', from: 'cprev', to: 'cnew', weight: `×${f_t}` },
        { id: 'e-ig-cnew', from: 'ig', to: 'cnew', weight: '' },
        { id: 'e-cand-cnew', from: 'cand', to: 'cnew', weight: '' },
        { id: 'e-cnew-hnew', from: 'cnew', to: 'hnew', weight: 'tanh' },
        { id: 'e-og-hnew', from: 'og', to: 'hnew', weight: '' },
      ],
    }, { title: 'LSTM cell: four gates controlling memory' }),
    highlight: { active: ['fg', 'ig', 'cand', 'og'], found: ['cnew', 'hnew'], visited: ['xt', 'hprev', 'cprev'] },
    explanation: `The LSTM cell has four learned gates operating on input xₜ=${x_t} and previous hidden state hₜ₋₁=${h_prev}. The forget gate decides how much old cell state to keep. The input gate decides how much new candidate memory to add. The output gate decides what part of the cell state to expose as the hidden state. The cell state cₜ is the long-term memory — it flows forward with only addition and element-wise multiplication, which is why gradients survive.`,
    invariant: 'The cell state cₜ is updated by addition (not repeated matrix multiplication), so gradients can flow backward without vanishing.',
  };

  yield {
    state: matrixState({
      title: 'Step 1: Forget gate — what old memory to keep',
      rows: [
        { id: 'formula', label: 'formula' },
        { id: 'numbers', label: 'numbers' },
        { id: 'result', label: 'fₜ' },
      ],
      columns: [{ id: 'val', label: '' }],
      values: [[1], [2], [3]],
      format: (v) => [
        `fₜ = σ(Wf·xₜ + Wf·hₜ₋₁ + bf)`,
        `σ(${Wf_x}·${x_t} + ${Wf_h}·${h_prev} + ${bf}) = σ(${r3(Wf_x * x_t + Wf_h * h_prev + bf)})`,
        `${f_t}`,
      ][v - 1],
    }),
    highlight: { active: ['formula:val', 'numbers:val'], found: ['result:val'] },
    explanation: `Forget gate: σ(${r3(Wf_x * x_t + Wf_h * h_prev + bf)}) = ${f_t}. This value is between 0 and 1. It multiplies the old cell state: cₜ₋₁ × fₜ = ${c_prev} × ${f_t} = ${r3(f_t * c_prev)}. A forget gate near 1 means "keep almost everything." Near 0 means "erase this memory." The network learns when to forget — for example, when a new subject appears, the old subject's gender information can be dropped.`,
  };

  yield {
    state: matrixState({
      title: 'Step 2: Input gate + candidate — what new memory to add',
      rows: [
        { id: 'ig', label: 'input gate iₜ' },
        { id: 'cand', label: 'candidate c̃ₜ' },
        { id: 'add', label: 'iₜ × c̃ₜ' },
      ],
      columns: [
        { id: 'formula', label: 'formula' },
        { id: 'value', label: 'value' },
      ],
      values: [[1, 4], [2, 5], [3, 6]],
      format: (v) => [
        `σ(${Wi_x}·${x_t} + ${Wi_h}·${h_prev} + ${bi})`,
        `tanh(${Wc_x}·${x_t} + ${Wc_h}·${h_prev} + ${bc})`,
        `${i_t} × ${c_cand}`,
        `${i_t}`,
        `${c_cand}`,
        `${r3(i_t * c_cand)}`,
      ][v - 1],
    }),
    highlight: { active: ['ig:formula', 'cand:formula'], found: ['add:value'] },
    explanation: `Input gate iₜ = ${i_t} decides how strongly to write. The candidate c̃ₜ = ${c_cand} is the proposed new memory content. Their product ${r3(i_t * c_cand)} is added to the surviving old memory. Two separate controls: what to write (candidate) and how much to write (input gate). This separation lets the network learn to be selective.`,
  };

  yield {
    state: matrixState({
      title: 'Step 3: New cell state and output',
      rows: [
        { id: 'cell', label: 'cₜ' },
        { id: 'out', label: 'hₜ' },
      ],
      columns: [
        { id: 'formula', label: 'formula' },
        { id: 'value', label: 'value' },
      ],
      values: [[1, 3], [2, 4]],
      format: (v) => [
        `fₜ·cₜ₋₁ + iₜ·c̃ₜ = ${f_t}·${c_prev} + ${i_t}·${c_cand}`,
        `oₜ · tanh(cₜ) = ${o_t} · tanh(${c_new})`,
        `${c_new}`,
        `${h_new}`,
      ][v - 1],
    }),
    highlight: { active: ['cell:formula'], found: ['cell:value', 'out:value'] },
    explanation: `The new cell state cₜ = ${f_t}·${c_prev} + ${i_t}·${c_cand} = ${c_new}. This is addition, not multiplication — the critical design choice. The output gate oₜ = ${o_t} then filters what to expose: hₜ = ${o_t} · tanh(${c_new}) = ${h_new}. The cell state carries long-term memory. The hidden state is the working output used by downstream layers. They are deliberately different.`,
    invariant: 'Cell state update is additive: cₜ = fₜ·cₜ₋₁ + iₜ·c̃ₜ. Addition preserves gradient magnitude across time steps.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'time step', min: -0.5, max: 6.5 }, y: { label: 'cell state', min: 0, max: 1.5 } },
      series: [
        { id: 'cell', label: 'cₜ (LSTM cell state)', points: [
          { x: 0, y: 0.8 }, { x: 1, y: c_new }, { x: 2, y: r3(0.85 * c_new + 0.6 * 0.3) },
          { x: 3, y: r3(0.9 * (0.85 * c_new + 0.6 * 0.3) + 0.5 * 0.2) },
          { x: 4, y: r3(0.3 * 0.9 * (0.85 * c_new + 0.6 * 0.3)) },
          { x: 5, y: r3(0.7 * 0.3 * 0.9 * (0.85 * c_new + 0.6 * 0.3) + 0.8 * 0.5) },
        ] },
        { id: 'rnn', label: 'hₜ (simple RNN decay)', points: [
          { x: 0, y: 0.8 }, { x: 1, y: 0.6 }, { x: 2, y: 0.42 }, { x: 3, y: 0.28 }, { x: 4, y: 0.17 }, { x: 5, y: 0.1 },
        ] },
      ],
      markers: [
        { id: 'forget', x: 4, y: r3(0.3 * 0.9 * (0.85 * c_new + 0.6 * 0.3)), label: 'forget event' },
      ],
    }),
    highlight: { active: ['cell'], compare: ['rnn'], found: ['forget'] },
    explanation: 'The LSTM cell state can hold information across many steps because the forget gate stays near 1 when there is nothing to forget. Contrast with a simple RNN hidden state, which decays steadily through repeated tanh squashing. At step 4, the forget gate fires low — the network decides to erase old memory. This selective forgetting is what makes LSTM work: it holds what matters and drops what does not, instead of blurring everything uniformly.',
  };
}

// ----------------------------------------------------------- GRU variant

function* gruVariant() {
  const x_t = 0.6, h_prev = 0.4;
  const Wz_x = 0.7, Wz_h = 0.5, bz = -0.1;
  const Wr_x = 0.8, Wr_h = 0.3, br = 0.2;
  const Wh_x = 0.6, Wh_h = 0.4, bh = 0.0;

  const z_t = r3(sigmoid(Wz_x * x_t + Wz_h * h_prev + bz));
  const r_t = r3(sigmoid(Wr_x * x_t + Wr_h * h_prev + br));
  const h_cand = r3(tanh(Wh_x * x_t + Wh_h * (r_t * h_prev) + bh));
  const h_new = r3((1 - z_t) * h_prev + z_t * h_cand);

  yield {
    state: graphState({
      nodes: [
        { id: 'xt', label: 'xₜ', x: 0.5, y: 3.5, note: `= ${x_t}` },
        { id: 'hprev', label: 'hₜ₋₁', x: 0.5, y: 6.0, note: `= ${h_prev}` },
        { id: 'zg', label: 'update gate z', x: 3.5, y: 2.0, note: `σ → ${z_t}` },
        { id: 'rg', label: 'reset gate r', x: 3.5, y: 5.0, note: `σ → ${r_t}` },
        { id: 'cand', label: 'candidate h̃', x: 6.0, y: 5.0, note: `tanh → ${h_cand}` },
        { id: 'hnew', label: 'hₜ', x: 8.5, y: 3.5, note: `= ${h_new}` },
      ],
      edges: [
        { id: 'e-xt-zg', from: 'xt', to: 'zg', weight: '' },
        { id: 'e-xt-rg', from: 'xt', to: 'rg', weight: '' },
        { id: 'e-hprev-zg', from: 'hprev', to: 'zg', weight: '' },
        { id: 'e-hprev-rg', from: 'hprev', to: 'rg', weight: '' },
        { id: 'e-rg-cand', from: 'rg', to: 'cand', weight: '' },
        { id: 'e-xt-cand', from: 'xt', to: 'cand', weight: '' },
        { id: 'e-zg-hnew', from: 'zg', to: 'hnew', weight: '' },
        { id: 'e-cand-hnew', from: 'cand', to: 'hnew', weight: '' },
        { id: 'e-hprev-hnew', from: 'hprev', to: 'hnew', weight: '1-z' },
      ],
    }, { title: 'GRU: two gates instead of three (Cho et al. 2014)' }),
    highlight: { active: ['zg', 'rg'], found: ['hnew'], visited: ['xt', 'hprev'] },
    explanation: `GRU merges LSTM's forget and input gates into a single update gate z. When z is high, the new candidate dominates; when z is low, the old hidden state passes through. The reset gate r controls how much history feeds into the candidate computation. Fewer parameters than LSTM (two gates instead of three plus cell state), similar performance on many tasks. GRU is the practical choice when model size matters.`,
    invariant: 'hₜ = (1-zₜ)·hₜ₋₁ + zₜ·h̃ₜ — the update gate interpolates between old and new, so information survives when z is near 0.',
  };

  yield {
    state: matrixState({
      title: 'GRU computation with numbers',
      rows: [
        { id: 'z', label: 'update gate zₜ' },
        { id: 'r', label: 'reset gate rₜ' },
        { id: 'cand', label: 'candidate h̃ₜ' },
        { id: 'h', label: 'hₜ' },
      ],
      columns: [
        { id: 'formula', label: 'formula' },
        { id: 'value', label: 'result' },
      ],
      values: [[1, 5], [2, 6], [3, 7], [4, 8]],
      format: (v) => [
        `σ(${Wz_x}·${x_t} + ${Wz_h}·${h_prev} + ${bz})`,
        `σ(${Wr_x}·${x_t} + ${Wr_h}·${h_prev} + ${br})`,
        `tanh(${Wh_x}·${x_t} + ${Wh_h}·(${r_t}·${h_prev}))`,
        `(1-${z_t})·${h_prev} + ${z_t}·${h_cand}`,
        `${z_t}`,
        `${r_t}`,
        `${h_cand}`,
        `${h_new}`,
      ][v - 1],
    }),
    highlight: { active: ['z:formula', 'r:formula', 'cand:formula'], found: ['h:value'] },
    explanation: `GRU gate computation: update gate zₜ = ${z_t}, reset gate rₜ = ${r_t}. The reset gate modulates the old hidden state before it enters the candidate: rₜ·hₜ₋₁ = ${r_t}·${h_prev} = ${r3(r_t * h_prev)}. Then hₜ = (1-${z_t})·${h_prev} + ${z_t}·${h_cand} = ${h_new}. The interpolation via (1-z) means the gate simultaneously controls forgetting and remembering with a single parameter.`,
  };

  yield {
    state: labelMatrix(
      'LSTM vs GRU comparison',
      [
        { id: 'lstm', label: 'LSTM' },
        { id: 'gru', label: 'GRU' },
      ],
      [
        { id: 'gates', label: 'gates' },
        { id: 'states', label: 'state vectors' },
        { id: 'params', label: 'parameters' },
        { id: 'edge', label: 'when to prefer' },
      ],
      [
        ['3 (forget, input, output)', 'hidden hₜ + cell cₜ', '4 weight matrices', 'large data, long dependencies'],
        ['2 (update, reset)', 'hidden hₜ only', '3 weight matrices', 'smaller models, faster training'],
      ],
    ),
    highlight: { compare: ['lstm:gates', 'gru:gates'], found: ['lstm:edge', 'gru:edge'] },
    explanation: 'LSTM separates what to remember (cell state) from what to output (hidden state). GRU combines them into one vector. In practice, neither consistently dominates. GRU trains faster because it has fewer parameters. LSTM has more expressive capacity, which helps on tasks with complex long-range structure. Both are far better than vanilla RNNs.',
  };
}

// ----------------------------------------------------- vanishing gradient

function* vanishingGradient() {
  const steps = Array.from({ length: 20 }, (_, i) => i + 1);
  const rnnGrad = steps.map((t) => ({ x: t, y: Math.pow(0.7, t) }));
  const lstmGrad = steps.map((t) => ({ x: t, y: Math.pow(0.95, t) }));

  yield {
    state: plotState({
      axes: { x: { label: 'time steps back', min: 0, max: 21 }, y: { label: 'gradient magnitude (relative)', min: 0, max: 1.1 } },
      series: [
        { id: 'rnn', label: 'simple RNN (×0.7/step)', points: rnnGrad },
        { id: 'lstm', label: 'LSTM (×0.95/step)', points: lstmGrad },
      ],
      markers: [
        { id: 'rnn10', x: 10, y: Math.pow(0.7, 10), label: `${r3(Math.pow(0.7, 10))}` },
        { id: 'lstm10', x: 10, y: Math.pow(0.95, 10), label: `${r3(Math.pow(0.95, 10))}` },
      ],
    }),
    highlight: { active: ['lstm'], compare: ['rnn'], found: ['rnn10', 'lstm10'] },
    explanation: `The vanishing gradient kills simple RNNs. Each time step multiplies the gradient by a factor — if that factor is 0.7, after 10 steps the gradient is 0.7¹⁰ = ${r3(Math.pow(0.7, 10))}, and after 20 steps it is ${r3(Math.pow(0.7, 20))} — effectively zero. LSTM's cell state acts as a gradient highway: the forget gate can stay near 1, giving a per-step factor of ~0.95. After 10 steps: 0.95¹⁰ = ${r3(Math.pow(0.95, 10))}. After 20 steps: ${r3(Math.pow(0.95, 20))}. Still strong enough to learn from.`,
    invariant: 'Gradient magnitude after T steps ≈ (per-step factor)^T — exponential decay kills learning unless the factor stays close to 1.',
  };

  yield {
    state: labelMatrix(
      'Why the LSTM cell state preserves gradients',
      [
        { id: 'rnn', label: 'simple RNN' },
        { id: 'lstm', label: 'LSTM' },
      ],
      [
        { id: 'update', label: 'state update rule' },
        { id: 'grad', label: 'gradient path' },
        { id: 'problem', label: 'failure mode' },
      ],
      [
        ['hₜ = tanh(W·hₜ₋₁ + ...)', 'multiply by W and tanh′ at each step', 'exponential decay or explosion'],
        ['cₜ = fₜ·cₜ₋₁ + iₜ·c̃ₜ', 'multiply by fₜ (near 1) at each step', 'forget gate controls decay rate'],
      ],
    ),
    highlight: { active: ['lstm:grad'], removed: ['rnn:problem'] },
    explanation: 'The key difference: a simple RNN applies a weight matrix W at every step, so backprop must multiply through W many times — and any eigenvalue below 1 causes vanishing. LSTM replaces this with multiplication by the forget gate, a scalar near 1. The gradient flows through the cell state like a highway, branching off at each gate but never being forced through a compressing matrix. This is why Hochreiter and Schmidhuber called it "constant error flow" in their 1997 paper.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'c0', label: 'c₀', x: 1.0, y: 2.0, note: 'cell' },
        { id: 'c1', label: 'c₁', x: 3.0, y: 2.0, note: 'cell' },
        { id: 'c2', label: 'c₂', x: 5.0, y: 2.0, note: 'cell' },
        { id: 'c3', label: 'c₃', x: 7.0, y: 2.0, note: 'cell' },
        { id: 'c4', label: 'c₄', x: 9.0, y: 2.0, note: 'cell' },
        { id: 'h0', label: 'h₀', x: 1.0, y: 5.0, note: 'hidden' },
        { id: 'h1', label: 'h₁', x: 3.0, y: 5.0, note: 'hidden' },
        { id: 'h2', label: 'h₂', x: 5.0, y: 5.0, note: 'hidden' },
        { id: 'h3', label: 'h₃', x: 7.0, y: 5.0, note: 'hidden' },
        { id: 'h4', label: 'h₄', x: 9.0, y: 5.0, note: 'hidden' },
      ],
      edges: [
        { id: 'e-c0-c1', from: 'c0', to: 'c1', weight: '×f₁' },
        { id: 'e-c1-c2', from: 'c1', to: 'c2', weight: '×f₂' },
        { id: 'e-c2-c3', from: 'c2', to: 'c3', weight: '×f₃' },
        { id: 'e-c3-c4', from: 'c3', to: 'c4', weight: '×f₄' },
        { id: 'e-c0-h0', from: 'c0', to: 'h0', weight: '' },
        { id: 'e-c1-h1', from: 'c1', to: 'h1', weight: '' },
        { id: 'e-c2-h2', from: 'c2', to: 'h2', weight: '' },
        { id: 'e-c3-h3', from: 'c3', to: 'h3', weight: '' },
        { id: 'e-c4-h4', from: 'c4', to: 'h4', weight: '' },
      ],
    }, { title: 'The cell state highway: gradients flow with minimal decay' }),
    highlight: { active: ['c0', 'c1', 'c2', 'c3', 'c4'], visited: ['h0', 'h1', 'h2', 'h3', 'h4'] },
    explanation: 'The cell state line (top) is the gradient highway. Information flows left to right during the forward pass, gradients flow right to left during backprop. Each connection multiplies by the forget gate fₜ — a learned scalar near 1, not a full weight matrix. The hidden states (bottom) branch off at each step through the output gate, providing the working output. This dual-track architecture — one track for long-term memory, one for immediate output — is the core LSTM contribution.',
    invariant: 'The cell state pathway multiplies only by forget gates (scalars near 1), never by weight matrices, so gradients can cross many time steps.',
  };
}

// ----------------------------------------------------------- run dispatch

export function* run(input) {
  const view = String(input.view);
  if (view === 'simple RNN') yield* simpleRNN();
  else if (view === 'LSTM cell') yield* lstmCell();
  else if (view === 'GRU variant') yield* gruVariant();
  else if (view === 'vanishing gradient') yield* vanishingGradient();
  else throw new InputError('Pick a view: simple RNN, LSTM cell, GRU variant, or vanishing gradient.');
}

// ----------------------------------------------------------- article

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation unrolls one recurrent cell across time. The same weights are reused at each step, while a hidden state carries information from earlier tokens or samples into the next computation.',
        {type: 'callout', text: 'Recurrence gives a model memory by feeding state forward; LSTM gates decide which parts of that memory survive.'},
        'For the LSTM frame, read the cell state as the long memory path. The input gate decides what to write, the forget gate decides what to erase, and the output gate decides what part of memory becomes visible as hidden state.',
        'The safe inference is that sequence memory is state, not a separate database. If information is not preserved in the hidden or cell state, the later step cannot use it.',
        {type: 'image', src: './assets/gifs/rnn-lstm.gif', alt: 'Animated walkthrough of the rnn lstm visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A feedforward neural network maps one fixed-size input to one output. Many problems are sequences: words in a sentence, samples in audio, clicks in a session, or measurements from a sensor over time.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Recurrent_neural_network_unfold.svg/250px-Recurrent_neural_network_unfold.svg.png', alt: 'Recurrent neural network shown compressed and unfolded through time', caption: 'Unrolling makes recurrence visible: one shared cell is reused at each time step with state carried forward. Source: https://commons.wikimedia.org/wiki/File:Recurrent_neural_network_unfold.svg.'},
        'RNN means recurrent neural network. It exists because the model needs a memory of earlier inputs while processing the current input, and it must use the same learned rule at every time step.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to concatenate a fixed window of recent inputs and feed that block into a normal network. For example, predict the next word from the previous five word vectors.',
        'That can work when all useful evidence fits inside the chosen window. It fails when the needed clue is ten, one hundred, or one thousand steps back, because the window either misses the clue or becomes too large and sparse to train well.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A simple RNN can in principle carry information forever, but training creates the wall. Gradients are the error signals used to update weights, and repeated multiplication through time can make them shrink toward zero or explode.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/88/Logistic-curve.svg', alt: 'Logistic sigmoid curve', caption: 'Saturating nonlinearities help explain vanishing gradients: far from the center, local slope becomes small. Source: https://commons.wikimedia.org/wiki/File:Logistic-curve.svg.'},
        'When gradients vanish, early tokens receive almost no learning signal. The model may remember short local patterns while failing on dependencies that require state to survive many steps.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'LSTM means long short-term memory. Its core idea is to create a cell state with controlled write, erase, and read operations instead of forcing all memory through one squashed hidden vector.',
        'A gate is a learned value between zero and one. Multiplying by a gate lets the model keep all, keep some, or drop nearly all of a signal at each time step.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At each step, the LSTM reads the current input and previous hidden state. It computes a forget gate for old cell memory, an input gate for new candidate memory, and an output gate for the hidden state.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/NN_LSTM-Cell_v2.svg/330px-NN_LSTM-Cell_v2.svg.png', alt: 'LSTM cell diagram with gates and state paths', caption: 'The LSTM cell separates the long-term state path from gated write and output paths. Source: https://commons.wikimedia.org/wiki/File:NN_LSTM-Cell_v2.svg.'},
        'The update is c_t = f_t * c_(t-1) + i_t * g_t, where c is cell state, f is forget gate, i is input gate, and g is candidate content. The hidden output is h_t = o_t * tanh(c_t), where o is the output gate.',
        'The gates are learned from data. If a task needs a subject noun to survive until a later verb, training can learn to keep that feature in the cell state across the intervening words.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that the cell state has an additive path through time. If the forget gate is near one and the input gate is near zero, the old memory passes forward with little change.',
        'That additive path gives gradients a route that avoids repeated squashing at every step. The model still can forget, but forgetting is a learned gate decision rather than an unavoidable side effect of multiplying many small derivatives.',
        'Correctness for sequence modeling means the recurrence computes each output from the current input plus a state summarizing the prefix. LSTM improves that summary by making long-lived information easier to preserve and update.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A simple RNN has one main state update per time step. An LSTM has several gates, so it performs about four affine transformations per step for each layer.',
        'For sequence length T and hidden width H, recurrent work scales roughly as O(T * H^2) per layer when matrix multiplies dominate. Doubling the sequence length doubles the number of sequential steps, and those steps cannot be fully parallelized across time like transformer prefill.',
        'The behavior cost is latency. RNNs and LSTMs can stream one step at a time with small memory, but training long sequences is slower because step t depends on state from step t - 1.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LSTMs were widely used for speech recognition, handwriting recognition, time-series forecasting, language modeling, and sequence tagging before transformers became dominant in large language models. They still fit streaming tasks where the model must emit outputs as data arrives.',
        'They are useful when memory must be compact. A sensor model can keep one hidden state per device instead of storing and attending over the full history.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'LSTMs do not remove all long-range problems. Very long dependencies can still be lost, and the hidden state is a bottleneck because all past information must be compressed into fixed-size vectors.',
        'They are also hard to parallelize across time. Transformers are more expensive in memory for long contexts, but they can compare many positions directly during training, which is why they displaced LSTMs for many language tasks.',
        'Gate values can saturate. If a gate learns values near zero or one too often, parts of the model become hard to adjust because the local gradient becomes small.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the previous cell state is c = 0.80 for a feature meaning plural subject. At the next word, the forget gate is 0.90, the input gate is 0.20, and the candidate value is -0.50.',
        'The new cell state is 0.90 * 0.80 + 0.20 * -0.50 = 0.72 - 0.10 = 0.62. The model mostly kept the plural clue while allowing the current word to weaken it.',
        'If the output gate is 0.70, the hidden value exposed to the next layer is 0.70 * tanh(0.62), about 0.70 * 0.55 = 0.385. The memory can remain stronger inside the cell than in the visible hidden state.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Hochreiter and Schmidhuber, Long Short-Term Memory, 1997; Bengio, Simard, and Frasconi, Learning long-term dependencies with gradient descent is difficult, 1994; Gers, Schmidhuber, and Cummins, Learning to forget, 2000.',
        'Study next by foundation. Read Backpropagation Through Time for training, Vanishing Gradients for the failure mode, GRU for a simpler gated recurrent unit, Attention for direct token-to-token comparison, and Transformer for the architecture that replaced recurrence in many sequence models.',
      ],
    },
  ],
};
