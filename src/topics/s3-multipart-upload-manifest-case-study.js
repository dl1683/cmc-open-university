// S3 multipart upload: upload-id state, independently retried parts,
// checksums, completion manifest, and abort cleanup.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 's3-multipart-upload-manifest-case-study',
  title: 'S3 Multipart Upload Manifest',
  category: 'Systems',
  summary: 'A multipart object-upload case study: initiate an upload, send numbered parts with checksums, retry failed parts, complete the manifest, or abort orphaned state.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['parts and checksums', 'complete upload'], defaultValue: 'parts and checksums' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function mpuGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'file', label: 'file', x: 0.5, y: 4.0, note: notes.file ?? '80 GB' },
      { id: 'init', label: 'init', x: 2.0, y: 4.0, note: notes.init ?? 'upload id' },
      { id: 'p1', label: 'part 1', x: 3.9, y: 1.7, note: notes.p1 ?? 'ok' },
      { id: 'p2', label: 'part 2', x: 3.9, y: 3.3, note: notes.p2 ?? 'retry' },
      { id: 'p3', label: 'part 3', x: 3.9, y: 4.9, note: notes.p3 ?? 'ok' },
      { id: 'p4', label: 'part 4', x: 3.9, y: 6.5, note: notes.p4 ?? 'ok' },
      { id: 'checks', label: 'checks', x: 6.0, y: 3.0, note: notes.checks ?? 'per part' },
      { id: 'list', label: 'list', x: 6.0, y: 5.4, note: notes.list ?? 'manifest' },
      { id: 'complete', label: 'commit', x: 7.6, y: 4.0, note: notes.complete ?? 'complete' },
      { id: 'object', label: 'object', x: 9.45, y: 4.0, note: notes.object ?? 'GET' },
    ],
    edges: [
      { id: 'e-file-init', from: 'file', to: 'init', weight: '' },
      { id: 'e-init-p1', from: 'init', to: 'p1', weight: '' },
      { id: 'e-init-p2', from: 'init', to: 'p2', weight: '' },
      { id: 'e-init-p3', from: 'init', to: 'p3', weight: '' },
      { id: 'e-init-p4', from: 'init', to: 'p4', weight: '' },
      { id: 'e-p1-checks', from: 'p1', to: 'checks', weight: '' },
      { id: 'e-p2-checks', from: 'p2', to: 'checks', weight: '' },
      { id: 'e-p3-checks', from: 'p3', to: 'checks', weight: '' },
      { id: 'e-p4-checks', from: 'p4', to: 'checks', weight: '' },
      { id: 'e-checks-list', from: 'checks', to: 'list', weight: '' },
      { id: 'e-list-complete', from: 'list', to: 'complete', weight: '' },
      { id: 'e-complete-object', from: 'complete', to: 'object', weight: '' },
    ],
  }, { title });
}

function lifecycleGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'init', label: 'init', x: 0.8, y: 4.0, note: notes.init ?? 'upload id' },
      { id: 'parts', label: 'parts', x: 2.7, y: 2.4, note: notes.parts ?? 'hidden' },
      { id: 'retry', label: 'retry', x: 2.7, y: 5.6, note: notes.retry ?? 'one part' },
      { id: 'complete', label: 'complete', x: 5.0, y: 3.1, note: notes.complete ?? 'commit' },
      { id: 'abort', label: 'abort', x: 5.0, y: 5.3, note: notes.abort ?? 'cleanup' },
      { id: 'object', label: 'object', x: 7.2, y: 3.1, note: notes.object ?? 'GETable' },
      { id: 'orphan', label: 'orphan', x: 7.2, y: 5.3, note: notes.orphan ?? 'cost' },
      { id: 'rule', label: 'lifecycle', x: 9.0, y: 5.3, note: notes.rule ?? 'expire' },
    ],
    edges: [
      { id: 'e-init-parts', from: 'init', to: 'parts', weight: '' },
      { id: 'e-init-retry', from: 'init', to: 'retry', weight: '' },
      { id: 'e-parts-complete', from: 'parts', to: 'complete', weight: '' },
      { id: 'e-retry-complete', from: 'retry', to: 'complete', weight: '' },
      { id: 'e-complete-object', from: 'complete', to: 'object', weight: '' },
      { id: 'e-parts-abort', from: 'parts', to: 'abort', weight: '' },
      { id: 'e-abort-orphan', from: 'abort', to: 'orphan', weight: '' },
      { id: 'e-orphan-rule', from: 'orphan', to: 'rule', weight: '' },
    ],
  }, { title });
}

