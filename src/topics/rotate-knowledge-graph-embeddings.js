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
      heading: 'What it is',
      paragraphs: [
        'RotatE is a knowledge-graph embedding model from "RotatE: Knowledge Graph Embedding by Relational Rotation in Complex Space." A knowledge graph stores triples such as (Paris, located_in, France) or (Marie Curie, won, Nobel Prize). Link prediction asks which missing triples are likely true. RotatE embeds entities as complex vectors and embeds each relation as a rotation.',
        'The scoring rule is the core idea: a triple is plausible when h * r is close to t, where h is the head entity, r is the relation, and t is the tail entity. In complex space, multiplication rotates and scales. RotatE constrains relations to unit-modulus rotations, so relation semantics become phase changes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Training uses known triples as positives and generated false triples as negatives. The model moves entity and relation embeddings so positives receive high scores and negatives receive low scores. The paper also proposes self-adversarial negative sampling: hard negative examples receive more attention because they are the ones most likely to confuse the model.',
        'The elegant part is pattern modeling. Symmetric relations can be represented by rotations that equal their own inverse. Antisymmetric relations use phases that do not. Inverse relations are conjugate rotations. Relation composition becomes multiplication of rotations, which adds phases. That gives the model a compact way to represent common graph regularities without hand-written rules.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'RotatE stores an embedding for each entity and relation, so memory is O((entities + relations) * dimensions). Training cost depends heavily on negative sampling and graph size. Large production graphs also need entity freshness, relation typing, incremental updates, and careful candidate generation. At query time, ranking every possible tail is expensive, so systems use filtered candidate sets, approximate nearest-neighbor search, or precomputed recommendations.',
        'The evaluation cost is subtle. Random edge splits can leak structure because the same entities and near-identical paths appear in train and test. Easy negative samples can make a model look better than it is. A serious link-prediction evaluation reports filtered metrics, relation types, split policy, negative sampling strategy, and failure cases.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Knowledge-graph embeddings support entity completion, product graph recommendations, biomedical relation discovery, fraud graph features, search ranking, question answering, and graph-enriched RAG. They connect directly to Graph Neural Networks because both learn representations over graph structure. RotatE is especially useful as a clean case study for how a representation choice - complex rotation - can encode a domain assumption.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'RotatE is not a symbolic theorem prover. It learns statistical geometry from graph facts and can reproduce graph bias, missingness, and staleness. It can infer plausible links, not guaranteed truth. Another misconception is that knowledge-graph embeddings replace graph databases. In practice they complement explicit graph storage: the database stores facts and permissions, while embeddings rank plausible candidates or features.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the arXiv paper at https://arxiv.org/abs/1902.10197 and the ICLR/OpenReview PDF at https://openreview.net/pdf?id=HkgEQnRqYQ. Study Graph BFS, PageRank, Graph Neural Networks, Embeddings & Similarity, Complex-Valued Neural Networks, HNSW (Vector Search at Scale), and Data Leakage & Contamination next.',
      ],
    },
  ],
};
