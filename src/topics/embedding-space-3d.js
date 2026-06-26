// The embedding space in TRUE 3D: words as floating points, meaning as
// distance, and the famous king âˆ’ man + woman arrow walked in front of
// your eyes. A navigable window into the geometry every LLM thinks in.

import { points3dState, InputError } from '../core/state.js';

export const topic = {
  id: 'embedding-space-3d',
  title: 'The Embedding Space, in 3D',
  category: 'AI & ML',
  summary: 'Words as floating points, meaning as distance — and king âˆ’ man + woman walked as an arrow through 3D space.',
  controls: [
    { id: 'view', label: 'Fly', type: 'select', options: ['through the space'], defaultValue: 'through the space' },
  ],
  run,
};


// A 3-D slice of an embedding space: clusters + a clean analogy parallelogram.
const WORDS = [
  { id: 'cat', label: 'cat', cluster: 'animals', x: 1.4, y: 6.2, z: 2.1 },
  { id: 'dog', label: 'dog', cluster: 'animals', x: 1.9, y: 6.6, z: 1.7 },
  { id: 'kitten', label: 'kitten', cluster: 'animals', x: 1.1, y: 5.8, z: 2.5 },
  { id: 'puppy', label: 'puppy', cluster: 'animals', x: 1.7, y: 6.1, z: 1.3 },
  { id: 'pizza', label: 'pizza', cluster: 'food', x: 7.1, y: 6.8, z: 1.6 },
  { id: 'sushi', label: 'sushi', cluster: 'food', x: 7.6, y: 7.2, z: 2.0 },
  { id: 'taco', label: 'taco', cluster: 'food', x: 7.3, y: 6.5, z: 2.4 },
  { id: 'man', label: 'man', cluster: 'people', x: 2.0, y: 1.0, z: 4.5 },
  { id: 'woman', label: 'woman', cluster: 'people', x: 2.8, y: 1.0, z: 5.7 },
  { id: 'king', label: 'king', cluster: 'royalty', x: 6.0, y: 4.0, z: 5.0 },
  { id: 'queen', label: 'queen', cluster: 'royalty', x: 6.78, y: 4.02, z: 6.18 },
  { id: 'prince', label: 'prince', cluster: 'royalty', x: 5.6, y: 3.5, z: 4.6 },
];
const AXES = { x: { min: 0, max: 8.5 }, y: { min: 0, max: 8 }, z: { min: 0, max: 7 } };
const at = (id) => WORDS.find((w) => w.id === id);
// king âˆ’ man + woman: the analogy\'s landing point.
const LANDING = {
  id: 'landing',
  label: 'king âˆ’ man + woman',
  cluster: 'royalty',
  x: at('king').x - at('man').x + at('woman').x,
  y: at('king').y - at('man').y + at('woman').y,
  z: at('king').z - at('man').z + at('woman').z,
};
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const cloud = (extraPoints = [], vectors = []) =>
  points3dState({ axes: AXES, points: [...WORDS, ...extraPoints], vectors });

