// ZooKeeper and Zab: replicated coordination with znodes, watches, sessions,
// and primary-backup atomic broadcast.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'zookeeper-zab-case-study',
  title: 'ZooKeeper & Zab Case Study',
  category: 'Papers',
  summary: 'ZooKeeper as a coordination kernel: znodes, sessions, watches, Zab ordering, quorum replication, and client-built primitives.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['znodes and watches', 'zab broadcast'], defaultValue: 'znodes and watches' },
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

function ensemble(title) {
  return graphState({
    nodes: [
      { id: 'clientA', label: 'client A', x: 0.8, y: 2.2, note: 'creates znode' },
      { id: 'clientB', label: 'client B', x: 0.8, y: 5.8, note: 'sets watch' },
      { id: 'leader', label: 'leader', x: 3.0, y: 4.0, note: 'orders writes' },
      { id: 'f1', label: 'follower 1', x: 5.2, y: 2.0, note: 'replica' },
      { id: 'f2', label: 'follower 2', x: 5.2, y: 4.0, note: 'replica' },
      { id: 'f3', label: 'follower 3', x: 5.2, y: 6.0, note: 'replica' },
      { id: 'tree', label: '/app/leader', x: 8.0, y: 4.0, note: 'znode tree' },
      { id: 'watch', label: 'watch event', x: 8.0, y: 6.2, note: 'one-shot' },
    ],
    edges: [
      { id: 'e-a-leader', from: 'clientA', to: 'leader', weight: 'write' },
      { id: 'e-b-leader', from: 'clientB', to: 'leader', weight: 'read/watch' },
      { id: 'e-leader-f1', from: 'leader', to: 'f1', weight: 'proposal' },
      { id: 'e-leader-f2', from: 'leader', to: 'f2', weight: 'proposal' },
      { id: 'e-leader-f3', from: 'leader', to: 'f3', weight: 'proposal' },
      { id: 'e-leader-tree', from: 'leader', to: 'tree', weight: 'state change' },
      { id: 'e-tree-watch', from: 'tree', to: 'watch', weight: 'notify' },
      { id: 'e-watch-b', from: 'watch', to: 'clientB', weight: 'refresh' },
    ],
  }, { title });
}

function* znodesAndWatches() {
  yield {
    state: ensemble('ZooKeeper exposes a replicated znode namespace'),
    highlight: { active: ['clientA', 'leader', 'tree', 'e-a-leader', 'e-leader-tree'], compare: ['f1', 'f2', 'f3'] },
    explanation: 'The first view shows ZooKeeper as a small replicated namespace, not a full application database. Znodes hold small data plus version metadata, and clients compose them into leader election, membership, configuration, and lock recipes.',
  };

  yield {
    state: labelMatrix(
      'Znode modes',
      [
        { id: 'persistent', label: 'persistent' },
        { id: 'ephemeral', label: 'ephemeral' },
        { id: 'sequential', label: 'sequential' },
        { id: 'container', label: 'container/TTL variants' },
      ],
      [
        { id: 'lifetime', label: 'lifetime' },
        { id: 'use', label: 'typical use' },
      ],
      [
        ['until deleted', 'configuration'],
        ['session-bound', 'membership and locks'],
        ['monotonic suffix', 'queues and election order'],
        ['managed cleanup', 'namespace hygiene'],
      ],
    ),
    highlight: { found: ['ephemeral:use', 'sequential:use'], compare: ['persistent:use'] },
    explanation: 'This table names the two znode features that make recipes practical. Ephemeral nodes turn session liveness into namespace state. Sequential nodes give clients a shared order without each client inventing its own counter.',
  };

  yield {
    state: ensemble('Watches are one-shot invalidation signals'),
    highlight: { active: ['clientB', 'watch', 'tree', 'e-tree-watch', 'e-watch-b'], found: ['leader'] },
    explanation: 'The highlighted watch is a one-shot invalidation. After the event fires, the client must re-read the znode tree and install a fresh watch. The state is durable; the notification is only a prompt to refresh.',
    invariant: 'A watch is a cache invalidation hint, not a durable event log.',
  };

  yield {
    state: labelMatrix(
      'Coordination recipes',
      [
        { id: 'election', label: 'leader election' },
        { id: 'lock', label: 'lock recipe' },
        { id: 'barrier', label: 'barrier' },
        { id: 'config', label: 'config publish' },
      ],
      [
        { id: 'znode', label: 'znode pattern' },
        { id: 'neighbor', label: 'study neighbor' },
      ],
      [
        ['ephemeral sequential children', 'Leader Replacement'],
        ['lowest sequence holds lock', 'Distributed Locks'],
        ['children count reaches N', 'Quorums'],
        ['persistent data + watches', 'Chubby Case Study'],
      ],
    ),
    highlight: { active: ['election:znode', 'lock:znode'], compare: ['config:neighbor'] },
    explanation: 'ZooKeeper intentionally stays small. The service provides ordered, replicated primitives, and the recipe logic lives in clients. That keeps the server general, but it means recipe correctness is still application work.',
  };
}

