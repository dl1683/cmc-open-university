// Merkle trees: hash the blocks, then hash the hashes, up to one root.
// Now "are these two huge datasets identical?" costs ONE comparison —
// and finding the difference costs log n. Git, Cassandra, and Bitcoin agree.

import { treeState, InputError } from '../core/state.js';

export const topic = {
  id: 'merkle-tree',
  title: 'Merkle Tree',
  category: 'Systems',
  summary: 'A tree of hashes: compare two datasets with one root check, find any difference in log n hops.',
  controls: [
    { id: 'tamper', label: 'Replica B differs at', type: 'select', options: ['block 5', 'block 2', 'nothing (identical)'], defaultValue: 'block 5' },
  ],
  run,
};

const BLOCKS = ['tx-a', 'tx-b', 'tx-c', 'tx-d', 'tx-e', 'tx-f', 'tx-g', 'tx-h'];

// A toy hash: deterministic, avalanche-y enough for teaching. Real systems
// use SHA-256; the tree logic is identical.
function hash(text) {
  let h = 7;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i) * 17) % 4096;
  return h.toString(16).padStart(3, '0');
}

function buildTree(blocks) {
  let level = blocks.map((b, i) => ({ id: `n0_${i}`, value: hash(b), left: null, right: null, block: i }));
  const all = [...level];
  let depth = 1;
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const parent = {
        id: `n${depth}_${i / 2}`,
        value: hash(level[i].value + level[i + 1].value),
        left: level[i].id,
        right: level[i + 1].id,
      };
      next.push(parent);
      all.push(parent);
    }
    level = next;
    depth += 1;
  }
  return { all, root: level[0] };
}

