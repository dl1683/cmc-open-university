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
      heading: 'Why this exists',
      paragraphs: [
        'Ordinary storage names data by location or mutable path: a filename, URL, bucket key, database row, or server address. That is convenient until the same bytes appear in many places, a cache serves stale data, a mirror is untrusted, or a build needs to prove exactly which inputs produced an artifact. Location names answer where to ask. They do not prove what was returned.',
        'A content-addressed Merkle DAG object store names immutable blocks by cryptographic identifiers derived from their bytes and encoding metadata. Blocks can link to other blocks by identifier, so a root identifier names the whole reachable graph. Git, IPFS, IPLD, package lockfiles, container manifests, backup systems, and reproducible build stores all use versions of this pattern.',
      ],
    },
    {
      heading: 'The naive naming wall',
      paragraphs: [
        'The obvious design is a key-value store where keys are chosen by the application: report-2026.pdf, layer-3.tar, chunk-42, latest.json. That works while one writer controls one namespace. It fails when data moves across peers, caches, mirrors, and time. A malicious or broken server can return the wrong bytes under the right name unless the client has an independent way to verify them.',
        'The second failure is duplication and provenance. If two builds contain the same dependency bytes under different paths, a location-named store may keep two copies. If a report cites a dataset path that later mutates, the report no longer commits to the evidence it used. Mutable names make it easy to say where something used to be and hard to prove what it was. The error often appears later, when nobody remembers which version the name once resolved to.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to make the name a commitment to the content. If the bytes or codec change, the identifier changes. If two parties use the same serialization and hashing rules for the same content, they get the same identifier. A CID in IPFS is more than a raw hash: it carries information such as the multihash, multicodec, and string encoding needed to interpret the block identity.',
        'Merkle links make this commitment recursive. A parent node stores child identifiers. Hashing the parent commits to its local payload and to the exact children it names. The root identifier therefore commits to every reachable block. A small root can name a large object graph without listing every byte in the root itself.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The store first chunks data into blocks. Chunking can be fixed-size for simplicity or content-defined so insertions near the front of a file do not shift every later boundary. Each block is encoded, hashed, and indexed by its content identifier. Higher-level nodes store payload plus links to child identifiers, forming a directed acyclic graph rather than a single flat file. Updating one logical object creates new nodes along the changed path while unchanged descendants keep their old identifiers.',
        'Fetching starts from a root CID. The client asks a local cache, peer, gateway, registry, or other provider for the block. Trust comes from recomputing the identifier from the returned bytes and checking that it matches the requested CID. After a block verifies, its links reveal child CIDs to fetch. Traversal continues until the reachable graph has been fetched, streamed, or partially materialized.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The CID graph view shows compositional identity. Payload blocks become CIDs. CIDs become links inside a parent node. The parent becomes a new CID. The root CID names the reachable graph, not only the root block. The important fact is that a parent does not merely point to children; it commits to the exact child identities.',
        'The fetch-and-GC view separates integrity, availability, caching, traversal, and retention. A block can arrive from an untrusted peer and still be verified. A cache can skip repeat fetches because the same CID means the same block under the same settings. Garbage collection can delete blocks not reachable from retained roots because immutable children cannot be changed behind the root.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The integrity argument comes from collision resistance and deterministic encoding. If the store asks for CID X and receives bytes that hash and decode to X, the client has strong evidence that it received the intended block. It does not need to trust the server, path, CDN, or peer identity for byte integrity. The name and verification procedure carry the trust boundary.',
        'The graph argument is inductive. A leaf CID commits to its payload. A parent CID commits to its payload and child CIDs. If each verified child has the identity named by the parent, the verified parent commits to the whole verified subgraph. Shared children are safe because the same identifier denotes the same immutable block.',
      ],
    },
    {
      heading: 'Cost and operations',
      paragraphs: [
        'The cost is not only the hash. A real store pays for chunking, codec choices, CID indexes, peer discovery, traversal queues, fetch scheduling, cache eviction, pin bookkeeping, and garbage collection. Small blocks improve deduplication and partial reuse, but create more metadata and random reads. Large blocks reduce metadata and traversal overhead, but make small edits less reusable. The right block size is an access-pattern decision, not a universal constant.',
        'The operational contract is root management. If no retained root reaches a block, garbage collection is allowed to delete it. Pins, branch heads, release tags, package locks, manifests, and build outputs are not just labels; they are retention policy. Lose the root registry and the store may correctly delete data that users still expected to keep, even though every remaining block verifies perfectly.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This design wins when integrity and reuse matter more than mutable convenience. Git can name snapshots through commits and trees. IPFS can fetch content from different providers and verify it after retrieval. Container registries can reuse digest-addressed layers across images. Package managers can pin dependency graphs. Backup systems can avoid storing duplicate chunks.',
        'It also wins for provenance. A research platform can store every downloaded PDF, extracted table, generated chart, model output, and report as hash-named objects. The report root then commits to the exact evidence graph it used. A semantic claim ledger can explain meaning, while the Merkle DAG proves byte identity and reachability. That separation is useful: semantics can be debated, but the underlying bytes either match the committed identifiers or they do not.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A CID is not a location. It says what bytes are wanted, not who will serve them. Availability still needs pinning, replication, gateways, indexes, incentives, or an ordinary storage service underneath. Content addressing can make a cache honest about bytes, but it cannot make an absent block appear.',
        'A CID is also not privacy or schema evolution. Public or guessable content can be recognized by its identifier, so sensitive content should be encrypted before being added to a public system. The same logical file can produce different CIDs if chunking, hashing, codec, or serialization settings differ. Determinism only holds under the same content-addressing contract.',
        'A final failure is treating roots as informal bookmarks. Production systems need explicit root ownership, retention classes, audit logs, replication status, and deletion workflows. Otherwise a valid garbage collector can erase the only copy of a block graph because nobody recorded which root made it important.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: IPFS content addressing at https://docs.ipfs.tech/concepts/content-addressing/, IPFS Merkle DAG docs at https://docs.ipfs.tech/concepts/merkle-dag/, IPLD at https://ipld.io/, and ProtoSchool Merkle DAG tutorial at https://proto.school/merkle-dags/.',
        'Study Git Internals for a production file-tree version, Merkle Tree for proof paths, Content-Defined Chunking for stable boundaries, Hash Table for CID lookup, Graph BFS for traversal and garbage collection, Software Supply Chain Provenance Graph for artifact trust, Transparency Log Witnessing for append-only audit, and Claim Graph Source Ledger for semantic provenance on top of byte identity.',
      ],
    },
  ],
};