function* partsAndChecksums() {
  yield {
    state: mpuGraph('Multipart upload turns one object into numbered parts'),
    highlight: { active: ['file', 'init', 'p1', 'p2', 'p3', 'p4'], found: ['checks'] },
    explanation: 'A multipart upload begins by creating upload state and receiving an upload ID. The client then uploads numbered parts, often in parallel. The parts are temporary until the upload is completed.',
    invariant: 'Part numbers define final object order; arrival order does not.',
  };

  yield {
    state: labelMatrix(
      'Part records',
      [
        { id: 'p1', label: 'part 1' },
        { id: 'p2', label: 'part 2' },
        { id: 'p3', label: 'part 3' },
        { id: 'upid', label: 'upload id' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'check', label: 'checksum' },
        { id: 'retry', label: 'retry' },
      ],
      [
        ['stored', 'sha256 A', 'no'],
        ['failed', 'none', 'yes'],
        ['stored', 'sha256 C', 'no'],
        ['open', 'tracks parts', 'list/abort'],
      ],
    ),
    highlight: { active: ['p2:state', 'p2:retry'], found: ['p1:check', 'p3:check'] },
    explanation: 'A failed part can be retried without resending the whole object. The upload ID scopes those temporary part records until complete or abort.',
  };

  yield {
    state: mpuGraph('Only the failed part is retransmitted', { p2: 'new bytes', checks: 'verify', list: 'parts ok' }),
    highlight: { active: ['p2', 'e-p2-checks', 'checks'], found: ['list'], compare: ['p1', 'p3', 'p4'] },
    explanation: 'The retry boundary is the part. That is why multipart upload is useful for large files and unreliable networks: failure scope is smaller than the whole object.',
  };

  yield {
    state: labelMatrix(
      'Integrity records',
      [
        { id: 'part', label: 'part check' },
        { id: 'full', label: 'full check' },
        { id: 'etag', label: 'ETag' },
        { id: 'meta', label: 'metadata' },
      ],
      [
        { id: 'means', label: 'means' },
        { id: 'caveat', label: 'caveat' },
      ],
      [
        ['per part', 'catch upload'],
        ['whole object', 'final verify'],
        ['object tag', 'not always MD5'],
        ['stored attrs', 'policy varies'],
      ],
    ),
    highlight: { active: ['part:means', 'full:means'], compare: ['etag:caveat'] },
    explanation: 'Modern S3 clients can use checksum fields for integrity. Do not treat every ETag as a simple MD5 of the object; multipart and encryption cases can differ.',
  };

  yield {
    state: mpuGraph('Parallel parts turn bandwidth into throughput', { file: 'large', init: 'id', complete: 'later', object: 'not yet' }),
    highlight: { active: ['p1', 'p2', 'p3', 'p4'], compare: ['complete', 'object'] },
    explanation: 'Parts can upload independently and in any order, but the object is not the final visible object until the client sends the complete request with the chosen part list.',
  };
}

