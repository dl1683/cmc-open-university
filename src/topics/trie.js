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
      heading: `What it is`,
      paragraphs: [
        `A trie stores strings by shared prefixes. Each edge or node represents the next character or token, and a marked node says that the path from the root is a complete key. Edward Fredkin coined the name around 1960 from retrieval; many people pronounce it try to avoid confusion with tree.`,
        `The structure is useful because common beginnings become common storage. The words cat, car, card, and care share c-a, then split. A Hash Table can answer exact membership quickly, but it does not naturally answer every key starting with ca. A prefix tree does: walk the prefix once, then traverse the subtree below it.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Insertion walks from the root one symbol at a time. If the child for the next symbol exists, reuse it. If not, create it. At the end, mark the node as a complete key. Exact lookup follows the same path and succeeds only if the final node is marked; reaching an unmarked prefix means the prefix exists but the full word does not.`,
        `Autocomplete is the signature operation. Walk the requested prefix in O(prefix length). If any step is missing, no stored key has that prefix. If the walk succeeds, collect completions with Tree Traversals over the descendant subtree. Deletion unmarks the terminal node and then removes now-useless childless nodes on the way back up.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Exact lookup and insertion cost O(L), where L is key length, independent of the number of stored keys. Autocomplete costs O(P + R), where P is prefix length and R is the size of the returned subtree. Space is O(total stored symbols) in the worst case, but shared prefixes reduce real usage. For cat, car, card, and care, the raw words contain 14 letters; the shared-prefix structure needs only c, a, t, r, d, and e plus the root.`,
        `Memory details depend on child representation. An array of 26 child pointers is fast for lowercase English but wasteful for Unicode. A map per node saves sparse space but adds hashing overhead. Compressed radix tries collapse chains of single-child nodes into edge labels, often winning in production.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Autocomplete in search boxes, IDE symbol completion, phone keyboards, spell-checkers, and command shells all rely on prefix lookup. Routers use binary prefix tries for longest-prefix IP matching. Databases and storage engines use trie-like or radix structures for ordered byte keys; B-Trees (How Databases Read) solve a related indexing problem with disk-friendly high fanout. Tokenization (BPE) implementations often use trie-like tables to find the longest mergeable token prefix. Huffman Coding also produces prefix-free codes, although its tree is optimized for compression rather than lookup by human-readable prefix.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `A trie is not automatically better than a Hash Table. For exact lookup on a small static dictionary, hashing is simpler and often faster. Prefix trees win when prefix queries, lexicographic traversal, or longest-prefix matching are core operations. Another misconception is that each node stores a full word. Usually the path spells the key, while nodes store one symbol, child links, and a terminal marker.`,
        `Large alphabets change the engineering. Unicode normalization, case folding, accents, and emojis can turn a character-by-character design into a bug farm. Finite State Machines and minimal deterministic automata can compress large static dictionaries even more aggressively, while Bloom Filter can cheaply reject impossible exact lookups before touching a larger index.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Hash Table to understand the exact-lookup alternative. Tree Traversals explains completion harvesting. PATRICIA Trie compresses prefix paths for routing-style lookups, and eBPF LPM Trie CIDR Policy Case Study shows longest-prefix matching exposed as a kernel map. Hierarchical Heavy Hitters: Prefix Sketch shows how prefix trees become a network-telemetry aggregation hierarchy. B-Trees (How Databases Read) shows disk-oriented multiway indexing. Tokenization (BPE) connects prefix matching to AI text processing. Huffman Coding covers prefix-free trees, and Finite State Machines show another way to represent many string patterns compactly.`,
      ],
    },
  ],
};
