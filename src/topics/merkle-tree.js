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
      heading: 'Why This Exists',
      paragraphs: [
        `Replicas, peers, and light clients often need to compare or verify large data without transferring all of it. A database repair job should not ship terabytes just to discover one changed block. A light client should not download an entire log to check one entry.`,
        `A Merkle tree gives one compact commitment to many pieces of data. If two roots match, the underlying data is equal for practical cryptographic purposes. If roots differ, the tree points to the changed region logarithmically.`,
      ],
    },
    {
      heading: 'The Obvious Approach and the Wall',
      paragraphs: [
        `The obvious approach is to hash or compare every block directly. That is fine for small files, but it is wasteful when most blocks already match or when a verifier only needs one membership proof.`,
        `A single flat hash of the whole dataset helps equality checks, but it does not localize differences or prove one leaf. If the flat hash differs, you still have to search the whole data set to find the changed block.`,
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        `Hash the data at the leaves, then hash child hashes upward until one root remains. Each parent commits to the entire subtree below it. A matching subtree hash proves that every descendant can be skipped.`,
        `The important word is "commits," not "compresses." A cryptographic hash is not lossless; it is collision-resistant enough that finding a different subtree with the same hash should be infeasible.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "Start at the root. If two replicas have the same trusted root hash, the comparison can stop because every descendant is committed by that root. If the roots differ, the animation descends only into child subtrees whose hashes differ.",
        "A highlighted matching subtree is proof of work avoided. The algorithm is not checking every block and then drawing a tree; it is using parent hashes to rule out whole regions at once. A highlighted mismatching child is the next search interval.",
        "When the animation reaches a leaf, it has localized the difference to one block. That is the core skill to learn: Merkle trees turn a large equality problem into repeated hash comparisons over smaller committed ranges.",
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        `Imagine eight blocks. Replica A and Replica B differ only at block 5. A flat file hash can say "different," but it cannot say where. A Merkle comparison checks the root, then the two children of the root, then the two children of the mismatching half, then the two leaves in the final pair. The matching half of the data is never transferred.`,
        `For inclusion, the proof is similarly small. To prove block 5 belongs to a root, a server sends block 5 plus the sibling hashes needed to recompute the path upward. The verifier does not need blocks 0 through 4 or 6 through 7. It only needs enough siblings to rebuild the trusted root.`,
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        `Build bottom-up in pairs. To compare replicas, compare roots first. If roots match, stop. If roots differ, compare child hashes. A matching child prunes that whole subtree; a mismatching child tells you where to descend.`,
        `To prove inclusion, send the leaf plus the sibling hashes along its path to the root. The verifier recomputes upward and checks whether the computed root equals the trusted root. Updating one leaf recomputes hashes only along that path.`,
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        `A changed leaf changes its leaf hash. That changes its parent hash, then every ancestor hash up to the root. So a root mismatch proves that at least one descendant differs, and a matching child hash lets the verifier skip that entire child subtree.`,
        `An inclusion proof works because the verifier can recompute the only hashes that matter for one path. The server can omit all unrelated leaves and still provide enough siblings to rebuild the trusted root.`,
      ],
    },
    {
      heading: 'Cost and Behavior',
      paragraphs: [
        `Construction takes O(n) hash operations and O(n) space if the tree is stored. Equality checking is one root comparison when both roots are already known. A balanced inclusion proof or single-difference search uses O(log n) hashes.`,
        `A Hash Table also uses hashes, but for bucket lookup. A Merkle tree uses hashes to authenticate a hierarchy. A Bloom Filter answers membership compactly with false positives; a Merkle proof verifies membership relative to a trusted root.`,
        `Updates are local but not free. Changing one leaf recomputes every ancestor up to the root. That is O(log n) for a balanced tree, which is cheap compared with rebuilding the full tree, but still important in high-write systems. Append-only logs often use specialized variants such as Merkle mountain ranges so append proofs and consistency proofs stay efficient.`,
      ],
    },
    {
      heading: 'Design Choices',
      paragraphs: [
        `Production Merkle trees must specify serialization, leaf hashing, parent hashing, odd-leaf behavior, domain separation, and tree shape. Two systems can contain the same logical records and still produce different roots if they encode leaves or pair children differently.`,
        `Domain separation is especially important. A leaf hash should not be confusable with an internal-node hash. Many systems prefix leaves and internal nodes differently before hashing so an attacker cannot reinterpret one kind of node as another in a proof.`,
      ],
    },
    {
      heading: 'Operational Uses',
      paragraphs: [
        `Anti-entropy repair is the cleanest operational use. Replicas exchange roots, then descend only into mismatching subtrees. The repair job transfers changed blocks instead of the full dataset, which is why the structure is useful when divergence is rare but data volume is huge.`,
        `Transparency logs use a different angle. The log publishes a root, and clients ask for inclusion or consistency proofs. The proof does not make the log honest by itself; witnesses, monitors, signatures, and policy decide whether a suspicious root should be trusted.`,
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        `Git uses content hashes over objects and tree-shaped structure so identical content has identical object IDs. Distributed databases use Merkle trees for anti-entropy repair after replicas diverge. Blockchains put Merkle roots in headers so clients can verify transaction inclusion. Certificate Transparency logs use Merkle proofs for append-only auditability.`,
        `The pattern is strongest when most data is unchanged or when small clients need selective proofs against a root supplied by another trust system.`,
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        `Merkle trees prove integrity, not privacy. Hashes can leak patterns unless the data and encoding are designed carefully. They also do not prove authorship; signatures, consensus, or policy decide who is allowed to produce the root.`,
        `Implementation details matter: block order, odd-leaf handling, hash domain separation, and serialization must be specified. A toy hash is fine for the visualization, but production systems need vetted cryptographic hashes.`,
        `They also do not solve availability by themselves. A proof can show that a block is part of a committed dataset, but someone still has to store and serve the block. That is why storage systems combine Merkle roots with replication, erasure coding, repair, or data-availability sampling.`,
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        `Read Hash Table for hashing intuition, then Git Internals and Content-Addressed Merkle DAG Object Store for content-addressed storage. CAP Theorem and Consistent Hashing explain why replicas drift and how data is placed. Bloom Filter gives a contrasting probabilistic tool. Write-Ahead Log (WAL) shows a different durability mechanism: logs recover recent writes, while Merkle trees compare stored state after the fact. Merkle Mountain Range Append-Only Log and Transparency Log Witnessing Case Study extend the idea into append-only auditability. HotStuff BFT Quorum Certificate Case Study shows how signed consensus votes can authenticate ordered blocks and state roots. Data Availability Sampling & Erasure Coding Case Study shows commitments plus random samples in modular blockchain data layers, and Namespaced Merkle Tree Proof Case Study shows how range metadata proves a complete per-app slice. Software Supply Chain Provenance Graph shows how Merkle roots connect to signed build artifacts and attestations.`,
      ],
    },
  ],
};
