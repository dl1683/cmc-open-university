// Content-addressed Merkle DAG object stores: CIDs, blocks, links,
// manifests, pins, traversal, verification, and garbage collection.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'content-addressed-merkle-dag-object-store',
  title: 'Content-Addressed Merkle DAG Object Store',
  category: 'Systems',
  summary: 'Generalize Git and IPFS: blocks are named by hashes, links form a Merkle DAG, roots pin reachable data, and traversal verifies every byte.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['cid graph', 'fetch and gc'], defaultValue: 'cid graph' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function dagGraph(title) {
  return graphState({
    nodes: [
      { id: 'chunkA', label: 'block A', x: 1.0, y: 4.8, note: 'payload' },
      { id: 'chunkB', label: 'block B', x: 1.0, y: 3.4, note: 'payload' },
      { id: 'cidA', label: 'CID A', x: 2.8, y: 4.8, note: 'hash+codec' },
      { id: 'cidB', label: 'CID B', x: 2.8, y: 3.4, note: 'hash+codec' },
      { id: 'node', label: 'node', x: 4.8, y: 4.1, note: 'links' },
      { id: 'root', label: 'root CID', x: 6.7, y: 4.1, note: 'name DAG' },
      { id: 'pin', label: 'pin', x: 8.1, y: 4.9, note: 'keep' },
      { id: 'fetch', label: 'fetch', x: 8.1, y: 3.3, note: 'verify' },
      { id: 'peer', label: 'peer', x: 9.4, y: 4.1, note: 'serve' },
    ],
    edges: [
      { id: 'e-a-cid', from: 'chunkA', to: 'cidA' },
      { id: 'e-b-cid', from: 'chunkB', to: 'cidB' },
      { id: 'e-cidA-node', from: 'cidA', to: 'node' },
      { id: 'e-cidB-node', from: 'cidB', to: 'node' },
      { id: 'e-node-root', from: 'node', to: 'root' },
      { id: 'e-root-pin', from: 'root', to: 'pin' },
      { id: 'e-root-fetch', from: 'root', to: 'fetch' },
      { id: 'e-fetch-peer', from: 'fetch', to: 'peer' },
    ],
  }, { title });
}

function fetchGraph(title) {
  return graphState({
    nodes: [
      { id: 'want', label: 'want', x: 0.8, y: 4.1, note: 'root CID' },
      { id: 'index', label: 'index', x: 2.3, y: 4.1, note: 'CID -> peer' },
      { id: 'block', label: 'block', x: 3.9, y: 4.8, note: 'bytes' },
      { id: 'verify', label: 'verify', x: 5.4, y: 4.8, note: 'hash' },
      { id: 'links', label: 'links', x: 5.4, y: 3.3, note: 'children' },
      { id: 'walk', label: 'walk', x: 7.0, y: 4.1, note: 'DAG' },
      { id: 'cache', label: 'cache', x: 8.4, y: 4.8, note: 'store' },
      { id: 'gc', label: 'GC', x: 8.4, y: 3.3, note: 'unpin' },
    ],
    edges: [
      { id: 'e-want-index', from: 'want', to: 'index' },
      { id: 'e-index-block', from: 'index', to: 'block' },
      { id: 'e-block-verify', from: 'block', to: 'verify' },
      { id: 'e-verify-links', from: 'verify', to: 'links' },
      { id: 'e-links-walk', from: 'links', to: 'walk' },
      { id: 'e-walk-cache', from: 'walk', to: 'cache' },
      { id: 'e-walk-gc', from: 'walk', to: 'gc' },
    ],
  }, { title });
}

