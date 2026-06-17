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
      heading: 'The problem RotatE solves',
      paragraphs: [
        `A knowledge graph stores facts as triples: head entity, relation, tail entity. Paris located_in France is a triple. Marie Curie won Nobel Prize is a triple. A product belongs_to category, a drug treats disease, and a person works_at company are all triples. Real graphs are incomplete, so the central machine-learning task is link prediction: given a partial graph, rank which missing triples are likely true.`,
        `The naive way to solve this is to memorize neighborhoods or write symbolic rules. If a city is located in a country and that country is part of a continent, maybe the city is located in the continent. If one relation is the inverse of another, use that rule directly. Rules are interpretable, but they are brittle when facts are sparse, noisy, or too numerous to hand encode. Pure neighborhood counting also struggles when new links require generalizing across many similar patterns.`,
        `RotatE is a knowledge-graph embedding model that turns this symbolic problem into geometry. It represents entities as vectors in complex space and represents each relation as a rotation. A triple is plausible when applying the relation rotation to the head entity lands near the tail entity. This design is memorable because important relational patterns become simple phase algebra: inversion, symmetry, antisymmetry, and composition all have natural forms in complex multiplication.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `RotatE's central idea is that a relation can be a transformation instead of a label. If applying the relation to the head entity rotates it near the tail entity, the triple is plausible. That one choice makes relation patterns visible as geometry.`,
        `This is not symbolic proof. The model does not derive facts from rules. It learns a space where common graph regularities become cheap to represent, then uses distance to rank which missing links fit those regularities best.`,
      ],
    },
    {
      heading: 'From translations to rotations',
      paragraphs: [
        `Earlier embedding models often used translations. In a translation model, a relation is a vector offset: head plus relation should land near tail. That works for some patterns. If Paris plus located_in lands near France, and Berlin plus located_in lands near Germany, the relation vector captures a common offset. But translations have trouble with several relation types. Symmetric relations, inverse relations, and composed paths do not always behave like one fixed displacement.`,
        `RotatE changes the operation. Instead of adding a relation vector, it multiplies the head embedding by a relation embedding whose components have unit modulus. In complex numbers, multiplying by a unit complex number rotates the point around the origin without changing its radius. In multiple dimensions, each component can rotate by its own phase. The scoring rule is simple: compute the distance between h * r and t. Small distance means a high score for the triple.`,
        `This makes relation semantics phase changes. If a relation has an inverse, the inverse relation can be represented by the conjugate rotation. If two relations compose, their rotations multiply, which adds their phase angles. If a relation is symmetric, applying it forward and backward should be compatible with the same relation. If it is antisymmetric, the phase should not equal its own inverse. The model does not receive these rules as code; the geometry makes them easy to learn.`,
      ],
    },
    {
      heading: 'Training mechanics',
      paragraphs: [
        `Training starts from known graph triples as positives. For each positive triple, the learner creates negative triples by corrupting the head or tail: replace Paris with Nobel Prize, or replace France with Physics, while keeping the relation. Most corrupted triples are assumed false or at least unknown. The model is optimized so real triples receive better scores than negatives.`,
        `Negative sampling is not a detail. If negatives are too easy, the model can look strong without learning useful boundaries. A type-ignorant negative such as Paris won Physics is obviously wrong, while Paris located_in Europe may be a harder case depending on the graph schema. RotatE's paper introduced self-adversarial negative sampling, which gives more weight to negatives that the current model scores as plausible. The goal is to train on examples near the decision boundary instead of wasting updates on nonsense triples.`,
        `After training, link prediction becomes ranking. For a query like Marie Curie won ?, the system scores many candidate tails and returns the highest ranked entities. For a query like ? located_in France, it scores candidate heads. Evaluation often uses filtered ranking metrics, where other known true triples are removed from the negative candidate set so the model is not penalized for ranking an alternative true fact highly.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Complex numbers give RotatE a compact way to encode direction and reversible structure. A real-valued scalar can say larger or smaller. A complex value has an angle. Multiplication by a unit complex number changes that angle while preserving magnitude. Relations in knowledge graphs often behave more like transformations than attributes, so representing a relation as an angle change can be more expressive than treating it as a simple offset.`,
        `Inversion is the easiest example. If parent_of and child_of are inverse relations, moving from parent to child should be undone by moving from child to parent. In complex space, the inverse of a unit rotation is its conjugate. Composition is also natural. If city_to_country followed by country_to_region implies city_to_region, the composed relation corresponds to multiplying the first two rotations. Multiplication of complex rotations adds phases, so path composition has a clean geometric analogue.`,
        `Symmetry and antisymmetry are both important because many graph relations have direction. Similar_to is symmetric: if x is similar to y, y is similar to x. Born_before is antisymmetric: if x was born before y, y was not born before x. A good knowledge-graph model should represent both without changing architecture. RotatE's phase constraints make those cases easier to express than a single translation scheme.`,
      ],
    },
    {
      heading: 'Where it is used',
      paragraphs: [
        `Knowledge-graph embeddings are used when explicit graph facts are valuable but incomplete. In commerce, they can suggest product-category links, substitute products, compatible accessories, or brand-entity relationships. In biomedical graphs, they can rank plausible drug-disease, protein-protein, or gene-pathway links for expert review. In security and fraud systems, they can turn account, device, transaction, and merchant graphs into features or suspicious-link candidates. In search and question answering, they can fill entity relations that improve retrieval and ranking.`,
        `RotatE is also useful as a case study in representation design. It shows that an embedding model is not only a compression method. Its geometry encodes assumptions about the domain. If relations in a graph often have inverses and compositional paths, a rotational geometry gives the learner a helpful bias. If the graph is dominated by hierarchical types, literals, text descriptions, or rich node attributes, a pure triple embedding may need to be combined with text encoders, graph neural networks, or rule systems.`,
        `In retrieval-augmented generation, knowledge-graph embeddings can help rank candidate entities or missing links before a language model writes an answer. They should not be treated as truth by themselves. They are better viewed as a recall and ranking layer that proposes plausible structured facts for downstream verification.`,
      ],
    },
    {
      heading: 'Evaluation traps',
      paragraphs: [
        `Knowledge-graph embedding benchmarks are easy to overstate. A random edge split can leak information because the same entities, relation neighborhoods, and near-duplicate paths appear in both training and test. If the task is to predict new facts about already-seen entities, that may be acceptable. If the real task is to generalize to new entities or future graph snapshots, the split must reflect that. Time-based splits and entity-disjoint splits are harder but often more honest.`,
        `Negative construction also changes the meaning of the score. Replacing a tail with a random entity often creates absurd negatives, especially in typed graphs. A model that separates country entities from award entities may do well without learning the relation deeply. Harder typed negatives ask whether Paris is located in France rather than Germany, or whether a drug treats disease A rather than disease B. Those negatives are more expensive and sometimes ambiguous, but they better test useful reasoning.`,
        `Filtered metrics need careful interpretation. Mean reciprocal rank and Hits@K summarize ranking quality, but they do not prove that top-ranked missing links are true in the world. A graph is incomplete, so some "negative" candidates may actually be unrecorded positives. The right production loop often routes high-scoring predictions to human review, external evidence retrieval, or delayed validation against future graph updates.`,
      ],
    },
    {
      heading: 'Limits and tradeoffs',
      paragraphs: [
        `RotatE is not a symbolic theorem prover. It learns statistical regularities from observed triples. If the graph is biased, stale, or missing whole classes of facts, the embeddings inherit those problems. If the graph records social or institutional patterns, the model can reproduce inequities in recommendations or risk scores. If facts change over time, a stale embedding table can rank obsolete links confidently.`,
        `It also does not replace a graph database. A database stores explicit facts, provenance, permissions, and queryable structure. RotatE stores dense vectors that rank plausibility. In a serious system, the database remains the source of truth, while embeddings support candidate generation, ranking, completion, or features for another model. That division matters because vector similarity is not an audit trail.`,
        `The main tradeoff is between expressive bias and operational simplicity. RotatE's geometry is elegant and cheap compared with large neural encoders, but it uses learned embeddings for entities. New entities need embeddings, retraining, or an inductive extension. Text-rich or attribute-rich graphs may benefit from models that read descriptions rather than only IDs. Very large graphs need approximate retrieval, sharding, refresh pipelines, and monitoring for drift.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study the original paper at https://arxiv.org/abs/1902.10197 and its OpenReview version at https://openreview.net/pdf?id=HkgEQnRqYQ. Then study Embeddings and Similarity, Graph BFS, PageRank, Graph Neural Networks, Complex-Valued Neural Networks, HNSW for vector search, and Data Leakage and Contamination. Together they explain the full stack: graph structure, representation geometry, retrieval infrastructure, and the evaluation discipline needed before link-prediction numbers should be trusted.`,
      ],
    },
  ],
};
