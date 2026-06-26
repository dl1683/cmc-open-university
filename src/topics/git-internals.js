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

  const totalNodes = NODES.length;
  const totalEdges = EDGES.length;
  const hashDigits = 4;
  const fullHashLen = 40;
  const blobNodes = NODES.filter(n => n.note.startsWith('README') || n.note.startsWith('app.js'));
  const treeNodes = NODES.filter(n => n.note.startsWith('tree'));
  const commitNodes = NODES.filter(n => n.note.startsWith('commit'));
  const numBlobs = blobNodes.length;
  const numTrees = treeNodes.length;
  const numCommits = commitNodes.length;

  const readmeHash = NODES.find(n => n.id === 'B1').label;
  const appV1Hash = NODES.find(n => n.id === 'B2').label;
  const appV2Hash = NODES.find(n => n.id === 'B3').label;
  const rootTree1Hash = NODES.find(n => n.id === 'T1').label;
  const rootTree2Hash = NODES.find(n => n.id === 'T1b').label;
  const srcTree1Hash = NODES.find(n => n.id === 'T2').label;
  const srcTree2Hash = NODES.find(n => n.id === 'T2b').label;
  const commit1Hash = NODES.find(n => n.id === 'C1').label;
  const commit2Hash = NODES.find(n => n.id === 'C2').label;

  yield {
    state: snapshot(),
    highlight: {},
    explanation: `You use git daily — here is what it actually is. First, the myth to kill: git does NOT store diffs. Every commit is a full SNAPSHOT of your whole project. Sounds wasteful? The trick that makes it cheap is the same one inside the Merkle Tree: name every piece of data by the HASH of its content, and identical content automatically becomes the same object. This graph has ${totalNodes} objects and ${totalEdges} edges. (Each node shows the first ${hashDigits} hex digits of its real ${fullHashLen}-digit hash.)`,
  };

  yield {
    state: snapshot(),
    highlight: { active: ['B1', 'B2'] },
    explanation: `The atoms: BLOBS (${numBlobs} in this graph). A blob is a file's contents — just the bytes, no filename — hashed to produce its id. README.md's contents hash to ${readmeHash}; app.js's to ${appV1Hash}. Content addressing has an immediate superpower: the same file content, anywhere in any commit by any author, is stored exactly ONCE, because it always hashes to the same name (a Hash Table where the key IS the value's fingerprint).`,
  };

  yield {
    state: snapshot(),
    highlight: { active: ['T1', 'T2'], compare: ['t1b1', 't1t2', 't2b2'] },
    explanation: `The folders: TREES (${numTrees} in this graph). A tree lists (filename → hash) pairs — src/ (${srcTree1Hash}) points at app.js's blob; the root tree (${rootTree1Hash}) points at README's blob and the src/ tree — and the tree is itself hashed. Recognize the construction? Hashes of hashes: the root tree ${rootTree1Hash} commits to the ENTIRE project state, exactly like a Merkle Tree root. One byte changes anywhere below, and ${rootTree1Hash} would be a different hash.`,
  };

  yield {
    state: snapshot(),
    highlight: { found: ['C1'], compare: ['c1t1'] },
    explanation: `The history: COMMITS (${numCommits} in this graph). A commit = root tree hash + parent commit hash + author + message, hashed. So commit ${commit1Hash} transitively pins every byte of the project AND its whole ancestry. THIS is why commit ids are tamper-proof: "editing history" would change hashes all the way down the chain — which is also why force-push REWRITES history (mints new commits) rather than editing it.`,
    invariant: `A commit hash commits to the entire project state and the entire history behind it.`,
  };

  const newObjectCount = 4;

  yield {
    state: snapshot(),
    highlight: { active: ['B3', 'T2b', 'T1b', 'C2'], found: ['B1'] },
    explanation: `Now edit app.js and commit. New content → NEW blob ${appV2Hash}; src/ now lists a different hash → NEW tree ${srcTree2Hash}; root changes → NEW tree ${rootTree2Hash}; new commit ${commit2Hash} with parent ${commit1Hash}. Count what was created: ${newObjectCount} small objects. And look at README's blob ${readmeHash} — BOTH root trees point at the SAME object. Unchanged files cost nothing. Full snapshots, diff-sized storage.`,
  };

  yield {
    state: snapshot(),
    highlight: { compare: ['T1', 'T1b'], found: ['B1'] },
    explanation: `And diffing? git status and git diff start as HASH COMPARISONS: root trees ${rootTree1Hash} vs ${rootTree2Hash} differ → descend; README's entries match (${readmeHash} = ${readmeHash}) → that whole file is skipped without reading a byte; src/ differs (${srcTree1Hash} vs ${srcTree2Hash}) → descend → app.js changed. It is exactly the Merkle Tree replica-repair descent — pruning everything identical, touching only what changed.`,
  };

  yield {
    state: snapshot(),
    highlight: { found: ['C2', 'C1'] },
    explanation: `The rest of git falls out: a BRANCH is a ${fullHashLen + 1}-byte file holding a commit hash (that's all "main" is); checkout walks the ${totalNodes}-node DAG and materializes blobs; push computes which object hashes the remote lacks and sends only those (why pushing a small change is instant); merge finds the common ancestor in the DAG. Git is a content-addressed Merkle DAG with a command-line UI — and the same design (hash-named immutable objects) underpins Docker image layers, Nix packages, and IPFS. You've been using a distributed data structure all along.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization builds a concrete Git object graph for a two-commit repository. It starts by showing all nine objects at once, then walks through each object type: blobs (raw file contents), trees (directory listings), and commits (snapshots with parent links). Highlighted nodes and edges mark the objects under discussion at each step.',
        'The final frames show what happens when you edit one file and commit again. Watch which objects are created fresh and which are reused from the first commit. The four-character hex labels on each node are shortened SHA-1 hashes; a real Git hash is 40 hex digits (160 bits), but the short prefix is enough to track identity in a small graph.',
        {type: 'image', src: './assets/gifs/git-internals.gif', alt: 'Animated walkthrough of the git internals visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Pay attention to the edges. Every edge is a hash reference: a commit points to its root tree, a tree points to blobs and subtrees, and a commit points to its parent commit. The direction of edges is the direction of hash commitment: if object A contains the hash of object B, there is an edge from A to B. This matters because changing B would invalidate A\'s stored hash, making the graph tamper-evident.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Most developers use Git daily but treat it as a black box with memorized incantations. When something goes wrong -- a detached HEAD, a lost commit after rebase, a merge conflict that makes no sense -- the mental model breaks because there was no model to begin with. Git\'s internal design is simple enough to fit on a napkin, and once you see it, every command becomes a predictable operation on a well-defined data structure.',
        'The payoff is not trivia. Understanding the object model tells you exactly what "rewriting history" means (minting new commit objects with new hashes), why force-push is dangerous (it moves a shared name to point at a different chain), why branches are cheap (they are 41-byte text files), and why Git can detect corruption (every object\'s name is the SHA-1 of its content). These are not metaphors; they are the literal implementation.',
        {type: 'callout', text: 'Git is easier to reason about when commits, trees, blobs, and refs are treated as immutable objects plus movable names.'},
        'This topic also connects Git to a broader family of content-addressed systems. Docker image layers, Nix store paths, IPFS blocks, and blockchain transactions all use the same core idea: name data by hashing its content, compose larger structures from those hashes, and get integrity verification and deduplication for free. Learning Git\'s internals teaches you a design pattern that appears across distributed systems.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The intuitive model for version control is storing diffs. You have a base version of each file, and each subsequent version is a patch: "at line 42, delete three lines and insert five." This is how RCS (1982) and CVS worked. It is space-efficient for text files with small changes, and it mirrors how humans think about editing.',
        {type: 'image', src: 'https://git-scm.com/book/en/v2/images/data-model-1.png', alt: 'Git commit object pointing to a tree and blob objects', caption: 'Pro Git, Git Internals: Git Objects, visualizes commits as pointers to tree snapshots rather than as patch files. Source: https://git-scm.com/book/en/v2/Git-Internals-Git-Objects'},
        'A slightly more sophisticated intuition is that a branch is a container of commits, like a folder of patches. You "put commits on a branch" and "move commits between branches." This language is so pervasive that it shapes how people debug: they ask "where did my commit go?" as if commits physically reside inside branches.',
        'Both intuitions are useful day-to-day shorthand, but they are wrong about the storage model. Git does not store diffs as the primary representation, and branches do not contain commits. Holding onto these models leads to confusion the moment you encounter rebase, reflog, or detached HEAD.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The diff-based model hits a wall when you try to explain basic Git behavior. If Git stores diffs, how can "git checkout" of an ancient commit be instantaneous instead of replaying thousands of patches? If branches contain commits, how can the same commit appear on multiple branches? If history is a list of patches, how does Git detect repository corruption?',
        'Consider a concrete scenario. You have 10,000 files and 5,000 commits. You run "git checkout HEAD~4999" to jump to the very first commit. In a diff-based system, reconstructing that state means reverse-applying 4,999 patches in sequence. Git does it in milliseconds. The diff model cannot explain this without inventing caches and snapshots -- at which point you are no longer describing a diff-based system.',
        'The branch-as-container model breaks just as hard. Run "git log --all --graph" and you will see the same commit hash reachable from multiple branches. After a merge, the merged branch\'s entire history is reachable from the target branch. Commits did not "move"; a pointer changed. If you delete the merged branch, the commits remain because they are still reachable from the merge commit. The container metaphor has no explanation for this.',
        'These are not edge cases. They are everyday operations that the standard mental model cannot predict. The wall is not Git being complicated; it is the wrong model being simple in a way that stops working.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Git is a content-addressed object store organized as a Merkle DAG (directed acyclic graph). Every piece of data is stored as an object whose name is the SHA-1 hash of its content. There are four object types: blobs (file content), trees (directory listings), commits (snapshots with metadata and parent links), and annotated tags. On top of this immutable object layer, Git places mutable references (refs) -- simple text files that hold one object hash each.',
        'Content addressing means the name of an object is determined entirely by what the object contains. If two files have identical content, they produce identical blobs with identical hashes. Git does not need to compare files byte-by-byte to check equality; it compares 20-byte hashes. This is the mechanism behind both deduplication and integrity checking.',
        {type: 'image', src: 'https://git-scm.com/book/en/v2/images/data-model-3.png', alt: 'Git object graph with multiple commits sharing unchanged objects', caption: 'Pro Git, Git Internals: Git Objects, shows how later commits reuse unchanged blobs and trees while new content receives new object identities. Source: https://git-scm.com/book/en/v2/Git-Internals-Git-Objects'},
        'The Merkle structure means a commit hash transitively commits to every byte in the project and every ancestor commit in the history. Change one character in one file in one old commit, and the commit hash changes, which changes the child commit hash, which changes every descendant all the way to HEAD. This is why Git history is tamper-evident: you cannot silently alter the past without producing a visibly different commit chain.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A blob object is the simplest: Git prepends a header ("blob <size>\\0") to the file\'s raw bytes, computes SHA-1 over the result, and stores the compressed object in .git/objects/<first 2 hex>/<remaining 38 hex>. The blob contains no filename, no permissions, no timestamp -- just content. A 500-byte file produces a blob header of roughly 10 bytes plus the content, so the pre-compression object is about 510 bytes. After zlib deflate, a typical source file compresses to 40-60% of its original size.',
        'A tree object is a sorted list of entries, each containing a file mode (like 100644 for a regular file or 040000 for a subdirectory), a name (like "README.md"), and the 20-byte binary hash of the blob or subtree it points to. The tree is itself hashed and stored as an object. A directory with 5 files produces a tree object of roughly 5 x (6 + name_length + 20) bytes before compression -- perhaps 250 bytes for typical filenames.',
        'A commit object contains the hash of a root tree, zero or more parent commit hashes, author name/email/timestamp, committer name/email/timestamp, and a message. A typical commit object is 200-300 bytes. The root tree hash pins the entire project snapshot; the parent hash pins the entire prior history. Together they form the Merkle DAG.',
        {type: 'image', src: 'https://git-scm.com/book/en/v2/images/data-model-2.png', alt: 'Git tree object naming blobs for files in a directory snapshot', caption: 'Pro Git, Git Internals: Git Objects, makes the tree object concrete: names and modes point to blob identities inside a snapshot. Source: https://git-scm.com/book/en/v2/Git-Internals-Git-Objects'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Content addressing provides two properties simultaneously: integrity and deduplication. Integrity comes from the hash contract -- if you read an object and its SHA-1 does not match its stored name, the data is corrupt. Git checks this on transfer and can check it on demand with "git fsck". Deduplication comes from the pigeonhole principle in reverse: identical content always produces the same hash, so Git never stores two copies of the same file content regardless of how many commits or branches reference it.',
        'The DAG structure provides efficient traversal and comparison. To diff two commits, Git compares their root tree hashes. If equal, the entire project is identical -- no file-by-file comparison needed. If different, Git descends into the trees, comparing subtree hashes at each level and skipping entire directory subtrees whose hashes match. This is the same Merkle tree descent used in peer-to-peer systems to synchronize large datasets: you prune the search space exponentially at each level of the tree.',
        'Immutability provides safe concurrency and simple caching. Once an object is written, it never changes. Multiple Git processes can read the object store without locks. Packfiles can cache delta chains without worrying about base objects being modified. The reflog can record every position a ref has ever held, and all those positions remain valid because the objects they name still exist until garbage collection.',
        'Cheap branching falls out of the ref design. Creating a branch means writing a 41-byte file (40 hex digits plus a newline) under .git/refs/heads/. Switching branches means updating HEAD (another 41-byte file or a symbolic-ref line) and materializing the target commit\'s tree into the working directory. There is no copying of commits or history; the branch is just a name that points into the existing object graph.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Space cost per commit is proportional to the number of changed files, not the total project size. If you change 1 file in a 10,000-file project, Git creates 1 new blob, a new tree for each directory on the path from root to that file (typically 2-4 new trees), and 1 new commit. That is roughly 5-7 new objects totaling perhaps 2-3 KB compressed. The other 9,999 blobs and all unchanged subtrees are referenced by hash without duplication.',
        'Time cost for common operations: "git status" walks the working tree and compares file stat data against the index, which is O(number of files). "git diff" between two commits is O(changed files) because Merkle descent prunes unchanged subtrees. "git log" is O(commits traversed) and follows parent pointers. "git branch" is O(1) -- write a 41-byte file. "git clone" transfers every reachable object, so it is O(total repository size), but subsequent fetches transfer only new objects.',
        'Packfile compression amortizes storage further. Git periodically runs "git gc" which packs loose objects into packfiles using delta compression: similar objects are stored as a base plus a binary delta. A 10 MB source tree with 1,000 commits might occupy only 15-30 MB as a packfile, because successive versions of the same file delta-compress extremely well. The logical object model is unchanged -- every object still has a unique hash -- but the physical storage is much smaller.',
        'The SHA-1 computation itself is fast: roughly 500 MB/s on modern hardware. For a 1 MB file, hashing takes about 2 ms. For a typical commit touching a few files, the total hashing overhead is under 1 ms. The bottleneck in Git operations is almost always filesystem I/O or network transfer, not hashing.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Every major software project uses Git. Linux kernel development, which Git was designed for, involves thousands of contributors merging through a hierarchy of maintainers. The kernel repository has over a million commits spanning two decades, and Git handles it because object reuse keeps the repository at a manageable ~4 GB packfile. Cloning is slow, but incremental fetches are fast because only new objects transfer.',
        'The content-addressed design extends beyond source code. Git-LFS (Large File Storage) uses the same hash-based pointers but stores actual blob data on a separate server, keeping the repository small while tracking large binaries. DVC (Data Version Control) applies the same pattern to machine learning datasets and model files.',
        'The broader design pattern appears in Docker (image layers are content-addressed tarballs), Nix (store paths include a hash of all build inputs), IPFS (blocks are addressed by their multihash), and blockchain systems (each block hash commits to the block contents and the previous block hash). In all cases, the core mechanism is identical: name data by its hash, compose structures from hashes, get integrity and deduplication automatically.',
        'Git\'s ref model also influenced distributed systems design. The idea that mutable names (branches, tags) sit on top of an immutable content-addressed store is now a common architecture for configuration management, artifact registries, and append-only event logs.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Git struggles with large binary files that change frequently. A 100 MB video file edited 50 times produces 50 blob objects. Delta compression helps if the binary format has local changes, but many formats (compressed images, compiled binaries) produce entirely different byte sequences for small logical changes. The repository grows by nearly 100 MB per commit, and there is no good way to prune old versions without rewriting history.',
        'Git also struggles with extremely large monorepos at scale. A repository with millions of files makes "git status" slow because it must stat every file in the working tree. Google, Facebook, and Microsoft have built custom virtual filesystem layers (GVFS/Scalar, VFSForGit) that lazily populate the working tree to work around this. Standard Git assumes the working tree fits comfortably on disk and can be scanned quickly.',
        'Security-sensitive content is another failure mode. If you commit a secret (API key, password, private key), it becomes a permanent object in the repository. Removing it from the current tree does not remove it from old commits. Cleaning it requires history rewriting (git filter-branch or BFG Repo Cleaner), which changes commit hashes all the way forward, breaks all existing clones\' history, and does not help if anyone has already cloned the old state. The correct response is to rotate the secret.',
        'The SHA-1 hash function is theoretically broken (SHAttered, 2017: a collision was demonstrated for two different PDF files). Git has been migrating toward SHA-256, but the transition is slow because the hash is deeply embedded in the wire protocol, packfile format, and every tool that parses Git objects. In practice, the SHAttered attack requires a chosen-prefix collision costing significant compute, and Git added hardening to detect known collision patterns, so real-world exploitation remains difficult.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with an empty repository. Create two files: README.md (28 bytes: "# My Project\\nHello world.\\n") and src/app.js (45 bytes: "function main() { console.log(\'hi\'); }\\n"). Run "git add ." and "git commit -m \'initial\'". Here is exactly what Git creates, with real hash calculations.',
        'Blob for README.md: Git computes SHA-1 over "blob 28\\0# My Project\\nHello world.\\n". The result is a 40-hex-digit hash, say 5b1dfce... Git writes the zlib-compressed content to .git/objects/5b/1dfce... Blob for app.js: same process over "blob 45\\0function main() { console.log(\'hi\'); }\\n", producing hash e44c3a7... Two objects written, two disk files created under .git/objects/.',
        'Tree for src/: Git creates a tree entry "100644 app.js\\0<20-byte binary hash of e44c3a7>". After hashing with the "tree <size>\\0" header, this produces tree object 44da92f... Tree for root /: entries are "100644 README.md\\0<hash of 5b1d>" and "040000 src\\0<hash of 44da>", producing root tree 7c01ab2... Two more objects.',
        'Commit: Git writes "tree 7c01ab2...\\nauthor Devansh <...> 1750000000 +0000\\ncommitter Devansh <...> 1750000000 +0000\\n\\ninitial\\n", hashes it with the "commit <size>\\0" header, gets commit a1f3e58... One more object. Total: 5 objects (2 blobs + 2 trees + 1 commit). Git writes "a1f3e58..." into .git/refs/heads/main. The branch is born.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The canonical reference is "Pro Git" by Scott Chacon and Ben Straub, freely available at https://git-scm.com/book. Chapter 10 ("Git Internals") covers the object model, packfiles, transfer protocols, and refspecs. The diagrams used in this article are from that chapter. For the original design rationale, read Linus Torvalds\' 2005 mailing list posts announcing Git and his 2007 Google Tech Talk on Git.',
        'To build hands-on intuition, run "git cat-file -t <hash>" (shows object type), "git cat-file -p <hash>" (pretty-prints object content), and "git ls-tree <tree-hash>" (lists tree entries) on a real repository. Create a tiny repo, make two commits, and inspect every object in .git/objects/ to verify the snapshot model. Try "git count-objects -vH" to see how many loose and packed objects your repository contains.',
        'Study Merkle Trees for the underlying data structure, Hash Tables for the content-addressing mechanism, and Persistent Data Structures for the broader concept of immutable versioned structures. For distributed systems applications of the same pattern, look at IPFS Content Addressing and eventually-consistent replication protocols. For Git-specific extensions, explore Three-Way Merge algorithms and the Git packfile delta format.',
      ],
    },
  ],
};