function* cidGraph() {
  yield {
    state: dagGraph('A block name is derived from the block bytes'),
    highlight: { active: ['chunkA', 'cidA', 'e-a-cid'], compare: ['chunkB', 'cidB'] },
    explanation: 'Content addressing names an object by a cryptographic digest of its contents. Change one byte, and the name changes. Identical bytes with the same settings get the same name.',
  };
  yield {
    state: dagGraph('Links carry CIDs, so parents commit to children'),
    highlight: { active: ['cidA', 'cidB', 'node', 'e-cidA-node', 'e-cidB-node'], found: ['root'] },
    explanation: 'A Merkle DAG node carries a payload plus links to child CIDs. Hashing the node commits to both its local payload and the identities of its children.',
    invariant: 'The root CID names the whole reachable DAG, not just the root block.',
  };
  yield {
    state: dagGraph('Pins protect reachable data from garbage collection'),
    highlight: { active: ['root', 'pin', 'e-root-pin'], compare: ['fetch'] },
    explanation: 'Because objects are immutable, a store can delete anything not reachable from a retained root. A pin, branch, manifest, package lock, or release tag is a root that keeps a subgraph alive.',
  };
  yield {
    state: labelMatrix(
      'Content-addressed records',
      [
        { id: 'block', label: 'block' },
        { id: 'cid', label: 'CID' },
        { id: 'node', label: 'DAG node' },
        { id: 'root', label: 'root' },
        { id: 'pin', label: 'pin' },
      ],
      [
        { id: 'contains', label: 'contains' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['payload bytes', 'immutable atom'],
        ['hash + codec', 'self-describing name'],
        ['payload + links', 'hashes compose'],
        ['top CID', 'names whole graph'],
        ['retention root', 'GC boundary'],
      ],
    ),
    highlight: { active: ['cid:contains', 'node:lesson', 'root:lesson', 'pin:lesson'] },
    explanation: 'Git trees, IPFS DAG nodes, package lockfiles, and container manifests all use the same idea: immutable blocks plus hash links plus a small root name.',
  };
}

function* fetchAndGc() {
  yield {
    state: fetchGraph('Fetch by CID, then verify the bytes'),
    highlight: { active: ['want', 'index', 'block', 'verify', 'e-want-index', 'e-index-block', 'e-block-verify'], compare: ['cache'] },
    explanation: 'A peer, gateway, cache, or local store may provide the bytes. Trust comes from recomputing the hash and checking it matches the CID, not from trusting the transport.',
  };
  yield {
    state: fetchGraph('Verified links drive recursive traversal'),
    highlight: { active: ['verify', 'links', 'walk', 'e-verify-links', 'e-links-walk'], found: ['cache'] },
    explanation: 'After a block verifies, its links name the child blocks to fetch. The traversal can deduplicate automatically because the same CID means the same block.',
  };
  yield {
    state: fetchGraph('Garbage collection is reachability over pinned roots'),
    highlight: { active: ['walk', 'gc', 'cache', 'e-walk-gc', 'e-walk-cache'], compare: ['want'] },
    explanation: 'The store can mark all blocks reachable from pinned roots, then sweep unmarked blocks. This is Graph BFS plus immutable content addressing.',
  };
  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'codec', label: 'wrong codec' },
        { id: 'chunk', label: 'bad chunking' },
        { id: 'pin', label: 'lost pin' },
        { id: 'privacy', label: 'public CID' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'control', label: 'control' },
      ],
      [
        ['bytes parse wrong', 'multicodec metadata'],
        ['poor dedupe', 'stable chunker'],
        ['GC deletes data', 'root registry'],
        ['content discoverable', 'encrypt before add'],
      ],
    ),
    highlight: { active: ['codec:control', 'pin:control', 'privacy:control'], compare: ['chunk:symptom'] },
    explanation: 'Content addressing verifies integrity. It does not solve privacy, naming, availability, retention, or schema evolution by itself.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'cid graph') yield* cidGraph();
  else if (view === 'fetch and gc') yield* fetchAndGc();
  else throw new InputError('Pick a content-addressed Merkle-DAG view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A content-addressed Merkle DAG object store stores immutable blocks named by cryptographic identifiers. A block can contain payload bytes and links to other blocks by their identifiers. The root identifier names the entire reachable graph. Git is one famous instance; IPFS and IPLD generalize the pattern for distributed content-addressed data.',
        'IPFS docs define a CID as a label based on the content itself rather than where the content is stored: https://docs.ipfs.tech/concepts/content-addressing/. Their Merkle DAG docs explain that node identifiers hash the node payload plus child identifiers, that nodes are immutable, and that a root CID identifies the whole reachable subgraph: https://docs.ipfs.tech/concepts/merkle-dag/.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The store first splits content into blocks. Each block receives a CID: hash algorithm, hash digest, codec, and encoding metadata. A higher-level node stores child CIDs plus its own payload, so hashing the parent commits to the children. Fetching a root means recursively fetching child CIDs, verifying each block, and caching verified blocks. The same CID from any peer should verify to the same bytes.',
        'This is a Merkle Tree without the balanced-tree requirement. DAG nodes can have arbitrary payloads, links, and multiple parents. Shared subgraphs deduplicate naturally. Updating a node creates a new node and new ancestors, while unchanged descendants keep the same identifiers.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The main structures are a block store, CID index, link table, root registry, pin set, traversal queue, fetch queue, and garbage collector. The root registry says which DAGs matter. The pin set protects reachable blocks. Graph traversal finds required children and garbage-collection reachability. Hash Table lookup maps CIDs to local bytes or known peers.',
        'Content-Defined Chunking improves deduplication for large mutable byte streams by choosing stable chunk boundaries. Git Internals teaches the file-tree version. Merkle Tree teaches the proof path. This module is the generic object-store version that connects all three.',
      ],
    },
    {
      heading: 'Case studies',
      paragraphs: [
        'IPFS uses CIDs, Merkle DAGs, and content addressing so content can be fetched from different peers and verified after retrieval. Git stores blobs, trees, and commits in a content-addressed DAG. Container registries use digest-addressed layers and manifests. Package managers use lockfiles and digests to pin exact dependency graphs. Backup systems use chunk hashes to avoid storing duplicate data.',
        'A research platform can use the same structure for provenance: store every downloaded PDF, extracted table, generated chart, and report version as hash-named objects. The report root then commits to every piece of evidence it used. Claim Graph & Source Ledger adds semantics; the Merkle DAG gives byte-level integrity.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A CID is not a location. It tells you what bytes you want, not which machine will serve them. Availability needs pinning, replication, gateways, or a retrieval network. A CID also is not privacy. If the content is public or guessable, the identifier may reveal what you are asking for. Encrypt sensitive content before adding it to a public content-addressed system.',
        'Another mistake is forgetting codec and chunking choices. The same logical file can produce different CIDs if chunking, hashing, or encoding settings differ. Content addressing is deterministic only under the same serialization contract.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: IPFS content addressing at https://docs.ipfs.tech/concepts/content-addressing/, IPFS Merkle DAG docs at https://docs.ipfs.tech/concepts/merkle-dag/, IPLD at https://ipld.io/, and ProtoSchool Merkle DAG tutorial at https://proto.school/merkle-dags/. Study Git Internals, Merkle Tree, Content-Defined Chunking, Narwhal Bullshark DAG Mempool Case Study, Data Availability Sampling & Erasure Coding Case Study, Namespaced Merkle Tree Proof Case Study, Transparency Log Witnessing Case Study, Software Supply Chain Provenance Graph, Hash Table, Graph BFS, and Claim Graph & Source Ledger next.',
      ],
    },
  ],
};