function* completeUpload() {
  yield {
    state: mpuGraph('Complete Multipart Upload commits the part manifest', { list: 'part nums', complete: 'commit', object: 'object' }),
    highlight: { active: ['list', 'complete', 'e-list-complete'], found: ['object', 'e-complete-object'] },
    explanation: 'Completion is the commit point. The client provides the ordered list of parts it wants assembled. S3 creates one object from those parts in ascending part-number order.',
    invariant: 'An incomplete multipart upload is not the finished object.',
  };

  yield {
    state: labelMatrix(
      'Complete request manifest',
      [
        { id: 'p1', label: 'part 1' },
        { id: 'p2', label: 'part 2' },
        { id: 'p3', label: 'part 3' },
        { id: 'p4', label: 'part 4' },
      ],
      [
        { id: 'num', label: 'number' },
        { id: 'tag', label: 'part tag' },
        { id: 'check', label: 'check' },
      ],
      [
        ['1', 'etag A', 'sha A'],
        ['2', 'etag B2', 'sha B'],
        ['3', 'etag C', 'sha C'],
        ['4', 'etag D', 'sha D'],
      ],
    ),
    highlight: { active: ['p2:tag', 'p2:check'], found: ['p1:num', 'p3:num', 'p4:num'] },
    explanation: 'The manifest-like complete request identifies each part by number and part tag, with checksum fields when used. Retried part 2 contributes its newest accepted record.',
  };

  yield {
    state: lifecycleGraph('Complete or abort closes the upload state'),
    highlight: { active: ['parts', 'complete', 'object', 'e-parts-complete', 'e-complete-object'], compare: ['abort'] },
    explanation: 'After completion, clients read one object through normal S3 GET and HEAD APIs. If the upload should not finish, aborting is the cleanup path for temporary parts.',
  };

  yield {
    state: labelMatrix(
      'Cleanup states',
      [
        { id: 'open', label: 'open' },
        { id: 'done', label: 'complete' },
        { id: 'abort', label: 'abort' },
        { id: 'stale', label: 'stale' },
      ],
      [
        { id: 'parts', label: 'parts' },
        { id: 'cost', label: 'cost risk' },
      ],
      [
        ['temporary', 'storage billed'],
        ['assembled', 'normal object'],
        ['removed', 'cleanup'],
        ['linger', 'orphan cost'],
      ],
    ),
    highlight: { active: ['open:cost', 'stale:cost'], found: ['abort:cost'] },
    explanation: 'The hidden cost is abandoned upload state. Production buckets often use lifecycle rules to expire incomplete multipart uploads after a policy-defined age.',
  };

  yield {
    state: labelMatrix(
      'When multipart helps',
      [
        { id: 'large', label: 'large file' },
        { id: 'flaky', label: 'flaky net' },
        { id: 'browser', label: 'browser' },
        { id: 'small', label: 'small file' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'caution', label: 'caution' },
      ],
      [
        ['parallelism', 'part sizing'],
        ['retry parts', 'resume state'],
        ['direct upload', 'scoped auth'],
        ['little gain', 'overhead'],
      ],
    ),
    highlight: { active: ['large:benefit', 'flaky:benefit'], compare: ['small:caution'] },
    explanation: 'Multipart upload is a state machine. Use it when parallelism, resumability, or object size justifies the extra manifest, checksum, abort, and lifecycle handling.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'parts and checksums') yield* partsAndChecksums();
  else if (view === 'complete upload') yield* completeUpload();
  else throw new InputError('Pick an S3 multipart upload view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a temporary manifest for one large object. A manifest is a record that says which parts exist, what order they occupy, and which metadata must be sent when the object is committed.',
        'The active part is being uploaded, retried, or committed. Part numbers define final object order; upload completion time does not.',
        {type:'callout', text:'Multipart upload makes retry scope, ordering, integrity, and commit state explicit for one large object.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A large object upload is too fragile as one request. If an 80 GB file fails at byte 78 GB, restarting from byte zero wastes network time, compute time, and user patience.',
        'S3 multipart upload exists to make large transfer resumable and parallel. The client uploads numbered parts under one upload ID, then asks S3 to assemble those parts into one object.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is one PUT request for the whole object. It is simple, has one checksum story, and works well for small files.',
        'For large files, the one-request model has a bad failure boundary. A transient network error invalidates all prior progress, and the sender cannot use multiple connections to fill available bandwidth.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is retry scope. Large uploads cross many failure domains: browser tab lifetime, mobile network changes, credential expiration, worker crashes, throttling, and regional network events.',
        'A second wall is commit correctness. Parts can arrive in any order, but the final object must be one ordered byte stream, so the system needs a precise list of accepted parts at completion time.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Multipart upload separates transfer from commit. UploadPart stores temporary part state under an upload ID, while CompleteMultipartUpload is the commit operation that chooses the ordered part list.',
        'That makes each part independently retryable. A failed part 17 can be resent without touching accepted parts 1 through 16 or parts 18 through 200.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The client initiates an upload and receives an upload ID. It chooses a part size, uploads part numbers independently, stores each accepted part number with its ETag or checksum metadata, and retries failed parts.',
        'When all required parts are accepted, the client sends the ordered manifest in the complete request. If the job is canceled or abandoned, abort removes temporary parts, and lifecycle rules can clean up uploads that no client finishes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from using part number as the order key. If part 9 finishes before part 4, the final object still places part 4 before part 9 because completion concatenates by ascending part number.',
        'The manifest prevents uncontrolled append. Completion names the exact accepted part metadata, so retrying a part can replace that part without changing the final order of the object.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Multipart upload adds request cost, temporary storage cost, client state, and cleanup responsibility. For a 100 GB upload split into 1,000 parts of 100 MB, the process uses one initiate request, 1,000 upload-part requests, and one complete request before retries.',
        'Part size controls behavior. Small parts reduce retry waste but increase request count and manifest size; large parts reduce request overhead but make every failed retry expensive.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Multipart upload fits backups, media files, browser direct uploads, data lake exports, machine-learning datasets, database snapshots, and warehouse unloads. These workloads have objects large enough that retrying a slice is cheaper than retrying the whole object.',
        'It also supports parallelism. A client with enough bandwidth can upload several parts at once, then commit the object after every required part has reached S3.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It is unnecessary overhead for small files. A 2 MB object does not need upload IDs, part records, abort logic, and lifecycle cleanup.',
        'It also fails when clients lose state. If the upload ID or accepted part list exists only in process memory, a crash can leave temporary parts billed until lifecycle cleanup deletes them.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A service uploads an 80 GB video with 64 MB parts, which produces 1,280 parts. If part 733 fails after 45 MB, the retry resends only that 64 MB part instead of the whole 80 GB object.',
        'With concurrency 16, the client keeps 16 parts in flight and records each accepted part number plus returned metadata. Completion sends the 1,280 ordered records; if the client sorted by finish time instead of part number, the assembled video would be corrupt even though every part uploaded.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: AWS multipart upload overview at https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html, UploadPart API at https://docs.aws.amazon.com/AmazonS3/latest/API/API_UploadPart.html, and abort-incomplete lifecycle guidance at https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpu-abort-incomplete-mpu-lifecycle-config.html. Study S3 object storage, checksums, idempotency keys, content-defined chunking, and transaction commit protocols next.',
      ],
    },
  ],
};