function* zabBroadcast() {
  yield {
    state: ensemble('Writes are ordered by the leader and replicated to a quorum'),
    highlight: { active: ['leader', 'f1', 'f2', 'e-leader-f1', 'e-leader-f2'], compare: ['f3'] },
    explanation: 'The Zab view follows a write through the leader. The leader orders the update, followers acknowledge it, and a quorum makes it durable before the client can rely on completion. Reads are cheap because writes paid for order.',
  };

  yield {
    state: labelMatrix(
      'Zab phases',
      [
        { id: 'discovery', label: 'discovery' },
        { id: 'sync', label: 'synchronization' },
        { id: 'broadcast', label: 'broadcast' },
        { id: 'recovery', label: 'leader recovery' },
      ],
      [
        { id: 'goal', label: 'goal' },
        { id: 'risk', label: 'risk controlled' },
      ],
      [
        ['choose viable leader', 'old primary ambiguity'],
        ['align follower logs', 'missing committed updates'],
        ['pipeline proposals', 'out-of-order delivery'],
        ['new epoch', 'split brain'],
      ],
    ),
    highlight: { found: ['sync:goal', 'broadcast:risk'], compare: ['recovery:risk'] },
    explanation: 'The phase table is about leadership safety. Zab has to choose a viable leader, align follower logs, broadcast proposals in order, and start a new epoch without letting two histories both look current.',
    invariant: 'All delivered writes appear in the same order at every correct replica.',
  };

  yield {
    state: ensemble('Reads are fast; writes pay ordering cost'),
    highlight: { active: ['clientB', 'f2'], compare: ['clientA', 'leader', 'f1'] },
    explanation: 'The animation contrasts the fast read path with the ordered write path. ZooKeeper works best when coordination reads dominate and writes are small. Clients that need a fresh read can use sync to catch up with the write order.',
  };

  yield {
    state: labelMatrix(
      'ZooKeeper versus adjacent systems',
      [
        { id: 'chubby', label: 'Chubby' },
        { id: 'raft', label: 'Raft' },
        { id: 'paxos', label: 'Paxos' },
        { id: 'etcd', label: 'etcd-style control plane' },
      ],
      [
        { id: 'shared', label: 'shared idea' },
        { id: 'difference', label: 'difference' },
      ],
      [
        ['coordination kernel', 'Google lock-service framing'],
        ['leader replication', 'Zab protocol details differ'],
        ['quorum safety', 'primary-backup broadcast form'],
        ['watchable key space', 'API and lease model differ'],
      ],
    ),
    highlight: { active: ['chubby:shared', 'raft:shared'], compare: ['paxos:difference'] },
    explanation: 'The comparison table is the study map. ZooKeeper sits between Chubby-style coordination, quorum replication, and practical watchable metadata. Understanding it helps make sense of etcd, Kafka-era coordination, and leader-election designs.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'znodes and watches') yield* znodesAndWatches();
  else if (view === 'zab broadcast') yield* zabBroadcast();
  else throw new InputError('Pick a ZooKeeper/Zab view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. The znodes-and-watches view shows clients, the leader, followers, and a znode tree. The Zab broadcast view shows a write flowing through the leader to a quorum of followers.',
        {
          type: 'bullets',
          items: [
            'Active nodes are the participants handling the current operation -- the client issuing a request, the leader ordering it, or the follower acknowledging it.',
            'Compare nodes are replicas or components not yet involved in the current step.',
            'Found nodes are znodes or watches that have resolved -- a watch that fired, a znode that was created.',
            'Edges carry labels: "write," "proposal," "notify," "refresh." Follow the edge labels to trace a request from client to quorum commit to watch delivery.',
          ],
        },
        'One safe inference rule: if an edge labeled "proposal" reaches a majority of followers and they acknowledge, the write is committed. No future leader can undo it. That is the Zab safety guarantee made visible.',
        {type: 'callout', text: 'ZooKeeper works by keeping the server primitive and ordered while pushing coordination recipes and their edge cases into clients.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Apache_ZooKeeper_logo.svg', alt: 'Apache ZooKeeper logo with a zookeeper figure and project name', caption: 'Apache ZooKeeper logo. Attribution: The Apache Software Foundation, vectorised by Vulphere, via Wikimedia Commons; Apache License 2.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Every distributed system needs to agree on a few small facts: who is the leader, which nodes are alive, what is the current configuration, and who holds a lock. Before ZooKeeper, each team built these protocols from scratch inside application code. The results were predictably bad.',
        {
          type: 'quote',
          text: 'ZooKeeper does not directly expose primitives such as leader election and locks. Instead, it exposes an API that allows application developers to implement their own coordination primitives.',
          attribution: 'Hunt, Konar, Junqueira, Reed -- "ZooKeeper: Wait-free Coordination for Internet-scale Systems," USENIX ATC 2010',
        },
        'The core bet is radical: do not build a leader election service, a lock service, and a configuration service. Build a tiny replicated filesystem with five or six carefully chosen properties and let clients compose every coordination pattern from those primitives. The server stays small. The recipes stay flexible.',
        'Zab (ZooKeeper Atomic Broadcast) is the replication protocol underneath. The namespace is only useful if every correct replica applies writes in the same order and a new leader never forgets committed history. Zab is what makes that true.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first obvious approach is a database table. Store a "leaders" row, a "config" row, and a "members" table in MySQL or Postgres. Application code reads and writes rows through SQL.',
        'This works until the application needs ephemeral membership (a member row must vanish when the process crashes, not when someone remembers to delete it), ordered election candidates (a sequence number assigned atomically by the system, not a client-generated timestamp), conditional updates (write only if the version I read is still current), and push notification (tell me when the row changes instead of polling every 100ms). A general database can approximate some of these, but the coordination contract stays scattered across application code, retry loops, and cron jobs.',
        {
          type: 'note',
          text: 'The database approach also has a deeper problem: it couples coordination availability to the application database. A schema migration, a long-running analytical query, or a replication lag spike in the main database now threatens leader election for every service that depends on it.',
        },
        'The second obvious approach is ad hoc heartbeats. Every service sends periodic heartbeats and uses timeouts to detect failures. A node that stops receiving heartbeats from the current leader declares itself leader.',
        'This creates split-brain. Two nodes both believe they are leader because the network was slow, a garbage collection pause delayed heartbeats, or the failure detector guessed wrong. Without a central arbiter with a clear ordering model, there is no way to resolve the ambiguity.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Coordination data is tiny in volume and enormous in blast radius. A wrong leader, stale configuration, or broken lock can corrupt a system storing petabytes of real data. You do not need a petabyte database to solve this. You need a small, strongly ordered, highly available service with simple semantics.',
        {
          type: 'table',
          headers: ['Coordination need', 'What breaks without it', 'Volume'],
          rows: [
            ['Leader election', 'Split-brain: two writers corrupt shared state', 'One znode per election'],
            ['Group membership', 'Stale routing: requests go to dead nodes', 'One znode per member'],
            ['Configuration', 'Version skew: nodes run incompatible settings', 'One znode per config key'],
            ['Distributed lock', 'Concurrent mutation of a shared resource', 'One znode per lock contender'],
          ],
        },
        'The second wall is notification. Clients cache coordination state because polling a central service on every request is expensive. But cached state is dangerous once the underlying fact changes. ZooKeeper watches solve this by providing one-shot invalidation signals: the server tells the client "the thing you cached may have changed," and the client rereads. Watches are not a durable event log. They are a prompt to refresh.',
        'The third wall is replication correctness during leader changes. It is not enough for a leader to order writes while alive. When the leader crashes, the new leader must not forget any write that the old leader committed. Zab handles this through epochs, discovery, synchronization, and ordered broadcast.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Expose a small replicated hierarchical namespace with five composable primitives, and let clients build every coordination pattern from combinations of them.',
        {
          type: 'table',
          headers: ['Primitive', 'What it provides', 'What recipes use it for'],
          rows: [
            ['Persistent znode', 'Data that survives client disconnection', 'Configuration, metadata'],
            ['Ephemeral znode', 'Data that vanishes when the session expires', 'Membership, liveness detection'],
            ['Sequential znode', 'Monotonically increasing suffix assigned by the server', 'Election order, queue position, lock contention order'],
            ['Version number', 'Compare-and-set protection on each znode', 'Conditional updates, optimistic concurrency'],
            ['Watch', 'One-shot notification on znode or child-list change', 'Cache invalidation, event-driven coordination'],
          ],
        },
        'The server does not know about leader election, locks, or barriers. It knows about znodes, sessions, versions, and watches. The client recipe combines these primitives into a coordination pattern. This keeps the server general and the API stable while allowing an open-ended set of coordination protocols.',
        {
          type: 'note',
          text: 'This is the opposite of Chubby, which directly exposes a lock abstraction. ZooKeeper trades API specificity for composability. The cost is that recipe correctness is now the client developer\'s problem.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'ZooKeeper exposes a hierarchical namespace that looks like a filesystem. Each node in the tree is a znode. Znodes can hold up to 1 MB of data (configurable, but the design assumes small values -- kilobytes, not megabytes). Every znode carries metadata: a creation transaction ID (czxid), a modification transaction ID (mzxid), a version number, a child version, an ACL version, and timestamps.',
        {
          type: 'diagram',
          text: [
            '                    / (root)',
            '                   /|\\',
            '                  / | \\',
            '                 /  |  \\',
            '              /app /db  /config',
            '              /|\\',
            '             / | \\',
            '            /  |  \\',
            '     /leader /lock /members',
            '                     /|\\',
            '                    / | \\',
            '           node-001 002 003',
            '          (ephemeral, sequential)',
          ].join('\n'),
          label: 'ZooKeeper namespace: a tree of znodes, some ephemeral, some sequential',
        },
        'Clients connect through a session. The session has a timeout (typically 4-40 seconds, negotiated at connect time). As long as the client sends heartbeats within the timeout, the session stays alive. If the session expires, all ephemeral znodes owned by that session are automatically deleted. This is the mechanism that turns process liveness into namespace state.',
        {
          type: 'code',
          language: 'text',
          text: [
            'zxid structure (64-bit transaction ID):',
            '',
            '  [---- epoch (32 bits) ----][---- counter (32 bits) ----]',
            '',
            '  epoch:   incremented on every leader change',
            '  counter: incremented on every transaction within an epoch',
            '',
            '  Example: epoch=5, counter=17042 -> zxid = 0x0000000500004292',
            '',
            '  Comparison: zxid_a > zxid_b iff epoch_a > epoch_b,',
            '              or epoch_a == epoch_b and counter_a > counter_b',
          ].join('\n'),
          label: 'The zxid encodes both leadership era and transaction position in a single 64-bit integer',
        },
        'The zxid is fundamental. Every state change in ZooKeeper gets a globally unique, monotonically increasing zxid. Because the high 32 bits are the epoch (leader era) and the low 32 bits are the counter within that era, any two zxids can be compared to determine which happened first and under which leader.',
      ],
    },
    {
      heading: 'How Zab works',
      paragraphs: [
        'Zab is a primary-backup atomic broadcast protocol. It guarantees that all committed writes are delivered in the same order at every correct replica, and that leader changes do not lose committed history.',
        {
          type: 'table',
          headers: ['Phase', 'Goal', 'What can go wrong without it'],
          rows: [
            ['1. Leader election', 'Choose a prospective leader with the most up-to-date history', 'An out-of-date node becomes leader and loses committed writes'],
            ['2. Discovery', 'The prospective leader contacts followers, learns the highest epoch, proposes a new epoch', 'Two leaders operate in the same epoch, causing conflicting write orders'],
            ['3. Synchronization', 'The leader sends missing transactions to followers, aligning their histories', 'Followers miss committed writes and serve stale reads'],
            ['4. Broadcast', 'The leader proposes new writes, followers acknowledge, leader commits after quorum', 'Writes are reordered or lost under concurrent proposals'],
          ],
        },
        'The broadcast phase is the steady state. A write request arrives at the leader. The leader assigns the next zxid, creates a proposal, and sends it to all followers. Each follower writes the proposal to its transaction log on disk and sends an acknowledgment. Once the leader has acknowledgments from a quorum (majority), it sends a COMMIT message. Followers then apply the transaction to their in-memory data tree.',
        {
          type: 'diagram',
          text: [
            '  Client        Leader       Follower 1    Follower 2    Follower 3',
            '    |              |              |              |              |',
            '    |-- write ---->|              |              |              |',
            '    |              |-- PROPOSAL ->|              |              |',
            '    |              |-- PROPOSAL ------------>|              |',
            '    |              |-- PROPOSAL --------------------------->|',
            '    |              |              |              |              |',
            '    |              |<---- ACK ----|              |              |',
            '    |              |<---- ACK ------------------|              |',
            '    |              |              |              |   (slow)     |',
            '    |              |              |              |              |',
            '    |              |  quorum reached (2 of 3 followers)',
            '    |              |              |              |              |',
            '    |              |-- COMMIT --->|              |              |',
            '    |              |-- COMMIT ------------>|              |',
            '    |              |-- COMMIT --------------------------->|',
            '    |<--- OK ------|              |              |              |',
          ].join('\n'),
          label: 'Zab broadcast: proposal, quorum ACK, commit. The slow follower still gets the commit eventually.',
        },
        'The critical property is twofold. Local primary order: if a primary broadcasts m1 before m2, any process that delivers m2 must have already delivered m1. Global primary order: if primary P1 broadcasts m1, then leadership changes and P2 broadcasts m2, any process delivering both must deliver m1 before m2. Combined with quorum intersection (any two quorums share at least one member), this ensures a new leader can always recover the complete committed prefix.',
        'The synchronization phase is where recovery gets concrete. The new leader aligns each follower using one of three methods depending on how far behind the follower is.',
        {
          type: 'table',
          headers: ['Sync method', 'When used', 'What happens'],
          rows: [
            ['DIFF', 'Follower is slightly behind', 'Leader sends only the missing transactions'],
            ['TRUNC', 'Follower has uncommitted proposals from a dead leader', 'Follower truncates divergent transactions, then receives DIFF'],
            ['SNAP', 'Follower is too far behind for log replay', 'Leader sends a full state snapshot'],
          ],
        },
        {
          type: 'note',
          text: 'Zab is not Paxos. Paxos agrees on a single value per consensus round. Zab orders a sequence of values as an atomic broadcast. Paxos can be composed into Multi-Paxos to order a stream, but Zab was designed directly for the primary-backup pattern. The key practical difference: if a Paxos leader proposes multiple values concurrently and fails, those uncommitted values may be reordered by the next leader. Zab prevents this by recovering entire history prefixes, not individual consensus slots.',
        },
      ],
    },
    {
      heading: 'How watches work',
      paragraphs: [
        'A watch is a one-shot callback registered alongside a read operation. The client calls getData or getChildren with a watch flag. If the watched znode\'s data changes (for getData watches) or its child list changes (for getChildren watches), ZooKeeper delivers exactly one WatchEvent to the client. After delivery, the watch is gone.',
        {
          type: 'code',
          language: 'java',
          text: [
            '// Register a watch while reading',
            'byte[] data = zk.getData("/app/config", watchEvent -> {',
            '    // This fires exactly once, then the watch is consumed',
            '    if (watchEvent.getType() == EventType.NodeDataChanged) {',
            '        // Re-read and re-register the watch',
            '        byte[] fresh = zk.getData("/app/config", this, null);',
            '        applyConfig(fresh);',
            '    }',
            '}, null);',
          ].join('\n'),
          label: 'The watch-reread-rewatch loop: the client must always re-register after receiving an event',
        },
        'The one-shot design is intentional. It prevents ZooKeeper from becoming a durable event log. Watches are cache invalidation hints, not guaranteed delivery streams. Between the watch firing and the client rereading, multiple changes may have occurred. The client sees only the final state, not every intermediate state.',
        {
          type: 'table',
          headers: ['Watch type', 'Registered by', 'Triggers on'],
          rows: [
            ['Data watch', 'getData(path, watch)', 'setData, delete on the watched znode'],
            ['Child watch', 'getChildren(path, watch)', 'create or delete of a direct child'],
            ['Existence watch', 'exists(path, watch)', 'create, delete, or setData on the path'],
          ],
        },
        'ZooKeeper guarantees that watch events are delivered before any subsequent state change is visible to the client on that session. This means a client that reads, sets a watch, and later receives a watch event can trust that no changes were silently missed between the read and the event. The ordering guarantee is per-session, not global.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'The canonical ZooKeeper recipe is leader election using ephemeral sequential znodes. Here is the complete protocol.',
        {
          type: 'code',
          language: 'text',
          text: [
            'Leader Election Recipe:',
            '',
            '1. Each candidate creates an ephemeral sequential znode:',
            '   create("/election/candidate-", data, EPHEMERAL_SEQUENTIAL)',
            '   -> server assigns: /election/candidate-00000001',
            '                      /election/candidate-00000002',
            '                      /election/candidate-00000003',
            '',
            '2. Each candidate calls getChildren("/election") and sorts the results.',
            '',
            '3. If this candidate\'s znode has the LOWEST sequence number:',
            '   -> This candidate IS the leader. Begin leading.',
            '',
            '4. If this candidate\'s znode does NOT have the lowest number:',
            '   -> Set a watch on the znode with the NEXT LOWER sequence number.',
            '   -> (candidate-00000003 watches candidate-00000002, NOT the whole dir)',
            '',
            '5. When the watch fires (predecessor disappeared):',
            '   -> Re-run getChildren and check if now lowest.',
            '   -> If yes, become leader. If no, watch new predecessor.',
          ].join('\n'),
          label: 'Each candidate watches only its predecessor, not the entire directory',
        },
        'The predecessor-only watch is the scalable detail. A naive recipe would have every candidate watch the election directory. When the leader dies, all N candidates wake up, all N call getChildren, all N discover only one of them is the new leader, and N-1 go back to sleep. With 200 candidates, one leader failure triggers 200 simultaneous getChildren calls. This is the herd effect.',
        {
          type: 'diagram',
          text: [
            '  Naive (herd effect):               Scalable (predecessor watch):',
            '',
            '  candidate-001 (leader, dies)        candidate-001 (leader, dies)',
            '       ^  ^  ^  ^                          ^',
            '       |  |  |  |                          |',
            '  002 003 004 ... 200                     002 (watches 001, wakes up)',
            '  (ALL wake up and stampede)                ^',
            '                                           |',
            '                                          003 (watches 002, sleeps)',
            '                                           ^',
            '                                           |',
            '                                          004 (watches 003, sleeps)',
          ].join('\n'),
          label: 'Predecessor-only watches reduce O(N) thundering herd to O(1) notification per failure',
        },
        'When candidate-001\'s session expires, its ephemeral znode disappears. Only candidate-002\'s watch fires. Candidate-002 calls getChildren, confirms it is now lowest, and becomes leader. Candidates 003 through 200 never wake up. The election cost is O(1) per leadership change instead of O(N).',
        'The lock recipe is almost identical. Each lock contender creates an ephemeral sequential child under /locks/resource-x. The contender with the lowest sequence number holds the lock. Others watch their predecessors. Releasing the lock means deleting the znode (or letting the session expire). The next contender\'s watch fires and it acquires the lock.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'ZooKeeper\'s correctness rests on three properties from Zab and two properties from the session model.',
        {
          type: 'table',
          headers: ['Property', 'What it guarantees', 'What breaks without it'],
          rows: [
            ['Total order', 'All replicas deliver writes in the same sequence', 'Two replicas diverge; reads return inconsistent coordination state'],
            ['Atomicity', 'A committed write is applied at all correct replicas or none', 'Partial writes leave some replicas with stale leader/lock state'],
            ['Prefix completeness', 'A new leader\'s history contains every committed write from all previous epochs', 'Leader change loses a committed lock grant or config update'],
            ['Session liveness', 'Ephemeral znodes exist iff the owning session is alive', 'Dead processes keep phantom membership or hold phantom locks'],
            ['FIFO client order', 'A client\'s operations are applied in the order sent', 'A lock release arrives before the preceding write, corrupting the protected resource'],
          ],
        },
        'Linearizable writes plus FIFO client order gives clients a predictable model: if client A does write W1 then write W2, every replica processes W1 before W2. Combined with version-conditional updates (set data only if version matches), clients can implement optimistic concurrency without external locks.',
        {
          type: 'note',
          text: 'ZooKeeper reads are NOT linearizable by default. A read served by a follower may return stale data if the follower has not yet processed recent commits. For linearizable reads, clients must issue a sync() call before the read, which forces the follower to catch up with the leader\'s committed state. This is a deliberate performance tradeoff: most coordination reads can tolerate slight staleness, and fast follower reads are what make ZooKeeper scale to high read throughput.',
        },
        'ZooKeeper also enforces a single system image: when a client reconnects to a different server, the server checks the client\'s last-seen zxid. If the server\'s state is behind the client\'s last-seen zxid, the server refuses the connection. This prevents a client from going backward in time after a reconnect.',
        {
          type: 'note',
          text: 'There is a subtle caveat: sync() is not currently implemented as a quorum operation. The leader processes it locally. If the leader has been partitioned from the quorum but does not yet know it, sync+read may return stale data. Jepsen testing confirmed this edge case is possible, though rare in practice. For true linearizable reads under all partition scenarios, the application must use writes (which always go through quorum) or accept the residual risk.',
        },
        'The quorum intersection property ties everything together. With 2F+1 servers tolerating F failures, any two quorums overlap by at least one member. That overlapping member has seen the committed prefix. A new leader that contacts a quorum is guaranteed to find the complete committed history.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'ZooKeeper is optimized for read-dominant coordination workloads. The original paper (Hunt et al., 2010) benchmarked saturated throughput with 250 concurrent clients sending 1 KB requests.',
        {
          type: 'table',
          headers: ['Workload', '3 servers (ops/sec)', '5 servers (ops/sec)', '9 servers (ops/sec)', '13 servers (ops/sec)'],
          rows: [
            ['100% reads', '~460,000', '~165,000', '~296,000', '~460,000'],
            ['100% writes', '~21,000', '~18,000', '~12,000', '~8,000'],
          ],
        },
        'The asymmetry is the design point. Read throughput scales with server count because any server can serve reads from its local in-memory data tree. Write throughput decreases with more servers because each write requires a quorum disk sync. Average request latency was 1.2 ms for a 3-server ensemble. Leader election after a failure completed in under 200 ms.',
        {
          type: 'table',
          headers: ['Operation', 'Cost', 'Bottleneck'],
          rows: [
            ['Read (local)', 'One in-memory tree lookup', 'Follower staleness (bounded by sync)'],
            ['Read (linearizable)', 'sync + in-memory lookup', 'Round trip to leader for ordering point'],
            ['Write', 'Leader proposal + quorum disk sync + commit', 'Disk fsync latency on followers'],
            ['Session heartbeat', 'Periodic ping, no disk write', 'Network latency to any connected server'],
            ['Watch delivery', 'In-memory lookup + TCP push', 'Watch storm if many clients watch the same znode'],
            ['Ephemeral cleanup', 'One write transaction per expired ephemeral znode', 'Session expiry during network partition can batch-delete many znodes'],
          ],
        },
        'Memory is the scaling limit. ZooKeeper stores its entire data tree in memory. The default maximum znode data size is 1 MB (jute.maxbuffer), but practical deployments keep znodes in the low kilobytes. An ensemble with 1 GB of znode data is already large. ZooKeeper is a coordination service, not a storage system.',
        {
          type: 'note',
          text: 'Snapshots in ZooKeeper are "fuzzy" -- they are taken without pausing writes. The snapshot may contain some updates that are interleaved during the snapshot process. On recovery, ZooKeeper replays the transaction log from the snapshot\'s starting zxid forward. Because transactions are idempotent and totally ordered, replaying already-applied transactions is safe and produces the correct final state.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['System', 'What it uses ZooKeeper for', 'Key recipe'],
          rows: [
            ['Apache Kafka (pre-KRaft)', 'Broker registration, topic/partition metadata, controller election', 'Ephemeral znodes for broker liveness, sequential znodes for controller election'],
            ['Apache HBase', 'Region server registration, master election, schema metadata', 'Ephemeral znodes for region server membership, watches for schema changes'],
            ['Apache Solr / SolrCloud', 'Collection state, shard leader election, live-node tracking', 'Ephemeral znodes for live nodes, sequential znodes for shard leader election'],
            ['Apache Hadoop YARN', 'ResourceManager leader election, node registration', 'Ephemeral sequential znodes for RM failover'],
            ['Apache Storm', 'Nimbus leader election, supervisor heartbeats, topology metadata', 'Ephemeral znodes for supervisor liveness'],
          ],
        },
        'The common pattern across all these systems: ZooKeeper holds the "who is alive" and "who is in charge" state that is too critical for a regular database and too coordination-specific for a message queue. The data is small (cluster membership is dozens of znodes, not millions of rows), the reads dominate (every request needs to know the current leader, but leader changes are rare), and session-based liveness is the right failure model.',
        {
          type: 'note',
          text: 'Kafka replaced ZooKeeper with KRaft (Kafka Raft) starting in version 3.3. The motivation was not that ZooKeeper was wrong, but that the operational burden of running a separate ZooKeeper ensemble alongside a Kafka cluster was significant. KRaft moves the metadata quorum inside the Kafka process itself, eliminating the external dependency.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'ZooKeeper fails when teams misuse it as something it is not.',
        {
          type: 'table',
          headers: ['Anti-pattern', 'What goes wrong', 'Better tool'],
          rows: [
            ['Large znode values (>100 KB)', 'Snapshot bloat, slow serialization, memory pressure on ensemble', 'An object store or database with a pointer in the znode'],
            ['High write volume (>1000 writes/sec sustained)', 'Quorum disk sync becomes bottleneck, latency spikes, leader overload', 'A log system (Kafka) or a database designed for write throughput'],
            ['Using ZooKeeper as a message queue', 'Znodes accumulate, no consumer offset semantics, no retention policy', 'Kafka, RabbitMQ, or any actual message queue'],
            ['Storing per-request application state', 'Ensemble becomes a bottleneck on the hot path, coupling coordination to request flow', 'A cache (Redis) or a database'],
            ['Locks without fencing tokens', 'Process pauses past session timeout, resumes, still holds external resource', 'Fencing tokens (use the znode version or zxid as a monotonic token)'],
          ],
        },
        'The fencing problem deserves special attention. A client acquires a ZooKeeper lock, then enters a long GC pause. The session times out. ZooKeeper deletes the ephemeral lock znode. Another client acquires the lock. The first client wakes up from GC, still believing it holds the lock, and writes to the external resource. Both clients now have concurrent access to the resource the lock was supposed to protect.',
        {
          type: 'code',
          language: 'text',
          text: [
            'The fencing token fix:',
            '',
            'Client A acquires lock, gets zxid (or sequential number) = 34',
            'Client A sends write to storage with fencing token 34',
            'Client A enters GC pause, session expires',
            'Client B acquires lock, gets zxid = 35',
            'Client B sends write to storage with fencing token 35',
            'Client A wakes up, sends write to storage with fencing token 34',
            'Storage REJECTS token 34 because it already saw token 35',
            '',
            'The storage system must enforce: reject any write with a token',
            'lower than the highest token it has already accepted.',
          ].join('\n'),
          label: 'Without fencing, a ZooKeeper lock is only advisory -- the external resource must participate in mutual exclusion',
        },
        {
          type: 'quote',
          text: 'If you are using ZooKeeper as lock service, you can use the zxid or the znode version number as fencing token, and you are in good shape.',
          attribution: 'Martin Kleppmann -- "How to do distributed locking," 2016',
        },
        'Production experience has surfaced other failure modes beyond fencing.',
        {
          type: 'table',
          headers: ['Failure', 'What happened', 'Lesson'],
          rows: [
            ['GC pause session expiry (HBase)', 'JVM stop-the-world GC on RegionServers exceeded the 40s session timeout. ZooKeeper deleted ephemeral znodes; HBase Master marked live servers dead.', 'Session timeout must account for worst-case GC pauses, not just network latency'],
            ['Ephemeral node loss (ZOOKEEPER-1740)', 'Prolonged fsync on ZK leader caused session expiration backlog. After leader recovered, it batch-expired sessions and deleted ephemeral znodes that clients had already reconnected and recreated.', 'Session recovery and ephemeral node lifecycle have ordering edge cases under leader stress'],
            ['Watch storm at scale (ZOOKEEPER-1177)', 'At 14.5 million watches, WatchManager consumed 1.2 GB of RAM (~100 bytes per watch). A config znode update triggered thundering-herd notification to thousands of clients.', 'Watches are not free; watch fan-out scales with subscriber count, not data size'],
            ['Disk-full split brain (ZOOKEEPER-3701)', 'Transaction log disk filled on one node in a 3-node cluster. Node continued in broken state for 5 days. After restart, it loaded an old snapshot, missing thousands of transactions.', 'A 3-node cluster tolerates exactly one failure; during maintenance, any second failure kills quorum'],
          ],
        },
      ],
    },
    {
      heading: 'ZooKeeper versus adjacent systems',
      paragraphs: [
        {
          type: 'table',
          headers: ['Dimension', 'ZooKeeper', 'etcd', 'Chubby', 'Consul'],
          rows: [
            ['Replication protocol', 'Zab (primary-backup atomic broadcast)', 'Raft (replicated log)', 'Paxos (single-decree, multi-instance)', 'Raft + Serf gossip for membership'],
            ['Data model', 'Hierarchical znode tree', 'Flat key-value with range queries', 'Hierarchical namespace with advisory locks', 'Key-value with service catalog'],
            ['Session / lease model', 'Client sessions with heartbeat timeout', 'Leases with TTL-based expiry', 'Lock handles with sequencer-based fencing', 'Sessions with TTL, health-check-based invalidation'],
            ['Watch model', 'One-shot watches, must re-register after each event', 'Persistent watches (watch streams via gRPC)', 'Lock-sequencer events', 'Blocking queries (long poll on index)'],
            ['API', 'Custom TCP protocol (Jute serialization)', 'gRPC + HTTP/JSON', 'RPC (internal Google)', 'HTTP + DNS interface'],
            ['Open source?', 'Yes (Apache)', 'Yes (CNCF)', 'No (Google internal)', 'Yes (HashiCorp BSL)'],
          ],
        },
        {
          type: 'quote',
          text: 'etcd has the luxury of hindsight taken from engineering and operational experience with ZooKeeper\'s design.',
          attribution: 'etcd documentation -- "ZooKeeper vs etcd"',
        },
        'etcd learned from ZooKeeper\'s limitations: it uses a flat keyspace (simpler than hierarchical znodes), persistent watches (no re-registration loop), gRPC (better tooling than Jute), and linearizable reads by default. Kubernetes chose etcd partly because both are written in Go, eliminating the JVM dependency and its GC-pause hazards. The tradeoff is that etcd\'s Raft implementation replicates a full log rather than a primary-backup stream, which behaves differently under leader changes and log compaction.',
        'Chubby was ZooKeeper\'s closest predecessor. The ZooKeeper paper explicitly describes its system as "similar to Chubby without the lock methods." The key design difference: Chubby\'s lock-delay mechanism blocks lock acquisition for a configurable period (typically one minute) after a lock holder dies, preventing zombie writers. ZooKeeper has no lock delay -- ephemeral znodes are deleted immediately on session end, and fencing is the client\'s responsibility. Chubby also provides a built-in sequencer (monotonic generation number) for fencing, while ZooKeeper clients must repurpose zxids or znode versions.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary paper: Hunt, Konar, Junqueira, Reed. "ZooKeeper: Wait-free Coordination for Internet-scale Systems." USENIX ATC, 2010.',
            'Zab paper: Junqueira, Reed, Serafini. "Zab: High-performance broadcast for primary-backup systems." IEEE/IFIP DSN, 2011.',
            'Apache ZooKeeper Programmer\'s Guide: https://zookeeper.apache.org/doc/current/zookeeperProgrammers.html',
            'Kleppmann. "How to do distributed locking." martin.kleppmann.com, 2016. (Fencing token argument)',
            'Burrows. "The Chubby lock service for loosely-coupled distributed systems." OSDI, 2006. (Predecessor system)',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Predecessor', 'Chubby Lock Service Case Study', 'The Google lock service that inspired ZooKeeper\'s design and the explicit contrast in the paper'],
            ['Prerequisite', 'Paxos', 'The foundational consensus protocol; understanding Paxos clarifies why Zab chose a different structure'],
            ['Prerequisite', 'Quorums', 'The majority intersection property that makes both reads and leader recovery safe'],
            ['Sibling', 'Raft Log Replication', 'The most widely taught alternative to Zab; similar goals, different protocol structure'],
            ['Extension', 'etcd Raft Case Study', 'The system that learned from ZooKeeper\'s limitations and replaced it in the Kubernetes ecosystem'],
            ['Extension', 'Kafka Log Case Study', 'Originally depended on ZooKeeper; migrated to KRaft, illustrating when to internalize coordination'],
            ['Application', 'Distributed Locks', 'The recipe pattern that ZooKeeper enables; includes the fencing token safety argument'],
            ['Application', 'Leader Replacement', 'How leadership transitions work; ZooKeeper\'s ephemeral nodes make this protocol concrete'],
            ['Failure mode', 'Fencing Token Zombie Writer Case Study', 'The precise failure when locks lack fencing; directly relevant to ZooKeeper lock recipes'],
          ],
        },
      ],
    },
  ],
};
