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
      heading: 'What it is',
      paragraphs: [
        'A sparse autoencoder is an interpretability tool trained on internal model activations. It reconstructs a dense activation vector through a sparse set of learned feature IDs. The decoder vectors act like a learned dictionary; the sparse code says which dictionary entries were active for a token or prompt.',
        'The motivation is superposition. Modern networks often store more useful features than they have clean neuron axes, so a single neuron can mix unrelated concepts. Sparse autoencoders try to recover a more human-auditable coordinate system: a larger feature dictionary where only a few features are active at once.',
      ],
    },
    {
      heading: 'The data structure',
      paragraphs: [
        'The practical output is a feature table, not just a model checkpoint. Each row needs a feature id, decoder direction, top activating examples, activation statistics, a label hypothesis, specificity tests, ablation or steering results, and version metadata for the base model, layer, dataset, SAE architecture, and sparsity setting.',
        'Once stored this way, the SAE becomes queryable infrastructure. You can ask which features fired on a prompt, retrieve the top examples for a feature, join features to benchmark deltas, compare features across model versions, and build dashboards for steering experiments. That is why this belongs next to Feature Hashing, Embeddings & Similarity, PCA, and Saliency Maps instead of living only as a research paper.',
      ],
    },
    {
      heading: 'How training works',
      paragraphs: [
        'Collect activations from a chosen layer, often a residual stream. Train an encoder to map each activation into an overcomplete sparse vector. Train a decoder to reconstruct the original activation from that sparse vector. The objective balances reconstruction quality against sparsity so that features stay selective enough to inspect.',
        'Top-k SAEs enforce a fixed number of active features. Other variants use L1 penalties or related sparsity mechanisms. The main knobs are dictionary size, layer choice, sparsity target, dataset, dead-latent handling, and reconstruction-error handling. The wrong setting can produce a dictionary that reconstructs well but is hard to interpret, or labels nicely but fails causal tests.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'Anthropic first made the superposition problem vivid with Toy Models of Superposition, then used dictionary learning to decompose a small transformer layer into thousands of features in Towards Monosemanticity. The same line later scaled to Claude 3 Sonnet, where sparse autoencoders with many millions of features produced interpretable feature candidates and enabled feature steering demonstrations.',
        'The important lesson is not that every learned feature is automatically true. The lesson is that the unit of analysis can move from raw neurons to sparse learned features, and those features can be subjected to evidence: top activating examples, specificity scoring, ablations, steering, and downstream behavioral evaluation.',
      ],
    },
    {
      heading: 'Steering and risk',
      paragraphs: [
        'Feature steering uses the SAE as a control surface at inference time. Encode an activation, increase or decrease selected feature activations, decode the modified activation, and continue the forward pass. This can change behavior without changing model weights, which makes it appealing for experimentation and safety work.',
        'The caution is that steering is not automatically modular. A refusal feature can raise unsafe-prompt refusal rates while also raising over-refusal on safe prompts and reducing unrelated benchmark performance. A style or topic feature can spill into hallucination or instruction-following failures. Every steering claim needs a grid of prompt classes, clamp values, and capability regressions.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not equate a feature label with a mechanism. A label is a hypothesis produced from examples. It becomes stronger when held-out examples fit, ablation reduces the behavior, steering increases it, and alternative explanations fail. It becomes weaker when it only describes the training examples or when clamping causes broad unrelated damage.',
        'Do not ignore versioning. SAE features are tied to a base model, layer, training corpus, sparsity setting, and implementation. If any of those change, feature IDs and labels may drift. A production feature dictionary needs the same discipline as a vector index or model checkpoint: immutable versions, replayable data cuts, privacy review, and regression tests for the behaviors it claims to explain.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Toy Models of Superposition at https://arxiv.org/abs/2209.10652 and https://transformer-circuits.pub/2022/toy_model/index.html; Towards Monosemanticity at https://transformer-circuits.pub/2023/monosemantic-features; Scaling Monosemanticity at https://transformer-circuits.pub/2024/scaling-monosemanticity; Sparse Crosscoders at https://transformer-circuits.pub/2024/crosscoders/index.html; and refusal feature steering at https://arxiv.org/abs/2411.11296.',
        'Study Variational Autoencoders for the encoder-decoder pattern, PCA for basis changes, Feature Hashing Signed Projection Primer for sparse feature IDs, Embeddings & Similarity for representation geometry, Saliency Maps & Feature Attribution for causal humility, Multi-Head Attention for routing versus explanation, and Benchmark Variance & Model Selection before trusting behavioral deltas.',
      ],
    },
  ],
};
