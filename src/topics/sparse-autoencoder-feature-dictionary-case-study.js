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
        'Read the dictionary view as a dense model activation being translated into sparse feature IDs. The residual stream is the dense vector inside a transformer layer, the encoder maps it to candidate features, top-k keeps only a few, and the decoder reconstructs the activation. Active nodes hold the current representation, compare nodes show the learned dictionary, and found nodes show the reconstructed output.',
        'The audit view starts after training. It links raw activations, top examples, labels, causal tests, steering attempts, and a versioned catalog. A feature label is only a hypothesis until held-out examples and interventions support it.',
        {type:'callout', text:'The sparse code is valuable because it turns an opaque activation vector into stable feature IDs that can be searched, tested, and versioned.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/8/83/Autoencoder_sparso.png', alt:'Diagram of a sparse autoencoder with input nodes, hidden nodes, and reconstructed outputs.', caption:'Single layer sparse autoencoder. Michela Massi, Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A transformer activation is a vector of numbers inside a model. In a large model, one coordinate rarely means one clean human concept. Different concepts can be superposed, which means they share overlapping directions in the same vector space.',
        'Sparse autoencoders, or SAEs, exist to learn a more inspectable coordinate system. They turn a dense activation into a sparse code where only a small number of feature IDs are active. The useful product is a feature dictionary with evidence, not just a lower loss number.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to inspect individual neurons. Collect the prompts where one neuron fires most, name the pattern, and treat the neuron as a concept detector. This sometimes works on small or simple models.',
        'The next approach is a linear probe. Train a classifier on activations to detect a concept such as sentiment or code. A probe can show that information is present, but it does not prove the model uses that direction as a mechanism.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is polysemanticity. A neuron may fire for DNA, legal citations, and HTTP snippets because the model packed several sparse features into one coordinate. A clean top-five example list can hide many lower-activation uses.',
        'The second wall is causal confidence. A feature name is not evidence that the feature controls behavior. Without ablation, steering, held-out tests, and side-effect checks, the interpretation can be a story about examples rather than a mechanism inside the model.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Train an overcomplete dictionary and force each activation to use only a few dictionary entries. Overcomplete means the dictionary has more feature slots than the original activation has dimensions. Sparsity means most feature slots are zero for any token.',
        'This matches the superposition hypothesis. If real features are sparse in data, a large sparse dictionary can separate them better than the model own dense coordinates. The sparse code gives feature IDs that can be indexed, searched, labeled, and tested.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First collect activations from a chosen model layer over many tokens. The SAE encoder maps each activation x into feature scores. A sparsity rule, such as top-k, keeps only k nonzero scores. The decoder combines the selected feature directions to reconstruct x as x_hat.',
        'Training minimizes reconstruction error while enforcing sparsity. If sparsity is too weak, many features fire and the code is not interpretable. If sparsity is too strong, reconstruction fails and the features no longer represent the computation faithfully.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness is not exact proof of meaning; it is an evidence stack. Reconstruction pressure checks that the sparse code preserves information used by the model. Sparsity pressure checks that a token can be described by a manageable set of active feature IDs.',
        'Interpretation becomes credible when labels predict new data and interventions change behavior in the expected direction. If feature 412 is labeled Python imports, it should fire on held-out import statements, stay quiet on unrelated text, and affect relevant completions when ablated or amplified. Side effects must be measured because features are not perfectly independent.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost starts with activation collection. Running a base model over 1 billion tokens just to save layer activations can be more expensive than training the SAE itself. Storage also grows because the project must keep dictionary weights, top activating examples, labels, test results, and steering logs.',
        'Dictionary size changes behavior. A 4,096-dimensional residual stream with a 32x expansion has 131,072 feature slots. If k = 64, each token stores about 64 active IDs instead of 4,096 dense values, but training must keep roughly 4,096 * 131,072 encoder and decoder weights. The dictionary is easier to inspect at inference time but expensive to build and audit.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SAE dictionaries support feature browsers, mechanistic interpretability, safety audits, model comparison, circuit discovery, and cautious activation steering. The common access pattern is looking up examples and tests by feature ID rather than staring at raw vectors.',
        'They are useful when a team needs a stable internal vocabulary for model behavior. A catalog can say which features changed after fine-tuning, which features correlate with refusals, and which steering interventions caused side effects. That turns model internals into an audit dataset.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'SAEs fail through dead features, feature splitting, false labels, poor reconstruction on rare tokens, privacy leakage in top examples, and steering side effects. A dictionary can look organized while missing rare or safety-critical behavior.',
        'They also fail when treated as complete explanations. A feature may be cleaner than a neuron but still interact with other features and layers. A label should be versioned with the model, layer, dataset, SAE checkpoint, and tests that support it.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a layer activation has 4,096 dimensions and the SAE dictionary has 131,072 features with k = 64. For a token in the phrase Golden Gate Bridge, feature 31,164,829 fires at value 8.7, while most dictionary entries stay zero. Its top examples include bridge references and San Francisco landmark text.',
        'Held-out testing uses 1,000 bridge examples and 1,000 random examples. If the feature fires on 940 bridge examples and 3 random examples, sensitivity is 94 percent and false-positive rate is 0.3 percent. If ablating it reduces Golden Gate completions by 65 percent while steering it increases unrelated San Francisco mentions, the feature is useful but not isolated.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Toy Models of Superposition, Towards Monosemanticity, Scaling Monosemanticity, Sparse Crosscoders, and recent top-k SAE training work. Read them for the evidence workflow: top examples, held-out validation, ablation, steering, and failure analysis.',
        'Study autoencoders, PCA, feature hashing, activation patching, circuit analysis, saliency methods, and benchmark variance next. The useful contrast is between finding a sparse internal dictionary and proving that a dictionary entry matters causally.',
      ],
    },
  ],
};
