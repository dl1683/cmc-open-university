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
      heading: 'Why this exists',
      paragraphs: [
        'Git internals matter because Git is not just a folder history tool. It is a content-addressed object database with references, indexes, trees, commits, packs, and merge algorithms layered on top. Understanding those pieces makes everyday commands less mysterious.',
        'The practical payoff is confidence. When a branch moves, a commit disappears from the log, a merge conflicts, or a rebase rewrites history, the underlying object model explains what changed and what probably still exists in the database.',
        {type: 'callout', text: 'Git is easier to reason about when commits, trees, blobs, and refs are treated as immutable objects plus movable names.'},
      ],
    },
    {
      heading: 'The obvious model',
      paragraphs: [
        'The obvious mental model is that Git stores file-by-file diffs. That is partly how people experience history, but it is not the core storage model. A commit points to a tree snapshot, not merely to a patch.',
        {type: 'image', src: 'https://git-scm.com/book/en/v2/images/data-model-1.png', alt: 'Git commit object pointing to a tree and blob objects', caption: 'Pro Git, Git Internals: Git Objects, visualizes commits as pointers to tree snapshots rather than as patch files. Source: https://git-scm.com/book/en/v2/Git-Internals-Git-Objects'},
        'Another tempting model is that a branch contains commits. More precisely, a branch is a reference to one commit. The commit graph contains parent links. Moving the reference changes what the branch name points at; it does not rewrite every object by itself.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Git stores objects by content hash. Blob objects hold file contents. Tree objects map names to blobs and subtrees. Commit objects point to a root tree, parent commits, author metadata, committer metadata, and a message. Tags can point to objects with a stable name.',
        'This creates a Merkle DAG. A commit hash commits to its tree. The tree commits to file names, modes, and child object hashes. Parent links commit to history. Change one file and the affected blob, trees, and commit get new identities, while unchanged blobs are reused.',
        {type: 'image', src: 'https://git-scm.com/book/en/v2/images/data-model-3.png', alt: 'Git object graph with multiple commits sharing unchanged objects', caption: 'Pro Git, Git Internals: Git Objects, shows how later commits reuse unchanged blobs and trees while new content receives new object identities. Source: https://git-scm.com/book/en/v2/Git-Internals-Git-Objects'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The working tree is the files you edit. The index is the staging area: a proposed next tree. The object database stores blobs, trees, commits, and tags. A commit writes a tree from the index, creates a commit object, and moves the current branch reference to that new commit.',
        'Branches are refs, usually files under refs/heads or packed references. HEAD normally points to a branch ref, and the branch ref points to a commit. Detached HEAD means HEAD points directly to a commit instead of a branch name.',
        'Git can store objects loose or packed. Loose objects are individual compressed files addressed by hash. Packfiles store many objects together with delta compression. The logical object model stays the same even when storage is optimized.',
        {type: 'image', src: 'https://git-scm.com/book/en/v2/images/data-model-2.png', alt: 'Git tree object naming blobs for files in a directory snapshot', caption: 'Pro Git, Git Internals: Git Objects, makes the tree object concrete: names and modes point to blob identities inside a snapshot. Source: https://git-scm.com/book/en/v2/Git-Internals-Git-Objects'},
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The object graph view proves that commits are snapshots linked by parents. The visible diff is derived by comparing trees. Git can show a patch because it can compare two snapshots; it does not need the patch to be the primary history object.',
        'The ref view proves why branch operations are cheap. Creating a branch writes a new pointer. Checking out a branch updates HEAD and the working tree. Merging or rebasing changes commit graph shape and refs, not the identity of existing immutable objects.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Content addressing gives integrity and reuse. If an object hash matches its content, Git can detect corruption. If two files or versions have identical content, they can share the same blob object. A commit hash names a complete reachable snapshot and history prefix.',
        'The DAG gives cheap history traversal. Parent links let Git walk ancestors, find merge bases, compute reachability, and decide whether one branch already contains another. Merge is not magic; it starts by finding common ancestors and comparing trees.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Git is fast for source trees because snapshots share objects and packfiles compress repeated content well. It is less happy with huge binary files that change often, because delta compression may be expensive and history grows without useful line-level structure.',
        'The tradeoff of immutable objects is that history rewriting creates new commits. Rebase, amend, and filter operations do not edit old commits in place. They make new commits with new hashes and then move refs. Shared branches therefore need coordination before rewriting.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Git wins for distributed source control, code review, branching, local experimentation, bisecting regressions, and auditable project history. Every clone has the object graph needed for most history operations without a central server.',
        'The same model appears elsewhere: content-addressed build caches, package lockfiles, container layer digests, Merkle DAG object stores, and provenance systems. Git is a practical, familiar instance of a broader design pattern.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The most common user failure is confusing refs with objects. Deleting a branch deletes a name, not immediately every commit it once reached. Reflogs and unreachable objects often provide a recovery window until garbage collection prunes them.',
        'Another failure is committing secrets or large generated files. Content addressing makes history durable. Removing a secret from the working tree does not remove it from old commits. Sensitive history cleanup requires rewriting commits and rotating the secret anyway.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'When you edit a file and run git add, Git writes or reuses a blob object for the staged content and records it in the index. When you commit, Git writes tree objects that describe the directory snapshot and then writes a commit pointing to the root tree.',
        'If only one file changed, most old blobs and subtrees can be reused. The new commit still names a full project snapshot because its root tree reaches every file, but unchanged objects keep their old identities. Snapshot semantics and storage reuse coexist.',
        'A merge commit is just another commit with more than one parent. The merge algorithm may be complex, but the stored result is simple: a tree snapshot and parent links. Understanding that removes much of the mystique around merge commits.',
      ],
    },
    {
      heading: 'Debugging checklist',
      paragraphs: [
        'When history looks wrong, ask which ref moved. git log follows refs and parent links; it is not a list of every object that exists. git reflog can show previous positions of HEAD and branch refs, which often recovers commits that disappeared from ordinary log output.',
        'When content looks wrong, ask which tree is checked out and what the index contains. The working tree, index, and HEAD commit are three different states. Commands such as status, diff, diff --staged, and cat-file expose those layers.',
        'When storage looks large, ask whether objects are loose, packed, reachable, or kept alive by reflogs. Garbage collection follows reachability rules. The fact that a commit is not on a branch today does not mean Git is allowed to delete it immediately.',
      ],
    },
    {
      heading: 'How to reason about commands',
      paragraphs: [
        'Many Git commands are easier if you translate them into object and ref changes. commit creates objects and moves a ref. branch creates or moves a name. checkout changes HEAD and updates the working tree. reset moves a ref and may update the index or working tree depending on mode.',
        'Rebase is not moving existing commits to a new base. It is replaying changes to create new commits with new parent links and new hashes, then moving a ref. That is why rebasing shared history can surprise collaborators who still point at the old graph.',
        'Merge is the conservative alternative when shared history matters. It preserves both parent lines and records a new commit that joins them. The result can be messier to look at, but it keeps the public graph honest about how work converged.',
        'Cherry-pick is another useful translation exercise. It computes the change introduced by an existing commit and applies that change to the current HEAD, producing a new commit with a different parent and hash. Same patch idea, different object identity.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Merkle Tree, Content-Addressed Merkle DAG Object Store, Hash Table, Persistent Data Structures, Three-Way Merge, CRDTs for collaborative contrast, and Software Supply Chain Provenance. A useful exercise is to run git cat-file on a commit, tree, and blob until the snapshot model becomes visible.',
      ],
    },
  ],
};