export function* run(input) {
  if (String(input.view) !== 'through the space') throw new InputError('Pick a view.');

  yield {
    state: cloud(),
    highlight: {},
    explanation: 'You are floating inside an EMBEDDING SPACE — the geometry where models keep meaning. Every word is a point; the slow orbit is your tour. Embeddings & Similarity introduced the idea and t-SNE & UMAP: Seeing Embeddings flattened it onto paper; this page finally shows it with depth, because the structure IS spatial: colors mark semantic families, and the empty space between them is not decoration — it is the geometry of "these things are unrelated." Real models use ~768 dimensions; this is a faithful 3-D slice, which is three dimensions more honest than any list of numbers.',
  };

  yield {
    state: cloud(),
    highlight: { active: ['cat', 'dog', 'kitten', 'puppy'], compare: ['pizza', 'sushi', 'taco'] },
    explanation: 'First law of the space: DISTANCE IS MEANING. The animal words huddle in one neighborhood — and look closer: kitten floats nearest cat, puppy nearest dog, the fine structure of meaning preserved at every scale. The foods form their own constellation across the gap. No one programmed these neighborhoods; they emerged from training on text, because words used in similar sentences get pushed to similar coordinates. Every similarity search you have ever used — semantic search, RAG retrieval, HNSW: Approximate Nearest Neighbors — is just measuring distances in a room like this one.',
    invariant: 'Embedding training pushes co-occurring words together: neighborhoods are learned, never declared.',
  };

  yield {
    state: cloud([], [
      { id: 'manWoman', label: 'man â†’ woman', from: at('man'), to: at('woman') },
      { id: 'kingQueen', label: 'king â†’ queen', from: at('king'), to: at('queen') },
    ]),
    highlight: { active: ['manWoman', 'kingQueen'] },
    explanation: 'Second law, and the famous one: DIRECTIONS ARE RELATIONSHIPS. Watch the two arrows — man â†’ woman, and king â†’ queen. As the camera orbits, see it from any angle you like: they are PARALLEL, the same displacement copied to a different part of space. That shared direction is the "gender axis" the embedding learned, and it is not alone: country â†’ capital, verb â†’ past tense, singular â†’ plural — each a consistent arrow direction living somewhere in the space. Relationships, in this geometry, are vectors you can pick up and carry.',
    invariant: 'A consistent relationship appears as a consistent displacement vector, reusable anywhere in the space.',
  };

  yield {
    state: cloud([LANDING], [
      { id: 'walk1', label: 'âˆ’ man', from: at('king'), to: { x: at('king').x - at('man').x + 0, y: at('king').y - at('man').y + 0, z: at('king').z - at('man').z + 0 } },
      { id: 'walk2', label: '+ woman', from: { x: at('king').x - at('man').x, y: at('king').y - at('man').y, z: at('king').z - at('man').z }, to: LANDING },
    ]),
    highlight: { active: ['walk1', 'walk2'], found: ['landing'] },
    explanation: 'Now the party trick that announced this geometry to the world (word2vec, 2013): do ARITHMETIC on meaning. Start at king. Subtract man — the first arrow walks you away from maleness. Add woman — the second walks you back along the gender direction. You land at the glowing point… and the nearest word to that landing spot is queen. Nobody taught the model royalty or gender; the analogy fell out of the geometry, because both relationships had been encoded as directions. The equation king âˆ’ man + woman â‰ˆ queen is real, and you just watched it happen in space.',
  };

  yield {
    state: cloud([LANDING]),
    highlight: { found: ['landing', 'queen'], compare: ['prince'] },
    explanation: `The landing point sits ${dist(LANDING, at('queen')).toFixed(2)} units from queen — its nearest neighbor by a wide margin (prince is ${dist(LANDING, at('prince')).toFixed(1)} away). Two honest footnotes before you go: in real 768-D spaces the analogy trick is noisier than the legend says (it works for famous pairs, fumbles many others), and embeddings inherit the BIASES of their training text — the same arithmetic once completed doctor âˆ’ man + woman with nurse, a finding that launched a whole research field on debiasing. The geometry is powerful precisely because it learned from us — flaws included. Every LLM forward pass begins by stepping into a room like this; now you have stood inside one.`,
    invariant: 'The analogy resolves by nearest neighbor: the landing point\'s closest word completes the equation.',
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the 3D cloud as a small slice of a much larger vector space. Each label is a point, nearby points are similar under the learned representation, and arrows show relationship directions. The king minus man plus woman walk is nearest-neighbor arithmetic, not a symbolic proof.',
        {
          type: 'callout',
          text: 'Embedding spaces turn similarity into neighborhoods and relationships into reusable directions.',
        },
        'Active arrows show the relationship being carried through the space. Found points show the nearest landing result after vector arithmetic. The safe inference is geometric: if a relationship is encoded as a consistent displacement, moving that displacement to a new neighborhood can complete an analogy.',
        {type: 'image', src: './assets/gifs/embedding-space-3d.gif', alt: 'Animated walkthrough of the embedding space 3d visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Computers need a way to compare meaning, not just spelling. Keyword systems know that two strings match, but they do not know that kitten is close to cat or that return policy may answer a refund question. Embeddings exist to turn items into coordinates where distance can stand in for similarity.',
        'This matters because modern AI systems retrieve, rank, cluster, and reason over huge collections. A language model cannot treat words as isolated symbols if it needs to generalize from one phrase to another. Dense vectors give the model a reusable geometry for meaning, even when the exact words differ.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious representation is one-hot encoding. Give every word an index, set that position to 1, and leave every other position at 0. This is exact, easy to inspect, and unambiguous.',
        {
 




         type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/One_hot_encoding.png/330px-One_hot_encoding.png',
          alt: 'One hot encoded categorical values represented as sparse binary columns',
          caption: 'One-hot encoding preserves identity but gives no geometric notion of semantic neighborhood. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:One_hot_encoding.png',
        },
        'The problem is that one-hot vectors do not share structure. Cat and dog are just as orthogonal as cat and tax code. The representation preserves identity but throws away similarity, analogy, and generalization.',
 





     ],
  
  },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when exact identity is not enough. Search users ask for ideas, not index entries, and two documents can answer the same question with different words. A one-hot or keyword-only system cannot bridge that gap without hand-built synonyms and rules.',
        'The wall gets worse at scale. A vocabulary of 50,000 words creates 50,000-dimensional sparse vectors, and each new token is disconnected from every other token. The system can memorize labels, but it cannot easily learn that neighborhoods and directions should transfer.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to learn dense coordinates from usage. Words, passages, images, or code snippets that appear in similar contexts should land near each other. Meaning becomes a position learned from prediction pressure rather than a definition written by hand.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Vector_space_model.jpg/250px-Vector_space_model.jpg',
          alt: 'Vectors for documents and a query separated by angles in a vector space model',
          caption: 'Vector-space retrieval compares directions and distances between embedded items. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Vector_space_model.jpg',
        },
        'Once meaning is geometric, relationships can become directions. The displacement from man to woman can resemble the displacement from king to queen. That does not mean the model understands society; it means the training data made a useful regularity cheap to encode.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Training starts with randomly initialized vectors. A prediction task then adjusts them so that useful context pairs get closer and mismatched pairs move apart. Skip-gram predicts surrounding words from a center word, while CBOW predicts a word from surrounding context.',
        'After many updates, local neighborhoods emerge. Animal words cluster because they appear in overlapping contexts, foods form another region, and royalty words form another. The model was not given these clusters directly; the clusters lower prediction loss.',
        'Similarity search then becomes distance search. A query is embedded into the same space as the stored items, and the system returns nearest neighbors by cosine similarity, dot product, or Euclidean distance. Production systems add approximate nearest-neighbor indexes so this remains fast over millions or billions of vectors.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
 






       'It works because the training objective rewards useful compression. A vector cannot store a dictionary entry for every possible sentence, so it must place reusable information in coordinates. Items used in similar contexts become nearby because that arrangement helps future predictions.',
        'Relationship directions work when many examples share a pattern. If gender, tense, pluralization, capital-city pairs, or other relations recur often enough, the model can reduce loss by encoding the change as a displacement. The analogy trick is the visible side effect of that pressure.',
        'The result is statistical structure, not guaranteed logic. Nearest neighbors can complete famous analogies because the space is organized, but they can also expose bias and frequency artifacts. Embeddings inherit both the signal and the distortions in their training data.',
 


     ],
  
  },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost has two parts: making vectors and searching vectors. Training an embedding model can be expensive because it requires many prediction updates over large text or image corpora. Using a pretrained model is cheaper, but every new document still has to be embedded once.',
        'Storage scales with item count times dimension count. One million 768-dimensional float32 vectors require about 3 GB before index overhead. Brute-force search costs O(n * d) per query, so production retrieval usually uses HNSW, IVF, product quantization, or another approximate index.',
        'Approximation trades exactness for latency and memory. Higher recall needs more graph edges, probes, or candidate checks, which costs RAM and time. The right setting depends on whether missing a good neighbor is harmless, annoying, or product-breaking.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Semantic search is the direct use. Embed the query, embed the documents, and return the closest documents even when the words do not match exactly. Retrieval-augmented generation uses the same move to fetch grounding context for a language model.',
        'Embeddings also power recommendations, clustering, anomaly detection, duplicate detection, code search, image search, and agent memory. The shared pattern is that raw items become comparable points. Once that happens, ranking and grouping can use geometry instead of hand-written rules.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Embeddings fail when distance is treated as truth. A nearby point means the model placed two items close under its training objective, not that one causes the other or that the match is fair. High similarity can reflect shortcuts, popularity, duplicates, or bias.',
        'They also fail on out-of-domain language. A medical, legal, or code embedding model trained on generic text may miss specialized distinctions. If the geometry was not trained to preserve a distinction, nearest-neighbor search may confidently blur it.',
        'Visualization can mislead too. A 3D or 2D projection hides most axes and can invent apparent clusters. Use plots for intuition, but validate retrieval quality with task metrics, slice checks, and real queries.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with one-hot vectors for four words: cat, dog, fish, and car. Cat and dog have zero dot product because their 1 values sit in different positions. The representation says they are no more related than cat and car.',
        'Now use simple 2D embeddings: cat = [0.9, 0.8], dog = [0.85, 0.75], fish = [0.7, 0.6], and car = [-0.5, 0.3]. Cat and dog have very high cosine similarity because their coordinates point in nearly the same direction. Cat and car are much farther apart.',
        'The animation applies the same idea to relationships. King minus man plus woman lands near [6.8, 4.0, 6.2], while queen is near [6.78, 4.02, 6.18]. Nearest-neighbor search chooses queen because the displacement preserved the relationship in this slice.',
      ],
 



   },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Bengio et al., "A Neural Probabilistic Language Model," for early learned distributed word representations. Then read Mikolov et al., "Efficient Estimation of Word Representations in Vector Space," for word2vec, skip-gram, and CBOW. Pennington et al., "GloVe: Global Vectors for Word Representation," gives a complementary matrix-factorization view.',
 




       'Study tokenization to see what gets embedded, cosine similarity for the retrieval metric, t-SNE and UMAP for visualization, and HNSW for fast nearest-neighbor search. Then study attention, because transformers start with embeddings and then build context-dependent representations from them.',
      ],
    },
  ],
}



;
