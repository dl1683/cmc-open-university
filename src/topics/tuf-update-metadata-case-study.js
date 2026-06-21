// The Update Framework: signed metadata roles that make software updates
// resistant to rollback, freeze, mix-and-match, and key-compromise failures.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'tuf-update-metadata-case-study',
  title: 'TUF Update Metadata Case Study',
  category: 'Security',
  summary: 'Secure software updates with root, targets, snapshot, timestamp, delegated roles, threshold signatures, hashes, versions, and expiry.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['role graph', 'client workflow'], defaultValue: 'role graph' },
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

function roleGraph(title) {
  return graphState({
    nodes: [
      { id: 'root', label: 'root', x: 0.9, y: 4.0, note: 'keys' },
      { id: 'targets', label: 'targets', x: 2.8, y: 2.3, note: 'files' },
      { id: 'delegated', label: 'delegate', x: 4.8, y: 1.7, note: 'path' },
      { id: 'target', label: 'file', x: 7.0, y: 1.7, note: 'hash' },
      { id: 'snapshot', label: 'snap', x: 3.4, y: 4.0, note: 'versions' },
      { id: 'timestamp', label: 'time', x: 5.6, y: 4.0, note: 'fresh' },
      { id: 'mirror', label: 'mirror', x: 7.25, y: 4.18, note: 'untrusted' },
      { id: 'client', label: 'client', x: 9.35, y: 3.62, note: 'verify' },
    ],
    edges: [
      { id: 'e-root-targets', from: 'root', to: 'targets' },
      { id: 'e-root-snapshot', from: 'root', to: 'snapshot' },
      { id: 'e-root-timestamp', from: 'root', to: 'timestamp' },
      { id: 'e-targets-delegated', from: 'targets', to: 'delegated' },
      { id: 'e-delegated-target', from: 'delegated', to: 'target' },
      { id: 'e-snapshot-targets', from: 'snapshot', to: 'targets' },
      { id: 'e-timestamp-snapshot', from: 'timestamp', to: 'snapshot' },
      { id: 'e-mirror-client', from: 'mirror', to: 'client' },
      { id: 'e-client-timestamp', from: 'client', to: 'timestamp' },
      { id: 'e-client-target', from: 'client', to: 'target' },
    ],
  }, { title });
}

function workflowGraph(title) {
  return graphState({
    nodes: [
      { id: 'trusted', label: 'trusted root', x: 0.8, y: 3.7, note: 'pinned' },
      { id: 'root', label: 'root update', x: 2.5, y: 3.7, note: 'threshold' },
      { id: 'timestamp', label: 'timestamp', x: 4.2, y: 2.1, note: 'expiry' },
      { id: 'snapshot', label: 'snapshot', x: 5.8, y: 2.1, note: 'meta list' },
      { id: 'targets', label: 'targets', x: 5.8, y: 5.2, note: 'hashes' },
      { id: 'file', label: 'file bytes', x: 7.6, y: 5.2, note: 'download' },
      { id: 'verify', label: 'verify', x: 9.2, y: 3.7, note: 'install?' },
    ],
    edges: [
      { id: 'e-trusted-root', from: 'trusted', to: 'root' },
      { id: 'e-root-timestamp', from: 'root', to: 'timestamp' },
      { id: 'e-timestamp-snapshot', from: 'timestamp', to: 'snapshot' },
      { id: 'e-snapshot-targets', from: 'snapshot', to: 'targets' },
      { id: 'e-targets-file', from: 'targets', to: 'file' },
      { id: 'e-file-verify', from: 'file', to: 'verify' },
      { id: 'e-root-verify', from: 'root', to: 'verify' },
      { id: 'e-snapshot-verify', from: 'snapshot', to: 'verify' },
      { id: 'e-targets-verify', from: 'targets', to: 'verify' },
    ],
  }, { title });
}

