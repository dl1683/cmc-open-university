// Trie (prefix tree): store words letter by letter so shared prefixes are
// stored once — and autocomplete becomes "walk the prefix, harvest the
// subtree". The structure behind every search box suggestion.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'trie',
  title: 'Trie (Prefix Tree)',
  category: 'Data Structures',
  summary: 'Words stored letter by letter, prefixes shared — autocomplete is just a subtree walk.',
  controls: [
    { id: 'prefix', label: 'Autocomplete', type: 'select', options: ['ca', 'car', 'do', 'x (absent)'], defaultValue: 'ca' },
  ],
  run,
};

const WORDS = ['cat', 'car', 'card', 'care', 'do', 'dog'];

function makeNode(path, char) {
  return { path, char, children: new Map(), isWord: false };
}

export function* run(input) {
  const prefix = String(input.prefix).split(' ')[0];
  if (!['ca', 'car', 'do', 'x'].includes(prefix)) throw new InputError('Pick a prefix.');

  const root = makeNode('', '·');

  const snapshot = () => {
    const nodes = [];
    const edges = [];
    let cursor = 0;
    let maxDepth = 0;
    (function place(node, depth) {
      maxDepth = Math.max(maxDepth, depth);
      let x;
      const kids = [...node.children.values()];
      if (kids.length === 0) {
        x = cursor++;
      } else {
        const xs = kids.map((kid) => place(kid, depth + 1));
        x = (xs[0] + xs[xs.length - 1]) / 2;
        if (node.isWord) cursor = Math.max(cursor, x + 1);
      }
      nodes.push({
        id: `t:${node.path}`,
        label: node.char,
        x: x * 1.7 + 1,
        y: depth * 1.85 + 0.8,
        note: node.isWord ? `"${node.path}"` : '',
      });
      for (const kid of kids) {
        edges.push({ id: `e:${kid.path}`, from: `t:${node.path}`, to: `t:${kid.path}` });
      }
      return x;
    })(root, 0);
    return graphState({ nodes, edges }, { depth: maxDepth });
  };

  yield {
    state: snapshot(),
    highlight: {},
    explanation: 'A Hash Table can tell you whether "card" exists — but ask it for "every word starting with ca" and it must scan EVERYTHING. The trie\'s move: store words one CHARACTER per edge, so words sharing a prefix share a path. Lookups cost O(length of the word) — completely independent of how many words are stored.',
  };

  for (const word of WORDS) {
    let node = root;
    let reused = 0;
    for (const ch of word) {
      if (node.children.has(ch)) {
        reused += 1;
        node = node.children.get(ch);
      } else {
        const child = makeNode(node.path + ch, ch);
        node.children.set(ch, child);
        node = child;
      }
    }
    node.isWord = true;
    const pathIds = word.split('').map((_, i) => `t:${word.slice(0, i + 1)}`);
    yield {
      state: snapshot(),
      highlight: { active: pathIds, found: [`t:${word}`] },
      explanation: `insert("${word}"): walk letter by letter from the root${reused > 0 ? `, REUSING the existing "${word.slice(0, reused)}" path` : ''}, creating ${word.length - reused} new node${word.length - reused === 1 ? '' : 's'}, and mark the final node as a complete word. ${reused > 0 ? 'Shared prefixes are stored exactly once — that is the entire space trick.' : ''}`,
      invariant: 'Every path from the root spells a prefix of at least one stored word.',
    };
  }

  // autocomplete: walk the prefix
  let node = root;
  let walked = '';
  let deadEnd = false;
  for (const ch of prefix) {
    if (!node.children.has(ch)) { deadEnd = true; break; }
    node = node.children.get(ch);
    walked += ch;
    yield {
      state: snapshot(),
      highlight: { active: [`t:${walked}`], visited: walked.length > 1 ? walked.slice(0, -1).split('').map((_, i) => `t:${walked.slice(0, i + 1)}`) : [] },
      explanation: `autocomplete("${prefix}"): follow '${ch}' → now at "${walked}". ${walked.length} hop${walked.length === 1 ? '' : 's'}, regardless of whether the dictionary holds six words or six million.`,
    };
  }

  if (deadEnd) {
    yield {
      state: snapshot(),
      highlight: { visited: walked ? walked.split('').map((_, i) => `t:${walked.slice(0, i + 1)}`) : [] },
      explanation: `Dead end: no '${prefix[walked.length]}' branch exists after "${walked}" — so NOTHING in the dictionary starts with "${prefix}", proven in ${walked.length + 1} steps without looking at a single stored word. (A hash table would still be scanning.)`,
    };
    return;
  }

  // harvest the subtree
  const completions = [];
  const subtree = [];
  (function collect(n) {
    subtree.push(`t:${n.path}`);
    if (n.isWord) completions.push(n.path);
    for (const kid of n.children.values()) collect(kid);
  })(node);

  yield {
    state: snapshot(),
    highlight: { range: subtree, found: completions.map((w) => `t:${w}`), active: [`t:${walked}`] },
    explanation: `Now harvest: every word below "${walked}" starts with "${walked}" by construction, so autocomplete is a plain subtree walk (see Tree Traversals). Suggestions: ${completions.map((w) => `"${w}"`).join(', ')} — ${completions.length} completions, found in O(prefix + results).`,
  };

  yield {
    state: snapshot(),
    highlight: { found: completions.map((w) => `t:${w}`) },
    explanation: 'That is every search-box suggestion you have ever seen: the browser address bar, your phone keyboard\'s next-word guesses, IDE symbol completion. The same longest-prefix walk routes internet packets (routers store IP prefixes in a trie) — and a compressed cousin (the radix trie) indexes keys inside databases. One structure, one idea: let common beginnings be common.',
  };
}

