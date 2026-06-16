// Git internals: under the porcelain, git is a content-addressed Merkle DAG —
// blobs, trees, and commits, all named by the hash of what they contain.
// See two commits share storage, and every git mystery starts dissolving.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'git-internals',
  title: 'Git Internals',
  category: 'Systems',
  summary: 'Blobs, trees, commits — git as a content-addressed Merkle DAG, where snapshots cost like diffs.',
  controls: [
    { id: 'show', label: 'Walk through', type: 'select', options: ['two commits, one edit'], defaultValue: 'two commits, one edit' },
  ],
  run,
};

// The object graph for: commit 1 (README.md + src/app.js), then editing app.js.
const NODES = [
  { id: 'C1', label: 'a1f3', x: 1.0, y: 7.2, note: 'commit 1' },
  { id: 'C2', label: '9e2b', x: 1.0, y: 2.2, note: 'commit 2' },
  { id: 'T1', label: '7c01', x: 4.0, y: 8.0, note: 'tree /' },
  { id: 'T2', label: '44da', x: 6.8, y: 9.0, note: 'tree src/' },
  { id: 'T1b', label: 'c8f2', x: 4.0, y: 1.4, note: 'tree /' },
  { id: 'T2b', label: '02e7', x: 6.8, y: 2.6, note: 'tree src/' },
  { id: 'B1', label: '5b1d', x: 9.2, y: 5.2, note: 'README.md' },
  { id: 'B2', label: 'e44c', x: 9.2, y: 8.8, note: 'app.js v1' },
  { id: 'B3', label: '1a9f', x: 9.2, y: 1.2, note: 'app.js v2' },
];
const EDGES = [
  { id: 'c1t1', from: 'C1', to: 'T1' },
  { id: 't1b1', from: 'T1', to: 'B1' },
  { id: 't1t2', from: 'T1', to: 'T2' },
  { id: 't2b2', from: 'T2', to: 'B2' },
  { id: 'c2c1', from: 'C2', to: 'C1' },
  { id: 'c2t1b', from: 'C2', to: 'T1b' },
  { id: 't1bb1', from: 'T1b', to: 'B1' },
  { id: 't1bt2b', from: 'T1b', to: 'T2b' },
  { id: 't2bb3', from: 'T2b', to: 'B3' },
];

