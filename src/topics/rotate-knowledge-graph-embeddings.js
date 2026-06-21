// RotatE knowledge-graph embeddings: represent each relation as a rotation in
// complex space so link prediction can model symmetry, inversion, and composition.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'rotate-knowledge-graph-embeddings',
  title: 'RotatE Knowledge Graph Embeddings',
  category: 'Papers',
  summary: 'A link-prediction model where entities are complex vectors and each relation rotates the head entity toward the tail.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['relational rotation', 'pattern reasoning'], defaultValue: 'relational rotation' },
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

function kgGraph(title) {
  return graphState({
    nodes: [
      { id: 'paris', label: 'Paris', x: 0.9, y: 4.9, note: 'city' },
      { id: 'france', label: 'France', x: 3.4, y: 4.9, note: 'country' },
      { id: 'europe', label: 'Europe', x: 5.9, y: 4.9, note: 'region' },
      { id: 'marie', label: 'Curie', x: 0.9, y: 5.8, note: 'person' },
      { id: 'nobel', label: 'Nobel', x: 3.4, y: 5.8, note: 'award' },
      { id: 'physics', label: 'Physics', x: 5.9, y: 5.8, note: 'field' },
      { id: 'query', label: '?', x: 8.6, y: 5.35, note: 'missing' },
    ],
    edges: [
      { id: 'e-paris-france', from: 'paris', to: 'france', weight: 'in' },
      { id: 'e-france-europe', from: 'france', to: 'europe', weight: 'part' },
      { id: 'e-marie-nobel', from: 'marie', to: 'nobel', weight: 'won' },
      { id: 'e-nobel-physics', from: 'nobel', to: 'physics', weight: 'field' },
      { id: 'e-physics-query', from: 'physics', to: 'query', weight: 'predict' },
    ],
  }, { title });
}

function* relationalRotation() {
  yield {
    state: kgGraph('Knowledge graphs are triples with missing edges'),
    highlight: { active: ['paris', 'france', 'e-paris-france'], compare: ['query'] },
    explanation: 'A knowledge graph stores triples such as (Paris, located_in, France). Link prediction asks which missing triples are likely true. RotatE turns that symbolic question into geometry.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'real axis', min: -1.2, max: 1.2 }, y: { label: 'imag axis', min: -1.2, max: 1.2 } },
      series: [
        { id: 'unit', label: 'unit circle', points: [
          { x: 1.0, y: 0.0 }, { x: 0.7, y: 0.7 }, { x: 0.0, y: 1.0 }, { x: -0.7, y: 0.7 },
          { x: -1.0, y: 0.0 }, { x: -0.7, y: -0.7 }, { x: 0.0, y: -1.0 }, { x: 0.7, y: -0.7 }, { x: 1.0, y: 0.0 },
        ] },
      ],
      vectors: [
        { id: 'head', from: { x: 0, y: 0 }, to: { x: 0.95, y: 0.15 }, label: 'head h' },
        { id: 'rel', from: { x: 0.95, y: 0.15 }, to: { x: 0.38, y: 0.92 }, label: 'rotate r' },
        { id: 'tail', from: { x: 0, y: 0 }, to: { x: 0.36, y: 0.93 }, label: 'tail t' },
      ],
    }),
    highlight: { active: ['head', 'rel'], found: ['tail'] },
    explanation: 'RotatE represents each relation as a unit-modulus complex vector. Scoring a triple asks whether h multiplied by r lands near t. In plain language: can the relation rotate the head entity toward the tail entity?',
    invariant: 'Valid triple: h * r is close to t in complex vector space.',
  };

  yield {
    state: labelMatrix(
      'Link prediction score',
      [
        { id: 'true', label: 'Paris -> France' },
        { id: 'hard', label: 'Paris -> Europe' },
        { id: 'bad', label: 'Paris -> Nobel' },
        { id: 'neg', label: 'Paris -> Physics' },
      ],
      [
        { id: 'distance', label: 'distance' },
        { id: 'score', label: 'score' },
      ],
      [
        ['0.08', 'high'],
        ['0.42', 'maybe'],
        ['1.50', 'low'],
        ['1.75', 'low'],
      ],
    ),
    highlight: { found: ['true:score'], compare: ['bad:score', 'neg:score'] },
    explanation: 'Training pulls known triples close and pushes sampled false triples away. The paper also introduces self-adversarial negative sampling so harder negatives receive more training attention.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'triples', label: 'known triples', x: 0.8, y: 3.8, note: 'facts' },
        { id: 'embed', label: 'entity vectors', x: 2.8, y: 2.6, note: 'complex' },
        { id: 'rel', label: 'relation phases', x: 2.8, y: 5.0, note: 'rotations' },
        { id: 'score', label: 'score h*r,t', x: 5.2, y: 3.8, note: 'distance' },
        { id: 'neg', label: 'hard negatives', x: 7.3, y: 2.6, note: 'sample' },
        { id: 'predict', label: 'missing links', x: 7.3, y: 5.0, note: 'rank' },
      ],
      edges: [
        { id: 'e-triples-embed', from: 'triples', to: 'embed', weight: '' },
        { id: 'e-triples-rel', from: 'triples', to: 'rel', weight: '' },
        { id: 'e-embed-score', from: 'embed', to: 'score', weight: '' },
        { id: 'e-rel-score', from: 'rel', to: 'score', weight: '' },
        { id: 'e-score-neg', from: 'score', to: 'neg', weight: '' },
        { id: 'e-score-predict', from: 'score', to: 'predict', weight: '' },
      ],
    }, { title: 'RotatE training loop' }),
    highlight: { active: ['score', 'neg'], found: ['predict'] },
    explanation: 'The trained embeddings can rank candidate tails for a query like (Marie Curie, won, ?). The model is useful when graph structure has patterns that geometry can compress.',
  };
}

