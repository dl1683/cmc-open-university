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
  const exampleCount = 3;
  const properties = 4;
  const pipelineNodes = 6;
  const pipelineEdges = 5;
  const outputPaths = 2;

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
    explanation: `A complex feature is not merely two unrelated real channels. Across ${exampleCount} examples with ${properties} properties each, the real and imaginary parts jointly encode a magnitude and a phase angle, which matters for signals such as spectra, radar, MRI, and wave-like measurements.`,
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
    explanation: `Multiplying by a complex weight rotates and scales the feature — input z at (0.8, 0.6) moves to wz at (-0.1, 1.2). That inductive bias is the reason complex layers can be natural for phase-sensitive data.`,
    invariant: `Complex multiplication preserves the geometry of rotation plus scaling across all ${pipelineNodes} pipeline stages.`,
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
    explanation: `A true complex layer is structured. The ${outputPaths} output paths (real and imaginary) each combine both input parts through cross terms, so the model can learn phase rotations instead of two independent real-valued filters.`,
  };

  yield {
    state: complexPipeline('Deep complex networks need complex-aware building blocks'),
    highlight: { active: ['linear', 'norm', 'act'], found: ['readout'] },
    explanation: `Deep complex models need ${pipelineNodes} matching components across ${pipelineEdges} connections: complex convolution or linear layers, complex normalization, complex initialization, and activations that respect or deliberately reshape magnitude and phase.`,
  };
}