export function* run(input) {
  if (String(input.show) !== 'two commits, one edit') throw new InputError('Pick the walkthrough.');
  const snapshot = () => graphState({ nodes: NODES, edges: EDGES });

  yield {
    state: snapshot(),
    highlight: {},
    explanation: 'You use git daily — here is what it actually is. First, the myth to kill: git does NOT store diffs. Every commit is a full SNAPSHOT of your whole project. Sounds wasteful? The trick that makes it cheap is the same one inside the Merkle Tree: name every piece of data by the HASH of its content, and identical content automatically becomes the same object. (Each node shows the first 4 hex digits of its real 40-digit hash.)',
  };

  yield {
    state: snapshot(),
    highlight: { active: ['B1', 'B2'] },
    explanation: 'The atoms: BLOBS. A blob is a file\'s contents — just the bytes, no filename — hashed to produce its id. README.md\'s contents hash to 5b1d; app.js\'s to e44c. Content addressing has an immediate superpower: the same file content, anywhere in any commit by any author, is stored exactly ONCE, because it always hashes to the same name (a Hash Table where the key IS the value\'s fingerprint).',
  };

  yield {
    state: snapshot(),
    highlight: { active: ['T1', 'T2'], compare: ['t1b1', 't1t2', 't2b2'] },
    explanation: 'The folders: TREES. A tree lists (filename → hash) pairs — src/ points at app.js\'s blob; the root tree points at README\'s blob and the src/ tree — and the tree is itself hashed. Recognize the construction? Hashes of hashes: the root tree 7c01 commits to the ENTIRE project state, exactly like a Merkle Tree root. One byte changes anywhere below, and 7c01 would be a different hash.',
  };

  yield {
    state: snapshot(),
    highlight: { found: ['C1'], compare: ['c1t1'] },
    explanation: 'The history: COMMITS. A commit = root tree hash + parent commit hash + author + message, hashed. So commit a1f3 transitively pins every byte of the project AND its whole ancestry. THIS is why commit ids are tamper-proof: "editing history" would change hashes all the way down the chain — which is also why force-push REWRITES history (mints new commits) rather than editing it.',
    invariant: 'A commit hash commits to the entire project state and the entire history behind it.',
  };

  yield {
    state: snapshot(),
    highlight: { active: ['B3', 'T2b', 'T1b', 'C2'], found: ['B1'] },
    explanation: 'Now edit app.js and commit. New content → NEW blob 1a9f; src/ now lists a different hash → NEW tree 02e7; root changes → NEW tree c8f2; new commit 9e2b with parent a1f3. Count what was created: 4 small objects. And look at README\'s blob 5b1d — BOTH root trees point at the SAME object. Unchanged files cost nothing. Full snapshots, diff-sized storage.',
  };

  yield {
    state: snapshot(),
    highlight: { compare: ['T1', 'T1b'], found: ['B1'] },
    explanation: 'And diffing? git status and git diff start as HASH COMPARISONS: root trees 7c01 vs c8f2 differ → descend; README\'s entries match (5b1d = 5b1d) → that whole file is skipped without reading a byte; src/ differs → descend → app.js changed. It is exactly the Merkle Tree replica-repair descent — pruning everything identical, touching only what changed.',
  };

  yield {
    state: snapshot(),
    highlight: { found: ['C2', 'C1'] },
    explanation: 'The rest of git falls out: a BRANCH is a 41-byte file holding a commit hash (that\'s all "main" is); checkout walks the DAG and materializes blobs; push computes which object hashes the remote lacks and sends only those (why pushing a small change is instant); merge finds the common ancestor in the DAG. Git is a content-addressed Merkle DAG with a command-line UI — and the same design (hash-named immutable objects) underpins Docker image layers, Nix packages, and IPFS. You\'ve been using a distributed data structure all along.',
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `Git is not a tool for storing diffs. It is a *content-addressed Merkle DAG*: a directed acyclic graph where every piece of data — files, folders, commits — is named by the cryptographic hash of its contents. A blob is file contents; a tree is a folder (a list of filenames pointing to hashes); a commit is a snapshot (root tree + parent commit + metadata), all hashed together. Because identical content always hashes to the same name, two commits sharing a README automatically share the same blob object in storage.`,
        `This design was revolutionary. When Linus Torvalds designed git in 2005, most version-control systems stored diffs — the changes between versions. Git stores snapshots (complete project states), yet because of content addressing, a snapshot costs about as much as a diff. Today, docker image layers, Nix packages, IPFS, and blockchain systems use the same pattern.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `When you commit, git builds four kinds of objects. First, it reads your working files and creates a blob for each — a SHA-1 hash of the file contents (40 hex digits in modern git, though git is migrating to SHA-256). Then it creates trees: the root tree is a table of filenames mapping to blob hashes and subtree hashes, and each folder becomes a tree. The root tree itself gets hashed — that hash is a cryptographic commitment to the *entire project state*, just like a Merkle tree root. Finally, the commit object contains the root tree hash, the parent commit hash, your author info, and a message, all hashed together to produce the commit ID.`,
        `Because of content addressing, editing one file creates only four new objects: the new blob, and three new trees (src/ folder, root). The unchanged README blob is shared between both commits — git diff literally walks the tree hashes downward, skipping anything identical without reading bytes. Pushing a 1-byte change is fast because git computes which object hashes the remote already has (hash set-difference), and sends only the new ones. Branches are not metaphors; a branch is a 41-byte text file containing a commit hash.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Content-addressed storage with hashing costs CPU (SHA-1 / SHA-256 is fast but not free) and initial setup time, but the payoffs are profound. Storage is deduplicated automatically — identical files across commits are one object. Diffing is logarithmic in project history because you descend only changed tree nodes, with exponential pruning. Corruption is detectable: any bit change in stored objects produces a different hash, so git fsck can audit object integrity. Force-pushing creates new commits rather than mutating old ones, preserving history traceability; this is a feature, not a bug, because it prevents tampering. The tradeoff is that git history is append-only: you cannot truly edit the past without invalidating all descendant commit hashes.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Git manages nearly every software project, making it the most-used version-control system. Beyond source code, the same hash-named-immutable-objects pattern powers container images (docker layers are content-addressed), package managers (Nix stores packages by their derivation hash), distributed file systems (IPFS uses content hashing), and blockchains. Kubernetes uses git as a source of truth (GitOps). The pattern also underpins databases with write-ahead logs and snapshot isolation, where prior versions are kept immutable and new snapshots reference unchanged parts. Anywhere you need to merge, deduplicate, or prove integrity, content addressing is the right tool.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The biggest myth is that git stores diffs, making it space-efficient. It does not; it stores snapshots. The efficiency comes from hashing and deduplication, which is a different beast. A second misconception is that commit hashes are random or unstable — they are *deterministic derivations* from content. If two people commit the same code from the same parent, they get the same commit hash. Force-pushing is often feared as "losing history," but it does not erase anything: the old commits are orphaned (unreachable from any branch), not deleted, and git reflog can recover them. Finally, many users misunderstand branching as creating new storage; a branch is just a label (41 bytes) pointing to a commit. Switching branches does not clone; it rewrites your working directory to match the commit tree.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary references: Git's object model in Pro Git at https://git-scm.com/book/en/v2/Git-Internals-Git-Objects, git repository layout at https://git-scm.com/docs/gitrepository-layout, and Git's hash transition notes at https://git-scm.com/docs/hash-function-transition. To deepen your understanding, explore Merkle Tree to see the mathematical structure underlying git's integrity commitments. Hash Table explains blob lookup. Graph BFS and Topological Sort explain commit traversal. Content-Addressed Merkle DAG Object Store generalizes Git's object model into a reusable storage pattern. Content-Defined Chunking & Dedup explains when byte-range boundaries replace Git's file/tree boundaries. Transparency Log Witnessing Case Study and Software Supply Chain Provenance Graph show how signed roots, attestations, and audit logs extend Git's integrity story into release security.`,
      ],
    },
  ],
};