function* patternReasoning() {
  yield {
    state: labelMatrix(
      'Relation patterns as phase algebra',
      [
        { id: 'sym', label: 'symmetry' },
        { id: 'anti', label: 'antisymmetry' },
        { id: 'inv', label: 'inversion' },
        { id: 'comp', label: 'composition' },
      ],
      [
        { id: 'graph fact', label: 'graph fact' },
        { id: 'rotation test', label: 'rotation test' },
      ],
      [
        ['x related y and y related x', 'r = inverse r'],
        ['x before y, not y before x', 'phase not self-inverse'],
        ['parent vs child', 'r2 = inverse r1'],
        ['city->country->region', 'r3 = r1 * r2'],
      ],
    ),
    highlight: { active: ['sym:rotation test', 'inv:rotation test', 'comp:rotation test'] },
    explanation: 'RotatE is memorable because relation patterns become simple complex-number algebra. Inversion is conjugation, composition is multiplication, and antisymmetry is a phase that does not undo itself.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'real axis', min: -1.2, max: 1.2 }, y: { label: 'imag axis', min: -1.2, max: 1.2 } },
      vectors: [
        { id: 'r1', from: { x: 0, y: 0 }, to: { x: 0.71, y: 0.71 }, label: 'r1 45deg' },
        { id: 'r2', from: { x: 0, y: 0 }, to: { x: 0.0, y: 1.0 }, label: 'r2 90deg' },
        { id: 'r3', from: { x: 0, y: 0 }, to: { x: -0.71, y: 0.71 }, label: 'r1*r2' },
        { id: 'inv', from: { x: 0, y: 0 }, to: { x: 0.71, y: -0.71 }, label: 'inverse r1' },
      ],
    }),
    highlight: { active: ['r1', 'r2', 'r3'], compare: ['inv'] },
    explanation: 'Composing two relations adds their phase angles. Inverting a relation flips the sign of the phase. This is why complex rotations fit knowledge-graph reasoning better than a plain translation in some relation families.',
    invariant: 'Complex multiplication turns relation composition into phase addition.',
  };

  yield {
    state: kgGraph('Pattern-aware reasoning over paths'),
    highlight: { active: ['paris', 'france', 'europe', 'e-paris-france', 'e-france-europe'], found: ['query'] },
    explanation: 'If the graph learns city->country and country->region rotations, the composition can help infer city->region. The model is not doing symbolic proof; it is learning a geometric bias that makes common relational patterns cheap.',
  };

  yield {
    state: labelMatrix(
      'When to trust a KGE result',
      [
        { id: 'split', label: 'split' },
        { id: 'negatives', label: 'negatives' },
        { id: 'rules', label: 'rules' },
        { id: 'freshness', label: 'freshness' },
      ],
      [
        { id: 'audit', label: 'audit' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['entity/time split', 'avoid leakage'],
        ['hard and typed', 'avoid easy wins'],
        ['compare symbolic', 'find real gain'],
        ['graph snapshot', 'facts drift'],
      ],
    ),
    highlight: { found: ['split:audit', 'negatives:audit', 'rules:audit', 'freshness:audit'] },
    explanation: 'Knowledge-graph embeddings are useful but evaluation is fragile. Randomly hiding edges can leak entity neighborhoods, and easy negatives can inflate link-prediction scores. The benchmark protocol is part of the model.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'relational rotation') yield* relationalRotation();
  else if (view === 'pattern reasoning') yield* patternReasoning();
  else throw new InputError('Pick a RotatE view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "relational rotation" view shows a knowledge graph, then the complex plane where RotatE scores triples. Active nodes and edges are the current triple being evaluated. Found markers show the tail entity that the rotation lands near. Compare markers show candidate tails that score poorly.',
        {type: 'callout', text: 'RotatE works because relation composition becomes phase addition on the complex unit circle.'},
        'The "pattern reasoning" view shows how relation patterns -- symmetry, inversion, composition -- map to phase algebra on the unit circle. Active vectors are relation rotations. The compare vector shows the conjugate (inverse). Watch how multiplying two rotations composes their phases.',
        'In both views, the scoring matrix highlights the distance between h * r and t. Small distance means a plausible triple. Large distance means the rotation missed the tail. At each frame, ask: did the rotation land close, and does the phase algebra match the relation pattern?',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Knowledge graphs store facts as triples: (head entity, relation, tail entity). Paris located_in France. Curie won Nobel Prize. A drug treats a disease. Real graphs are massively incomplete -- Freebase had roughly 3 billion facts but an estimated 70% of person-place-of-birth edges were missing. The core task is link prediction: given the observed triples, rank which missing triples are likely true.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A knowledge graph is a directed labeled graph; RotatE changes missing-edge prediction into geometry over those directed facts. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Link prediction matters because downstream systems consume these facts. Search engines use entity relations for knowledge panels. Biomedical researchers use protein-protein and drug-target graphs to prioritize wet-lab experiments. Recommendation systems use item-attribute graphs to suggest products. If the graph is incomplete, those systems degrade silently. Filling in plausible links is not academic curiosity; it is infrastructure.',
        'RotatE (Sun et al., ICLR 2019) treats link prediction as geometry. Entities become complex-valued vectors. Each relation becomes a rotation in complex space. A triple (h, r, t) is plausible when multiplying h by r lands near t. This one design choice gives the model a natural way to represent symmetry, antisymmetry, inversion, and composition -- the four relation patterns that dominate real knowledge graphs.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'TransE (Bordes et al., 2013) is the simplest knowledge-graph embedding. It represents each relation as a translation vector: h + r should be close to t. Training pushes known triples together and sampled negatives apart. TransE is fast, easy to implement, and works well on simple relation types.',
        {
          type: 'note',
          text: 'TransE handles antisymmetric relations naturally: if h + r = t, then t + r != h (unless r = 0). It also handles composition: if h + r1 = m and m + r2 = t, then h + (r1 + r2) = t. Translation is a good first guess.',
        },
        'DistMult (Yang et al., 2015) takes a different approach: it scores triples using a bilinear function, computing a weighted dot product between head and tail. This handles symmetric relations well because the scoring function is symmetric by design. ComplEx (Trouillon et al., 2016) extends DistMult to complex space, which breaks the symmetry and lets the model distinguish asymmetric relations too.',
        'Each of these models handles some relation patterns cleanly but struggles with others. The question is whether a single model can cover all four patterns -- symmetry, antisymmetry, inversion, and composition -- without architectural changes.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'TransE cannot model symmetric relations. If r is the translation for "similar_to" and h + r = t, then t + r = t + r, not h. To get back to h you need -r, but -r is a different relation. TransE forces every relation to be antisymmetric. On the WN18 benchmark, where 18 symmetric relation types dominate, TransE pays a large accuracy penalty.',
        'DistMult has the opposite problem. Its scoring function f(h, r, t) = sum(h * r * t) is symmetric in h and t, so it cannot distinguish (h, r, t) from (t, r, h). Every relation looks symmetric. Antisymmetric and inverse relations are invisible to the model.',
        {
          type: 'bullets',
          items: [
            'TransE: strong at antisymmetry, inversion, and composition, but weak on symmetry because one translation cannot point both ways.',
            'DistMult: strong at symmetry, but its score is symmetric in head and tail, so antisymmetry and inversion disappear.',
            'ComplEx: handles symmetry, antisymmetry, and inversion, but lacks a clean relation-composition operator.',
            'RotatE: handles symmetry, antisymmetry, inversion, and composition with one phase-rotation mechanism.',
            'QuatE: also covers the four patterns with richer quaternion rotations, at the cost of a more complex representation.',
          ],
        },
        'ComplEx fixes the symmetry problem by moving to complex space, but it still cannot model composition because its bilinear scoring has no mechanism for chaining two relations into a third. The wall is composition: city->country->region should imply city->region, but bilinear models have no algebraic path from r1 and r2 to r3. RotatE breaks through because complex multiplication is inherently compositional -- multiplying two unit rotations produces a third rotation whose phase is the sum of the first two.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each entity gets a d-dimensional complex embedding vector. Each relation gets a d-dimensional complex vector constrained to have unit modulus on every component: |r_j| = 1 for all j. This means each component of r is a point on the unit circle, parameterized by a single phase angle theta_j.',
        'Scoring a triple (h, r, t) computes the element-wise product h * r (complex multiplication per dimension), then measures the L1 or L2 distance to t. The score is the negative of this distance, so smaller distance means higher plausibility.',
        {
          type: 'code',
          language: 'python',
          text: '# RotatE scoring function\nimport torch\n\ndef rotate_score(h_re, h_im, r_phase, t_re, t_im):\n    """Score a batch of (h, r, t) triples.\n    h_re, h_im: (batch, dim) entity embeddings\n    r_phase:    (batch, dim) relation phase angles\n    t_re, t_im: (batch, dim) entity embeddings\n    \"\"\"\n    r_re = torch.cos(r_phase)\n    r_im = torch.sin(r_phase)\n    # Complex multiplication: (h_re + i*h_im) * (r_re + i*r_im)\n    hr_re = h_re * r_re - h_im * r_im\n    hr_im = h_re * r_im + h_im * r_re\n    # Distance to tail\n    diff_re = hr_re - t_re\n    diff_im = hr_im - t_im\n    # L2 norm per dimension, sum across dimensions\n    dist = torch.sqrt(diff_re**2 + diff_im**2).sum(dim=-1)\n    return -dist  # higher is better',
        },
        'Training uses a self-adversarial negative sampling loss. For each positive triple (h, r, t), the model generates k negative triples by corrupting the head or tail. The key innovation is weighting each negative by its current model probability: negatives the model already scores as implausible get low weight, while negatives near the decision boundary get high weight. This focuses gradient updates on the hardest cases.',
        {
          type: 'note',
          text: `The self-adversarial weight for negative triple (h_i_prime, r, t) is p(h_i_prime | h, r, t) = exp(alpha * f(h_i_prime, r, t)) / sum(exp(alpha * f(h_j_prime, r, t))). The temperature alpha controls how aggressively the model focuses on hard negatives. The paper treats these weights as fixed with no gradient through them, making the approach a form of importance sampling.`,
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The power of RotatE comes from one algebraic fact: the group of unit-modulus complex numbers under multiplication is isomorphic to the group of rotations on the circle. This makes four relation patterns fall out of basic complex arithmetic.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Unit_circle_angles_color.svg/250px-Unit_circle_angles_color.svg.png', alt: 'Unit circle marked with common angle coordinates', caption: 'Relation phases live on the unit circle; composing relations adds angles, and inverse relations flip the sign of the angle. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Unit_circle_angles_color.svg.'},
        {
          type: 'bullets',
          items: [
            'Symmetry: relation r is symmetric when r * r = 1 (identity). This means theta = 0 or theta = pi. Applying the relation twice returns to the start.',
            'Antisymmetry: relation r is antisymmetric when r * r != 1. Any phase other than 0 or pi satisfies this. The rotation does not undo itself.',
            'Inversion: relations r1 and r2 are inverses when r1 * r2 = 1. This means r2 = conjugate(r1), so theta_2 = -theta_1. The second relation undoes the first.',
            'Composition: if r3 = r1 * r2, then the phase of r3 is theta_1 + theta_2. Chaining two relations is just adding their rotation angles.',
          ],
        },
        {
          type: 'diagram',
          label: 'Composition as phase addition on the unit circle',
          text: '        Im\n         |\n    r1*r2 .   . r2 (90 deg)\n      (135 deg) |\n         |   /\n  -------+-------> Re\n         |  /\n         | / r1 (45 deg)\n         |/',
        },
        'TransE models relations as translations, which form a group under addition. But the additive group on R^d has no natural way to represent the constraint r + r = 0 (symmetry) while also allowing r + r != 0 (antisymmetry) per-relation. The multiplicative group on the unit circle handles both cases with different phase values in the same mechanism. This is not a parameter count advantage -- RotatE and TransE use similar numbers of parameters. It is a structural advantage: the operation itself matches the patterns in the data.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'RotatE stores one d-dimensional complex vector per entity (2d floats) and one d-dimensional phase vector per relation (d floats). For a graph with E entities and R relations, total parameter count is 2dE + dR. On FB15k-237, d = 1000 gives roughly 30 million parameters -- comparable to TransE and much smaller than a graph neural network.',
        {
          type: 'bullets',
          items: [
            'Score one triple: O(d) time to rotate and compare one embedding pair; O(d) working space for the component-wise distance.',
            'Train one epoch over N triples with k negatives: O(Nkd) scoring work, with O(Ed + Rd) parameter storage for entities and relations.',
            'Rank all tails for one query: O(Ed) if every entity is scored exactly; approximate nearest-neighbor search trades this cost for recall risk.',
            'Filtered full evaluation: O(N_test * E * d) in the exact protocol because each test query is ranked against the entity set.',
          ],
        },
        'Training takes hours on a single GPU for standard benchmarks (FB15k-237: ~15k entities, ~237 relations, ~310k triples). For large production graphs with millions of entities, the bottleneck is the negative sampling loop and the all-entity ranking at evaluation time. Approximate nearest-neighbor search (HNSW, IVF) can reduce inference cost from O(Ed) to O(d log E) per query, but this introduces recall loss.',
        'Doubling the entity count doubles parameter storage and doubles per-query ranking time. Doubling the embedding dimension doubles storage and per-triple scoring cost but may improve accuracy on relation-rich graphs. The practical ceiling is usually memory: at d = 500 and E = 5 million, the entity table alone is 20 GB in float32.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'RotatE excels on graphs with diverse relation patterns. On FB15k-237, it outperforms TransE, DistMult, and ComplEx on MRR and Hits@10 because the benchmark includes symmetric, antisymmetric, inverse, and compositional relations. On WN18RR (WordNet with inverse-relation leakage removed), it remains competitive because hypernymy and other hierarchical relations benefit from the rotational bias.',
        'In biomedical knowledge graphs (DrugBank, Hetionet, UMLS), relations like "treats," "inhibits," "associated_with," and "is_a" have clear inverse and compositional structure. RotatE and its variants are commonly used as the embedding backbone in drug repurposing pipelines, where the task is to rank plausible drug-disease links for expert review.',
        'RotatE is also a strong baseline when you need a simple, interpretable embedding model. The phase angles are human-readable: you can inspect which relations learned near-zero phase (symmetric) versus non-trivial phase (antisymmetric). This interpretability is valuable in compliance-sensitive domains where black-box neural models face regulatory pushback.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'RotatE is transductive: it learns a fixed embedding per entity. New entities that appear after training have no embedding. Inductive settings -- predicting links for unseen entities based on their neighborhood or text descriptions -- require extensions like NodePiece or graph neural networks that compute embeddings from local structure.',
        'It cannot use node attributes, text descriptions, or multi-modal features. If two entities have identical graph neighborhoods but different textual descriptions, RotatE treats them as interchangeable. Models like KG-BERT or BLP that encode entity descriptions with a language model handle this case better, at much higher computational cost.',
        'N-ary and higher-order relations are out of scope. RotatE scores binary triples (h, r, t). If the fact is "Curie won the Nobel Prize in Physics in 1903," the year and field are either separate triples or lost. Hyper-relational models like StarE extend the triple format, but RotatE cannot represent them natively.',
        {
          type: 'bullets',
          items: [
            'Silent failure: a graph dominated by 1-to-N relations (one head, many valid tails with the same relation) can produce low-quality embeddings because the single rotation cannot fan out to multiple targets. The model learns an average rotation that lands between the true tails.',
            'Benchmark inflation: standard filtered evaluation removes known true triples from the negative set, which can hide poor calibration. A model may rank the correct tail at position 3 but assign implausible scores to positions 1 and 2.',
            'Staleness: a trained RotatE table does not update when the graph changes. Production systems need retraining pipelines, and the gap between graph updates and embedding refresh is a silent accuracy leak.',
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'quote',
          text: 'We propose to define each relation as a rotation from the source entity to the target entity in the complex vector space.',
          attribution: 'Sun et al., "RotatE: Knowledge Graph Embedding by Relational Rotation in Complex Space," ICLR 2019',
        },
        {
          type: 'bullets',
          items: [
            'Primary source: Sun et al., "RotatE: Knowledge Graph Embedding by Relational Rotation in Complex Space," ICLR 2019 (https://arxiv.org/abs/1902.10197).',
            'TransE: Bordes et al., "Translating Embeddings for Modeling Multi-relational Data," NeurIPS 2013.',
            'ComplEx: Trouillon et al., "Complex Embeddings for Simple Link Prediction," ICML 2016.',
            'QuatE: Zhang et al., "Quaternion Knowledge Graph Embeddings," NeurIPS 2019 -- extends RotatE from complex to quaternion space for richer rotations.',
            'Reference implementation: the official PyTorch code at github.com/DeepGraphLearning/KnowledgeGraphEmbedding.',
          ],
        },
        'Study Embeddings and Similarity for the geometry of vector representations. Study Graph BFS and PageRank for graph traversal foundations. Study Complex-Valued Neural Networks for the algebra of complex embeddings beyond knowledge graphs. Study HNSW for the approximate nearest-neighbor search needed to make embedding-based retrieval fast at scale. Study Data Leakage and Contamination for the evaluation pitfalls that inflate knowledge-graph embedding benchmarks.',
        'The progression is: graph structure (BFS, PageRank) -> representation geometry (embeddings, complex numbers) -> retrieval infrastructure (HNSW) -> evaluation discipline (leakage). Each layer is necessary before link-prediction results should be trusted in production.',
      ],
    },
  ],
};
