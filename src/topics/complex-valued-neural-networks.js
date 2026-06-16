// Complex-valued neural networks: preserve amplitude and phase when the data
// naturally lives in the complex plane.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'complex-valued-neural-networks',
  title: 'Complex-Valued Neural Networks',
  category: 'AI & ML',
  summary: 'Neural networks over real and imaginary components, where multiplication rotates and scales phase-sensitive signals instead of treating them as unrelated channels.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['complex layer mechanics', 'phase-aware signals'], defaultValue: 'complex layer mechanics' },
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

function complexPipeline(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'complex input', x: 0.8, y: 3.8, note: 'a + bi' },
      { id: 'weight', label: 'complex weight', x: 2.7, y: 2.4, note: 'rotate+scale' },
      { id: 'linear', label: 'linear mix', x: 4.8, y: 2.4, note: 'real/imag coupled' },
      { id: 'norm', label: 'complex norm', x: 4.8, y: 5.1, note: 'stabilize' },
      { id: 'act', label: 'activation', x: 6.8, y: 3.8, note: 'modReLU/split' },
      { id: 'readout', label: 'readout', x: 8.8, y: 3.8, note: 'task output' },
    ],
    edges: [
      { id: 'e-input-weight', from: 'input', to: 'weight', weight: '' },
      { id: 'e-weight-linear', from: 'weight', to: 'linear', weight: '' },
      { id: 'e-linear-norm', from: 'linear', to: 'norm', weight: '' },
      { id: 'e-norm-act', from: 'norm', to: 'act', weight: '' },
      { id: 'e-act-readout', from: 'act', to: 'readout', weight: '' },
    ],
  }, { title });
}

function* complexLayerMechanics() {
  yield {
    state: labelMatrix(
      'Magnitude and phase stay coupled',
      [
        { id: 'z1', label: 'z1' },
        { id: 'z2', label: 'z2' },
        { id: 'z3', label: 'z3' },
      ],
      [
        { id: 'real', label: 'real' },
        { id: 'imag', label: 'imag' },
        { id: 'mag', label: 'mag' },
        { id: 'phase', label: 'phase' },
      ],
      [
        ['0.80', '0.60', '1.00', '37 deg'],
        ['0.00', '1.00', '1.00', '90 deg'],
        ['-0.70', '0.70', '0.99', '135 deg'],
      ],
    ),
    highlight: { active: ['z1:real', 'z1:imag'], found: ['z1:mag', 'z1:phase'] },
    explanation: 'A complex feature is not merely two unrelated real channels. The real and imaginary parts jointly encode a magnitude and a phase angle, which matters for signals such as spectra, radar, MRI, and wave-like measurements.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'real axis', min: -1.4, max: 1.4 }, y: { label: 'imaginary axis', min: -1.4, max: 1.4 } },
      series: [
        { id: 'unit', label: 'unit circle samples', points: [
          { x: 1.0, y: 0.0 }, { x: 0.7, y: 0.7 }, { x: 0.0, y: 1.0 }, { x: -0.7, y: 0.7 },
          { x: -1.0, y: 0.0 }, { x: -0.7, y: -0.7 }, { x: 0.0, y: -1.0 }, { x: 0.7, y: -0.7 }, { x: 1.0, y: 0.0 },
        ] },
      ],
      markers: [
        { id: 'z', x: 0.8, y: 0.6, label: 'z' },
        { id: 'wz', x: -0.1, y: 1.2, label: 'wz' },
      ],
      vectors: [
        { id: 'zvec', from: { x: 0, y: 0 }, to: { x: 0.8, y: 0.6 }, label: 'input' },
        { id: 'wvec', from: { x: 0.8, y: 0.6 }, to: { x: -0.1, y: 1.2 }, label: 'rotate+scale' },
      ],
    }),
    highlight: { active: ['zvec', 'wvec'], found: ['wz'], compare: ['z'] },
    explanation: 'Multiplying by a complex weight rotates and scales the feature. That inductive bias is the reason complex layers can be natural for phase-sensitive data.',
    invariant: 'Complex multiplication preserves the geometry of rotation plus scaling.',
  };

  yield {
    state: labelMatrix(
      'A complex linear layer couples real and imaginary paths',
      [
        { id: 'realout', label: 'output real' },
        { id: 'imagout', label: 'output imag' },
      ],
      [
        { id: 'formula', label: 'formula' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['wr*xr - wi*xi', 'real path subtracts cross term'],
        ['wr*xi + wi*xr', 'imag path adds cross term'],
      ],
    ),
    highlight: { active: ['realout:formula', 'imagout:formula'] },
    explanation: 'A true complex layer is structured. The weight real part and imaginary part interact with both input parts, so the model can learn phase rotations instead of two independent real-valued filters.',
  };

  yield {
    state: complexPipeline('Deep complex networks need complex-aware building blocks'),
    highlight: { active: ['linear', 'norm', 'act'], found: ['readout'] },
    explanation: 'Deep complex models need matching components: complex convolution or linear layers, complex normalization, complex initialization, and activations that respect or deliberately reshape magnitude and phase.',
  };
}

