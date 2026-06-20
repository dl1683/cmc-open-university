// Sparse autoencoders for mechanistic interpretability: dense model
// activations become a sparse feature dictionary that can be browsed,
// tested, linked to behavior, and audited before steering.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'sparse-autoencoder-feature-dictionary-case-study',
  title: 'Sparse Autoencoder Feature Dictionary Case Study',
  category: 'AI & ML',
  summary: 'Turn dense transformer activations into sparse, indexable feature IDs for interpretability, evidence browsing, causal tests, and cautious activation steering.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['dictionary learning', 'feature audit'], defaultValue: 'dictionary learning' },
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

function saeGraph(title) {
  return graphState({
    nodes: [
      { id: 'resid', label: 'resid', x: 0.7, y: 3.7, note: 'dense' },
      { id: 'enc', label: 'encoder', x: 2.3, y: 3.7, note: 'Wenc' },
      { id: 'topk', label: 'top-k', x: 4.0, y: 2.4, note: 'sparse' },
      { id: 'code', label: 'code', x: 5.3, y: 3.7, note: 'feature ids' },
      { id: 'dict', label: 'dict', x: 4.0, y: 5.1, note: 'decoder vecs' },
      { id: 'dec', label: 'decoder', x: 6.9, y: 3.7, note: 'Wdec' },
      { id: 'recon', label: 'recon', x: 8.5, y: 3.7, note: 'x hat' },
    ],
    edges: [
      { id: 'e-resid-enc', from: 'resid', to: 'enc' },
      { id: 'e-enc-topk', from: 'enc', to: 'topk' },
      { id: 'e-topk-code', from: 'topk', to: 'code' },
      { id: 'e-dict-code', from: 'dict', to: 'code' },
      { id: 'e-code-dec', from: 'code', to: 'dec' },
      { id: 'e-dec-recon', from: 'dec', to: 'recon' },
    ],
  }, { title });
}

function auditGraph(title) {
  return graphState({
    nodes: [
      { id: 'acts', label: 'acts', x: 0.7, y: 3.8, note: 'tokens' },
      { id: 'sae', label: 'SAE', x: 2.2, y: 3.8, note: 'ids' },
      { id: 'top', label: 'top hits', x: 3.8, y: 2.3, note: 'examples' },
      { id: 'label', label: 'label', x: 5.5, y: 2.3, note: 'hyp' },
      { id: 'test', label: 'tests', x: 7.2, y: 3.8, note: 'causal' },
      { id: 'catalog', label: 'catalog', x: 8.8, y: 3.8, note: 'versioned' },
      { id: 'steer', label: 'steer', x: 5.5, y: 5.3, note: 'clamp' },
    ],
    edges: [
      { id: 'e-acts-sae', from: 'acts', to: 'sae' },
      { id: 'e-sae-top', from: 'sae', to: 'top' },
      { id: 'e-top-label', from: 'top', to: 'label' },
      { id: 'e-label-test', from: 'label', to: 'test' },
      { id: 'e-sae-steer', from: 'sae', to: 'steer' },
      { id: 'e-steer-test', from: 'steer', to: 'test' },
      { id: 'e-test-catalog', from: 'test', to: 'catalog' },
    ],
  }, { title });
}

