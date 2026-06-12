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
      heading: 'What it is',
      paragraphs: [
        `A trie is a tree where each node represents a single character and each path from root to a marked node spells a complete word. Unlike a Hash Table that treats each word as an atomic key, a trie breaks words into letters and stores them as a navigable chain. The magic: words that share a prefix (like "car" and "card") share the same path up to their divergence point, so that prefix is stored exactly once in memory.`,
        `Each node holds a map of its children (one per possible character), a flag marking whether the path to that node completes a word, and a label (the character itself). The root node is usually unmarked and represents the empty string. Imagine a massive dictionary stored not as a flat list but as a branching tree of letters — that is a trie. Every path spells a prefix of at least one real word by construction.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Insert a word by walking from the root, one character at a time. If a child node for that character already exists, reuse it (this is where the space savings happen). If not, create it and link it. Mark the final node as "is a word." Lookup is identical: walk the path; if you fall off the tree at any step, the word is not in the dictionary. If you reach the end and the node is marked, the word exists. Autocomplete is the key unlock: to find all words starting with a prefix like "ca", walk the prefix path (O(prefix length)), then harvest the entire subtree below that node — every node in that subtree represents a word or prefix of a word beginning with "ca".`,
        `Deletion reverses insertion: unmark a node as a "word," then clean up childless nodes bottom-up. A trie proves the absence of a prefix instantly. If you reach a dead end (a missing child), no word in the dictionary starts with that prefix — proven without scanning the entire dictionary or even looking at stored words, just the structure itself. This is impossibly fast compared to a Hash Table, which must scan or probe.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `A lookup or insert costs O(word length), completely independent of how many words are in the dictionary. This is trie's defining promise: a million-word dictionary and a two-word dictionary have the same lookup speed for a three-letter word. Space usage is O(total characters across all words) — not O(number of words). A trie storing "cat," "car," and "card" reuses the "ca" prefix, so it holds roughly 2 + 2 + 2 nodes (c-a-t, c-a-r, c-a-r-d) instead of 10. Autocomplete (prefix walk plus subtree harvest) costs O(prefix length + number of results), so if the prefix narrows down to 47 completions, you pay for 47, not for the entire dictionary.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Every search box you have used — browser address bar, search engines, phone keyboards, IDE symbol completion, map applications — relies on a trie. When you type "sou," autocomplete reaches the "sou" node and yields all descendants: "soup," "sound," "south," etc. IP routing in networks uses a trie of binary prefixes; when a packet arrives, a router walks the prefix trie to find the longest matching prefix and forward accordingly, supporting millions of routes. Spell-checkers and predictive keyboards use tries to suggest corrections. Databases like LevelDB and RocksDB use compressed tries (radix tries) to index sorted keys efficiently. DNA sequence matching in bioinformatics uses tries to find patterns in genomic data. Type-ahead systems at scale (e.g., Google's search suggestions) store tries in memory or compressed form to serve billions of queries per day.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Tries are not always faster than Hash Tables for simple lookups on a small, static dictionary. If you only need "does this word exist?" on 50 words, a Hash Table is simpler and faster. Tries shine when you need prefix queries, autocomplete, or dynamic insertion into a large dictionary. People sometimes think a trie stores the full word at each node; in fact, each node stores one character and a map of children. A path spells the word, not any single node. Tries can waste memory if your alphabet is large (e.g., Unicode) and words are sparse; each node reserves space for all possible children even if most branches are empty (this is why hash-based tries or radix tries exist). Finally, naive tries assume a fixed, small alphabet (like a-z); with large alphabets or variable-length suffixes, compressed or hybrid structures often win.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Tries are built on the same tree-navigation principles as Tree Traversals (in-order and depth-first traversal are how you harvest completions). To understand why tries beat Hash Tables for prefix queries, study Hash Table to see its O(1) lookup but O(n) scanning cost. For a deeper dive into compressed tries, explore B-Trees (How Databases Read), which use a similar philosophy of shared structure and multi-way branching to scale storage. If you are building a tokenizer for AI models, see Tokenization (BPE) — BPE uses a trie-like structure to merge frequent character sequences. Finally, for truly massive-scale tries, Binary Search Tree introduces the principles of balanced trees, which applies to balanced trie variants in production systems.`,
      ],
    },
  ],
};