function* phaseAwareSignals() {
  const domainCount = 4;
  const modelingChoices = 3;
  const hybridStages = 5;
  const hybridEdges = 4;
  const auditChecks = 4;

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
    explanation: `Complex-valued networks are most compelling across ${domainCount} domains where the upstream measurement or transform is already complex. For those domains, phase is signal, not bookkeeping.`,
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
    explanation: `The choice is architectural across ${modelingChoices} options. Sometimes two real channels are enough. Sometimes phase is exactly the structure the model needs to preserve.`,
    invariant: `Representation choice among ${modelingChoices} alternatives decides which symmetries are easy for the model to learn.`,
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
    explanation: `CoShNet-style systems use a fixed complex transform across ${hybridStages} stages linked by ${hybridEdges} edges to expose edges, ridges, and blobs, then train a smaller complex-valued network on top. The transform supplies structure the network would otherwise have to learn from scratch.`,
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
    explanation: `Complex-valued networks are a strong idea in the right domain, but all ${auditChecks} audit checks must pass to prove the domain needs phase-aware geometry and that the real-valued baseline was not underbuilt.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The "complex layer mechanics" view starts with a matrix of three complex numbers showing their real, imaginary, magnitude, and phase components. Active cells highlight the real and imaginary parts; found cells highlight the magnitude and phase that they jointly encode. The second frame plots a complex input as a vector in the complex plane and shows how multiplication by a complex weight rotates and scales it. The third frame shows the cross-term formulas for a complex linear layer. The fourth frame shows the full pipeline of components a deep complex network requires.',
        {type: 'callout', text: 'Complex-valued layers make phase-preserving rotation and scaling cheap when the data already lives in the complex plane.'},
        'The "phase-aware signals" view shows four domains where complex numbers arise naturally, three modeling choices (split, magnitude-only, complex), a hybrid pipeline that uses a fixed complex transform followed by a learned complex network, and an audit checklist for evaluating complex-valued network claims.',
        'At each frame, ask: what does the highlighted structure encode, why does coupling real and imaginary parts matter here, and what would be lost by treating them as two independent channels.',
        {type: 'image', src: './assets/gifs/complex-valued-neural-networks.gif', alt: 'Animated walkthrough of the complex valued neural networks visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some measurements are naturally complex numbers. Radar returns, MRI signals, wireless I/Q samples, Fourier spectra, and sonar readings all produce values with both a real and an imaginary component before any model ever sees them. In these domains the imaginary part is not padding. It records a phase relationship that can carry distance, frequency, orientation, interference, or timing information.',
        'A standard real-valued neural network can process complex data by splitting real and imaginary parts into two separate channels or by discarding phase entirely and keeping only magnitude. Both choices can work. But both can force the model to learn geometric structure that the input representation already had. Complex-valued neural networks try to keep that geometry native so the model does not have to rediscover it from examples.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first obvious approach is to treat a complex number as two unrelated real features. Feed the real part into one channel and the imaginary part into another, then let ordinary real convolutions learn separate filters over each. With enough data the model may learn to couple them, but nothing in the architecture encourages it. The relationship between amplitude and angle must emerge from gradients alone.',
        'The second obvious approach is to discard phase and keep only magnitude. Magnitude is stable, always nonnegative, and easy to feed into ordinary networks. But it throws away half the information. In speech, communications, radar, MRI, and transform-based vision, phase encodes alignment, delay, fine geometry, and interference. A magnitude-only model may look clean while silently discarding the part of the measurement that distinguishes one class from another.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that the coupling between amplitude and phase is not arbitrary. In complex arithmetic, the two coordinates form a magnitude and an angle. Rotating a signal changes both coordinates together in a specific pattern. A split-channel model can express that pattern, but it has to discover it from data. If training examples are scarce or the rotation structure is the key discriminant, the model may converge slowly, overfit, or miss the pattern entirely.',
        'This is a representation problem, not a capacity problem. A wide enough real network can approximate any complex-valued function. The question is whether it will learn the right structure before overfitting or running out of data. The wall is the gap between what the architecture makes easy and what the task requires.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A complex number z = a + bi has a magnitude (how far from the origin) and a phase angle (which direction). Multiplying z by another complex number w rotates z by the angle of w and scales it by the magnitude of w. That single operation is exactly what is needed for phase shifts, frequency responses, and wave interactions.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/50/A_plus_bi.svg', alt: 'Complex number shown as a vector in the complex plane', caption: 'The complex plane makes the inductive bias visible: a feature carries both rectangular coordinates and geometric phase. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:A_plus_bi.svg.'},
        'A complex layer does not merely double a real layer. It imposes a structured relationship between its two coordinates. This is an inductive bias: phase-preserving transformations become cheap for the model to learn. A real network can approximate the same mapping, but it does not receive rotation as a built-in operation. Complex-valued networks are most interesting when they reduce sample complexity, parameter count, or brittleness in domains where phase genuinely matters.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A complex linear layer couples real and imaginary paths through cross terms. If the weight is w = wr + wi*i and the input is x = xr + xi*i, then the product wx has real part (wr * xr - wi * xi) and imaginary part (wr * xi + wi * xr). The real output depends on both input parts, and the imaginary output depends on both input parts. That cross-term structure is what lets the layer learn rotations directly.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/71/Euler%27s_formula.svg', alt: 'Euler formula diagram on the unit circle in the complex plane', caption: 'Euler formula shows why phase is geometry: changing angle moves a point around the unit circle while preserving magnitude. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Euler%27s_formula.svg.'},
        'A deep complex network needs matching components throughout: complex convolution or linear layers, complex normalization that handles covariance between real and imaginary parts, initialization that preserves variance in both magnitude and phase, and activations that respect or reshape magnitude and phase. Split activations apply a real nonlinearity to each part separately. Magnitude-based activations like modReLU change amplitude while controlling phase. Ordinary ReLU is not naturally defined on the complex plane.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Complex networks work when the task rewards sensitivity to phase-like transformations. In radio modulation, a phase shift changes the observed I/Q samples while preserving the underlying transmission. In MRI and radar, the measured field encodes spatial and physical information in phase. In Fourier and wavelet features, phase encodes alignment and structure. Complex multiplication gives the model a direct way to represent these relationships instead of learning them from scratch.',
        'Hybrid systems show the same idea from another angle. A fixed Fourier, wavelet, or shearlet transform exposes complex features such as oriented edges, ridges, and frequency bands. A complex-valued network on top learns from those features without forcing early layers to rediscover the transform. This can reduce learned parameters or improve robustness, but only when the transform and the downstream task are aligned.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'One complex multiply expands into four real multiplies and two additions. A complex layer is therefore roughly four times heavier than a same-shaped real layer in arithmetic. Hardware and libraries are more mature for real-valued tensor kernels. Some frameworks support complex gradients natively, but many production paths still expect real tensors, which affects deployment, quantization, and inference acceleration.',
        'The training cost is design complexity. Initialization must preserve variance in both magnitude and phase. Normalization must avoid distorting the complex geometry by treating real and imaginary parts independently. Activations can damage phase if chosen carelessly. Optimizers operate through real and imaginary parameters using Wirtinger calculus or framework conventions. A complex model that is harder to train and slower to run must earn its place by converging faster, using fewer channels, or solving a task where real baselines struggle.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Complex-valued networks appear in wireless I/Q classification, radar target recognition, MRI reconstruction, sonar signal processing, speech and audio spectra, optics, holography, channel estimation, radio modulation recognition, and transform-based computer vision. The shared theme is that phase carries task-relevant information, not merely that the signal has two channels.',
        'A concrete example is wireless modulation recognition. The receiver observes in-phase and quadrature samples. Treating them as two arbitrary real channels ignores the rotational structure of modulation. A complex convolution learns filters that rotate and scale the signal in a way that matches the physics. Another example is MRI, where phase and magnitude both arise from the measurement process. Discarding phase simplifies reconstruction but can remove information that a model could use for sharper images.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The main failure mode is using complex numbers where no meaningful phase exists. If the data has no geometric coupling between its two coordinates, the architecture adds cost without useful bias. Image pixels, tabular features, and text embeddings are not naturally complex. Forcing them into complex form is adding structure that the problem does not have.',
        'Comparison against weak baselines is a common trap. A split real-imaginary CNN with enough channels, proper normalization, and good augmentation may match a complex network. A claim that complex wins is only persuasive when compute, parameter count, data, and tuning effort are held fair. Unstable training is another risk: bad initialization can explode magnitudes, a poor activation can destroy phase, and normalizing real and imaginary parts independently can remove the covariance the model needs.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the input feature is z = 0.8 + 0.6i. Its magnitude is sqrt(0.64 + 0.36) = 1.0, and its phase angle is arctan(0.6 / 0.8) = 36.87 degrees. Now multiply by a complex weight w = 0.5 + 0.866i, which has magnitude 1.0 and phase 60 degrees.',
        'The real part of wz is (0.5)(0.8) - (0.866)(0.6) = 0.4 - 0.52 = -0.12. The imaginary part is (0.5)(0.6) + (0.866)(0.8) = 0.3 + 0.693 = 0.993. The output is approximately -0.12 + 0.99i. Its magnitude is sqrt(0.0144 + 0.9801) = 0.998, still about 1.0. Its phase is about 96.9 degrees, which is 36.87 + 60 = 96.87 degrees within rounding. The weight rotated the input by 60 degrees and preserved its magnitude.',
        'A real-valued layer processing [0.8, 0.6] as two independent channels would need to learn this rotation pattern from data. A complex layer performs it by construction. In a domain where phase shifts are the signal, that built-in operation saves the model from spending capacity rediscovering basic geometry.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Trabelsi et al., "Deep Complex Networks" (2018, ICLR), defines complex convolution, batch normalization, weight initialization, and activation functions for deep complex architectures. Singh et al., "CoShNet: A Hybird Complex Valued Neural Network using Shearlets" (2020), shows hybrid pipelines using fixed complex transforms. Bassey et al., "A Survey of Complex-Valued Neural Networks" (2021), provides a broad overview with domain-specific results.',
        'Study complex numbers and Fourier transforms before treating complex-valued networks as ordinary deep-learning modules. In this curriculum, connect to Convolution, Activation Functions, Normalization, Gradient Flow, FNet Fourier Token Mixing, and Embeddings & Similarity.',
      ],
    },
  ],
};
