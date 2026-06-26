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
  const headEntity = 'Paris';
  const tailEntity = 'France';
  const relation = 'located_in';
  const trueDistance = '0.08';
  const worstDistance = '1.75';
  const entityCount = 7;
  const edgeCount = 5;

  yield {
    state: kgGraph('Knowledge graphs are triples with missing edges'),
    highlight: { active: ['paris', 'france', 'e-paris-france'], compare: ['query'] },
    explanation: `A knowledge graph stores triples such as (${headEntity}, ${relation}, ${tailEntity}). Link prediction asks which missing triples are likely true. RotatE turns that symbolic question into geometry over ${entityCount} entities and ${edgeCount} edges.`,
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
    explanation: `RotatE represents each relation as a unit-modulus complex vector. Scoring a triple (${headEntity}, ${relation}, ${tailEntity}) asks whether h multiplied by r lands near t. In plain language: can the relation rotate the head entity toward the tail entity?`,
    invariant: `Valid triple: h * r is close to t in complex vector space — distance ${trueDistance} for the true triple versus ${worstDistance} for a false one.`,
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
    explanation: `Training pulls known triples close (${headEntity} -> ${tailEntity} scores distance ${trueDistance}) and pushes sampled false triples away (worst distance ${worstDistance}). The paper also introduces self-adversarial negative sampling so harder negatives receive more training attention.`,
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
    explanation: `The trained embeddings can rank candidate tails for a query like (Curie, won, ?). The model learns from ${edgeCount} known edges and predicts missing links when graph structure has patterns that geometry can compress.`,
  };
}