function* phaseAwareSignals() {
  yield {
    state: labelMatrix(
      'Where phase is part of the data',
      [
        { id: 'audio', label: 'audio spectrum' },
        { id: 'mri', label: 'MRI / radar' },
        { id: 'wireless', label: 'wireless channel' },
        { id: 'shearlet', label: 'shearlet features' },
      ],
      [
        { id: 'complex part', label: 'complex part' },
        { id: 'risk if ignored', label: 'risk if ignored' },
      ],
      [
        ['Fourier bins', 'phase alignment lost'],
        ['measured wave field', 'geometry distorted'],
        ['I/Q samples', 'modulation confused'],
        ['oriented edges/ridges', 'orientation cue flattened'],
      ],
    ),
    highlight: { found: ['audio:complex part', 'mri:complex part', 'wireless:complex part', 'shearlet:complex part'] },
    explanation: 'Complex-valued networks are most compelling when the upstream measurement or transform is already complex. For those domains, phase is signal, not bookkeeping.',
  };

  yield {
    state: labelMatrix(
      'Three modeling choices',
      [
        { id: 'split', label: 'split real/imag' },
        { id: 'magnitude', label: 'magnitude only' },
        { id: 'complex', label: 'complex-valued' },
      ],
      [
        { id: 'what it does', label: 'what it does' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['use two real channels', 'easy but weak geometry'],
        ['drop phase', 'simple but information loss'],
        ['couple phase and magnitude', 'richer but harder to train'],
      ],
    ),
    highlight: { active: ['complex:what it does'], compare: ['split:tradeoff', 'magnitude:tradeoff'] },
    explanation: 'The choice is architectural. Sometimes two real channels are enough. Sometimes phase is exactly the structure the model needs to preserve.',
    invariant: 'Representation choice decides which symmetries are easy for the model to learn.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'image', label: 'image/signal', x: 0.8, y: 3.8, note: 'raw input' },
        { id: 'transform', label: 'fixed transform', x: 2.8, y: 3.8, note: 'Fourier/shearlet' },
        { id: 'complex', label: 'complex features', x: 4.8, y: 3.8, note: 'phase+mag' },
        { id: 'cvnn', label: 'complex net', x: 6.8, y: 3.8, note: 'learn task head' },
        { id: 'class', label: 'prediction', x: 8.8, y: 3.8, note: 'label/value' },
      ],
      edges: [
        { id: 'e-image-transform', from: 'image', to: 'transform', weight: '' },
        { id: 'e-transform-complex', from: 'transform', to: 'complex', weight: '' },
        { id: 'e-complex-cvnn', from: 'complex', to: 'cvnn', weight: '' },
        { id: 'e-cvnn-class', from: 'cvnn', to: 'class', weight: '' },
      ],
    }, { title: 'Hybrid complex pipelines can replace learned early convolutions' }),
    highlight: { active: ['transform', 'complex', 'cvnn'], found: ['class'] },
    explanation: 'CoShNet-style systems use a fixed complex transform to expose edges, ridges, and blobs, then train a smaller complex-valued network on top. The transform supplies structure the network would otherwise have to learn from scratch.',
  };

  yield {
    state: labelMatrix(
      'What to audit before trusting a CVNN win',
      [
        { id: 'domain', label: 'domain fit' },
        { id: 'baseline', label: 'real baseline' },
        { id: 'params', label: 'parameter budget' },
        { id: 'stability', label: 'training stability' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['is phase meaningful?', 'otherwise complexity is decorative'],
        ['was split-channel tuned?', 'avoid straw baselines'],
        ['same compute and data?', 'fair comparison'],
        ['normalization/init/activation?', 'complex training is fragile'],
      ],
    ),
    highlight: { found: ['domain:question', 'baseline:question', 'params:question', 'stability:question'] },
    explanation: 'Complex-valued networks are a strong idea in the right domain, but the evaluation has to prove the domain needs phase-aware geometry and that the real-valued baseline was not underbuilt.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'complex layer mechanics') yield* complexLayerMechanics();
  else if (view === 'phase-aware signals') yield* phaseAwareSignals();
  else throw new InputError('Pick a complex-valued network view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Complex-valued neural networks use complex numbers inside the model: activations, weights, or both can have real and imaginary parts. That sounds like a cosmetic change until the data itself has phase. Fourier spectra, MRI, radar, wireless I/Q samples, optics, and many wave-based measurements naturally produce complex-valued signals. In those settings, dropping phase or treating real and imaginary parts as unrelated channels can discard useful geometry.',
        'A complex number stores magnitude and phase. Multiplication by a complex weight rotates and scales a feature. That means a complex layer can express phase shifts and frequency relationships directly. A real-valued network can often approximate the same function, but it may need more parameters, more data, or a less natural representation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A true complex linear layer couples the two parts: output_real = weight_real * input_real - weight_imag * input_imag, and output_imag = weight_real * input_imag + weight_imag * input_real. The cross terms are the point. They make rotation and phase interaction first-class operations. Complex convolution applies the same idea spatially or across time, and complex recurrent layers can preserve oscillatory structure.',
        'The hard part is that the rest of the neural-network toolkit must also be adapted. Deep Complex Networks introduced complex convolution, complex batch normalization, complex initialization, and activation designs. Some activations split real and imaginary parts. Others operate on magnitude while preserving phase. Optimization often uses Wirtinger-style calculus or framework conventions that reduce complex gradients into real-imaginary updates.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Complex layers usually cost more than similarly shaped real layers because each complex multiply expands into several real operations. They also require careful initialization and normalization. The win must therefore come from representation efficiency: fewer channels, fewer learned early filters, faster convergence, or better robustness on phase-sensitive data. CoShNet is an example of a hybrid approach: a fixed complex shearlet transform exposes structured image features, then a smaller complex network does the classification.',
        'The evaluation should compare against strong real-valued baselines with the same data, compute, and tuning effort. A complex model beating a weak split-channel baseline does not prove much. A complex model that is smaller, faster, and more accurate on data where phase matters is a more serious result.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'CVNNs are most relevant in signal processing, speech and audio spectra, radio modulation, radar, sonar, MRI reconstruction, optics, holography, communications, and transform-based computer vision. They connect to Convolution because many complex models are complex CNNs. They connect to Embeddings & Similarity because the representation geometry changes. They connect to Normalization and Gradient Flow because complex training has its own stability issues.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not use complex numbers because they sound more advanced. If the task has no meaningful phase, a real-valued model may be simpler and better. Do not collapse complex data to magnitude without checking whether phase carries label information. Do not assume every deep-learning layer has a safe complex analogue; activations, normalization, and optimizers need explicit design. Finally, remember that complex-valued models are not magic explainability tools. They encode different geometry, but they still need ordinary validation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Deep Complex Networks at https://arxiv.org/abs/1705.09792, CoShNet at https://arxiv.org/abs/2208.06882, and Theory and Implementation of Complex-Valued Neural Networks at https://arxiv.org/abs/2302.08286. For broader context, see A Survey of Complex-Valued Neural Networks at https://arxiv.org/abs/2101.12249. Study Convolution, Activation Functions, Normalization, Gradient Flow, FNet Fourier Token Mixing Case Study, Embeddings & Similarity, and One-Pixel Attack Case Study next.',
      ],
    },
  ],
};