function* roleGraphView() {
  yield {
    state: roleGraph('TUF splits update trust into signed roles'),
    highlight: { active: ['root', 'targets', 'snapshot', 'timestamp', 'e-root-targets', 'e-root-snapshot', 'e-root-timestamp'], compare: ['mirror'] },
    explanation: 'TUF does not ask a mirror to be trusted. Root signs which keys are trusted for the other top-level roles: targets, snapshot, and timestamp.',
    invariant: 'Trust metadata, not mirrors.',
  };

  yield {
    state: roleGraph('Targets metadata binds paths to hashes and sizes'),
    highlight: { active: ['targets', 'delegated', 'target', 'e-targets-delegated', 'e-delegated-target'], found: ['client'] },
    explanation: 'The targets role says which files are valid and records their hashes and sizes. Delegated targets roles can be trusted for only a subset of paths.',
  };

  yield {
    state: roleGraph('Snapshot and timestamp stop stale metadata games'),
    highlight: { active: ['timestamp', 'snapshot', 'targets', 'e-timestamp-snapshot', 'e-snapshot-targets'], compare: ['mirror'] },
    explanation: 'Snapshot signs the versions of all target metadata, stopping mix-and-match. Timestamp signs the current snapshot hash and expires quickly, stopping indefinite freeze.',
  };

  yield {
    state: labelMatrix(
      'TUF top-level roles',
      [
        { id: 'root', label: 'root' },
        { id: 'targets', label: 'targets' },
        { id: 'snapshot', label: 'snapshot' },
        { id: 'timestamp', label: 'timestamp' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'blocks', label: 'blocks' },
      ],
      [
        ['role keys', 'key takeover'],
        ['file hashes', 'wrong file'],
        ['meta versions', 'mix-match'],
        ['fresh snap', 'freeze'],
      ],
    ),
    highlight: { active: ['root:stores', 'targets:stores', 'snapshot:blocks', 'timestamp:blocks'] },
    explanation: 'The data structure is four signed metadata families with different jobs. Separating jobs limits damage when an online key or mirror is compromised.',
  };
}