function* patternReasoning() {
  const patternCount = 4;
  const r1Deg = 45;
  const r2Deg = 90;
  const composedDeg = r1Deg + r2Deg;
  const auditChecks = 4;

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
    explanation: `RotatE is memorable because all ${patternCount} relation patterns — symmetry, antisymmetry, inversion, composition — become simple complex-number algebra. Inversion is conjugation, composition is multiplication, and antisymmetry is a phase that does not undo itself.`,
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
    explanation: `Composing two relations adds their phase angles: r1 at ${r1Deg} degrees plus r2 at ${r2Deg} degrees gives r1*r2 at ${composedDeg} degrees. Inverting r1 flips the sign to -${r1Deg} degrees. This is why complex rotations fit knowledge-graph reasoning better than a plain translation.`,
    invariant: `Complex multiplication turns relation composition into phase addition — ${r1Deg} + ${r2Deg} = ${composedDeg} degrees.`,
  };

  yield {
    state: kgGraph('Pattern-aware reasoning over paths'),
    highlight: { active: ['paris', 'france', 'europe', 'e-paris-france', 'e-france-europe'], found: ['query'] },
    explanation: `If the graph learns city->country and country->region rotations, their composition (phase addition) can help infer city->region. The model is not doing symbolic proof; it is learning a geometric bias that makes common relational patterns cheap across ${patternCount} pattern types.`,
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
    explanation: `Knowledge-graph embeddings are useful but evaluation is fragile — ${auditChecks} audit checks are essential. Randomly hiding edges can leak entity neighborhoods, and easy negatives can inflate link-prediction scores. The benchmark protocol is part of the model.`,
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
        'The animation starts with a knowledge graph, which is a directed graph whose edges have labels such as located_in or won. Active nodes and edges are the triple being scored: head entity h, relation r, and tail entity t. Found marks the candidate tail that the rotation lands near, and compare marks tails that are farther away.',
        {type: 'callout', text: 'RotatE works because relation composition becomes phase addition on the complex unit circle.'},
        'In the complex-plane frames, each relation is a rotation, meaning multiplication by a point on the unit circle. A small distance between h * r and t means the triple is plausible. The safe inference rule is local: if the relation rotation lands near a tail, that tail should rank above candidates where the distance is larger.',
        {type: 'image', src: './assets/gifs/rotate-knowledge-graph-embeddings.gif', alt: 'Animated walkthrough of the rotate knowledge graph embeddings visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A knowledge graph stores facts as triples: a head entity, a relation, and a tail entity. Real graphs are incomplete, so a system needs link prediction: ranking missing triples that are likely true. Without a model, every missing edge looks equally unknown.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A knowledge graph is a directed labeled graph; RotatE changes missing-edge prediction into geometry over those directed facts. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'RotatE exists because common graph relations have structure. Parent and child are inverses, similar_to is often symmetric, and city-to-country followed by country-to-region composes into city-to-region. The model turns those symbolic patterns into geometry so one learned relation can transfer evidence across many entities.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The direct approach is to assign each entity and relation a vector, then score a triple by whether h plus r is close to t. This is the TransE idea, and it is a reasonable first step because translation naturally represents directed movement from one entity to another. If Paris plus located_in lands near France, the geometry has learned something useful.',
        'Another simple approach is a dot-product or bilinear score. It can be fast and compact, and it works for relations where swapping head and tail should not change the meaning much. These baselines are not naive in the insulting sense; they expose which relation patterns a scoring function can and cannot express.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A single translation struggles with symmetry. If h + r = t and the relation should also allow t to reach h, then the same r would need to point both ways. A dot product has the opposite problem: it often treats (h, r, t) and (t, r, h) too similarly, which hides antisymmetric relations such as parent_of.',
        'The harder wall is composition. If relation r1 maps city to country and r2 maps country to region, a model should have a clean way to represent r1 followed by r2. Plain translation can add vectors, but it does not handle symmetry in the same mechanism. RotatE needs one operation that covers symmetry, antisymmetry, inversion, and composition without switching models.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'RotatE represents each relation as a complex number with modulus 1, which means it sits on the unit circle. Multiplying by that relation rotates each entity component without changing its length. The score asks whether the rotated head is close to the tail.',
        'This makes relation logic become angle logic. A symmetric relation can rotate by 0 or pi so applying it twice returns to the start. An inverse relation uses the negative angle. A composed relation uses the sum of the angles, because complex multiplication adds phases.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each entity stores a complex vector, so every dimension has a real and imaginary coordinate. Each relation stores a phase angle per dimension, and that angle defines a unit complex multiplier. To score a triple, the model computes h * r component by component and measures the distance to t.',
        'Training pulls true triples closer and pushes corrupted triples farther away. A corrupted triple replaces the head or tail with a different entity, creating a negative example. Self-adversarial negative sampling gives more weight to false triples that the current model finds tempting, so training spends less effort on easy negatives.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is about representation, not proof of truth. If the data contains inverse relations, then learning r2 as the conjugate of r1 makes h * r1 close to t and t * r2 close to h. If the data contains a composed path, then r3 can learn the product r1 * r2, so the phase of r3 equals the phase sum of the path.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Unit_circle_angles_color.svg/250px-Unit_circle_angles_color.svg.png', alt: 'Unit circle marked with common angle coordinates', caption: 'Relation phases live on the unit circle; composing relations adds angles, and inverse relations flip the sign of the angle. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Unit_circle_angles_color.svg.'},
        'The invariant is that plausible triples have low rotation distance. The model is not proving a missing fact the way a logic engine would. It is ranking facts by whether the learned geometry preserves relation patterns seen in the graph.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Scoring one triple costs O(d), where d is the embedding dimension, because each dimension performs one complex rotation and one distance calculation. Training with N positive triples and k negatives costs about O(Nkd) scoring work per epoch. Doubling d roughly doubles scoring time and parameter memory.',
        'Storage is linear in the number of entities and relations. Entity embeddings use two floats per dimension, while relation phases use one angle per dimension. If there are 5 million entities and d = 500, the entity table alone is about 20 GB in float32, so memory bandwidth and retrieval infrastructure become part of the model behavior.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RotatE is useful when a graph has many binary relations and missing links matter. Search knowledge panels, biomedical relation graphs, recommendation graphs, and entity-resolution systems all need to rank plausible missing edges for review or downstream use. It is a strong baseline because it is much cheaper than running a graph neural network over the whole graph.',
        'It also helps when relation patterns are the signal. Hierarchies, inverse properties, and path-like facts are common in knowledge bases. The phase representation gives engineers a way to inspect whether a relation learned near-symmetric, inverse, or compositional behavior.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'RotatE is transductive, which means each entity needs a learned embedding. A new entity that appears after training has no vector unless the system retrains or uses an additional encoder. It also ignores text, images, timestamps, and attributes unless those facts are encoded as graph edges.',
        'It is weak for many-to-one and one-to-many relations when one rotation must land near several different tails. It also depends heavily on evaluation design. Random edge splits and easy negative samples can make a link-prediction model look stronger than it is in production.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use one complex dimension. Let Paris be angle 20 degrees, located_in be a rotation of 40 degrees, and France be angle 63 degrees. Paris * located_in lands at 60 degrees, so the angular error to France is 3 degrees.',
        'Now compare a false tail such as Nobel at 155 degrees. The same rotation lands at 60 degrees, giving a 95-degree error. If the model scores by negative distance, France ranks far above Nobel. If country_to_region is 30 degrees, then city_to_region should be about 70 degrees because 40 + 30 = 70.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Sun et al., RotatE: Knowledge Graph Embedding by Relational Rotation in Complex Space, ICLR 2019. Study TransE, DistMult, ComplEx, and QuatE next to see how different scoring functions buy or lose relation patterns.',
        'For implementation depth, study complex numbers, negative sampling, approximate nearest-neighbor search, and data leakage in graph benchmarks. The useful habit is to ask what pattern the geometry can represent, what the benchmark hides, and what happens when the graph changes after training.',
      ],
    },
  ],
};