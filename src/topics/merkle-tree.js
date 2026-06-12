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
        `A Merkle Tree is a tree of hashes. Leaves hash data blocks; parents hash the concatenation of child hashes; the root commits to everything below it. Ralph Merkle proposed the idea in 1979. The visualization uses eight toy blocks, hashes each one, then hashes upward to one root. If replica B changes block 5 or block 2, the leaf hash changes, then every hash on the path to the root changes.`,
        `The important word is "commits," not "compresses." A cryptographic hash such as SHA-256 is not a lossless fingerprint; collisions are theoretically possible. The security claim is that finding a collision is computationally infeasible. The demo uses a tiny teaching hash so the numbers fit on screen, but real systems rely on collision-resistant hashes.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Build bottom-up in pairs. To compare replicas, first compare roots. If roots match, the datasets are equal for practical cryptographic purposes. If roots differ, compare the two child hashes. A matching child hash prunes that entire subtree; a mismatching child hash points downward. With eight blocks, the demo finds the bad leaf in three levels. With about 8 billion blocks, log2(n) is roughly 33 levels, so the proof path is tiny compared with the dataset.`,
        `Merkle proofs use the same path in the other direction. To prove a leaf belongs under a root, send the leaf plus the sibling hashes needed to recompute the root. That proof is O(log n) hashes. Updating one block also costs O(log n) hash recomputations up to the root, while building the whole tree costs O(n).`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Construction takes O(n) hash operations and O(n) space if the tree is stored. Equality checking is one root comparison when both roots are already known. Locating one differing block is O(log n) comparisons in a balanced tree, plus the network messages needed to exchange sibling hashes. A Hash Table also uses hashes, but for bucket lookup; a Merkle tree uses hashes to authenticate a hierarchy. Bloom Filter is another compact probabilistic structure, but it answers membership with false positives rather than proving data integrity.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Git Internals is a Merkle-DAG story: blobs, trees, and commits are named by content hashes, so identical content has identical object IDs. Distributed databases use Merkle trees for anti-entropy repair after replicas diverge, a practical response to the tension described by CAP Theorem and Consistent Hashing. Blockchains put Merkle roots in block headers so light clients can verify transaction inclusion. Certificate Transparency logs use Merkle proofs for append-only auditability. BitTorrent v2 uses Merkle trees for piece verification; older torrents used flat piece-hash lists.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Merkle trees prove integrity, not privacy. Anyone who sees block hashes may learn patterns unless blocks are encrypted or salted appropriately. They also do not prove authorship; signatures or consensus rules do that. Block order matters: the same blocks in a different order produce a different root. Implementations must define odd-leaf handling, hash domain separation, and serialization carefully. A toy hash is fine for this visualization, but production systems use SHA-256, BLAKE3, or another vetted cryptographic hash.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Read Hash Table for hashing intuition, then Git Internals for content-addressed storage. CAP Theorem and Consistent Hashing explain why replicas drift and how data is placed. Bloom Filter gives a contrasting space-saving probabilistic tool. Write-Ahead Log (WAL) shows a different durability mechanism: logs recover recent writes, while Merkle trees compare stored state after the fact. Tree Traversals helps with proof paths and subtree reasoning.`,
      ],
    },
  ],
};
