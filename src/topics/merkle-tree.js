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
      heading: 'What it is',
      paragraphs: [
        `A Merkle tree is a tree of hashes where every leaf is the hash of a data block, every parent is the hash of its children's hashes concatenated, and the root is a fingerprint that commits to the entire dataset. Invented by Ralph Merkle in 1979, it solves a deceptively hard problem: proving two massive datasets are identical without transmitting all the data.`,
        `Think of it as a nested chain of responsibility. Any change to any byte in any block changes that block's hash, which changes its parent's hash, which propagates all the way up to the root. The root is therefore a compact cryptographic commitment to everything beneath it — a few hundred bits that could represent terabytes of data.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Build a Merkle tree bottom-up: hash each data block to create leaf nodes, then pair adjacent leaves and hash their concatenation to create the parent, repeat pairwise until a single root remains. To compare two datasets, compute both trees and compare roots (one hash comparison). If roots match, every block is provably identical. If they differ, descend the tree comparing children: hashes that match prune their entire subtree from further inspection, mismatched hashes point the way down. For n blocks, a full mismatch requires only log₂(n) comparisons — for 8 billion blocks, that is 33 hashes.`,
        `When a mismatch is found at a leaf, you have identified exactly one different block and can heal the replica by sending only that block, not all the data. The algorithm exploits a key insight: a hash is a lossless fingerprint, so identical hashes prove identical contents, and you never need to inspect a subtree whose root hash matches.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Building the tree costs O(n) hash operations and O(n) space. Comparing two complete trees costs one root hash comparison. Finding a difference costs O(log n) hash comparisons plus O(log n) network round trips to exchange intermediate hashes. Transmitting the differing data block costs the block size, independent of dataset size. A real-world example: comparing two 8-billion-block datasets (imagine a petabyte database) requires 33 hash comparisons at most, whereas naive comparison requires transmitting every block. With SHA-256, each comparison is 32 bytes; with Merkle tree you learn the damage from less than 2 kilobytes of hashing, then send only the difference.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Distributed databases use Merkle trees constantly: Cassandra and DynamoDB run background anti-entropy repair by comparing replica roots after a network partition heals, then descending the tree to exchange only changed blocks. Version control systems (notably Git) store every commit as the root of a Merkle tree over your files, so cloning detects corruption instantly and two developers with identical repositories never need to re-sync identical objects. BitTorrent peers verify downloaded pieces using a Merkle tree built by the torrent tracker. Blockchains embed Merkle trees in block headers so a light client can verify a transaction was included in a block without downloading the whole block. Certificate Transparency logs use Merkle trees to let you prove a certificate is in a public log of millions without downloading millions of entries.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Merkle trees prove integrity but not privacy; an observer sees every block hash. Cryptographic hash functions (SHA-256, BLAKE2) are essential — toy hashes like CRC-32 collide too easily and defeat the tree. The tree requires balanced pairing (usually powers of two blocks); implementations that handle irregular counts either pad with dummy blocks or use more complex tree shapes. Merkle trees are not a replacement for cryptographic signatures; they prove no one has tampered with the data, but not who created it. Finally, tree construction order matters: two identical datasets with blocks in different order produce different roots, so merkle trees detect reordering as a difference (usually intentional, sometimes a surprise).`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Merkle trees depend on hash collisions being vanishingly rare (read Hash Table to understand why hashing works). Understanding tree construction requires Tree Traversals. Merkle trees shine in distributed systems: learn CAP Theorem to see why consistency is hard, Consistent Hashing to see how databases partition data, and Bloom Filter to see a complementary space-efficient data structure. Blockchain applications combine Merkle trees with cryptographic signatures to guarantee consensus across strangers.`,
      ],
    },
  ],
};

