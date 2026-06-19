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
        'The animation unrolls a recurrent network across time steps. Each column is one moment in a sequence. The top row shows inputs arriving one at a time. The bottom row shows hidden states — the network\'s memory after processing each input.',
        'Arrows labeled Wₓ carry the current input into the hidden state. Arrows labeled Wₕ carry the previous hidden state forward. In LSTM views, the four gates (forget, input, candidate, output) appear as separate nodes. Active markers highlight the gate currently being computed. Found markers show the resulting cell state and hidden state after all gates fire.',
        'In the vanishing gradient view, two curves compare how gradient magnitude decays across time steps for a simple RNN versus an LSTM. The gap between them is the reason LSTM exists.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Feed-forward networks take a fixed-size input and produce a fixed-size output. That works for images (224x224 pixels) but not for language ("the cat sat on the mat" has 6 tokens; "she left" has 2). Sequences vary in length, and meaning depends on order. A network that processes each token independently cannot know that "bank" means a financial institution in one sentence and a riverbank in another — context from earlier tokens determines meaning.',
        'The core need: a neural network that can process one element at a time while maintaining a running summary of everything it has seen. That running summary is the hidden state. Elman proposed this in 1990 — feed the previous hidden state back into the network alongside each new input. The same weights are applied at every step, so the network handles sequences of any length with a fixed number of parameters.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Before recurrent networks, sequence tasks used fixed-size windows. To predict the next word, look at the previous 3 words (a trigram model). To classify sentiment, average the word vectors. To tag parts of speech, use a window of 5 tokens centered on the target.',
        'Fixed windows work well for local patterns. English syntax is mostly local: adjectives precede nouns, verbs agree with nearby subjects. A 5-word window catches most of these. Trigram language models powered speech recognition and machine translation for decades. The approach is simple, fast, and embarrassingly parallel.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Fixed windows cannot capture long-range dependencies. Consider: "The cat that sat on the mat next to the dog that chased the bird ... was hungry." The verb "was" must agree with "cat," which could be 20 tokens back. A trigram model sees only "bird ... was" and has no path to "cat." Making the window larger does not scale — a 50-token window means 50x more parameters, most of which are useless for any given prediction.',
        'The dependency distance problem is not rare. Coreference ("she" referring to a character introduced paragraphs earlier), negation scope ("I don\'t think he said she was wrong" — how many negations?), and discourse structure all require memory that spans many tokens. Any architecture that sees only a local window is structurally blind to these patterns.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Feed the hidden state back. At each time step, the network receives two inputs: the current token and its own previous hidden state. The hidden state is a compressed summary of the entire history. The same weights process every step, so the network generalizes across positions. This is the Elman network (1990): hₜ = tanh(Wₓ·xₜ + Wₕ·hₜ₋₁ + b).',
        'The simple RNN has a fatal flaw: gradients vanish. Backpropagation through time (BPTT) multiplies the gradient by the weight matrix Wₕ at every step. If the largest eigenvalue of Wₕ is below 1, the gradient shrinks exponentially. After 20 steps, a per-step factor of 0.7 gives 0.7²⁰ = 0.0008 — the network cannot learn from events more than ~10 steps in the past.',
        'Hochreiter and Schmidhuber\'s LSTM (1997) fixes this with a cell state that updates by addition instead of multiplication. Three gates — forget, input, output — control what the cell remembers, what it absorbs, and what it exposes. The cell state acts as a conveyor belt: information placed on it at step 5 can survive to step 50 if the forget gate stays near 1. Gradients flow backward along this belt without being forced through a squashing weight matrix at every step.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The LSTM cell maintains two state vectors: the cell state cₜ (long-term memory) and the hidden state hₜ (working output). At each time step, four operations run in parallel on the concatenation of xₜ and hₜ₋₁:',
        'Forget gate: fₜ = σ(Wf·[hₜ₋₁, xₜ] + bf). This sigmoid output is between 0 and 1 for each dimension. It multiplies the old cell state element-wise: dimensions where fₜ is near 0 are erased, dimensions near 1 are preserved. When a new sentence begins, the forget gate learns to clear the old subject\'s features.',
        'Input gate: iₜ = σ(Wi·[hₜ₋₁, xₜ] + bi). Candidate memory: c̃ₜ = tanh(Wc·[hₜ₋₁, xₜ] + bc). The input gate controls how much of the candidate actually gets written. This two-part design separates "what is the new information" (candidate) from "how strongly should it be stored" (input gate).',
        'Cell state update: cₜ = fₜ ⊙ cₜ₋₁ + iₜ ⊙ c̃ₜ. This is the key equation. It is addition, not matrix multiplication. The old cell state is scaled by the forget gate, then the new candidate is added, scaled by the input gate. No weight matrix intervenes in the cell-to-cell path.',
        'Output gate: oₜ = σ(Wo·[hₜ₋₁, xₜ] + bo). Hidden state: hₜ = oₜ ⊙ tanh(cₜ). The output gate filters what part of the cell state becomes visible to the rest of the network. The cell might store subject gender, verb tense, and sentiment simultaneously, but only the information relevant to the current prediction passes through.',
        'The GRU (Cho et al. 2014) simplifies this to two gates. The update gate z replaces both forget and input gates via interpolation: hₜ = (1-zₜ)·hₜ₋₁ + zₜ·h̃ₜ. The reset gate r controls how much history enters the candidate. GRU has fewer parameters and trains faster. On many benchmarks, GRU matches LSTM quality.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The cell state is an additive accumulator. In a simple RNN, the gradient at step t must pass through t multiplications by Wₕ and t applications of tanh\'. In an LSTM, the gradient along the cell state path passes through t multiplications by the forget gate fₜ — a learned scalar near 1. If fₜ = 0.95 at every step, the gradient after 20 steps is 0.95²⁰ ≈ 0.36, versus 0.25²⁰ ≈ 10⁻¹² for a sigmoid RNN. The forget gate is the gradient valve: it controls both what memory survives forward and what error signal survives backward.',
        'Hochreiter and Schmidhuber called this "constant error flow." If the forget gate is exactly 1 and the input gate is exactly 0, the cell state copies forward unchanged indefinitely — and the gradient copies backward unchanged. In practice the gates are never exactly 1 or 0, but they stay close enough that useful gradient reaches 100+ steps back. This is not just better than simple RNNs; it changed what sequence tasks were feasible.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'An LSTM layer with hidden size d processes a sequence of length T in O(T·d²) time. Each step performs four matrix-vector multiplications (one per gate, each d×d), plus element-wise operations. Memory is O(T·d) to store all hidden and cell states for backpropagation. A bidirectional LSTM doubles both compute and memory.',
        'The sequential bottleneck is LSTM\'s structural tax. Step t+1 depends on step t\'s hidden state, so the T steps cannot be parallelized within a layer. A 500-token sequence takes 500 serial steps. Transformers replaced this with O(T²·d) parallel computation — slower asymptotically but much faster on GPUs because all positions compute simultaneously. For T=512 and d=512, the LSTM does 512 serial steps of 512² work each; the transformer does 1 parallel step of 512²·512 work. The transformer wins on wall-clock time despite doing more total arithmetic.',
        'When input doubles from T to 2T: LSTM time doubles (linear), LSTM memory doubles (linear), transformer time quadruples (quadratic). LSTM is asymptotically cheaper but practically slower.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Time series forecasting is LSTM\'s strongest remaining domain. Stock prices, sensor readings, weather data, and medical vitals are naturally sequential with variable-length dependencies. LSTM models these without the quadratic cost of attention on long sequences, and the sequential nature matches streaming data where predictions must be emitted one step at a time.',
        'Speech recognition used LSTM as its backbone from 2013 to ~2020. Bidirectional LSTMs with CTC (connectionist temporal classification) powered Google\'s voice search, Apple\'s Siri, and Baidu\'s DeepSpeech. The architecture was replaced by conformer and transformer models, but the LSTM era proved that gated recurrence could handle real-time audio at production scale.',
        'Machine translation was LSTM\'s breakthrough application. Sutskever et al. (2014) showed that an encoder LSTM reading "the cat sat" and a decoder LSTM generating "le chat s\'est assis" could match phrase-based statistical MT. The attention mechanism (Bahdanau et al. 2015) was first added to LSTM-based seq2seq, before transformers took over in 2017.',
        'Music generation, handwriting synthesis (Graves 2013), and text generation all used LSTM before GPT-era transformers. The common pattern: sequential data where each output depends on accumulated context, and where the training set is small enough that transformer data hunger is a disadvantage.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Parallelization is impossible within a sequence. Each hidden state depends on the previous one, so a 1000-step sequence requires 1000 serial computations per layer. Modern GPUs have thousands of cores sitting idle during each step. Transformers compute all positions in parallel, which is why they train 10-100x faster on the same hardware despite higher theoretical complexity.',
        'Very long dependencies still break LSTM in practice. The forget gate helps, but 1000+ step dependencies require the forget gate to stay extremely close to 1 for hundreds of steps — any learned deviation accumulates multiplicatively. Tasks like long-document summarization, code generation with files spanning thousands of tokens, and multi-turn dialogue over many pages expose this limit.',
        'Transformers dominate almost every NLP benchmark since 2018. BERT, GPT, and their descendants replaced LSTM not because LSTM was wrong, but because attention + parallelism + scale proved more effective with modern hardware and data sizes. LSTM remains competitive in low-data regimes, streaming applications, and edge deployment where constant memory per step matters.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace one LSTM step with concrete numbers. Inputs: xₜ = 0.6, hₜ₋₁ = 0.4, cₜ₋₁ = 0.8. Using scalar weights for clarity (real LSTMs use matrices).',
        'Forget gate: fₜ = σ(0.7·0.6 + 0.5·0.4 - 0.2) = σ(0.42 + 0.20 - 0.20) = σ(0.42) = 0.603. The network keeps 60.3% of each old cell value.',
        'Input gate: iₜ = σ(0.8·0.6 + 0.3·0.4 + 0.1) = σ(0.48 + 0.12 + 0.1) = σ(0.70) = 0.668. The network writes at 66.8% strength.',
        'Candidate: c̃ₜ = tanh(0.6·0.6 + 0.4·0.4 + 0.0) = tanh(0.52) = 0.477. This is the proposed new memory content.',
        'Cell update: cₜ = 0.603·0.8 + 0.668·0.477 = 0.482 + 0.319 = 0.801. The old memory survives partially (0.482 from 0.8), and new information adds 0.319.',
        'Output gate: oₜ = σ(0.5·0.6 + 0.6·0.4 + 0.1) = σ(0.64) = 0.655.',
        'Hidden state: hₜ = 0.655·tanh(0.801) = 0.655·0.665 = 0.436. This is what the rest of the network sees. The cell stores 0.801, but the output gate filters it down to 0.436.',
        'Prediction: the cell state barely changed (0.800 to 0.801) because the forget and input contributions nearly balanced. The hidden state shifted from 0.400 to 0.436. In a real network with 512-dimensional vectors, different dimensions would have very different gate values — some memories strengthened, others erased, in parallel.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Original papers: Elman, "Finding structure in time" (1990) introduced the simple recurrent network. Hochreiter and Schmidhuber, "Long short-term memory" (1997, Neural Computation) introduced LSTM. Cho et al., "Learning phrase representations using RNN encoder-decoder" (2014) introduced GRU. Graves, "Generating sequences with recurrent neural networks" (2013) demonstrated LSTM for handwriting and text generation.',
        'Prerequisites: study Neural Network Forward Pass and Backpropagation to understand the feed-forward foundations. Study Vanishing & Exploding Gradients to understand the problem LSTM solves.',
        'Extensions: Attention Mechanism shows how Bahdanau et al. (2015) added direct token-to-token lookup to LSTM-based seq2seq, foreshadowing transformers. Transformer Block shows the architecture that replaced RNNs by making all positions parallel. RWKV Recurrent Transformer and xLSTM Matrix Memory Case Study show modern attempts to bring recurrent ideas back with transformer-era training.',
        'Alternatives: Selective State Space Models: Mamba explores a different approach to linear-time sequence modeling. RetNet Retention State Case Study and Liquid Time-Constant Network Case Study offer other recurrent designs.',
      ],
    },
  ],
};
