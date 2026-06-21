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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/complex-valued-neural-networks.gif', alt: 'Animated walkthrough of the complex valued neural networks visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why This Topic Exists',
      paragraphs: [
        'Complex-valued neural networks exist because some data is naturally measured in amplitude and phase. Radar returns, MRI signals, wireless I/Q samples, Fourier spectra, optics, sonar, and many wave-based systems produce complex numbers before a model ever sees them. In those domains the imaginary part is not decoration. It records a phase relationship that can carry distance, frequency, orientation, interference, timing, or material information.',
        {type: 'callout', text: 'Complex-valued layers make phase-preserving rotation and scaling cheap when the data already lives in the complex plane.'},
        'A standard real-valued network can ingest complex data by splitting real and imaginary parts into two channels, or by discarding phase and keeping magnitude. Both choices can work, but both can make the model learn geometry that the input representation already had. Complex-valued networks try to keep that geometry native. A complex weight rotates and scales a feature. A complex activation can decide what to do with magnitude and phase. The topic is about using the right algebra for phase-sensitive structure, not about making a model more exotic.',
      ],
    },
    {
      heading: 'The Naive Approach',
      paragraphs: [
        'The naive approach is to treat a complex number as two unrelated real features. A real convolution can learn separate filters over the real and imaginary channels, and with enough data it may learn the coupling. The problem is that the coupling is not arbitrary. In complex arithmetic, the two parts form a magnitude and an angle. Rotating a phase-sensitive signal changes both coordinates together. A split-channel model can express that, but it has to rediscover the rule from examples.',
        'The even simpler approach is magnitude only. This often helps because magnitude is stable and easy to feed into ordinary networks. It also throws away phase. That loss may be harmless for some classification tasks and damaging for others. In speech, communications, radar, MRI, and transform-based vision, phase can encode alignment, delay, fine geometry, or interference. If the label depends on those relationships, a magnitude-only model may look clean while silently discarding the useful part of the measurement.',
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        'The core insight is that representation decides which patterns are easy. A complex number z = a + bi can also be described by magnitude and phase. Multiplication by another complex number rotates and scales z in the complex plane. That is exactly the kind of operation needed for phase shifts, frequency responses, and wave interactions. A complex layer does not merely double a real layer. It imposes a structured relationship between two coordinates.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/50/A_plus_bi.svg', alt: 'Complex number shown as a vector in the complex plane', caption: 'The complex plane makes the inductive bias visible: a feature carries both rectangular coordinates and geometric phase. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:A_plus_bi.svg.'},
        'This is an inductive bias. It says that phase-preserving transformations should be easy for the network to learn. A real-valued network can still approximate the same mapping, but it may need extra filters or more training data because it does not receive rotation as a built-in operation. Complex-valued networks are therefore most interesting when they reduce sample complexity, parameter count, or brittleness in domains where phase really matters.',
      ],
    },
    {
      heading: 'How The Layer Works',
      paragraphs: [
        'A true complex linear layer couples real and imaginary paths. If w = wr + wi*i and x = xr + xi*i, then wx has real part wr * xr - wi * xi and imaginary part wr * xi + wi * xr. The cross terms are the point. The real output depends on both input parts, and the imaginary output also depends on both input parts. That structure is what lets the layer learn rotations and phase interactions directly.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/71/Euler%27s_formula.svg', alt: 'Euler formula diagram on the unit circle in the complex plane', caption: 'Euler formula shows why phase is geometry: changing angle moves a point around the unit circle while preserving magnitude. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Euler%27s_formula.svg.'},
        'Complex convolution applies the same multiplication pattern across local windows. Complex recurrent layers can carry oscillatory state. Complex normalization has to handle covariance between real and imaginary parts, not just scale each channel independently. Activations require design choices. A split activation applies a real nonlinearity separately to each part. A magnitude-based activation changes amplitude while preserving or controlling phase. Methods such as modReLU are useful because ordinary ReLU is not naturally defined on the complex plane.',
      ],
    },
    {
      heading: 'What The Visual Is Proving',
      paragraphs: [
        'The first visual proves that real and imaginary entries should be read as one feature with two coordinates, not as two unrelated scalar columns. The magnitude and phase columns are the semantic view of the same numbers. When the vector plot shows multiplication moving a point, it is demonstrating rotation plus scaling. That movement is the geometric operation the architecture is trying to make cheap.',
        'The pipeline visual proves that complex networks are a full modeling stack, not a single changed matrix multiply. A useful model needs complex inputs, complex weights, a complex-aware linear or convolutional operation, normalization that stabilizes the coupled coordinates, an activation that makes sense for phase, and a readout suited to the task. The audit table proves the evaluation question: did the domain need phase-aware geometry, and was the real-valued baseline strong enough?',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'Complex networks work when the task rewards equivariance or sensitivity to phase-like transformations. In radio modulation, a phase shift changes the observed I/Q samples while preserving the underlying transmission. In MRI and radar, the measured field contains spatial and physical information in phase. In Fourier and wavelet features, phase can encode alignment and structure. Complex multiplication gives the model a direct way to represent these relationships.',
        'Hybrid systems show the same idea from another angle. A fixed Fourier, wavelet, or shearlet transform can expose complex features such as oriented edges, ridges, and frequency bands. A complex-valued network on top can learn from those features without forcing early real-valued layers to rediscover the transform. This can reduce the number of learned parameters or improve robustness, but only when the transform and the downstream task are aligned.',
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        'The cost starts with arithmetic. One complex multiply expands into several real multiplies and additions, so a complex layer can be slower or heavier than a same-shaped real layer. Hardware and libraries are also more mature for real-valued tensor kernels. Some frameworks support complex gradients, but many production paths still expect real tensors. That affects deployment, quantization, inference acceleration, and monitoring.',
        'The training cost is design complexity. Initialization must preserve variance in both magnitude and phase. Normalization must avoid distorting the complex geometry. Activations can damage phase if chosen carelessly. Optimizers operate through real and imaginary parameters, often using Wirtinger-style reasoning or framework conventions. A complex model that is harder to train and slower to run must earn its place by using fewer channels, converging faster, improving validation, or solving a task where real baselines struggle.',
      ],
    },
    {
      heading: 'Real Uses',
      paragraphs: [
        'Complex-valued networks are most useful in signal processing, speech and audio spectra, radar, sonar, MRI reconstruction, optics, holography, wireless communications, channel estimation, radio modulation recognition, and transform-based computer vision. They also appear in research on recurrent networks for oscillatory data and in models that operate after Fourier-like token mixing. The shared theme is not that every signal has two channels. The shared theme is that phase carries task-relevant information.',
        'A practical example is wireless I/Q classification. The receiver observes in-phase and quadrature samples. Treating them as arbitrary real channels ignores the rotational structure of modulation. A complex convolution can learn filters that rotate and scale the signal in a way that matches the physics. Another example is MRI, where phase and magnitude both arise from the measurement process. Dropping phase can simplify reconstruction, but it can also remove information that a careful model could use.',
      ],
    },
    {
      heading: 'Failure Modes And Limits',
      paragraphs: [
        'The main failure mode is using complex numbers where no meaningful phase exists. Then the architecture adds cost without useful bias. Another failure is comparing against a weak real baseline. A split real-imaginary CNN with enough channels, tuned normalization, and good augmentation may be competitive. A claim that complex wins is only persuasive when compute, parameter count, data, and tuning effort are fair.',
        'Complex-valued models can also fail through unstable training. Bad initialization can explode or collapse magnitudes. A poor activation can destroy phase relationships. Normalizing real and imaginary parts independently can remove the very covariance the model needs. Finally, complex values do not make a model interpretable by default. They encode different geometry, but they still require validation, ablation, calibration, and domain-specific error analysis.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Study complex numbers, Fourier transforms, convolution, and signal processing basics before treating CVNNs as ordinary deep-learning modules. Then study Deep Complex Networks for complex convolution, normalization, initialization, and activation design. Study CoShNet and related transform-first systems to see how fixed complex features can reduce learned front-end work. In this curriculum, connect the topic to Convolution, Activation Functions, Normalization, Gradient Flow, FNet Fourier Token Mixing Case Study, Embeddings & Similarity, and evaluation discipline for strong baselines.',
      ],
    },
  ],
};
