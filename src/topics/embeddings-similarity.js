// Embeddings: meaning as geometry. Words become points; similar meanings
// sit close together; "find similar" becomes "find nearest" — the idea
// behind vector databases, semantic search, and RAG.

import { scatterState, InputError } from '../core/state.js';

export const topic = {
  id: 'embeddings-similarity',
  title: 'Embeddings & Similarity',
  category: 'AI & ML',
  summary: 'Meaning as geometry: similar words sit close together, and search becomes "find my neighbors".',
  controls: [
    { id: 'query', label: 'Find words similar to', type: 'select', options: ['cat', 'pizza', 'truck'], defaultValue: 'cat' },
  ],
  run,
};


// A hand-made 2D embedding space. Real embeddings have hundreds or
// thousands of dimensions and are LEARNED — but distance works the same.
const WORDS = [
  { label: 'cat', x: 2.0, y: 7.5 }, { label: 'dog', x: 2.8, y: 8.1 },
  { label: 'kitten', x: 1.4, y: 7.0 }, { label: 'horse', x: 3.6, y: 7.0 },
  { label: 'pizza', x: 7.6, y: 7.8 }, { label: 'burger', x: 8.4, y: 7.2 },
  { label: 'sushi', x: 7.0, y: 8.4 }, { label: 'taco', x: 8.2, y: 8.3 },
  { label: 'truck', x: 5.0, y: 1.6 }, { label: 'car', x: 4.2, y: 2.2 },
  { label: 'bicycle', x: 5.8, y: 2.4 }, { label: 'bus', x: 4.6, y: 1.0 },
];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function* run(input) {
  const queryWord = String(input.query);
  const queryPoint = WORDS.find((w) => w.label === queryWord);
  if (!queryPoint) throw new InputError('Pick one of the listed words.');

  const points = WORDS.map((w, i) => ({ id: `e${i}`, ...w }));
  const queryId = points.find((p) => p.label === queryWord).id;
  const snapshot = () => scatterState({
    points,
    axes: { x: { label: 'dimension 1 (of 2 here; thousands in real models)' }, y: { label: 'dimension 2' } },
  });

  yield {
    state: snapshot(),
    highlight: {},
    explanation: 'An EMBEDDING turns a word (or sentence, or image) into a list of numbers — a point in space. The magic is in how the points are arranged: models learn to place similar meanings close together. Look: animals cluster top-left, foods top-right, vehicles at the bottom. Nobody labeled these groups — they emerge from how words are used.',
  };

  yield {
    state: snapshot(),
    highlight: { active: [queryId] },
    explanation: `Query: "find things similar to ${queryWord}". With embeddings this stops being a language problem and becomes GEOMETRY: just measure the distance from "${queryWord}" to every other point. (Real systems use cosine similarity — the angle between vectors — but the idea is identical: closer = more similar.)`,
  };

  const ranked = points
    .filter((p) => p.id !== queryId)
    .map((p) => ({ ...p, d: dist(p, queryPoint) }))
    .sort((a, b) => a.d - b.d);

  for (let i = 0; i < 3; i += 1) {
    const hit = ranked[i];
    yield {
      state: snapshot(),
      highlight: { active: [queryId], compare: [hit.id], found: ranked.slice(0, i).map((r) => r.id) },
      explanation: `Nearest neighbor #${i + 1}: "${hit.label}" at distance ${hit.d.toFixed(2)}. ${i === 0 ? 'No dictionary or synonym list is being consulted; proximity in the learned space is the similarity signal.' : 'The next closest point is still semantically related, but the larger distance shows a weaker match.'}`,
      invariant: 'Distance in embedding space â‰ˆ difference in meaning.',
    };
  }

  const farthest = ranked[ranked.length - 1];
  yield {
    state: snapshot(),
    highlight: { active: [queryId], found: ranked.slice(0, 3).map((r) => r.id), visited: [farthest.id] },
    explanation: `Top 3 for "${queryWord}": ${ranked.slice(0, 3).map((r) => `"${r.label}"`).join(', ')} — while "${farthest.label}" sits far away (${farthest.d.toFixed(2)}). This exact loop, scaled to millions of points and thousands of dimensions, is a VECTOR DATABASE. It's how semantic search finds documents "about" your question, and the R in RAG: embed the question, fetch the nearest chunks, hand them to the LLM. Meaning became geometry, so search became math.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each dot is a word placed at coordinates in a 2D embedding space. Position is the representation: words with similar meanings cluster together. Animals sit top-left, foods top-right, vehicles at the bottom. Nobody labeled these groups. They emerge because training pushes words that share context toward similar coordinates.',
        {
          type: 'callout',
          text: 'Embedding search works because the model moved meaning into geometry before the query ever arrives.',
        },
        'The highlighted dot is the query word. The system measures the distance from the query to every other point and returns the closest ones as "found" neighbors. The visited dot marks the farthest word. The gap between nearest and farthest is the signal: the space has captured meaningful structure, and "similar" has become "nearby."',
        {type: 'image', src: './assets/gifs/embeddings-similarity.gif', alt: 'Animated walkthrough of the embeddings similarity visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Computers cannot compare words by meaning unless words have a numeric form that encodes meaning. String matching tells you "cat" equals "cat," but it cannot tell you "cat" is closer to "kitten" than to "helicopter." Keyword search counts shared tokens but misses synonyms, paraphrases, and semantic relatedness entirely.',
        'An embedding maps each word to a dense vector of real numbers -- a point in a continuous space where geometric proximity encodes semantic similarity. The idea descends from the distributional hypothesis (Firth, 1957): "You shall know a word by the company it keeps." Bengio et al. (2003) first showed a neural language model could learn useful word vectors as a side effect of next-word prediction. Mikolov et al. (2013) made the idea practical at scale with Word2Vec, training on billions of tokens in hours rather than weeks.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Represent each word as a one-hot vector: a vector of length V (vocabulary size) with a 1 in that word\'s slot and 0 everywhere else. "cat" = [0,0,0,1,0,...,0]. This gives every word a unique identity. Equality checks and table lookups work fine.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/One_hot_encoding.png/330px-One_hot_encoding.png',
          alt: 'One hot encoded categorical values represented as sparse binary columns',
          caption: 'One-hot vectors encode identity but make distinct tokens orthogonal by construction. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:One_hot_encoding.png',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'One-hot vectors are orthogonal by construction. The dot product between any two distinct words is exactly 0, so cosine similarity between "cat" and "kitten" equals cosine similarity between "cat" and "quantum" -- both zero. The representation encodes identity but contains zero relational information.',
        'The dimensions are also absurd. A 100,000-word vocabulary produces 100,000-dimensional vectors that are 99.999% zeros. But the deeper problem is not storage waste -- it is information loss. No distance metric applied to one-hot vectors can recover similarity that was never encoded. You need a representation that places related words near each other before any downstream task can exploit their relationship.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Words that appear in similar contexts should receive similar vectors. "Cat" and "kitten" both appear near "pet," "fur," "purr," and "litter." "Cat" and "mortgage" almost never share context. A model that learns to predict context words from a target word (or vice versa) is forced to assign nearby vectors to words that substitute for each other in sentences. Meaning becomes geometry not because someone hand-defined similarity, but because co-occurrence statistics encode it implicitly.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Vector_space_model.jpg/250px-Vector_space_model.jpg',
          alt: 'Vector space model showing document vectors and query vector angles',
          caption: 'Embedding retrieval inherits the vector-space idea: compare points or directions after text becomes coordinates. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Vector_space_model.jpg',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Word2Vec (Mikolov et al., 2013) offers two architectures. Skip-gram takes a center word and predicts context words within a window. CBOW (Continuous Bag of Words) takes the surrounding words and predicts the center. Both use a shallow neural network: an input layer, one hidden layer (the embedding matrix), and a softmax output over the vocabulary. After training, the hidden-layer weights are the word vectors.',
        'Computing a full softmax over 100K+ words at every step is prohibitive. Negative sampling fixes this: each step updates the correct context word (positive sample) and a small random set of wrong words (typically 5-20 negative samples). The objective pushes dot products between co-occurring pairs up and between random pairs down. This reduces per-step cost from O(V) to O(k), where k is the number of negatives.',
        'GloVe (Pennington, Socher, and Manning, 2014) takes a different route. It builds a global word-word co-occurrence matrix from the corpus, then factorizes it: find vectors w_i, w_j such that w_i . w_j + biases approximates log(X_ij), where X_ij counts how often words i and j co-occur. The result captures the same distributional signal through matrix factorization rather than stochastic gradient descent.',
        'FastText (Bojanowski et al., 2017) extends Word2Vec by representing each word as a bag of character n-grams. The vector for "cat" is the sum of vectors for "<ca", "cat", "at>", plus the whole-word token. "Cats," "catlike," and "catfish" share subword components. FastText can produce vectors for words never seen during training by composing their n-grams -- solving the out-of-vocabulary problem that defeats Word2Vec and GloVe.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is the distributional hypothesis: words that fill the same syntactic and semantic slots receive similar vectors. "The ___ sat on the mat" accepts "cat," "dog," "child" but not "democracy" or "fourteen." Words that predict (and are predicted by) overlapping context words are pushed toward the same region of the space. The training objective enforces this -- maximizing co-occurrence dot products is equivalent to forcing contextually interchangeable words to converge.',
        'The result is more than clustering. The space develops linear structure: directions encode relationships. vec("king") - vec("man") + vec("woman") approximates vec("queen") because the gender direction is roughly parallel across word pairs. This analogy property (Mikolov et al., 2013) achieves about 60-70% accuracy on standard benchmarks -- imperfect, but its existence reveals that co-occurrence statistics encode relational structure, not just proximity.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Storage: each word\'s vector is d floats. A 100K vocabulary at d=300 in float32 costs 100,000 x 300 x 4 bytes = 120 MB. Double the vocabulary, double the storage. Embedding lookup is O(1) -- a single row index into the matrix.',
        'Training: Word2Vec with negative sampling processes about 1 billion tokens per hour on a single machine. Doubling the corpus doubles the wall-clock time linearly. GloVe first builds the co-occurrence matrix (one pass over the corpus, O(corpus_size)), then runs weighted least-squares factorization. The matrix is O(V^2) worst-case but sparse in practice -- a 100K vocabulary yields roughly 1 billion nonzero entries from a large corpus. FastText is 2-3x slower than Word2Vec per token because each word fans out to multiple n-gram updates.',
        'Similarity search: brute-force nearest-neighbor lookup over N vectors of dimension d costs O(N * d) per query. With N = 1 million and d = 300, that is 300 million multiply-adds per query. Approximate nearest-neighbor indexes (HNSW, IVF) reduce this to roughly O(d * log N) at the cost of occasional missed neighbors. Doubling the database size adds one more graph hop, not double the work.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Transfer learning in NLP: before end-to-end deep learning, pretrained word vectors were the standard first layer. Initializing with Word2Vec or GloVe and fine-tuning consistently beat random initialization, especially on small labeled datasets where the model could not learn good representations from scratch.',
        'Semantic search and recommendation: embed queries and documents in the same space, retrieve nearest neighbors. This pattern powers product search (embed descriptions), music recommendation (embed listening histories), and code search (embed function signatures and docstrings). The key access pattern is "find things semantically close to X" without requiring exact keyword overlap.',
        'Cross-lingual transfer: Mikolov et al. (2013b) showed a simple linear transform between independently trained English and Spanish embedding spaces could translate words, because the geometric structure is surprisingly similar across languages trained on comparable corpora.',
        'RAG (Retrieval-Augmented Generation): embed a user question, find the nearest document chunks in a vector database, and feed those chunks to an LLM as context. The embedding step converts "find relevant information" from a keyword-matching problem into a geometry problem.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Polysemy: Word2Vec assigns one vector per word. "Bank" (financial institution) and "bank" (river edge) collapse to the same point -- a frequency-weighted average of both senses. This limitation motivated contextual embeddings (ELMo, 2018; BERT, 2019), where the vector for "bank" depends on the surrounding sentence.',
        'Bias encoding: if the training corpus associates "doctor" with "he" and "nurse" with "she," the embedding space encodes those associations as geometric directions. Bolukbasi et al. (2016) showed debiasing requires explicit post-processing, and even then bias can leak into downstream tasks.',
        'Out-of-vocabulary words: Word2Vec and GloVe produce no vector for words absent from training data. A misspelling, a new brand name, or a rare technical term is simply unrepresentable. FastText mitigates this through subword composition, but quality depends on how much morphological overlap the unseen word shares with known vocabulary.',
        'Static averaging: even within a single word sense, meaning shifts with context. "Light" in "light beer," "light saber," and "light rain" carries different semantic weight. Static embeddings average all usages into one point -- adequate for coarse retrieval but a hard ceiling for fine-grained understanding.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose three words have learned 2D embeddings: cat = (2.0, 7.5), pizza = (7.6, 7.8), dog = (2.8, 8.1). Query: find the word most similar to "cat."',
        'Compute Euclidean distance from cat to each other word. dist(cat, dog) = sqrt((2.8 - 2.0)^2 + (8.1 - 7.5)^2) = sqrt(0.64 + 0.36) = sqrt(1.0) = 1.0. dist(cat, pizza) = sqrt((7.6 - 2.0)^2 + (7.8 - 7.5)^2) = sqrt(31.36 + 0.09) = sqrt(31.45) = 5.61.',
        'Dog wins: distance 1.0 vs. 5.61. No dictionary was consulted. The training process placed "cat" and "dog" nearby because they share context words ("pet," "fur," "feed"), while "cat" and "pizza" rarely co-occur. Similarity is read directly from geometry.',
        'Now consider cosine similarity, which measures the angle between vectors rather than raw distance. cos(cat, dog) = (2.0*2.8 + 7.5*8.1) / (sqrt(4+56.25) * sqrt(7.84+65.61)) = (5.6 + 60.75) / (7.76 * 8.57) = 66.35 / 66.50 = 0.998. cos(cat, pizza) = (2.0*7.6 + 7.5*7.8) / (7.76 * 10.88) = (15.2 + 58.5) / 84.45 = 73.7 / 84.45 = 0.873. Both metrics agree: dog is the nearest neighbor to cat. Cosine similarity is preferred in high dimensions because it is invariant to vector magnitude -- a word mentioned 10x more often than another gets a longer vector but points in the same direction.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Firth (1957), "A Synopsis of Linguistic Theory," introduced the distributional hypothesis. Bengio et al. (2003), "A Neural Probabilistic Language Model," first learned word vectors via neural language modeling. Mikolov et al. (2013), "Efficient Estimation of Word Representations in Vector Space" (https://arxiv.org/abs/1301.3781), introduced Word2Vec. Pennington, Socher, and Manning (2014), "GloVe: Global Vectors for Word Representation" (https://aclanthology.org/D14-1162/), derived embeddings from co-occurrence matrix factorization. Bojanowski et al. (2017), "Enriching Word Vectors with Subword Information," introduced FastText. Bolukbasi et al. (2016), "Man is to Computer Programmer as Woman is to Homemaker?" documented embedding bias.',
        'Study next: Attention Mechanism -- how Transformers replaced static embeddings with context-dependent representations. Tokenization (BPE) -- how modern models decompose words into subword tokens before embedding them. The Embedding Space in 3D -- geometric intuition for the king-queen analogy in a navigable space. t-SNE and UMAP -- how high-dimensional embeddings are projected for visualization, and the distortion artifacts those projections introduce.',
      ],
    },
  ],
};
