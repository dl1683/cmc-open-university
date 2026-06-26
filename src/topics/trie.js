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
      heading: 'How to read the animation',
      paragraphs: [
        'Each node represents a prefix, which means the characters on the path from the root to that node. An edge labeled c appends c to the current prefix.',
        'Active nodes show the prefix path currently being walked. Found nodes are end-of-word nodes, meaning the path is a complete stored key and not just a prefix.',
        {type: 'callout', text: 'A trie turns every prefix into an addressable state, so prefix search starts at the prefix node instead of scanning complete keys.'},
        {type: 'image', src: './assets/gifs/trie.gif', alt: 'Animated walkthrough of the trie visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A trie stores strings so shared prefixes are stored once. It exists because exact lookup and prefix lookup need different structure.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Trie_example.svg', alt: 'Trie diagram with shared prefixes for several English words', caption: 'This trie makes the storage claim visible: each edge contributes one character, and complete words end at marked nodes. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Trie_example.svg.'},
        'A hash table can answer whether card exists, but it cannot jump to all words starting with car. A trie gives car its own node, so autocomplete starts at that state and walks only its subtree.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a hash table for words. Exact lookup is fast on average because the whole key is hashed and checked in one bucket.',
        'Another reasonable approach is a sorted array. Binary search can find the first matching prefix, then scan forward while keys still share the prefix.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Hashing destroys prefix structure. The hash of car gives no address for card, care, or cart, so prefix search falls back to scanning all keys.',
        'A sorted array can answer prefix ranges but pays O(n) insertion cost and repeatedly stores the same characters in many keys. The prefix itself is not a shared object with children.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Make every prefix a node. Once the prefix path is reached, every descendant word shares that prefix, and everything outside that subtree can be ignored.',
        'A missing child pointer is a proof of absence. If the path for ca breaks at x, no stored word can start with cax because insertion would have created that edge.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Insert walks the key one character at a time, creating missing child nodes as needed. After the last character, it marks that node as end-of-word.',
        'Search follows the same path and succeeds only if the final node exists and has the end-of-word mark. Prefix query follows the prefix path, then traverses the subtree below it to collect end-of-word descendants.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is path meaning: the path from the root to a node spells exactly the prefix represented by that node. Insertion preserves the invariant by extending one character at a time and never changing existing path labels.',
        'Prefix query correctness follows directly. Every word below the prefix node passed through that prefix during insertion, and every stored word with that prefix must be below that same node.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insert, search, and delete cost O(m), where m is key length. Looking up card takes four character steps whether the trie stores 6 words or 6 million words.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/cd/Patricia_tree.png', alt: 'Patricia tree compressing strings with shared binary prefixes', caption: 'A Patricia tree stores branch positions instead of every intermediate character node, showing the space-saving direction compressed tries take. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Patricia_tree.png.'},
        'Prefix query costs O(m + k), where k is the number of returned nodes or characters walked in the result subtree. Space can be high because each node stores child links, so compressed tries collapse single-child chains to save memory.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Autocomplete uses a trie by walking the typed prefix and harvesting completions below it. IDE symbol completion, browser address bars, command palettes, and phone keyboards all use this access pattern or a compressed variant.',
        'Routers use bitwise tries for longest-prefix match on IP addresses. Spell checkers, dictionaries, DNA sequence tools, and static string indexes use trie-like structures when prefixes are the natural query.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'For exact lookup only, a hash table is usually simpler and faster. The trie pays for prefix structure that exact membership queries do not use.',
        'Tries can be memory-heavy and cache-unfriendly because nodes are pointer-rich and scattered. Large alphabets such as Unicode require sparse maps, adaptive nodes, compression, or a different data structure.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Insert cat, car, card, care, and cab. Cat creates c, a, t; car reuses c and a and creates r; card and care reuse car and add d or e; cab reuses ca and adds b.',
        'The trie has root, c, a, t, r, d, e, and b: 8 nodes for 5 words. Query car walks c -> a -> r in 3 steps, then returns car, card, and care without visiting cat or cab.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include Fredkin, Trie Memory, 1960; de la Briandais on variable-length key searching, 1959; and Morrison on PATRICIA, 1968. Bentley and Sedgewick cover ternary search tries for practical string search.',
        'Study hash tables, radix trees, Patricia tries, adaptive radix trees, Aho-Corasick, suffix trees, suffix arrays, and succinct tries next.',
      ],
    },
  ],
};
