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
        'Each circle is a trie node labeled with one character. The root carries a dot. The path from the root down to any node spells the prefix that node represents: root-c-a spells "ca." An edge from parent to child means "append the child\'s character."',
        {type: 'callout', text: 'A trie turns every prefix into an addressable state, so prefix search starts at the prefix node instead of scanning complete keys.'},
        'Active (highlighted) nodes show the path the algorithm is walking right now. Found nodes have an end-of-word marker: the full root-to-node path is a complete stored word, not just a prefix. Visited nodes mark trail already covered.',
        'Watch two things during insertion. First, how many existing nodes the walk reuses (shared prefix) versus how many it creates (unique suffix). Second, notice that "car" and "cat" share root-c-a, so three characters of storage serve both words. During autocomplete, the shaded subtree below the prefix node is the entire result set. Everything outside is never examined. When a prefix is missing, the walk hits a dead edge and the empty answer is proven in one failed child lookup.',
      
        {type: 'image', src: './assets/gifs/trie.gif', alt: 'Animated walkthrough of the trie visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Edward Fredkin named the structure "trie" in 1960, clipping the word "retrieval." Rene de la Briandais described the same idea independently in 1959. The problem both solved: how do you answer "what keys share this beginning?" without scanning everything?',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Trie_example.svg', alt: 'Trie diagram with shared prefixes for several English words', caption: 'This trie makes the storage claim visible: each edge contributes one character, and complete words end at marked nodes. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Trie_example.svg.'},
        'A hash table can check whether "card" is present, but asking it for every word starting with "car" requires examining every key in the table. A BST can answer the query, but it compares whole strings at each node, costing O(m log n) where m is the key length. Tries take a different path: store words one character per edge so that shared prefixes are shared nodes. Lookup, insertion, and prefix queries all cost O(m) -- proportional only to the key length, independent of how many keys are stored.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Store words in a sorted array. Exact lookup is O(m log n) via binary search (m characters compared at each of log n steps). Prefix search is possible: binary-search to the first key starting with the prefix, then scan forward until keys stop matching.',
        'Alternatively, store words in a hash table. Exact lookup is O(m) average (hash the key, check the bucket). For small dictionaries and infrequent prefix questions, these are reasonable approaches.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Hash tables cannot answer prefix queries. The hash of "car" reveals nothing about the hash of "card" or "care." Finding all words starting with "ca" requires scanning all n keys, every time. The hash function destroys the character-level structure that prefix queries need.',
        'Sorted arrays can binary-search to the start of a prefix range, but insertion costs O(n) to shift elements, and each binary-search comparison touches all m characters of a key. Worse, "car" is stored redundantly inside "car," "card," and "care" -- the shared prefix "ca" is repeated in memory for every key that begins with it.',
        'The core problem: neither structure gives the prefix itself a location. "ca" is not an addressable object in a hash table or sorted array. It is a substring buried inside complete keys. When prefix queries dominate the workload, that missing structure is the bottleneck.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A trie is a rooted tree where each edge carries one character from the alphabet. Each node has up to |S| children, one per possible character (S is the alphabet: 26 for lowercase English, 256 for bytes). The path from the root to any node spells exactly the prefix that node represents. A boolean end-of-word flag on a node marks the root-to-node path as a complete stored key.',
        'Insert: start at the root and consume the key one character at a time. If the child for the current character exists, follow it. Otherwise, create it. After the last character, mark the node as end-of-word. Inserting "cat" creates root-c-a-t(end). Inserting "car" reuses root-c-a, creates only r(end). The shared prefix c-a is stored exactly once.',
        'Search: walk the same path. If every child exists and the final node is marked end-of-word, the key is present. If any child is missing, the key is absent. If the path exists but the final node is not end-of-word, the string is a stored prefix but not a stored key.',
        'Prefix query: walk the prefix path. If it succeeds, traverse the subtree below the prefix node and collect every end-of-word descendant. Those are exactly the stored keys sharing that prefix. Cost: O(m + k), where m is the prefix length and k is the number of results.',
        'Delete: walk to the end-of-word node and clear its flag. Then walk back toward the root, pruning any node that is no longer end-of-word and has no children. Stop at the first node that is still end-of-word or has other children, because that node is shared by other keys.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is path meaning: the concatenation of edge labels from root to node is exactly the prefix that node represents. Insertion preserves this by extending paths one character at a time, creating only the edges needed to spell the new key. No existing path is modified, so previously inserted keys survive every insertion.',
        'Prefix queries are correct because every descendant of a prefix node inherits that prefix by construction. If a stored key starts with "ca," its insertion path passed through the "ca" node, placing it in that subtree. Conversely, every end-of-word node below "ca" spells a word starting with "ca." The subtree is exactly the answer set.',
        'A missing edge is a proof of absence. If the child for the next character does not exist, no stored key continues through that point. The trie rejects an absent key in one failed child lookup per missing character, without examining any stored word.',
        'Lookup cost depends only on key length m because each character requires exactly one child-pointer follow. Whether the trie holds 6 words or 6 million, looking up "card" takes exactly 4 steps. The number of stored keys is irrelevant.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insert, search, and delete all cost O(m), where m is the key length in characters. This is the key insight: cost tracks key length, not dictionary size. Looking up "card" in a trie of 6 words costs 4 steps. Looking up "card" in a trie of 6 million words costs 4 steps. Doubling the dictionary adds zero comparisons.',
        'Prefix query costs O(m + k): m steps to reach the prefix node, then a subtree traversal proportional to the k results. The trie does no work on keys outside the prefix subtree.',
        'Space is the tax. Each node may store up to |S| child pointers. For lowercase English, that is 26 pointers per node. With n keys of average length m, worst-case node count is O(n * m), and each node costs O(|S|) with a fixed child array. Total worst case: O(n * m * |S|). Shared prefixes reduce the actual node count, but sparse alphabets still waste space on empty child slots.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/cd/Patricia_tree.png', alt: 'Patricia tree compressing strings with shared binary prefixes', caption: 'A Patricia tree stores branch positions instead of every intermediate character node, showing the space-saving direction compressed tries take. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Patricia_tree.png.'},
        'Compressed tries (radix trees, Patricia tries) collapse chains of single-child nodes into one node carrying a multi-character edge label. This cuts node count when keys share long prefixes or when the key set is sparse. A radix tree storing "card," "care," and "careful" merges the single-child chain c-a-r into one node labeled "car."',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Autocomplete: the user types a prefix, the trie walks it in O(m) and harvests completions from the subtree. Every search box, IDE symbol palette, and command launcher depends on this pattern.',
        'Spell checkers: candidate generation walks the trie while tracking edit distance, pruning branches that exceed the error budget. Entire subtrees of impossible corrections are skipped without examining individual words.',
        'IP routing (longest prefix match): routers store network prefixes in a bit-level trie and walk the destination address bit by bit. The deepest matching prefix determines the next hop. Every packet forwarded on the internet passes through this operation.',
        'T9 predictive text: the phone keypad maps each digit to multiple letters. A trie of dictionary words keyed by digit sequence prunes impossible letter combinations at each keystroke and returns only real words.',
        'DNA sequence search: genomic databases index sequences over the 4-character alphabet {A, C, G, T}. The small alphabet keeps per-node cost low, and prefix queries find all sequences sharing a motif.',
        'Compiler symbol tables: identifier lookup during compilation is a prefix-structured problem. Tries give O(m) lookup independent of how many symbols are in scope.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Memory hungry. Each node stores up to |S| child pointers, most of which may be null. A byte-indexed trie (|S| = 256) uses 256 pointers per node. A naive Unicode trie is impractical without hash-map or sorted-list children.',
        'Cache unfriendly. Each node is a separate heap allocation, and following child pointers scatters memory access unpredictably. For CPU-cache-sensitive workloads, a sorted array with binary search can outperform a trie despite worse asymptotic prefix behavior, because the array is contiguous in memory.',
        'For exact lookup only, a hash table is simpler and typically faster. The trie pays for prefix structure that exact queries never use. If the workload is "is this key present?" and nothing else, a hash table wins.',
        'Compressed variants fix the space problem. Radix trees collapse single-child chains. DAFSAs (directed acyclic word graphs) share suffixes as well as prefixes. Adaptive radix trees size each node to its actual fanout (4, 16, 48, or 256 children). Each adds implementation complexity but can reduce memory by 10-100x.',
        'For small, static key sets, a sorted array is easier to build, trivial to serialize, and fast enough. The trie earns its keep when prefix queries are frequent and the key set is large or dynamic.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with an empty trie (just the root). Insert "cat": create nodes c, a, t along the path from root, mark t as end-of-word. The trie has 4 nodes.',
        'Insert "car": walk root-c-a (both exist, reused), create r, mark r as end-of-word. One new node. The prefix "ca" is stored once and shared by "cat" and "car."',
        'Insert "card": walk root-c-a-r (all exist, reused), create d, mark d as end-of-word. One new node. Node r is now both end-of-word ("car") and a parent (of d).',
        'Insert "care": walk root-c-a-r (reused), create e, mark e as end-of-word. One new node. Node r now has two children: d and e.',
        'Insert "cab": walk root-c-a (reused), create b, mark b as end-of-word. One new node. Node a now has three children: t, r, and b.',
        'The trie has 8 nodes total (root, c, a, t, r, d, e, b). Five words, but the shared prefix "ca" created only one c node and one a node. Without sharing, five separate strings would need 16 character slots.',
        'Prefix query "car": walk root-c-a-r (3 steps). Node r exists. Traverse its subtree: r itself is end-of-word ("car"), d is end-of-word ("card"), e is end-of-word ("care"). Result: ["car", "card", "care"]. The nodes for "cat" and "cab" were never visited.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Fredkin, "Trie Memory," Communications of the ACM, 1960 -- coined the name from "retrieval." De la Briandais, "File Searching Using Variable Length Keys," Proceedings of the Western Joint Computer Conference, 1959 -- independent invention. Morrison, "PATRICIA -- Practical Algorithm to Retrieve Information Coded in Alphanumeric," 1968 -- the first compressed trie. Bentley and Sedgewick, "Fast Algorithms for Sorting and Searching Strings," 1997 -- ternary search tries.',
        'Prerequisite: Hash Table (contrast for exact-only lookup). Extension: Radix Tree / Patricia Trie (collapse single-child chains for space efficiency). Space-optimized: Adaptive Radix Tree (node sizes 4/16/48/256 matching actual fanout). Alternative: Ternary Search Tree (three pointers per node, BST-like space with trie-like speed). Pattern matching: Aho-Corasick (multi-pattern search built on a trie with failure links). Substring queries: Suffix Tree / Suffix Array (index all suffixes, not just prefixes). Compact static: LOUDS Succinct Trie (rank/select encoding). Routing: eBPF LPM Trie (longest prefix match for network policy).',
      ],
    },
  ],
};
