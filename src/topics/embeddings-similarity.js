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
        'Each dot is a word placed at coordinates in a 2D embedding space. The position is the representation: words that mean similar things land near each other, forming visible clusters (animals top-left, foods top-right, vehicles bottom). Nobody hand-labeled these groups. They emerge because the training process pushes words that appear in similar contexts toward similar coordinates.',
        {
          type: 'callout',
          text: 'Embedding search works because the model moved meaning into geometry before the query ever arrives.',
        },
        'The highlighted dot is the query word. The system measures the distance from the query to every other point and returns the closest ones as "found" neighbors. The visited dot marks the farthest word. The gap between nearest and farthest is the signal: the space has captured meaningful structure, and "similar" has become "nearby."',
      
        {type: 'image', src: './assets/gifs/embeddings-similarity.gif', alt: 'Animated walkthrough of the embeddings similarity visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Computers cannot compare words by meaning unless words have a numeric form that encodes meaning. String matching can tell you "cat" and "cat" are identical, but it cannot tell you "cat" is closer to "kitten" than to "helicopter." Keyword search counts shared tokens but misses synonyms, paraphrases, and semantic relatedness.',
        'Word embeddings solve this by mapping each word to a dense vector of real numbers -- a point in a continuous space where geometric proximity encodes semantic similarity. The idea descends from the distributional hypothesis (Firth, 1957): "You shall know a word by the company it keeps." Bengio et al. (2003) first showed that a neural language model could learn useful word vectors as a side effect of predicting the next word. Mikolov et al. (2013) made the idea practical at scale with Word2Vec, training on billions of tokens in hours rather than weeks.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Represent each word as a one-hot vector: a vector of length V (vocabulary size) with a 1 in that word\'s position and 0 everywhere else. "cat" = [0,0,0,1,0,...,0]. This gives every word a unique identity and works for table lookups.',
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
        'One-hot vectors are orthogonal. The dot product between any two distinct words is exactly 0, so cosine similarity says "cat" vs. "kitten" is the same as "cat" vs. "quantum." The representation encodes identity but zero relational information.',
        'The dimensions are also absurd. A 100,000-word vocabulary means 100,000-dimensional vectors that are 99.999% zeros. Storing and multiplying these sparse vectors is wasteful. But the deeper problem is not efficiency -- it is information loss. No distance metric applied to one-hot vectors can recover similarity that was never encoded. You need a representation that places related words near each other before any downstream task can exploit their relationship.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Words that appear in similar contexts should get similar vectors. "Cat" and "kitten" both appear near "pet," "fur," "purr," and "litter." "Cat" and "mortgage" almost never share context. A model that learns to predict context words from a target word (or vice versa) is forced to assign similar vectors to words that substitute for each other in sentences. Meaning becomes geometry not because someone defined similarity by hand, but because co-occurrence statistics encode it implicitly.',
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
        'Word2Vec (Mikolov et al., 2013) offers two architectures. Skip-gram takes a center word and predicts context words within a window. CBOW (Continuous Bag of Words) takes the context words and predicts the center. Both use a shallow neural network: an input layer, one hidden layer (the embedding matrix), and an output layer over the vocabulary. After training, the hidden-layer weights are the word vectors.',
        'Training on a full softmax over 100K+ words is expensive. Negative sampling makes it tractable: instead of updating all output weights, each training step updates the correct context word (positive sample) and a small random set of incorrect words (negative samples, typically 5-20). The objective pushes the dot product between co-occurring word pairs up and between random pairs down.',
        'GloVe (Pennington, Socher, and Manning, 2014) takes a different route. It builds a global word-word co-occurrence matrix from the corpus, then factorizes it: find vectors w_i, w_j such that w_i . w_j + biases approximates log(X_ij), where X_ij is how often words i and j co-occur. The result captures the same distributional signal as Word2Vec but through matrix factorization rather than stochastic prediction.',
        'FastText (Bojanowski et al., 2017) extends Word2Vec by representing each word as a bag of character n-grams. The vector for "cat" is the sum of vectors for "<ca", "cat", "at>", plus the word itself. This handles morphology: "cats," "catlike," and "catfish" share subword components. Critically, FastText can produce vectors for words never seen during training by composing their n-grams, solving the out-of-vocabulary problem that plagues Word2Vec and GloVe.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The distributional hypothesis is the foundation. Words that fill the same syntactic and semantic slots -- "the ___ sat on the mat" accepts "cat," "dog," "child" but not "democracy" or "fourteen" -- are pushed toward similar regions of the space because they predict (and are predicted by) overlapping context words.',
        'The result is more than simple clustering. The embedding space develops linear structure: directions encode relationships. vec("king") - vec("man") + vec("woman") approximates vec("queen") because the gender direction (man to woman) is roughly parallel to the royalty-gender direction (king to queen). This analogy property, first demonstrated by Mikolov et al. (2013), showed that word vectors capture relational structure, not just proximity. The linear regularity is not perfect (about 60-70% accuracy on standard analogy benchmarks), but its existence reveals that co-occurrence statistics encode far more structure than anyone expected.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Embedding dimension is typically 100-300. Each word\'s vector is stored as d floats, so a 100K vocabulary at d=300 in float32 costs about 120 MB. Once trained, looking up a word\'s embedding is O(1) -- a single index into the matrix.',
        'Training cost depends on approach. Word2Vec with negative sampling processes billions of tokens in a few hours on a single machine. GloVe requires building the co-occurrence matrix first (O(corpus_size) to scan, O(V^2) worst-case for the matrix, though in practice it is sparse), then running the factorization. FastText is slower than Word2Vec because each word generates multiple n-gram updates, but it remains single-machine tractable for corpora in the billions of tokens.',
        'The real cost is data. Embeddings trained on small corpora are noisy. The famous analogy results require training on at least a billion words (Google News, Wikipedia, Common Crawl). For most practitioners, the answer is to download pretrained vectors rather than train from scratch.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'NLP preprocessing: before deep learning models became end-to-end, pretrained word vectors were the standard first layer. Initializing with Word2Vec or GloVe embeddings and fine-tuning consistently outperformed random initialization, especially on small labeled datasets. This was one of the earliest forms of transfer learning in NLP.',
        'Semantic search and recommendation: embed queries and documents in the same space, then retrieve nearest neighbors. The same approach works for product search (embed product descriptions), music recommendation (embed listening histories), and code search (embed function signatures and docstrings).',
        'Machine translation: Mikolov et al. (2013b) showed that a simple linear transform between independently trained English and Spanish embedding spaces could translate words, because the geometric structure is surprisingly similar across languages.',
        'Analogy and relational reasoning: the king-queen analogy is the famous example, but the same arithmetic works for country-capital pairs, verb tenses, and comparative-superlative forms. This made word vectors a diagnostic tool for probing what language models learn.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Polysemy. Word2Vec assigns one vector per word. "Bank" (financial institution) and "bank" (river edge) get the same vector, which is the average of both senses weighted by frequency. This was the core limitation that motivated contextual embeddings (ELMo, Peters et al., 2018; BERT, Devlin et al., 2019), where the vector for "bank" depends on the surrounding sentence.',
        'Bias amplification. If the training corpus contains social stereotypes -- "doctor" near "he," "nurse" near "she" -- the embedding space faithfully encodes those biases as geometric directions. Bolukbasi et al. (2016) showed that debiasing requires explicit post-processing, and even then, bias can persist in downstream tasks.',
        'Out-of-vocabulary words. Word2Vec and GloVe cannot represent words absent from training data. A misspelling, a new product name, or a technical term produces no vector at all. FastText partially solves this with subword decomposition, but the quality of out-of-vocabulary vectors depends on how much morphological structure the unseen word shares with known words.',
        'Static representations. Even within a single sense, word meaning shifts with context. "Light" in "light beer" vs. "light saber" vs. "light rain" carries different semantic weight. Static embeddings average all usages into one point. This is adequate for many retrieval and classification tasks but fundamentally limits fine-grained understanding.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Train Skip-gram on the sentence "the cat sat on the mat" with window size 2 and embedding dimension 3. Initialize all word vectors randomly.',
        'For center word "cat" at position 2, the context window covers positions 0-1 and 3-4: {"the", "sat"}. Skip-gram generates two positive training pairs: (cat, the) and (cat, sat). For each positive pair, sample 2 negative words at random -- say "on" and "mat" for the first pair.',
        'The training step for (cat, the) with negatives {on, mat}: compute dot products cat.the, cat.on, cat.mat. Push cat.the higher (these words co-occur) and cat.on, cat.mat lower (these pairings are random noise). The gradient update nudges the cat vector toward the the vector and away from on and mat. Simultaneously, the, on, and mat vectors update symmetrically.',
        'Repeat for every center word in every sentence in the corpus. After billions of such updates, words that share many context partners converge to nearby points. "Cat" and "kitten" both co-occur with "pet," "fur," "small," and "cute," so their vectors are pushed toward the same region by thousands of overlapping context signals. "Cat" and "mortgage" share almost no context, so no gradient ever pushes them together.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Firth (1957), "A Synopsis of Linguistic Theory," introduced the distributional hypothesis. Bengio et al. (2003), "A Neural Probabilistic Language Model," first learned word vectors via neural language modeling. Mikolov et al. (2013), "Efficient Estimation of Word Representations in Vector Space" (https://arxiv.org/abs/1301.3781), introduced Word2Vec. Pennington, Socher, and Manning (2014), "GloVe: Global Vectors for Word Representation" (https://aclanthology.org/D14-1162/), derived embeddings from co-occurrence matrix factorization. Bojanowski et al. (2017), "Enriching Word Vectors with Subword Information," introduced FastText. Bolukbasi et al. (2016), "Man is to Computer Programmer as Woman is to Homemaker?" documented embedding bias.',
        'Study next: Attention Mechanism to see how Transformers replaced static embeddings with context-dependent representations. BERT and contextual embeddings to understand the successor paradigm. Tokenization (BPE) to learn how modern models decompose words before embedding them. The Embedding Space, in 3D to build geometric intuition for the king-queen analogy. t-SNE and UMAP to understand how high-dimensional embeddings are projected for visualization, and the artifacts those projections introduce.',
      ],
    },
  ],
};