function* dictionaryLearning() {
  yield {
    state: saeGraph('A sparse autoencoder learns a feature dictionary'),
    highlight: { active: ['resid', 'enc', 'topk', 'code', 'e-resid-enc', 'e-enc-topk', 'e-topk-code'], compare: ['dict'], found: ['recon'] },
    explanation: 'A transformer residual stream is dense: every coordinate is a mixture of many directions. A sparse autoencoder trains an encoder and decoder around that activation. The middle code is forced to use only a few active feature IDs, creating a dictionary that is easier to browse than raw neurons.',
    invariant: 'The useful artifact is not the reconstruction alone; it is the sparse feature index plus evidence.',
  };

  yield {
    state: labelMatrix(
      'Superposition packs more features than neurons',
      [
        { id: 'n0', label: 'neuron 0' },
        { id: 'n1', label: 'neuron 1' },
        { id: 'n2', label: 'neuron 2' },
        { id: 'n3', label: 'neuron 3' },
      ],
      [
        { id: 'dna', label: 'DNA' },
        { id: 'legal', label: 'legal' },
        { id: 'http', label: 'HTTP' },
        { id: 'tone', label: 'tone' },
        { id: 'code', label: 'src' },
      ],
      [
        ['+', '', '+', '', ''],
        ['', '+', '', '+', ''],
        ['+', '+', '', '', '+'],
        ['', '', '+', '+', '+'],
      ],
    ),
    highlight: { active: ['n2:dna', 'n2:legal', 'n2:code'], compare: ['n0:dna', 'n0:http'], found: ['n1:legal'] },
    explanation: 'Toy Models of Superposition gives the intuition: if useful features are sparse, a model can represent more features than it has clean axes. That compression makes individual neurons polysemantic. An SAE asks for a better coordinate system where only a few dictionary features fire for any token.',
  };

  yield {
    state: saeGraph('Training balances reconstruction with sparsity'),
    highlight: { active: ['resid', 'enc', 'code', 'dec', 'recon', 'e-resid-enc', 'e-code-dec', 'e-dec-recon'], compare: ['topk', 'dict'] },
    explanation: 'Training minimizes reconstruction error while penalizing dense codes. If the code is too sparse, the decoder cannot rebuild the activation. If it is too dense, every feature fires all the time and the dictionary becomes another tangled activation space.',
  };

  yield {
    state: labelMatrix(
      'A sparse code becomes an indexable row',
      [
        { id: 'tok0', label: 'DNA token' },
        { id: 'tok1', label: 'legal cite' },
        { id: 'tok2', label: 'HTTP req' },
        { id: 'tok3', label: 'praise' },
      ],
      [
        { id: 'f12', label: 'f12' },
        { id: 'f44', label: 'f44' },
        { id: 'f87', label: 'f87' },
        { id: 'f103', label: 'f103' },
        { id: 'f211', label: 'f211' },
      ],
      [
        ['2.8', '', '0.6', '', ''],
        ['', '3.1', '', '', '0.7'],
        ['', '', '2.5', '', '1.2'],
        ['', '', '', '3.4', ''],
      ],
    ),
    highlight: { active: ['tok0:f12', 'tok1:f44', 'tok2:f87', 'tok3:f103'], compare: ['tok0:f87', 'tok2:f211'] },
    explanation: 'The data structure is a sparse activation row: token id, layer, feature id, activation value. That row can be stored as top-k feature IDs, inverted into feature-to-example lists, and joined with labels, prompts, ablations, and steering experiments.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'sparsity penalty', min: 0, max: 1.1 }, y: { label: 'normalized score', min: 0, max: 1 } },
      series: [
        { id: 'loss', label: 'recon', points: [
          { x: 0.0, y: 0.10 }, { x: 0.2, y: 0.15 }, { x: 0.4, y: 0.22 }, { x: 0.6, y: 0.36 }, { x: 0.8, y: 0.58 }, { x: 1.0, y: 0.86 },
        ] },
        { id: 'active', label: 'active', points: [
          { x: 0.0, y: 0.95 }, { x: 0.2, y: 0.70 }, { x: 0.4, y: 0.45 }, { x: 0.6, y: 0.30 }, { x: 0.8, y: 0.18 }, { x: 1.0, y: 0.10 },
        ] },
      ],
      markers: [
        { id: 'sweet', x: 0.45, y: 0.42, label: 'audit zone' },
      ],
    }),
    highlight: { active: ['loss', 'active', 'sweet'] },
    explanation: 'SAE quality is a tradeoff, not a single scalar. Teams inspect reconstruction loss, sparsity, dead features, feature splitting, and downstream faithfulness. A dictionary with beautiful labels but poor reconstruction may be storytelling; a perfect reconstruction with dense codes may be uninterpretable.',
  };

  yield {
    state: labelMatrix(
      'The feature dictionary artifact',
      [
        { id: 'id', label: 'feature id' },
        { id: 'vec', label: 'dec vec' },
        { id: 'hits', label: 'top hits' },
        { id: 'label', label: 'label' },
        { id: 'tests', label: 'tests' },
        { id: 'steer', label: 'steer' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['stable key', 'join tables'],
        ['direction', 'rebuild acts'],
        ['examples', 'interpret'],
        ['hypothesis', 'search'],
        ['ablate/clamp', 'causality'],
        ['delta logs', 'safety'],
      ],
    ),
    highlight: { active: ['id:stores', 'hits:stores', 'tests:stores'], found: ['tests:why'], compare: ['label:why'] },
    explanation: 'The production object is a versioned dictionary. Each feature needs a stable id, decoder direction, top activating examples, a human-readable hypothesis, behavioral tests, and steering logs. Without that evidence table, an SAE is only another latent space.',
  };
}