function* clientWorkflow() {
  yield {
    state: workflowGraph('Start from a pinned trusted root'),
    highlight: { active: ['trusted', 'root', 'verify', 'e-trusted-root', 'e-root-verify'], compare: ['file'] },
    explanation: 'A client begins with trusted root metadata shipped with the application. Root updates require threshold signatures so one compromised root key is not enough.',
  };

  yield {
    state: workflowGraph('Fetch timestamp before trusting repository state'),
    highlight: { active: ['root', 'timestamp', 'snapshot', 'e-root-timestamp', 'e-timestamp-snapshot'], found: ['verify'] },
    explanation: 'Timestamp is usually online and short-lived. It tells the client which snapshot hash and version are current before the client trusts deeper metadata.',
  };

  yield {
    state: workflowGraph('Snapshot selects one consistent metadata set'),
    highlight: { active: ['snapshot', 'targets', 'e-snapshot-targets'], compare: ['timestamp'], found: ['verify'] },
    explanation: 'Snapshot metadata lists versions of targets metadata, including delegated roles. That prevents an attacker from mixing new timestamp metadata with old targets metadata.',
  };

  yield {
    state: workflowGraph('Install only bytes that match trusted targets metadata'),
    highlight: { active: ['targets', 'file', 'verify', 'e-targets-file', 'e-file-verify', 'e-targets-verify'], compare: ['trusted'] },
    explanation: 'The downloaded target file is checked against trusted hashes and size before the application is allowed to use it. The target bytes remain opaque to TUF.',
    invariant: 'No matching target metadata, no install.',
  };

  yield {
    state: labelMatrix(
      'Attack map',
      [
        { id: 'rollback', label: 'rollback' },
        { id: 'freeze', label: 'freeze' },
        { id: 'mix', label: 'mix-match' },
        { id: 'key', label: 'key leak' },
        { id: 'mirror', label: 'bad mirror' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'defense', label: 'defense' },
      ],
      [
        ['old good file', 'versions'],
        ['stale world', 'expiry'],
        ['split metadata', 'snapshot'],
        ['one key stolen', 'threshold'],
        ['wrong bytes', 'hash check'],
      ],
    ),
    highlight: { found: ['rollback:defense', 'freeze:defense', 'mix:defense', 'key:defense', 'mirror:defense'] },
    explanation: 'TUF is a threat-model data structure. Versions, expiry, hashes, sizes, roles, delegation paths, and threshold signatures each close a specific update attack path.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'role graph') yield* roleGraphView();
  else if (view === 'client workflow') yield* clientWorkflow();
  else throw new InputError('Pick a TUF view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Role graph" traces how TUF splits update trust across four signed metadata families -- root, targets, snapshot, and timestamp -- each with a different job, different keys, and a different blast radius if compromised. "Client workflow" traces the ordered verification sequence a client follows from its pinned trusted root through timestamp, snapshot, targets, and file download.',
        {type:'callout', text:'TUF protects updates by splitting trust into signed roles where each role blocks one specific class of repository attack.'},
        {
          type: 'bullets',
          items: [
            'Active (highlighted) nodes are the current verification stage -- the metadata being fetched or the check being performed right now.',
            'Found (green) nodes are facts the client has committed to -- metadata that passed all checks and is now trusted.',
            'Compare (blue) nodes show contrast cases -- untrusted mirrors, earlier trust anchors, or metadata the client has not yet reached.',
          ],
        },
        'In the matrix views, rows are roles or attack classes and columns show what each role stores or which defense blocks each attack. Read each cell as a claim the protocol makes and ask whether the mechanism behind it is sufficient.',
        {
          type: 'note',
          text: 'The animation uses a small role graph with a handful of nodes. A production TUF repository may have dozens of delegated roles (PyPI uses 2,048 hash-bin delegations), thousands of target entries, and key ceremonies involving hardware security modules. The verification logic is identical at any scale.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Software update systems are the highest-value target in the supply chain. An attacker who controls what a client installs controls the machine. The 2008 paper "A Look in the Mirror" by Justin Samuel and Justin Cappos studied ten major package managers and found every one exploitable -- the researchers obtained official mirrors on all five Linux distributions they attempted, using false credentials. That paper launched the research that became TUF.',
        {
          type: 'quote',
          text: 'We found that all of the package managers we examined are vulnerable to at least one of the attacks we describe... None of the package managers we examined take adequate steps to protect clients from all of the attacks we describe.',
          attribution: 'Samuel & Cappos, "A Look in the Mirror: Attacks on Package Managers," CCS 2008',
        },
        'The damage is not hypothetical. The 2017 NotPetya attack spread through a backdoored update to Ukrainian tax software M.E.Doc, causing over $10 billion in damages -- Maersk alone lost $250-300 million. The 2020 SolarWinds/SUNBURST attack compromised the build system so that legitimately signed updates carried backdoors. The 2016 Linux Mint hack replaced ISO downloads and their MD5 checksums simultaneously.',
        'TUF does not replace a package manager, build system, CDN, or installer. It gives those systems a way to decide which update metadata is trusted, which target files are allowed, and whether the repository state is fresh enough to use. It was first developed at the University of Washington in 2009 by Justin Samuel and Justin Cappos, building on Thandy (the Tor Project updater). It graduated from the CNCF in December 2019 as the first security project and first academic-led project to do so.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is HTTPS plus a GPG signature on the package file. Download the file over an encrypted channel, verify the signature against a known public key, and install if the signature checks out. For a small internal updater with one server and one signing key, this works. The transport prevents eavesdropping, and the signature proves the bytes came from a trusted key at some point in time.',
        {
          type: 'table',
          headers: ['Property', 'HTTPS + GPG signature', 'Gap'],
          rows: [
            ['Confidentiality', 'Yes -- TLS encrypts the channel', 'Mirrors may not use HTTPS'],
            ['File integrity', 'Yes -- signature covers the bytes', 'Only proves the file, not the repository state'],
            ['Key trust', 'Single key or keyring', 'One compromised key is total compromise'],
            ['Freshness', 'None', 'An old signed file is still "valid"'],
            ['Consistency', 'None', 'Nothing ties metadata versions together'],
            ['Rollback detection', 'None', 'A mirror can serve last month\'s valid package'],
          ],
        },
        'This approach handles the simplest attack -- someone tampering with bytes in transit. Many teams stop here because the signature verification feels complete. The gap is that file authenticity is only one of at least six properties a secure update system needs.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that freshness, consistency, and blast radius are independent of file authenticity. A single GPG signature proves "these bytes were signed by this key" but says nothing about when, whether the repository state is current, or what happens when the key leaks.',
        {
          type: 'table',
          headers: ['Attack', 'How it works against HTTPS+GPG', 'Why GPG cannot stop it'],
          rows: [
            ['Rollback', 'Mirror serves v3.1 (with known RCE) instead of v3.2', 'The v3.1 signature is still valid -- GPG has no version ordering'],
            ['Freeze', 'Mirror keeps serving last week\'s metadata indefinitely', 'GPG signatures have no expiry tied to repository state'],
            ['Mix-and-match', 'Attacker combines new timestamp with old targets metadata', 'GPG signs files individually, not the repository as a unit'],
            ['Key compromise', 'Single leaked key signs anything the attacker wants', 'No threshold, no role separation, no offline/online key split'],
            ['Endless data', 'Attacker sends gigabytes when client requests a small file', 'GPG does not specify expected file sizes before download'],
          ],
        },
        'Each of these attacks uses validly signed data or exploits the absence of a property that GPG was never designed to provide. The problem is not that GPG is broken -- it is that update security requires a structure around the signatures, not just the signatures themselves. TUF splits authority across roles so that no single key compromise, no single mirror, and no single stale file can break the entire system.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is role separation with ordered verification. Different update questions deserve different keys, different expiry schedules, and different blast radii. TUF factors update trust into four top-level roles, each answering exactly one question:',
        {
          type: 'table',
          headers: ['Role', 'Question it answers', 'What it stores', 'Attack it blocks', 'Typical key location'],
          rows: [
            ['root', 'Who is trusted to sign the other roles?', 'Key definitions, role thresholds', 'Key compromise (via rotation + threshold)', 'Offline / HSM / airgapped'],
            ['targets', 'Which files are valid and what are their hashes?', 'Target paths, SHA-256 hashes, byte lengths, delegations', 'Arbitrary software (malicious files)', 'Offline'],
            ['snapshot', 'Which versions of target metadata belong together?', 'Version numbers of all targets metadata files', 'Mix-and-match (inconsistent metadata)', 'Offline or online'],
            ['timestamp', 'What is the current repository state right now?', 'Hash and version of snapshot.json', 'Freeze (stale metadata)', 'Online (must sign frequently)'],
          ],
        },
        'This turns update security into a chain of small verification gates. A bad mirror cannot install malicious files because target bytes must match signed hashes. A rollback is caught because metadata versions must increase monotonically. A freeze is caught because timestamp metadata expires within hours. A mix-and-match attack is caught because snapshot pins every metadata file to a specific version number. A single stolen key does less damage when roles use threshold signatures and the most sensitive keys stay offline.',
        {
          type: 'note',
          text: 'The separation is not arbitrary -- it follows the principle of least privilege applied to signing authority. The timestamp key must be online because it signs every few hours, so TUF assumes it is the most exposed and limits its power to pointing at a snapshot hash. The root keys are rarely used, so they can live in a vault and still be available when needed.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Every TUF metadata file uses the same signed envelope structure:',
        {
          type: 'code',
          language: 'json',
          text: [
            '{',
            '  "signatures": [',
            '    { "keyid": "4e777de0...", "sig": "a337d637..." }',
            '  ],',
            '  "signed": {',
            '    "_type": "root",',
            '    "spec_version": "1.0.0",',
            '    "version": 1,',
            '    "expires": "2030-01-01T00:00:00Z",',
            '    ...role-specific fields...',
            '  }',
            '}',
          ].join('\n'),
        },
        'The keyid is the hex-encoded SHA-256 of the canonical JSON serialization of the key object. Canonical JSON follows the OLPC specification: keys sorted lexicographically, no whitespace between tokens, no trailing commas. The signature covers the canonical JSON of the entire "signed" object. Each keyid in the signatures array must be unique -- CVE-2020-6174 exploited implementations (python-tuf and AWS tough) that counted duplicate signatures from the same keyid toward the threshold.',
        'Root metadata is the trust anchor. It defines every key in the system and specifies how many signatures each role requires:',
        {
          type: 'code',
          language: 'json',
          text: [
            '"roles": {',
            '  "root":      { "keyids": ["aaa...", "bbb...", "ccc..."], "threshold": 2 },',
            '  "targets":   { "keyids": ["ddd..."], "threshold": 1 },',
            '  "snapshot":  { "keyids": ["eee..."], "threshold": 1 },',
            '  "timestamp": { "keyids": ["fff..."], "threshold": 1 }',
            '}',
          ].join('\n'),
        },
        'Targets metadata maps file paths to their cryptographic hashes and byte lengths. It may also contain delegations -- an ordered array of sub-roles, each authorized to sign for a specific set of path patterns. Delegations can be terminating (search stops after this subtree even if the target is not found) or non-terminating (search continues to the next delegation). PyPI uses succinct hash-bin delegations (TAP 15) to distribute 500,000+ packages across 2,048 bins, reducing metadata overhead from 69% to 9%.',
        'Snapshot metadata lists the version number of every targets metadata file (top-level plus all delegated roles). This creates an atomic consistent view of the repository -- if any metadata file version does not match what snapshot declares, the client rejects the update.',
        'Timestamp metadata contains exactly one entry: the hash and version of snapshot.json. It is intentionally tiny so clients can poll frequently. A typical expiry is 1 day, so a freeze attack can delay updates by at most ~24 hours.',
        {
          type: 'diagram',
          label: 'Client verification order (spec sections 5.1-5.7)',
          text: [
            '  Record wall-clock time T',
            '       |',
            '       v',
            '  Load trusted root (shipped with app)',
            '       |',
            '       v',
            '  Update root: fetch N+1, verify BOTH old AND new threshold,',
            '               check version == N+1 exactly, repeat until 404',
            '       |',
            '       v',
            '  Check final root expiry > T',
            '       |',
            '       v',
            '  Fetch timestamp.json (always unprefixed, no version in URL)',
            '  Check: signature, version > trusted, snapshot version >= trusted, expiry > T',
            '       |',
            '       v',
            '  Fetch snapshot (VERSION.snapshot.json if consistent_snapshot)',
            '  Check: hash matches timestamp, signature, version == timestamp says, expiry > T',
            '       |',
            '       v',
            '  Fetch targets (VERSION.targets.json if consistent_snapshot)',
            '  Check: hash matches snapshot, signature, version == snapshot says, expiry > T',
            '  Walk delegation tree if needed (depth-first, pre-order, cycle-safe)',
            '       |',
            '       v',
            '  Download target file (HASH.filename if consistent_snapshot)',
            '  Check: hash matches targets metadata, length matches targets metadata',
            '       |',
            '       v',
            '  Install',
          ].join('\n'),
        },
        'The client records wall-clock time once at the start and uses that single timestamp for all expiry checks. This prevents race conditions during long update sequences. Root updates walk one version at a time -- version N to N+1 exactly -- and each step requires threshold signatures from both the old root and the new root, so a single compromised root key cannot unilaterally rotate trust.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'TUF works because the client never asks one artifact to prove everything. Each verification step establishes a different property, and the ordering is the security boundary:',
        {
          type: 'table',
          headers: ['Step', 'Property established', 'What breaks if skipped'],
          rows: [
            ['Root update with cross-signing', 'Key trust continuity', 'Attacker with one root key rotates all other keys'],
            ['Root expiry check', 'Trust anchor freshness', 'Client trusts ancient root with revoked keys'],
            ['Timestamp version > trusted', 'Forward progress', 'Rollback to old repository state'],
            ['Timestamp expiry check', 'Repository freshness', 'Freeze on stale metadata forever'],
            ['Snapshot hash from timestamp', 'Snapshot integrity', 'Attacker substitutes different snapshot'],
            ['Snapshot version pinning', 'Metadata consistency', 'Mix old targets metadata with new snapshot'],
            ['Targets hash from snapshot', 'Targets integrity', 'Attacker substitutes different targets list'],
            ['Target file hash from targets', 'File integrity', 'Mirror serves modified binary'],
          ],
        },
        'The correctness argument is compositional: each role proves one thing, and the chain of proofs covers the full attack surface. Threshold signatures add redundancy within each proof -- a 2-of-3 threshold on root means an attacker who steals one root key still cannot forge a valid root rotation. The uniqueness constraint (each keyid counted at most once) prevents the duplicate-signature bypass found in CVE-2020-6174.',
        {
          type: 'note',
          text: 'The order is not interchangeable. A client that trusts targets before checking snapshot can be fed inconsistent metadata. A client that skips the timestamp expiry check can be frozen indefinitely. A client that accepts timestamp version <= trusted version can be rolled back. The spec encodes these ordering constraints as numbered steps precisely because reordering them creates vulnerabilities.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace a client updating from a pinned root through file installation. The client has trusted root v3, timestamp v50, and snapshot v20 from a previous update cycle.',
        {
          type: 'code',
          language: 'text',
          text: [
            'Step 1: Record fixed time T = 2026-06-20T14:00:00Z',
            '',
            'Step 2: Load trusted root v3 from local storage',
            '        (expiry not checked at this step)',
            '',
            'Step 3: Root update loop',
            '  Fetch 4.root.json -- found',
            '    Verify: 2-of-3 signatures from root v3 keys? Yes (keys A, C signed)',
            '    Verify: 2-of-3 signatures from root v4 keys? Yes (keys A, D signed)',
            '    Verify: version == 4? Yes',
            '    Accept root v4, persist, continue loop',
            '  Fetch 5.root.json -- HTTP 404, loop ends',
            '  Check root v4 expiry (2027-01-01) > T (2026-06-20)? Yes',
            '  Root v4 rotated timestamp key -- delete cached timestamp and snapshot',
            '',
            'Step 4: Fetch timestamp.json',
            '  Verify signature with new timestamp key from root v4? Yes',
            '  Version 55 > 0 (cache was deleted)? Yes',
            '  Snapshot version in timestamp (22) >= 0? Yes',
            '  Expiry (2026-06-21T00:00:00Z) > T? Yes',
            '  Accept timestamp v55',
            '',
            'Step 5: Fetch 22.snapshot.json (consistent_snapshot is true)',
            '  Hash matches what timestamp v55 declared? Yes',
            '  Signature valid? Yes',
            '  Version == 22 (exactly what timestamp said)? Yes',
            '  Expiry (2026-07-01) > T? Yes',
            '  Accept snapshot v22',
            '',
            'Step 6: Fetch 8.targets.json',
            '  Snapshot v22 says targets.json version = 8',
            '  Hash matches snapshot? Yes. Signature valid? Yes',
            '  Version == 8? Yes. Expiry > T? Yes',
            '  Look up "editor-3.2.0.tar.gz":',
            '    length: 4718592, sha256: "c14aef7e...681"',
            '',
            'Step 7: Fetch c14aef7e...681.editor-3.2.0.tar.gz',
            '  Downloaded 4718592 bytes',
            '  SHA-256 matches c14aef7e...681? Yes',
            '  Install.',
          ].join('\n'),
        },
        'Now trace what happens when an attacker controlling a mirror tries a rollback. The attacker captured valid metadata from last month: timestamp v40, snapshot v18, targets v6 (listing editor v3.1 with a known RCE).',
        {
          type: 'code',
          language: 'text',
          text: [
            'Attacker serves timestamp v40 to the client.',
            'Client compares: new version 40 vs trusted version 55.',
            '40 < 55 -- REJECTED. Rollback attack detected.',
            '',
            'The attack fails at the very first metadata file downloaded.',
            'Even if the attacker could bypass timestamp, snapshot v18 < v22',
            'would fail the snapshot rollback check as defense-in-depth.',
          ].join('\n'),
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The runtime cost is extra metadata fetches and signature verifications before any target file is downloaded.',
        {
          type: 'table',
          headers: ['Metadata file', 'Typical size', 'Fetch frequency', 'Signature cost', 'Expiry period'],
          rows: [
            ['timestamp.json', '< 1 KB', 'Every update check', '1 Ed25519 verify (~50 us)', 'Hours to 1 day'],
            ['snapshot.json', '1-100 KB', 'When timestamp changes', '1 verify + hash check vs timestamp', 'Days to weeks'],
            ['targets.json (top-level)', '1 KB - 5 MB', 'When snapshot changes', '1 verify + hash check vs snapshot', 'Days to weeks'],
            ['Delegated targets', 'Varies', 'On demand per delegation', '1 verify each', 'Days to weeks'],
            ['root.json', '1-5 KB', 'Walk chain on each update', '2x threshold verify per version step', '1 year+'],
          ],
        },
        'For a repository with 10 delegated roles and Ed25519 keys, a full cold-start update performs roughly 15-20 signature verifications -- under 1 ms of CPU time on modern hardware. The dominant cost is network round trips, not cryptography.',
        'The operational cost is key management. Root keys require ceremonies with hardware security modules, offline storage, and split responsibility. Sigstore held its first root signing ceremony on June 18, 2021 -- live-streamed, with five community keyholders using YubiKeys. Timestamp keys must be online and automated. Targets keys need rotation plans and emergency revocation procedures.',
        {
          type: 'note',
          text: 'Clients must persist trusted metadata between update cycles. Without a remembered timestamp version, rollback detection has no baseline. Without a remembered snapshot, mix-and-match detection has no baseline. The persistent metadata cache is part of the security boundary, not an optimization.',
        },
        'Consistent snapshots add storage cost: each metadata version and each target file hash produces a distinct filename on disk (42.snapshot.json, c14ae...firmware.bin). This eliminates CDN cache races -- timestamp points to a specific snapshot version that remains on disk as an immutable file -- but multiplies storage by the number of retained versions.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Deployment', 'What TUF protects', 'Scale', 'Key detail'],
          rows: [
            ['PyPI (PEP 458)', 'Python package index metadata', '500,000+ packages', 'Uses TAP 15 succinct delegations: 2,048 hash bins, reduced overhead from 69% to 9%'],
            ['Sigstore', 'Root of trust material (Fulcio CA cert, Rekor public key)', 'All Go, npm, PyPI cosign users', 'TUF distributes trust anchors; artifact signing uses OIDC keyless flow'],
            ['Uptane', 'Automotive OTA updates', 'Millions of vehicles', 'Dual-repo (Image + Director), Primary/Secondary ECU split, IEEE-ISTO standard'],
            ['Datadog', 'Agent integration packages', 'Enterprise fleet', 'TUF + in-toto; developers sign with YubiKeys'],
            ['Google Fuchsia', 'OS package updates', 'Fuchsia devices', 'Packages as PACKAGE/VARIANT paths with Merkle root custom attributes'],
            ['AWS Bottlerocket', 'Atomic OS image updates', 'Container-optimized hosts', 'Rust implementation (tough); update to inactive partition'],
          ],
        },
        'Uptane deserves special attention because it extends TUF for a constrained environment. An automobile has dozens of electronic control units (ECUs) with different compute capabilities. Uptane introduces a Primary ECU (network-connected, runs full TUF verification) and Secondary ECUs (resource-constrained, receive pre-verified metadata from the Primary). Two repositories -- Image (offline keys, ground truth about all available software) and Director (online keys, vehicle-specific update instructions) -- must agree before any ECU installs anything. This was named by Popular Science as a top security innovation of 2017.',
        'Docker Content Trust (Notary v1) was an early high-profile TUF deployment that ultimately failed. Key management burden was too high for the Docker workflow: every push required an offline targets key, CI/CD pipelines could not automate signing, and key loss meant permanent inability to sign for a repository. Fewer than 0.05% of Docker Hub pulls used DCT. Docker dropped TUF entirely in Notary v2, switching to X.509 PKI certificates. The lesson: TUF is a protocol plus an operating discipline, and if the discipline does not fit the developer workflow, adoption fails.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'TUF has explicit design boundaries and operational failure modes that users must understand.',
        {
          type: 'table',
          headers: ['Failure mode', 'Condition', 'Consequence'],
          rows: [
            ['Build-system compromise', 'Attacker modifies source before signing', 'TUF faithfully distributes the backdoored artifact -- it proves bytes match metadata, not that the bytes are safe (SolarWinds-class attack)'],
            ['Threshold root key compromise', 'Attacker obtains enough root keys to meet threshold', 'Total takeover -- can redefine all roles. Recovery requires out-of-band distribution of new root to every client'],
            ['Key loss without backup', 'Offline key destroyed with no recovery ceremony', 'Repository role permanently unusable until root rotates it out (Docker DCT\'s fatal problem)'],
            ['Clock skew on client', 'Client clock far in the future or past', 'Expiry checks give wrong answers -- may accept expired metadata or reject fresh metadata'],
            ['Metadata size explosion', 'Hundreds of thousands of targets without delegation', 'Single targets.json becomes megabytes; every update downloads the full file'],
            ['Stale persistent cache', 'Client loses its metadata cache', 'Falls back to pinned root; rollback detection baseline reset to zero; must walk entire root chain'],
            ['Delegation cycle or depth bomb', 'Malicious or misconfigured delegation graph', 'Client follows arbitrarily deep chains; mitigated by application-defined max-roles limit'],
          ],
        },
        'The deepest silent failure: TUF tells a client "these are the authorized bytes for this repository state" but says nothing about whether the source code was reviewed, the build was reproducible, the maintainer was honest, or the dependency is free of vulnerabilities. Teams that deploy TUF and believe they have solved supply-chain security have confused one link with the entire chain. In-toto (build provenance), transparency logs (public auditability), vulnerability scanners, and policy engines cover the adjacent attack surfaces.',
        {
          type: 'quote',
          text: 'TUF is designed to be used in conjunction with other security measures. TUF cannot, by itself, protect against all attacks... it cannot prevent developers from including malicious code in their packages.',
          attribution: 'TUF project documentation, theupdateframework.io',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary paper: "Survivable Key Compromise in Software Update Systems" -- Justin Samuel, Nick Mathewson, Justin Cappos, Roger Dingledine. ACM CCS 2010, pages 61-72. Finalist for AT&T Best Applied Security Research Paper.',
            'Specification: The Update Framework Specification v1.0.34 (January 2026) at theupdateframework.github.io/specification/latest/.',
            'Delegation model: "Diplomat: Using Delegations to Protect Community Repositories" -- NSDI 2016.',
            'Automotive extension: "Uptane: Securing Software Updates for Automobiles" -- escar 2016. IEEE-ISTO standard 6100.1.0.0.',
            'Project documentation: theupdateframework.io. Reference implementations: python-tuf (v7.0.0), go-tuf (v2.4.2), tough (Rust, AWS Labs).',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Study next', 'Why it connects'],
          rows: [
            ['Prerequisite', 'Merkle Tree', 'TUF hashes chain metadata integrity; Merkle trees generalize hash commitments to arbitrary data sets'],
            ['Prerequisite', 'Shamir Secret Sharing', 'Key recovery ceremonies split root keys across custodians using threshold secret sharing'],
            ['Extension', 'Sigstore Keyless Signing Transparency', 'Sigstore uses TUF for root-of-trust distribution and adds OIDC-based keyless signing on top'],
            ['Extension', 'Software Supply Chain Provenance Graph', 'In-toto covers build provenance -- the link TUF explicitly does not protect'],
            ['Contrast', 'Transparency Log Witnessing', 'Append-only logs provide public auditability; TUF provides private client-side verification -- different trust models for overlapping goals'],
            ['Production', 'OPA Rego Policy Decision Graph', 'After TUF verifies the bytes are authorized, a policy engine decides whether to install them on a specific fleet'],
          ],
        },
      ],
    },
  ],
};