export function* run(input) {
  const choice = String(input.tamper);
  const tampered = choice === 'block 5' ? 4 : choice === 'block 2' ? 1 : -1;
  if (!['block 5', 'block 2', 'nothing (identical)'].includes(choice)) throw new InputError('Pick a scenario.');

  const A = buildTree(BLOCKS);
  const bBlocks = BLOCKS.map((b, i) => (i === tampered ? b + '!' : b));
  const B = buildTree(bBlocks);
  const bById = new Map(B.all.map((n) => [n.id, n]));
  const snapshot = () => treeState(A.all, A.root.id);

  yield {
    state: snapshot(),
    highlight: { visited: A.all.filter((n) => !n.left).map((n) => n.id) },
    explanation: `Replica A holds ${BLOCKS.length} data blocks (bottom row shows each block's HASH — a short fingerprint that changes completely if even one byte changes). Replica B, across the ocean, holds its own copy. Question: are they identical? Naive answer: ship all the data over and compare — at database scale, terabytes.`,
  };

  yield {
    state: snapshot(),
    highlight: { active: A.all.filter((n) => n.left).map((n) => n.id) },
    explanation: `The Merkle move: hash the hashes. Each parent = hash(left child + right child), pairwise, up to a single ROOT (${A.root.value}). Any change to ANY block changes its leaf hash, which changes its parent, which changes… all the way up. The root is a fingerprint of the ENTIRE dataset.`,
    invariant: 'A node\'s hash commits to every block beneath it.',
  };

  if (tampered === -1) {
    yield {
      state: snapshot(),
      highlight: { found: [A.root.id] },
      explanation: `Replica B computes its own tree and sends ONE value: its root, ${B.root.value}. It equals A's root — so (with a real cryptographic hash) the replicas are IDENTICAL, all ${BLOCKS.length} blocks, proven by one comparison of a few bytes. The same trick proves 8 billion blocks identical just as cheaply.`,
    };
    yield {
      state: snapshot(),
      highlight: {},
      explanation: 'That single-comparison check runs constantly inside Cassandra and DynamoDB anti-entropy repair (replicas comparing roots after a partition heals — see CAP Theorem), inside git (every commit is the root of a hash tree over your files: identical content = identical hash = nothing to transfer), in BitTorrent piece verification, and in every blockchain block header. Re-run with a tampered block to watch the hunt.',
    };
    return;
  }

  yield {
    state: snapshot(),
    highlight: { compare: [A.root.id] },
    explanation: `Replica B sends its root: ${B.root.value} ≠ ${A.root.value}. SOMETHING differs among the ${BLOCKS.length} blocks — but which one? Don't ship everything: descend the tree, comparing child hashes, and PRUNE every subtree whose hashes match.`,
  };

  let aNode = A.root;
  const pruned = [];
  const path = [A.root.id];
  const byIdA = new Map(A.all.map((n) => [n.id, n]));
  while (aNode.left) {
    const aL = byIdA.get(aNode.left);
    const aR = byIdA.get(aNode.right);
    const bL = bById.get(aNode.left);
    const bR = bById.get(aNode.right);
    const leftDiffers = aL.value !== bL.value;
    const diffChild = leftDiffers ? aL : aR;
    const sameChild = leftDiffers ? aR : aL;
    const collectSubtree = (n, acc) => {
      acc.push(n.id);
      if (n.left) { collectSubtree(byIdA.get(n.left), acc); collectSubtree(byIdA.get(n.right), acc); }
      return acc;
    };
    pruned.push(...collectSubtree(sameChild, []));
    yield {
      state: snapshot(),
      highlight: { active: [diffChild.id], compare: [sameChild.id], visited: pruned, range: path },
      explanation: `Compare children: ${leftDiffers ? 'left' : 'right'} differs (${diffChild.value} vs ${(leftDiffers ? bL : bR).value}), ${leftDiffers ? 'right' : 'left'} MATCHES — so its entire subtree (${Math.ceil(pruned.length)} nodes' worth of data) is provably identical and never needs checking. Descend into the mismatch.`,
      invariant: 'Matching hashes prune a subtree; mismatching hashes point the way down.',
    };
    aNode = diffChild;
    path.push(aNode.id);
  }

  yield {
    state: snapshot(),
    highlight: { found: [aNode.id], visited: pruned, range: path },
    explanation: `Leaf reached: ${choice} is the difference — found in ${path.length - 1} comparisons instead of ${BLOCKS.length} block transfers, and at scale in log₂(n) hops: 8 billion blocks ≈ 33 comparisons. Now the replicas exchange just that ONE block to heal. This is exactly Cassandra's anti-entropy repair, how git transfers only changed objects, and why Certificate Transparency can prove a certificate sits in a log of millions without shipping the log.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each leaf represents a data block, and each label is a hash, which is a fixed-size digest computed from input bytes. A parent hash is computed from its two child hashes, so the root commits to every block below it. Active nodes show the comparison path between two replicas.',
        'Visited nodes are subtrees that the algorithm has ruled out. The safe inference rule is this: if two corresponding subtree hashes match under a collision-resistant hash function and the same encoding rules, every block under that subtree can be treated as identical. Found marks the leaf where a mismatch has been localized.',
        {type: 'callout', text: 'A Merkle tree lets one trusted root stand for many blocks because every parent hash commits to its full subtree.'},
        {type: 'image', src: './assets/gifs/merkle-tree.gif', alt: 'Animated walkthrough of the merkle tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Distributed systems often need to compare large data sets across machines. A replica repair job should not ship every block when only one block changed. A light client should not download an entire ledger just to verify one transaction or entry.',
        'A Merkle tree gives a small commitment to a large ordered collection. A commitment is a value that binds the publisher to data without revealing or transferring all of it. The root is cheap to compare, while the path from a leaf to the root gives compact evidence about one block.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The direct approach is to compare every block or send a flat hash of the whole file. Comparing every block is exact, but it costs O(n) data transfers or hash checks every time. A flat hash is cheap to compare, but it only says same or different.',
        'For a 1 TB replica divided into 1 MB blocks, there are about 1,000,000 blocks. If one block differs, a flat hash tells you the file changed but not which block changed. You still need a search over the data to locate the repair.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is localization. A single digest over the whole collection destroys the structure needed to find the differing part. It compresses the answer to equality, but it does not preserve enough intermediate evidence to skip matching regions.',
        'A second wall is selective verification. If a server claims block 5 belongs to a published root, the verifier needs proof that connects block 5 to that root. Shipping every other block is wasteful, but a flat hash cannot provide a local membership proof.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Hash the leaves first, then hash pairs of child hashes upward until one root remains. Each parent commits to the entire subtree below it. Matching parent hashes let the verifier skip whole subtrees, while mismatching parent hashes point to the part that must be inspected.',
        'The important term is collision resistance. A cryptographic hash is not reversible and is not proof by itself; it is designed so finding a different input with the same digest is infeasible. Merkle proofs rely on that property plus exact agreement about byte encoding and tree shape.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/9/95/Hash_Tree.svg', alt: 'Merkle hash tree with data blocks at leaves and hashes combined upward to a root', caption: 'The parent hash commits to both children; repeating that rule makes one root cover every leaf. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Hash_Tree.svg.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build the tree bottom-up. Compute one hash per data block, pair adjacent hashes, hash each pair into a parent, and repeat until one root remains. If the number of leaves is odd, the system must define a rule, such as duplicating the last hash or carrying it upward.',
        'To compare replicas, exchange roots first. If roots match, stop. If roots differ, compare the left and right child hashes, descend into children that differ, and prune children that match. The search ends at the leaf or leaves that changed.',
        'To prove inclusion, the prover sends the leaf value and the sibling hash at each level on the path to the root. The verifier recomputes the path upward and checks whether the result equals the trusted root. Unrelated leaves are not needed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from the commitment chain. If a leaf changes, its leaf hash changes with overwhelming probability, then its parent hash changes, then every ancestor changes up to the root. A matching root therefore commits to matching descendants, assuming the hash and encoding rules hold.',
        'A membership proof works because the verifier rebuilds exactly the ancestors that connect the leaf to the root. At each level, the sibling hash supplies the missing half of the parent input. If the final recomputed root equals the trusted root, the leaf is part of the committed tree at that position.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/2b/Cryptographic_Hash_Function.svg', alt: 'Cryptographic hash function avalanche diagram with different outputs for small input changes', caption: 'Merkle proofs depend on hash avalanche behavior: a changed block should change every ancestor digest on its path. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Cryptographic_Hash_Function.svg.'},
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Building a tree over n leaves costs O(n) hash operations and O(n) storage if internal nodes are kept. A root comparison costs O(1) once both roots exist. A balanced inclusion proof or single-difference search costs O(log n) hashes and transfers O(log n) sibling digests.',
        'When n doubles, proof length grows by one hash because the tree gains one level. A tree with 1,048,576 leaves has height 20, so a membership proof needs about 20 sibling hashes. With 32-byte SHA-256 digests, that is roughly 640 bytes of sibling data plus framing.',
        'Updates are local but not free. Changing one leaf recomputes every ancestor on its path, so a balanced tree update costs O(log n). Systems with frequent appends often use specialized history-tree or Merkle-mountain-range layouts so old prefixes remain easy to audit.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Git stores content-addressed objects and tree objects so unchanged files and directories can be recognized by hash. Distributed databases use Merkle-style trees for anti-entropy repair after replicas diverge. Blockchains put Merkle roots or related authenticated commitments in headers so clients can verify transaction inclusion with small proofs.',
        'Certificate Transparency logs use Merkle proofs to make append-only certificate logs auditable. File distribution systems use piece hashes so a peer can verify a downloaded chunk before trusting it. The shared access pattern is selective trust: verify a small piece against a compact root.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Replica repair is a directed exchange of roots, child hashes, and changed blocks, not a full data copy. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A Merkle tree proves integrity relative to a trusted root, not truth by itself. If the root is signed by the wrong party, served through a split view, or accepted without policy, the proof can be internally valid and still not trustworthy. Authentication and governance sit around the data structure.',
        'Implementation details can break interoperability or security. Leaf framing, internal-node framing, odd-leaf handling, child order, serialization, and hash choice must be specified. Two systems can store the same logical records and produce different roots if these rules differ.',
        'Merkle trees also do not solve availability or privacy. A proof can show that a block belongs under a root, but someone still has to store and serve the block. Hashes may reveal equality or patterns when data is low-entropy or encoded carelessly.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use four blocks: A = "tx1", B = "tx2", C = "tx3", and D = "tx4". Compute hA, hB, hC, and hD from the block bytes. Then compute hAB = hash(hA || hB), hCD = hash(hC || hD), and root = hash(hAB || hCD).',
        'To prove C belongs to the tree, the server sends C, hD, and hAB. The verifier computes hC from C, then hCD from hC and hD, then root from hAB and hCD. If the result equals the trusted root, C is included at that position.',
        'If replica B changes C to "tx3!", then hC changes, hCD changes, and the root changes. Comparing roots detects a difference in one step, comparing hAB and hCD shows the right half differs, and comparing hC and hD localizes the changed leaf. Four blocks need two levels of descent; one million blocks need about twenty.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Ralph Merkle hash-tree work, the Git object model, Bitcoin SPV proofs, and Certificate Transparency RFCs for concrete proof formats. The stable mechanism is simple: parent hashes commit to child hashes, and a path of siblings rebuilds one root.',
        'Study Hash Table for the hash primitive, Bloom Filter for probabilistic membership, and Merkle Mountain Range Append-Only Log for append-friendly commitments. Then study Content-Addressed Merkle DAG Object Store and Transparency Log Witnessing to see how roots are embedded in real trust systems.',
      ],
    },
  ],
};