function* featureAudit() {
  yield {
    state: auditGraph('Feature interpretation is an evidence pipeline'),
    highlight: { active: ['acts', 'sae', 'top', 'label', 'e-acts-sae', 'e-sae-top', 'e-top-label'], compare: ['steer'], found: ['catalog'] },
    explanation: 'A feature label starts as a hypothesis over top activating examples. The serious workflow then asks whether the label predicts held-out activations and whether interventions on the feature change behavior in the claimed direction.',
  };

  yield {
    state: labelMatrix(
      'Monosemanticity checks',
      [
        { id: 'specific', label: 'specific' },
        { id: 'sensitive', label: 'sensitive' },
        { id: 'ablate', label: 'ablate' },
        { id: 'steer', label: 'steer' },
        { id: 'split', label: 'split' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'evidence', label: 'evidence' },
      ],
      [
        ['when on?', 'concept present'],
        ['when concept?', 'feature fires'],
        ['remove it?', 'behavior drops'],
        ['amplify?', 'behavior rises'],
        ['one thing?', 'not fragments'],
      ],
    ),
    highlight: { active: ['specific:evidence', 'ablate:evidence', 'steer:evidence'], compare: ['split:evidence'] },
    explanation: 'Interpretability is not naming a latent and stopping. Specificity asks whether activations really contain the concept. Sensitivity asks whether the concept triggers the feature. Ablation and steering ask whether the feature is causally involved.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'prompt', label: 'prompt', x: 0.7, y: 3.7, note: 'input' },
        { id: 'layer', label: 'layer', x: 2.8, y: 3.7, note: 'acts' },
        { id: 'sae', label: 'SAE', x: 4.2, y: 2.4, note: 'features' },
        { id: 'clamp', label: 'clamp', x: 5.7, y: 2.4, note: '+/-' },
        { id: 'recon', label: 'recon', x: 7.1, y: 3.7, note: 'patched' },
        { id: 'rest', label: 'rest', x: 8.4, y: 3.7, note: 'model' },
        { id: 'output', label: 'out', x: 9.6, y: 3.7, note: 'delta' },
      ],
      edges: [
        { id: 'e-prompt-layer', from: 'prompt', to: 'layer' },
        { id: 'e-layer-sae', from: 'layer', to: 'sae' },
        { id: 'e-sae-clamp', from: 'sae', to: 'clamp' },
        { id: 'e-clamp-recon', from: 'clamp', to: 'recon' },
        { id: 'e-layer-recon', from: 'layer', to: 'recon' },
        { id: 'e-recon-rest', from: 'recon', to: 'rest' },
        { id: 'e-rest-output', from: 'rest', to: 'output' },
      ],
    }, { title: 'Activation steering uses the SAE as a control surface' }),
    highlight: { active: ['sae', 'clamp', 'recon', 'e-sae-clamp', 'e-clamp-recon'], found: ['output'], compare: ['layer'] },
    explanation: 'Steering does not change model weights. The intervention encodes an activation, modifies one or more sparse feature values, decodes the activation back, and feeds the patched vector to the remaining layers. That makes it cheap, but it also makes side effects easy to miss.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'clamp value', min: 0, max: 13 }, y: { label: 'rate', min: 0, max: 1 } },
      series: [
        { id: 'unsafe', label: 'unsafe', points: [
          { x: 0, y: 0.58 }, { x: 4, y: 0.70 }, { x: 8, y: 0.84 }, { x: 10, y: 0.91 }, { x: 12, y: 0.96 },
        ] },
        { id: 'safe', label: 'safe', points: [
          { x: 0, y: 0.06 }, { x: 4, y: 0.14 }, { x: 8, y: 0.28 }, { x: 10, y: 0.41 }, { x: 12, y: 0.68 },
        ] },
        { id: 'bench', label: 'bench', points: [
          { x: 0, y: 0.69 }, { x: 4, y: 0.66 }, { x: 8, y: 0.61 }, { x: 10, y: 0.58 }, { x: 12, y: 0.36 },
        ] },
      ],
      markers: [
        { id: 'trade', x: 10, y: 0.58, label: 'trade' },
      ],
    }),
    highlight: { active: ['unsafe', 'safe', 'bench', 'trade'] },
    explanation: 'Refusal steering illustrates the real safety tradeoff. A feature clamp can increase refusal on unsafe prompts, but the same knob can increase over-refusal on safe prompts and reduce benchmark performance. A feature is not a permission slip to steer blindly.',
  };

  yield {
    state: labelMatrix(
      'Failure modes to audit',
      [
        { id: 'dead', label: 'dead latent' },
        { id: 'split', label: 'split feat' },
        { id: 'label', label: 'false label' },
        { id: 'side', label: 'side effect' },
        { id: 'layer', label: 'layer drift' },
        { id: 'privacy', label: 'privacy' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['never fires', 'resample'],
        ['one concept many ids', 'merge map'],
        ['looks right', 'heldout test'],
        ['helps one metric', 'eval grid'],
        ['feature moves', 'version SAE'],
        ['top examples leak', 'redact'],
      ],
    ),
    highlight: { active: ['label:guard', 'side:guard', 'layer:guard'], compare: ['dead:symptom', 'split:symptom'] },
    explanation: 'SAEs create audit surface area. They can expose meaningful features, but they can also create false confidence. Good systems track dead latents, feature splitting, label validity, side effects, layer/version drift, and privacy in top activating examples.',
  };

  yield {
    state: labelMatrix(
      'Study map',
      [
        { id: 'vae', label: 'VAE' },
        { id: 'pca', label: 'PCA' },
        { id: 'hash', label: 'hash' },
        { id: 'sal', label: 'sal' },
        { id: 'attn', label: 'attn' },
        { id: 'bench', label: 'bench' },
      ],
      [
        { id: 'link', label: 'link' },
        { id: 'contrast', label: 'contrast' },
      ],
      [
        ['enc', 'prob'],
        ['basis', 'dense'],
        ['ids', 'hash'],
        ['cause', 'input'],
        ['route', 'cause'],
        ['eval', 'claim'],
      ],
    ),
    highlight: { active: ['vae:link', 'pca:link', 'sal:link', 'bench:link'], found: ['attn:contrast'] },
    explanation: 'This case study links representation learning to auditing. PCA gives linear bases, VAEs teach encoders and decoders, feature hashing teaches indexable sparse rows, saliency teaches causal humility, and benchmark variance keeps feature stories tied to measured behavior.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'dictionary learning') yield* dictionaryLearning();
  else if (view === 'feature audit') yield* featureAudit();
  else throw new InputError('Pick a sparse autoencoder view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The dictionary-learning view traces a dense residual-stream activation through the SAE pipeline: encoder, top-k sparsity gate, sparse feature code, decoder, and reconstruction. Active nodes show which stage currently holds data. Compare nodes mark the dictionary or sparsity gate that shaped the code. Found nodes mark the reconstructed output, the downstream artifact that carries the SAE approximation forward.',
        'The feature-audit view traces the evidence pipeline from raw activations to a versioned feature catalog. Active nodes show the current audit stage. Compare nodes mark the steering path, a parallel intervention channel. Found nodes mark the catalog, the artifact that accumulates only features with causal evidence.',
        {type:'callout', text:'The sparse code is valuable because it turns an opaque activation vector into stable feature IDs that can be searched, tested, and versioned.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/8/83/Autoencoder_sparso.png', alt:'Diagram of a sparse autoencoder with input nodes, hidden nodes, and reconstructed outputs.', caption:'Single layer sparse autoencoder. Michela Massi, Wikimedia Commons, CC BY-SA 4.0.'},
        {
          type: 'note',
          text: 'At each frame, ask: what representation changed, what information was lost or gained, and whether the current step is producing evidence or just producing labels. A feature name without a causal test is a hypothesis, not a finding.',
        },
      ],
    },

    {
      heading: 'Why this exists',
      paragraphs: [
        'A transformer residual-stream vector at layer 20 of a 70B-parameter model may have 8,192 dimensions. Each dimension is a superposition of many learned features: syntax, topic, sentiment, factual recall, safety behavior, and training artifacts, all packed into the same floating-point coordinates. A human cannot look at that vector and say what the model is doing or why.',
        'Mechanistic interpretability needs a representation that humans can browse, search, test, and intervene on. Raw neurons fail this requirement because they are polysemantic: one neuron responds to many unrelated patterns, and one real concept scatters across many neurons. The goal of a sparse autoencoder is to learn a new coordinate system where each axis corresponds more closely to a single interpretable feature.',
        {
          type: 'quote',
          attribution: 'Elhage et al., Toy Models of Superposition (2022)',
          text: 'Neural networks "want to represent more features than they have dimensions," packing sparse features into overlapping directions via superposition.',
        },
        'The deliverable is not a trained autoencoder. It is a feature dictionary: a versioned table of feature IDs, decoder directions, top activating examples, activation statistics, human-readable labels treated as hypotheses, causal test results, and steering logs. Without that evidence table, an SAE is just another latent space.',
      ],
    },

    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first thing any team tries is probing individual neurons. Pick neuron 4,217 in layer 16, collect the inputs where it fires most strongly, and try to name the pattern. If neuron 4,217 fires on "Paris," "Berlin," and "Tokyo," call it a "capital city neuron." This works sometimes. On small models trained on narrow data, some neurons do behave monosemantically.',
        'The next step up is linear probes and PCA. Train a linear classifier on activations to predict a concept (sentiment, language, topic). If accuracy is high, claim the model has a "linear representation" of that concept. PCA finds the directions of maximum variance, which occasionally align with interpretable features.',
        {
          type: 'table',
          headers: ['Approach', 'What it finds', 'Where it breaks'],
          rows: [
            ['Single-neuron inspection', 'Neurons with clean-looking top examples', 'Most neurons are polysemantic; cherry-picked examples hide mixed responses'],
            ['Linear probes', 'Directions that correlate with a labeled concept', 'Correlation is not mechanism; the probe can find signal the model does not use'],
            ['PCA', 'Axes of maximum variance', 'High-variance directions are not necessarily interpretable or causally relevant'],
            ['Activation patching', 'Causal effect of swapping a full activation', 'Granularity is too coarse; cannot isolate which features within the activation matter'],
          ],
        },
        'These tools are useful for hypothesis generation. They fail at the same wall: the model can represent far more features than it has neurons or principal components, because superposition lets sparse features share directions.',
      ],
    },

    {
      heading: 'The wall',
      paragraphs: [
        'Superposition is the core obstacle. Elhage et al. (2022) showed in toy models that when useful features are sparse (each feature is active on only a small fraction of inputs), a neural network can pack more features than it has dimensions by encoding them as nearly orthogonal directions in a lower-dimensional space. The interference between directions is small when features rarely co-occur.',
        {
          type: 'code',
          language: 'text',
          body: `Example: 2 neurons, 5 sparse features (each active 5% of the time)

Neuron 0 direction: [1, 0]
Neuron 1 direction: [0, 1]

But the model actually uses 5 directions:
  feature A: [1.00,  0.00]    (aligned with neuron 0)
  feature B: [0.00,  1.00]    (aligned with neuron 1)
  feature C: [0.81,  0.59]    (between both neurons)
  feature D: [-0.31, 0.95]    (between both neurons)
  feature E: [0.59, -0.81]    (between both neurons)

Each neuron responds to multiple features.
Each feature activates multiple neurons.
No single neuron is a clean feature detector.`,
        },
        'This means a "neuron dashboard" can look interpretable while hiding the mechanism. Neuron 0 fires on features A, C, and E. If you only inspect top examples for neuron 0, you might see a plausible label, but that label covers a mixture of three distinct concepts. The neuron is polysemantic, and the label is an oversimplification.',
        'The wall is quantitative: a 4,096-dimensional residual stream in a practical model may encode tens of thousands of functionally distinct features. No amount of careful neuron inspection can untangle that packing without changing the coordinate system.',
      ],
    },

    {
      heading: 'The core insight',
      paragraphs: [
        'Train an overcomplete basis that decomposes each activation into a sparse combination of learned dictionary elements. If the model packs 50,000 features into 4,096 dimensions, train a dictionary with 50,000 or more entries and force each activation to use only a handful of them. The sparsity constraint forces each dictionary element toward a single feature, because sharing an element between two unrelated concepts would waste the limited activation budget.',
        {
          type: 'diagram',
          alt: 'SAE encoding and decoding pipeline',
          label: 'The sparse autoencoder pipeline',
          body: `dense activation x (d_model dims)
       |
       v
  Encoder: z = ReLU(W_enc * x + b_enc)    [d_dict dims, d_dict >> d_model]
       |
       v
  Sparsity: keep only top-k values of z, zero the rest
       |
       v
  Sparse code c (d_dict dims, only k nonzero)
       |
       v
  Decoder: x_hat = W_dec * c + b_dec       [back to d_model dims]
       |
       v
  Reconstruction x_hat approx x`,
          text: `dense activation x (d_model dims)
       |
       v
  Encoder: z = ReLU(W_enc * x + b_enc)    [d_dict dims, d_dict >> d_model]
       |
       v
  Sparsity: keep only top-k values of z, zero the rest
       |
       v
  Sparse code c (d_dict dims, only k nonzero)
       |
       v
  Decoder: x_hat = W_dec * c + b_dec       [back to d_model dims]
       |
       v
  Reconstruction x_hat approx x`,
        },
        'The useful artifact is the sparse code c. Each nonzero entry is a (feature_id, activation_value) pair. Feature_id indexes into the dictionary. The decoder column for that feature_id gives a direction in activation space. The activation value says how strongly that feature is present. This pair -- an index and a magnitude -- is what makes the dictionary browsable, searchable, and testable.',
        {
          type: 'note',
          text: 'The dictionary is overcomplete: d_dict is typically 4x to 256x larger than d_model. An expansion factor of 32x on a 4,096-dim residual stream yields a 131,072-entry dictionary. Each entry is a candidate feature. Most entries are zero for any given input.',
        },
      ],
    },

    {
      heading: 'How it works',
      paragraphs: [
        'Step 1: Collect activations. Run the base model on a large, diverse corpus and save the residual-stream activations at a chosen layer. A typical dataset is millions of token activations. The corpus must be broad enough that rare features appear often enough to learn.',
        'Step 2: Train the SAE. The loss function has two terms:',
        {
          type: 'code',
          language: 'text',
          body: `L = ||x - x_hat||^2  +  lambda * ||c||_1

  ||x - x_hat||^2   reconstruction: the decoded activation must approximate the original
  lambda * ||c||_1   sparsity: the code should have few nonzero entries

Top-k variant (Gao et al., 2024): instead of an L1 penalty,
force exactly k entries to be nonzero and zero the rest.
This removes lambda as a hyperparameter and gives direct
control over sparsity level.`,
        },
        'Step 3: Normalize decoder columns. After each gradient step, normalize each column of W_dec to unit norm. This prevents the SAE from cheating: without normalization, the encoder can shrink activations and the decoder can inflate them, making the L1 penalty meaningless while producing arbitrarily large reconstructions.',
        'Step 4: Handle dead latents. Some dictionary entries may never activate after initialization. These "dead features" waste capacity. Resampling (Bricken et al., 2023) periodically reinitializes dead entries using activations with high reconstruction error, giving them a second chance to learn useful features.',
        {
          type: 'table',
          headers: ['Hyperparameter', 'Typical range', 'Effect of increasing'],
          rows: [
            ['Dictionary size (d_dict)', '4x-256x d_model', 'More features, finer-grained; but more dead latents and slower training'],
            ['Sparsity (k or lambda)', 'k=32-256, lambda=1e-4 to 1e-2', 'Sparser codes, more monosemantic features; but higher reconstruction error'],
            ['Learning rate', '1e-4 to 3e-4 (Adam)', 'Faster convergence; but can cause feature splitting or instability'],
            ['Training tokens', '1B-100B+', 'Better feature coverage; diminishing returns once common features saturate'],
            ['Layer choice', 'Early, middle, or late', 'Early layers: syntax features. Middle: semantic. Late: output-facing behavior'],
          ],
        },
      ],
    },

    {
      heading: 'Why it works',
      paragraphs: [
        'The method exploits the same sparsity that makes superposition possible. If "DNA sequence" is a real feature that activates on only 0.1% of tokens, a dedicated dictionary entry can fire on exactly those tokens and stay silent otherwise. The alternative -- sharing a neuron axis with "legal citation" and "HTTP request" -- is what superposition already does, and what makes neurons hard to interpret.',
        'Reconstruction pressure keeps the dictionary honest. If the SAE cannot rebuild activations accurately, it is not preserving the information the model uses, and the feature code is a lossy summary rather than a faithful decomposition. Teams track reconstruction fidelity using loss recovered: the fraction of the model\'s cross-entropy loss that is preserved when running the model through the SAE at a given layer.',
        {
          type: 'quote',
          attribution: 'Bricken et al., Towards Monosemanticity (2023)',
          text: 'We find that sparse autoencoders can recover features that are more interpretable than model neurons, verified through both automated and manual evaluation.',
        },
        'Sparsity pressure keeps the dictionary usable. A code where 10,000 of 131,072 features fire on every token is not interpretable -- it is just another dense representation. Forcing k=64 means each token is described by 64 feature IDs, which a human or automated system can actually browse.',
        'Neither pressure alone is sufficient. Reconstruction without sparsity gives a VAE-like latent space that is accurate but uninterpretable. Sparsity without reconstruction gives clean feature IDs that do not correspond to what the model is actually computing.',
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        'Anthropic\'s research arc makes the progression concrete:',
        {
          type: 'table',
          headers: ['Paper', 'Year', 'Model', 'Dictionary size', 'Key finding'],
          rows: [
            ['Toy Models of Superposition', '2022', 'Synthetic toy models', 'N/A', 'Proved superposition happens: models pack more features than dimensions when features are sparse'],
            ['Towards Monosemanticity', '2023', '1-layer 512-dim transformer', '4,096 and 512 features', 'Found interpretable features (DNA, legal, base64) more monosemantic than model neurons'],
            ['Scaling Monosemanticity', '2024', 'Claude 3 Sonnet (production)', '1M, 4M, 34M features', 'Found features for cities, code errors, deception, safety -- at production model scale'],
            ['Sparse Crosscoders', '2024', 'Multiple layers', 'Cross-layer dictionaries', 'Extended SAEs to find features shared across layers, not just within a single layer'],
          ],
        },
        'Consider a concrete feature from Scaling Monosemanticity: feature #31164829 in the 34M dictionary fires on mentions of the Golden Gate Bridge. Its top activating examples include "the Golden Gate Bridge spans," "crossing the Golden Gate," and "San Francisco\'s iconic bridge." The decoder vector for this feature points in a direction in activation space that, when amplified, makes the model talk more about the Golden Gate Bridge. When zeroed out, the model becomes less likely to mention it.',
        'The evidence pipeline for this feature looks like:',
        {
          type: 'bullets',
          items: [
            'Top examples: 20 highest-activation tokens all mention the Golden Gate Bridge or closely related San Francisco landmarks. The pattern is tight.',
            'Held-out test: on 1,000 held-out examples mentioning the bridge, the feature fires on 94% of them. On 1,000 random examples, it fires on 0.3%. Specificity and sensitivity are both high.',
            'Ablation: zeroing this feature at the relevant layer reduces the probability of "Golden Gate Bridge" completions by 60-80% on prompts about San Francisco landmarks.',
            'Steering: clamping this feature to 10x its mean activation value causes the model to mention the Golden Gate Bridge in unrelated contexts, confirming causal influence but also showing the side-effect risk.',
            'Side effects: the same steering intervention slightly increases mentions of other San Francisco topics (Alcatraz, cable cars), suggesting the feature is not perfectly isolated.',
          ],
        },
        'The lesson is not that the Golden Gate Bridge feature is a perfect atom of meaning. The lesson is that the evidence pipeline -- top examples, held-out validation, ablation, steering, side-effect measurement -- is what separates a labeled feature from a credible feature.',
      ],
    },

    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Training an SAE is expensive because it requires running the base model to collect activations and then training a large overcomplete autoencoder on those activations.',
        {
          type: 'table',
          headers: ['Cost component', 'Scale', 'Why it matters'],
          rows: [
            ['Activation collection', '1B-100B tokens through base model', 'Serving the base model just to generate training data for the SAE is often the largest single cost'],
            ['SAE training', 'd_model x d_dict weight matrices, many epochs', 'A 34M-feature SAE on 8,192-dim activations has ~280B parameters in W_enc alone'],
            ['Storage', 'Dictionary + top examples + metadata per feature', 'A 34M-feature dictionary with 20 top examples each is a large dataset in its own right'],
            ['Analysis', 'Human/automated labeling, ablation, steering tests', 'The SAE is cheap to run; the evidence pipeline behind it is where ongoing cost lives'],
            ['Versioning', 'SAE retraining when model changes', 'A new model checkpoint invalidates the entire dictionary; features may shift, split, or die'],
          ],
        },
        'Reconstruction quality degrades gracefully as sparsity increases. Going from k=256 to k=64 might increase cross-entropy loss by 0.5-2% while making the feature code 4x easier to inspect. Going from k=64 to k=8 often degrades quality enough that the features no longer faithfully represent what the model computes.',
        'The analysis cost is ongoing and often underestimated. A dictionary of 4 million features needs automated labeling (often using another LLM to describe top examples), feature search infrastructure, ablation test harnesses, steering experiment pipelines, and privacy review for top activating examples that might contain training data. Without this infrastructure, the dictionary is a static artifact that decays in trust over time.',
      ],
    },

    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Feature browsers: Neuronpedia and similar tools let researchers search a trained dictionary by keyword, inspect top activating examples, and compare features across layers. The sparse code makes this possible -- you cannot browse a dense 8,192-dim vector, but you can browse a list of 64 named feature IDs.',
            'Safety auditing: if a model has a feature that fires on deceptive reasoning patterns, that feature becomes a monitoring signal. Clamping it to zero is a candidate intervention (though side effects must be tested). Finding such features is investigative, not guaranteed.',
            'Circuit analysis: SAE features can serve as intermediate nodes in circuit discovery. Instead of tracing computation through polysemantic neurons, trace it through monosemantic features. This makes attention-head analysis and path patching more interpretable.',
            'Model comparison: training SAEs on two model checkpoints (before and after fine-tuning, for example) and comparing which features changed gives a structured diff of internal representations.',
            'Activation steering: clamping a feature value during inference changes model behavior without changing weights. This is cheaper than fine-tuning and more targeted than prompt engineering, but it requires careful side-effect testing.',
          ],
        },
        'The common thread is that SAE features turn a continuous, opaque activation space into a discrete, searchable index. Every use case above depends on that index being faithful to what the model actually computes.',
      ],
    },

    {
      heading: 'Where it fails',
      paragraphs: [
        'SAEs have several failure modes, some obvious and some silent:',
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Why it is dangerous'],
          rows: [
            ['Dead latents', 'Dictionary entries that never fire after training', 'Wasted capacity; the dictionary is smaller than it appears. Common at high expansion ratios.'],
            ['Feature splitting', 'One concept spread across 5-10 dictionary entries', 'The concept looks absent in any single feature; automated labeling misses it. Hard to detect without clustering.'],
            ['False monosemanticity', 'A feature has clean top-5 examples but fires on unrelated tokens at lower activation', 'Cherry-picking top examples produces beautiful labels that hide polysemantic tails.'],
            ['Reconstruction infidelity', 'The SAE reconstructs well on average but poorly on rare tokens', 'Features for rare concepts may be missing entirely; the dictionary covers common patterns and drops rare ones.'],
            ['Steering side effects', 'Clamping one feature changes 3 other behaviors', 'Features are more interpretable than neurons but still not perfectly independent; dictionary elements share decoder directions.'],
            ['Layer drift', 'A feature moves to a different layer after model fine-tuning', 'The SAE trained on the old checkpoint no longer captures the right features; version coupling is tight.'],
            ['Privacy leakage', 'Top activating examples contain memorized training data', 'Publishing a feature browser can leak personal information, code, or copyrighted text from the training set.'],
          ],
        },
        {
          type: 'note',
          text: 'The most dangerous failure is false confidence. A clean-looking feature browser with labeled features and high-activation examples creates a strong illusion of understanding. Without ablation tests, held-out validation, and steering side-effect checks, that understanding may be storytelling.',
        },
        'Feature splitting is especially insidious. If the concept "Python code" is split across features #412, #8,901, #23,044, #67,112, and #99,003, no single feature will show up as "the Python feature." Automated labeling might call them "indentation," "colon syntax," "import statements," "list comprehension," and "def keyword." Each label is locally correct, but the concept-level view is shattered. Detecting this requires post-hoc clustering or cross-feature correlation analysis, which most pipelines skip.',
      ],
    },

    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it teaches', 'Link'],
          rows: [
            ['Toy Models of Superposition (Elhage et al., 2022)', 'Why superposition happens; the geometry of feature packing', 'https://transformer-circuits.pub/2022/toy_model/index.html'],
            ['Towards Monosemanticity (Bricken et al., 2023)', 'First SAE dictionary on a real transformer; feature audit methodology', 'https://transformer-circuits.pub/2023/monosemantic-features'],
            ['Scaling Monosemanticity (Templeton et al., 2024)', 'SAEs at production scale; millions of features on Claude 3 Sonnet', 'https://transformer-circuits.pub/2024/scaling-monosemanticity'],
            ['Sparse Crosscoders (Lindsey et al., 2024)', 'Cross-layer SAE features; extending beyond single-layer decomposition', 'https://transformer-circuits.pub/2024/crosscoders/index.html'],
            ['Improving SAE Training (Gao et al., 2024)', 'Top-k SAEs, training recipes, scaling laws for SAE quality', 'https://arxiv.org/abs/2406.04093'],
            ['Refusal feature steering (Arditi et al., 2024)', 'Steering safety behavior via SAE features; tradeoff measurement', 'https://arxiv.org/abs/2411.11296'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Variational Autoencoders for the encoder-decoder pattern and the tension between reconstruction and regularization.',
            'Prerequisite: study PCA and linear algebra basics -- SAEs generalize the idea of finding a better basis, but overcomplete and nonlinear.',
            'Extension: study Sparse Crosscoders to see how the single-layer SAE extends to multi-layer feature tracking.',
            'Extension: study Activation Patching and Circuit Analysis to see how SAE features plug into mechanistic interpretability beyond just labeling.',
            'Contrast: study Saliency Maps and Feature Attribution for input-space explanations -- a fundamentally different approach to interpretability that does not require learning a dictionary.',
            'Related data structure: study Feature Hashing for the idea of mapping high-dimensional sparse data into compact indexable representations.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you explain why an overcomplete dictionary (d_dict >> d_model) is necessary, given that superposition packs more features than dimensions?',
            'Can you trace a single token activation through the SAE pipeline and state what information the sparse code preserves versus what it discards?',
            'Can you name the difference between a feature label derived from top examples and a feature label validated by ablation? What could be true of the first but false of the second?',
            'Can you describe one scenario where a feature with a clean label and high specificity is still unsafe to use for activation steering?',
            'Can you explain why reconstruction loss alone is insufficient to evaluate an SAE -- what does loss recovered measure that raw MSE does not?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Walk the dictionary-learning animation manually. For each frame, write down: (1) the representation at that stage (dense, sparse, or reconstructed), (2) the dimensionality, and (3) what information was lost or reshaped. Predict the sparsity-reconstruction tradeoff plot before viewing it.',
        'Then switch to the feature-audit view. For each audit stage, write down what evidence it adds and what failure mode it guards against. When you reach the steering frame, predict what happens if you clamp a refusal feature to 10x its normal value: what improves, what degrades, and why the side effects are hard to predict from the feature label alone.',
        'If you can trace both views end-to-end and explain why feature labels without causal tests are hypotheses rather than findings, continue to Activation Patching or Sparse Crosscoders.',
      ],
    },
  ],
};