export const article = {
  sections: [
    {
      heading: 'Why tries exist',
      paragraphs: [
        `A trie exists because many string problems are not really whole-string problems. Search boxes ask for every word that begins with what the user has typed. Routers ask for the longest stored IP prefix that matches an address. Spell checkers, command palettes, tokenizers, IDE symbol indexes, and dictionary engines all care about shared beginnings.`,
        `A flat collection of complete strings hides that structure. It can tell you whether "care" is present, but it does not give the prefix "car" a place in the data structure. A trie turns every prefix into a reachable node. Once the query reaches that node, the rest of the dictionary outside that subtree is irrelevant.`,
      ],
    },
    {
      heading: 'The baseline and the wall',
      paragraphs: [
        `The obvious baseline is a hash table of complete words. For exact lookup, it is hard to beat. "Is card in the dictionary?" becomes a hash computation and a bucket check. A sorted array or balanced tree is also reasonable when ordered iteration matters.`,
        `The wall appears when the query asks for a prefix. A hash table must scan keys or maintain a separate index for prefixes. A sorted array can binary-search the beginning of a prefix range, but it still stores the same leading characters again and again in every word. As prefix queries become the main workload, hiding common beginnings inside full strings becomes the wrong representation.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The core insight is to store a key as a path from the root. Each edge consumes one symbol. If two words begin with the same symbols, they share the same path until the first symbol where they differ. The trie stores the shared beginning once and branches only at the point of disagreement.`,
        `The node is not just a container; it has meaning. The node reached by c then a represents the prefix "ca". Every descendant of that node starts with "ca". A terminal marker says that the path itself is a complete key, which is why "car" can be present even when "card" and "care" continue below it.`,
      ],
    },
    {
      heading: 'Invariant',
      paragraphs: [
        `The invariant is path meaning: the sequence of edge labels from the root to a node is exactly the prefix represented by that node. Every terminal descendant of a prefix node is a stored key with that prefix. Every stored key with that prefix must be in that subtree.`,
        `This invariant gives the trie its strongest negative result. If a required child edge is missing while walking a prefix, no stored key can have that prefix. A missing branch is proof, not a guess. That is why autocomplete for an absent first character can return immediately without reading the rest of the dictionary.`,
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        `Insertion starts at the root and consumes one symbol at a time. If the next child already exists, the insertion reuses it. If the child does not exist, the insertion creates it. After the last symbol, the node is marked terminal. Without that marker, the structure could not distinguish "car is a stored word" from "car is only a prefix of longer stored words."`,
        `Exact lookup follows the same path and then checks the terminal marker. Prefix lookup follows only the prefix. If the walk succeeds, autocomplete is a traversal of the descendant subtree that collects terminal nodes. If the walk fails, the result is empty immediately. The algorithm spends time on the query prefix and the returned results, not on unrelated words.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Correctness follows from insertion preserving the path invariant. When a word is inserted, the algorithm creates exactly the missing edges needed to spell it and marks exactly the final node terminal. Therefore every inserted word has a root-to-terminal path whose labels spell the word.`,
        `Exact lookup is correct because it accepts only when that path exists and the final node is terminal. Autocomplete is correct because descendants preserve the prefix that reached their ancestor. After walking "ca", every terminal node below that point spells a word beginning with "ca", and any inserted word beginning with "ca" must have passed through the same node during insertion.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Insert "cat" into an empty trie. The root gains a c child, c gains an a child, a gains a t child, and the t node is marked terminal. Insert "car" next. The c and a nodes already exist, so the insertion reuses them and creates only r. The two words share c-a and split at the last letter.`,
        `Now insert "card" and "care". Both reuse c-a-r. One creates a d child and marks it terminal; the other creates an e child and marks it terminal. Autocomplete "car" walks c, a, r. The r node itself is terminal, so "car" is a result. The traversal below r also finds "card" and "care". Autocomplete "x" fails at the root, proving the result is empty in one missing-edge check.`,
      ],
    },
    {
      heading: 'Cost model',
      paragraphs: [
        `Insertion and exact lookup cost O(L), where L is the key length in symbols. Prefix lookup costs O(P) to reach the prefix node, where P is the prefix length, plus the cost of enumerating the output subtree. This is the central performance promise: lookup time depends on the string being walked and the results being returned, not directly on the number of stored keys.`,
        `Space is the tradeoff. A plain trie can allocate many nodes, especially when keys share little prefix structure. Child representation matters. A fixed array per node is fast for a tiny alphabet but wasteful for sparse Unicode. A map per node saves space but adds hashing or tree lookup cost. Packed arrays, sorted child lists, radix compression, and PATRICIA-style bit tries all adjust this memory-speed tradeoff.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Tries win when prefix is the natural query shape: autocomplete, IDE symbol completion, command lookup, dictionary search, spell-check candidate generation, longest-prefix IP routing, ordered byte-key dictionaries, tokenizer prefix lookup, and hierarchical policy matching. They turn "find the relevant range" into "walk the shared beginning."`,
        `They also win when failed prefix queries should be cheap. A missing edge can reject an entire dictionary region that a scan would have to discover item by item. For user-facing search, that matters because many partial inputs are not complete words and many typed prefixes produce small result sets.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `A trie is not automatically better than a hash table. If the workload is exact lookup on random strings, hashing is simpler and often faster. If the key set is small, a sorted array can be easier to build, easier to serialize, and fast enough. A trie earns its keep when prefix structure is used heavily.`,
        `Real text also complicates the clean model. Unicode normalization, case folding, accents, grapheme clusters, locale-specific comparisons, and token boundaries decide what a "symbol" means. If the application treats bytes as symbols in one place and user-visible characters in another, the trie can return surprising results. Production systems must define the alphabet before they define the data structure.`,
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        `Choose the child representation from the alphabet and workload. For lowercase English words, a compact array or small sorted vector can be reasonable. For arbitrary strings, use a map or a packed representation. For memory-heavy dictionaries, consider a radix tree that stores multi-symbol edge labels, or a minimal deterministic automaton when the key set is static.`,
        `Be careful with deletion. Unmarking the terminal node is not always enough; you may also want to remove now-unused nodes on the path back to the root. But removing shared nodes would corrupt other keys, so deletion must stop as soon as it reaches a node that is terminal or has another child. For ranked autocomplete, store scores or top-k summaries near prefix nodes, but update them consistently during insertions, deletions, and score changes.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `During insertion, the useful thing to notice is reuse. "car", "card", and "care" share c-a-r, so the structure stores that beginning once and branches only for the different endings. The highlighted path is not just a route through nodes; it is the prefix represented by those nodes.`,
        `During autocomplete, the highlighted prefix node becomes the boundary of the answer. Everything below it is relevant, and everything outside it is irrelevant. When the chosen prefix is absent, the dead end itself is the result: the missing edge proves there are no completions.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Hash Table for the exact-lookup alternative, Tree Traversals for completion harvesting, PATRICIA Trie and Radix Tree for compressed paths, eBPF LPM Trie CIDR Policy Case Study for longest-prefix matching, Hierarchical Heavy Hitters: Prefix Sketch for prefix aggregation, B-Trees for disk-oriented indexing, Tokenization (BPE) for AI text processing, Huffman Coding for prefix-free codes, and Finite State Machines for compact pattern recognition.`,
      ],
    },
  ],
};
