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
        "Read the animation as the execution trace for The Embedding Space, in 3D. Words as floating points, meaning as distance — and king âˆ’ man + woman walked as an arrow through 3D space..",
        {
          type: 'callout',
          text: "Embedding spaces turn similarity into neighborhoods and relationships into reusable directions.",
        },
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      
        {type: 'image', src: './assets/gifs/embedding-space-3d.gif', alt: 'Animated walkthrough of the embedding space 3d visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: `Why this exists`,
      paragraphs: [
        `An embedding space is the high-dimensional room where neural networks store meaning — a coordinate system in which every word, image, or concept is a point, and distance measures similarity. You have just floated through one: you saw semantic neighborhoods (kitten near cat), relationship directions (man to woman parallel to king to queen), and arithmetic on meaning (king âˆ’ man + woman landing near queen). These are not metaphors; they are the literal geometry that the model learned from training data. Every transformer-based LLM begins its forward pass inside a space like this, translating raw tokens into floating-point coordinates where the problem becomes "walk through this space to find the answer."`,
        `Embeddings replaced the old symbolic approach to meaning (a dictionary of fixed definitions) with a learned, distributed representation — many dimensions, each dimension capturing some subtle aspect of meaning that the training process discovered. A word is not defined anymore; it is positioned. The space was born from word2vec (2013) and has since evolved through larger models, multi-modal embeddings (text + image in the same space), and language models that embed entire passages. The magic is that meaning, learned purely from co-occurrence in training text, spontaneously organizes itself into structure: neighborhoods emerge, axes encode relationships, and analogy arithmetic works — none of it programmed in by hand.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `The old way to search text was to match tokens. That fails as soon as two people use different words for the same need, or the same word in different contexts. Keyword matching can find exact overlap, but it does not know that puppy belongs near dog, that physician belongs near doctor, or that refund policy and return rules may answer the same question.`,
        `Embeddings solve that wall by turning meaning into geometry. Once text becomes coordinates, search can ask for nearby meaning instead of identical spelling. This is why embeddings sit under semantic search, RAG, recommendations, clustering, and many modern agent memory systems.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start with raw text: millions or billions of sentences from books, web pages, and code. The training loop is deceptively simple — predict the next word given the context words around it, or predict context given a target word. During this prediction, the model learns to map each word to a coordinate in an N-dimensional space (N = 512, 768, or larger for modern LLMs). The objective is to make the model\'s guesses right: if the model predicts "cat" when it sees "kitten, the small furry," it adjusts the embeddings so that "kitten" and "cat" sit closer in space (because they appeared in overlapping contexts). Run this process over billions of examples, and neighborhoods crystallize: animals cluster together, foods cluster together, not because anyone declared it, but because the training signal pulled similar-context words toward similar coordinates.`,
        `Relationships emerge the same way. "King" and "queen" appear in similar contexts (royalty, authority), but they also have a systematic difference: king appears with male pronouns, queen with female. During training, the model learns that swapping the gender axis (a consistent direction in space) transforms king into queen, man into woman, prince into princess. These vectors are not stored explicitly; they fall out of the geometry. When you compute king âˆ’ man + woman, you are removing the "maleness" signal and adding the "femaleness" signal, walking through space along a learned direction. The model never saw the equation; it simply learned a space where that arithmetic makes sense.`,
        `The visualization you just saw is a faithful 3-D slice: a real embedding space in 768 dimensions looks identical in principle, just with 765 more axes. You cannot see those directions, so a 2-D projection like t-SNE or UMAP squashes the space onto paper (Embeddings & Similarity and t-SNE & UMAP: Seeing Embeddings show how). Searching in the space is efficient: to find the nearest neighbors (most similar embeddings), you compute distances using Euclidean distance, dot product, or cosine similarity. A full brute-force search is O(N) — expensive for billions of words — so production systems use approximate nearest neighbor indexes like HNSW: Approximate Nearest Neighbors to speed it up.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `Read the point cloud before the equations. Nearby points share context, colors mark rough semantic neighborhoods, and empty space is meaningful separation. The 3D view is only a slice of a much larger space, but the rule is the same: similarity search is distance search over learned coordinates.`,
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Vector_space_model.jpg/250px-Vector_space_model.jpg',
          alt: `Vectors for documents and a query separated by angles in a vector space model`,
          caption: `Vector-space retrieval compares directions and distances between embedded items. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Vector_space_model.jpg`,
        },
        `Then read the arrows as relationships. Parallel arrows mean the same kind of change appears in different neighborhoods. The king - man + woman step is nearest-neighbor arithmetic, not symbolic reasoning. It is powerful because the training data organized relationships geometrically, and risky because the same geometry can encode social bias.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The training objective forces useful geometry. Words, passages, or images that help solve similar prediction tasks are nudged toward similar coordinates, while mismatched examples are pushed apart. Over many examples, local neighborhoods become semantic neighborhoods because that arrangement makes prediction easier.`,
        `The same pressure also creates directions. If many pairs share a relationship, the model can reduce loss by encoding that relationship as a reusable displacement. The result is not symbolic reasoning, but it is structured enough that nearest-neighbor search and vector arithmetic become useful tools.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `Embedding cost is dominated by the training phase. For a language model: preprocess text (tokenization, cleaning), initialize random embeddings, and run many epochs of gradient descent on the prediction objective. A modern LLM embedding space (768 dimensions, trained on billions of tokens) requires weeks on a GPU cluster. Once trained, storing embeddings is cheap: V words Ã— D dimensions Ã— 4 bytes (float32) = your memory footprint. For a 10,000-word vocabulary in 768-D, that is roughly 30 MB. Searching an embedding space at inference time: for each query, compute its embedding (pass it through the model once, O(model-size)), then find its nearest neighbors. Brute-force search of N points is O(N Ã— D) distance computations. A vector database with HNSW indexing drops this to O(log N Ã— D) by navigating a hierarchical graph, trading memory for speed.`,
        `The honest cost: training a production embedding model from scratch is expensive and not recommended for small teams. Instead, use pretrained embeddings from OpenAI (text-embedding-3), Google (Gecko, Gecko-002), or open-source models (all-MiniLM-L6-v2, BGE). These cost cents per million tokens and handle the heavy lifting. You then embed your own documents once and search them billions of times for free (or nearly free).`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Semantic search: the canonical use case. A user types "best Italian restaurants near me"; embed the query, embed all restaurant descriptions in a vector database, return the nearest neighbors. Exact keyword search (does the name contain "Italian"?) is easy; semantic search (what is the user really asking for?) is solved by embeddings. Retrieval-Augmented Generation (RAG): the core of modern LLM applications. A user asks a question; embed it, retrieve the K nearest documents from a knowledge base, feed those documents to the LLM, get a grounded answer (preventing hallucination). E-commerce recommendation: embed product descriptions and user behavior, find customers most similar to you, recommend the products they liked. Image search: embed images and queries in the same space, find visually similar images by nearest neighbor (multi-modal embeddings). Clustering: run K-means on embeddings, automatically group documents by topic without labeled training data. Anomaly detection: points far from all others in embedding space are outliers — unusual transactions, rare document types, network intrusions.`,
        `Debiasing and fairness research: embeddings inherit biases from training text. Doctor âˆ’ man + woman â†’ nurse (gender bias); programmer âˆ’ male + female â†’ still male-skewed. This launched a research program on debiasing embeddings, and it works — by moving embeddings to neutralize harmful axes. Chatbots use embeddings to retrieve similar past conversations, feeding context into the generation model. Code search: GitHub Copilot embeds code snippets; a natural-language query is embedded and matched against a repository. Every major AI tool you use — search, recommendation, chatbot, code assistant — relies on embeddings at its core.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `The most dangerous misconception: thinking embeddings are inherently interpretable. They are not. A single dimension does not necessarily mean "size" or "color" or any human concept; it is a learned feature that is only meaningful relative to other dimensions. You can find approximate axes (gender, royalty) using the analogy trick, but the space is not a labeled, navigable grid — it is a tangled web of learned correlations. Do not trust a single embedding dimension for anything; always use the full vector for distance computations.`,
        `Another trap: confusing distance with causality. If "queen" is closest to the landing point of king âˆ’ man + woman, it is because both are in a royalty cluster, and both have aligned gender signals — the arithmetic resolves by coincidence and proximity, not because the equation "caused" it to be true. The analogy works better for some word pairs (king–queen, man–woman) than others; in real 768-D spaces, it is noisier than the legend suggests. Bias is not a pit fall, but a reality: embeddings will reflect training-text biases (gender, race, profession stereotypes). Debiasing requires deliberate work; do not assume embeddings are neutral.`,
        `Finally, embeddings are expensive to compute at search time if you do not use approximation. A full nearest-neighbor search over 1 million vectors takes milliseconds; a billion vectors becomes infeasible without HNSW or similar. Always index before you launch a production system, and always measure tail latency (the 99th percentile query time), not the average.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Start with Embeddings & Similarity to understand the intuition of floating-point coordinates and distance. Then read t-SNE & UMAP: Seeing Embeddings to see how to project high-D spaces onto paper — the same technique used to visualize real embeddings. Learn HNSW: Approximate Nearest Neighbors to see how production systems search embedding spaces fast. The Loss Landscape, in 3D shows another kind of high-dimensional geometry you will encounter — the space of model weights during training, shaped by the loss function. Finally, Matrix Completion & Recommenders uses embeddings for user-item similarities to power recommendation engines. You now have stood in the room where every LLM thinks; understanding how to search and use it is next.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `One-hot encoding: represent each word as a vector of size V (vocabulary) with a single 1. "cat" = [0,0,1,0,...,0], "dog" = [0,0,0,1,...,0]. The representation is unambiguous and trivial to build — assign each word an index, set that position to 1, leave the rest at 0.`,
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/One_hot_encoding.png/330px-One_hot_encoding.png',
          alt: `One hot encoded categorical values represented as sparse binary columns`,
          caption: `One-hot encoding preserves identity but gives no geometric notion of semantic neighborhood. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:One_hot_encoding.png`,
        },
        `Three problems kill it. (1) Vectors are huge — V=50,000 means 50,000-dimensional vectors, almost entirely zeros. (2) All pairs are equidistant — cos("cat","dog") = 0, the same as cos("cat","democracy"). No notion of similarity survives. (3) No generalization — the model cannot use what it learns about "cat" to help with "kitten," because the two vectors share no structure.`,
        `Embeddings (Bengio et al. 2003, Word2Vec by Mikolov et al. 2013) replace this with a dense vector of size d (typically 100-300) for each word, where similar words have similar vectors. Training: predict a word from its context (CBOW) or context from a word (Skip-gram). The result: "king" - "man" + "woman" approximates "queen" — the geometry encodes semantic relationships. Modern systems learn embeddings end-to-end as the first layer of every language model, not as a separate step.`,
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        `4-word vocabulary: {cat, dog, fish, car}. One-hot: cat=[1,0,0,0], dog=[0,1,0,0]. cos(cat,dog)=0 — no similarity signal at all.`,
        `Now suppose training has produced 2D embeddings: cat=[0.9,0.8], dog=[0.85,0.75], fish=[0.7,0.6], car=[-0.5,0.3]. Compute cosine similarity: cos(cat,dog) = (0.9*0.85 + 0.8*0.75) / (||cat|| * ||dog||) = 0.9998 — very similar. cos(cat,car) = (0.9*(-0.5) + 0.8*0.3) / (||cat|| * ||car||) is roughly 0.15 — dissimilar. The embedding space clusters animals together and vehicles apart. Distances encode meaning.`,
        `In the animation you just saw, the same principle operates in 3D: cat, dog, kitten, and puppy cluster tightly while foods and royalty occupy distinct regions. The king-man+woman arithmetic works because the gender relationship is a consistent displacement vector — subtract it from "king" and add it back in the female direction, and you land near "queen."`,
      ],
    },

    {
      heading: 'Sources and study next',
      paragraphs: [
        `Bengio et al. 2003, "A Neural Probabilistic Language Model" — the first learned word embeddings from a neural language model. Mikolov et al. 2013a, "Efficient Estimation of Word Representations in Vector Space" (https://arxiv.org/abs/1301.3781) — introduced Word2Vec with Skip-gram and CBOW, making embedding training practical at scale. Mikolov et al. 2013b, "Linguistic Regularities in Continuous Space Word Representations" — demonstrated word analogies and vector arithmetic. Pennington et al. 2014, "GloVe: Global Vectors for Word Representation" (https://aclanthology.org/D14-1162/) — a global matrix factorization approach to embeddings.`,
        `Study next: Tokenization (BPE) — what the embedding layer actually receives as input. Positional Encoding — how Transformers add position information to token embeddings, since embeddings alone carry no word-order signal. Attention Mechanism — operates on embedded representations to build context-dependent vectors. t-SNE & UMAP: Seeing Embeddings — how to project and visualize high-dimensional embeddings in 2D, and the projection artifacts that come with it. Dimensionality Reduction / PCA — the classic tool for understanding high-dimensional structure.`,
      ],
    },

    {
      heading: 'Learning map',
      paragraphs: [
        `Prerequisites: vector basics (distance, dot product, cosine similarity) and neural network basics (forward pass, loss function, gradient update). If you cannot compute the dot product of two 3D vectors or explain what a loss function measures, start there. Embeddings & Similarity on this site introduces the 2D intuition; this page adds depth.`,
        `Unlocks: the entire NLP pipeline (tokenization, language models, machine translation all consume embeddings as input), transfer learning (pretrained embeddings bootstrap new tasks with small data), understanding Transformer input layers (the first thing a Transformer does is look up an embedding for each token), recommendation systems (users and items become vectors in the same space), and the "king - man + woman = queen" analogy phenomenon that showed embeddings capture relational structure, not just proximity.`,
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you explain why one-hot vectors are orthogonal (cos=0) regardless of word meaning? (Any two distinct one-hot vectors have zero overlap — their dot product is always 0 because the single 1 in each vector occupies a different position.)',
            'Can you explain the Skip-gram training objective: given "the cat sat on the ___", predict context words from "sat"? (The model adjusts embeddings so words appearing in similar contexts get similar vectors.)',
            'Can you compute a word analogy: if v(king)-v(man)+v(woman)=v(queen), what operation finds "Paris is to France as Tokyo is to ___"? (Compute v(Tokyo)-v(Japan)+v(France) and find the nearest neighbor — it should land near v(Paris).)',
            'Can you explain why embedding dimension d is a tradeoff? (Too small = the vector cannot capture enough relationships, too large = overfitting, wasted compute, and diminishing returns on representational quality.)',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        `Take the animation's 3D coordinates for king=[6.0,4.0,5.0], man=[2.0,1.0,4.5], woman=[2.8,1.0,5.7]. Compute king - man + woman = [6.0-2.0+2.8, 4.0-1.0+1.0, 5.0-4.5+5.7] = [6.8, 4.0, 6.2]. Now check: queen=[6.78, 4.02, 6.18]. The landing point is within 0.03 units of queen — the analogy resolves by nearest neighbor in the space you just watched.`,
        `Next, try inventing 3D embeddings for "prince" and "princess" that preserve the same male-female offset. The offset is woman - man = [0.8, 0.0, 1.2]. So if prince=[5.6, 3.5, 4.6], then princess should be near [5.6+0.8, 3.5+0.0, 4.6+1.2] = [6.4, 3.5, 5.8]. Verify: is that point closer to queen than to any food or animal word? If yes, the relational structure is consistent.`,
      ],
    },
],
};
