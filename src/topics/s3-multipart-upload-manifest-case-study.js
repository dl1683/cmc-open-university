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
      heading: 'Why this exists',
      paragraphs: [
        'S3 multipart upload exists because large object uploads are too expensive to treat as one fragile request. A single network failure should not force an 80 GB file to restart from byte zero.',
        'The practical problem is resumable, parallel, verifiable upload with a clear commit point. Parts may arrive in any order, but the final object must have one ordered shape.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is one PUT request for the whole object. That is simple for small files and has one response to interpret.',
        'The wall is failure scope. For large files, a timeout near the end wastes all prior transfer. One large request also limits parallelism and makes integrity reporting less granular.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The data structure is a temporary manifest keyed by upload ID. Each part record has a part number, server-side part tag, optional checksum information, size, and state.',
        'Completion is the commit operation. The client submits the ordered part list, and S3 assembles one visible object from those accepted parts.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `In the parts-and-checksums view, read each part as an independently retryable record under one upload ID. Part 2 can fail and be resent while parts 1, 3, and 4 remain accepted. Part numbers, not arrival order, define the eventual object order.`,
        `In the complete-upload view, the manifest is the commit record. Until completion, the uploaded parts are temporary state. Completion chooses the accepted parts to assemble; abort deletes the temporary state. The lifecycle rule is the operational backstop for clients that disappear before cleaning up.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The client creates a multipart upload, receives an upload ID, uploads numbered parts independently, retries failed parts, and tracks accepted part metadata. Parts are temporary until complete or abort.',
        'CompleteMultipartUpload provides the manifest. AbortMultipartUpload removes temporary state. Lifecycle rules can expire incomplete uploads that clients abandoned.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because part number, not arrival order, defines final object order. A failed part can be retried without disturbing accepted parts, and the complete request chooses which accepted parts become the object.',
        'The commit point is explicit. Before completion, clients do not read the final object. After completion, normal GET and HEAD see one assembled object.',
        'The manifest also makes retries safe. Retrying part 2 replaces or supersedes the failed attempt for that part number; the final complete request names the accepted part metadata that should be used. That is the difference between parallel upload and uncontrolled append.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Multipart upload adds state. Clients must choose part size, persist upload IDs, track retry state, validate checksums, complete once, and abort abandoned uploads. Small objects usually do not need this machinery.',
        'ETag handling is a common pitfall. For multipart and encrypted objects, the ETag should not be assumed to be the plain MD5 digest of the entire object. Use checksum features for the integrity contract you need.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Multipart upload wins for large objects, flaky networks, browser direct uploads, warehouse exports, media files, backups, and any upload where parallelism or retrying individual pieces matters.',
        'It is strongest when the client can persist upload state and clean up abandoned attempts.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails as unnecessary overhead for small files. It also fails operationally when clients leak incomplete uploads, lose upload IDs, pick poor part sizes, or treat ETags as universal checksums.',
        'Multipart is not a multi-object transaction. It commits one object assembled from parts, not a set of objects or metadata updates.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'Persist the upload ID and accepted part records outside the uploading process. If a worker crashes, another worker should be able to resume or abort from the manifest. Treat the manifest as job state, not as local memory.',
        'Choose part size with both S3 limits and retry economics in mind. Very small parts increase request overhead and can hit part-count limits. Very large parts make each retry expensive. The right size depends on object size, network reliability, concurrency, and memory budget.',
        'Always have an abort path and a lifecycle cleanup rule for incomplete uploads. Without cleanup, abandoned temporary parts can become invisible storage cost.',
      ],
    },
    {
      heading: 'Rule of thumb',
      paragraphs: [
        'Use multipart upload when retry scope and parallelism matter. Do not use it merely because an SDK exposes it. Small files are often better as one PUT because the operational state is simpler.',
        'The manifest is the truth. A completed object is assembled from the part numbers and tags in the complete request, so correctness depends on tracking that list accurately.',
      ],
    },
    {
      heading: 'Worked failure case',
      paragraphs: [
        'A browser uploads a 20 GB video in 100 MB parts. The tab crashes after part 127. If the upload ID and accepted part list only lived in memory, the client cannot resume cleanly. It may leak temporary parts until lifecycle cleanup removes them.',
        'A better client persists the upload ID, part size, completed part numbers, ETags or checksums, and object key. On restart, it can list or reuse accepted parts, retry the missing range, and send one complete request with the ordered manifest.',
      ],
    },
    {
      heading: 'What to watch in production',
      paragraphs: [
        'Track incomplete upload age, abandoned upload bytes, retry counts by part, checksum failures, complete failures, and abort failures. These metrics catch the hidden cost of partially successful uploads.',
        'Be careful with client-side concurrency. More parallel parts can improve throughput, but they also increase memory, open connections, retry storms, and pressure on upstream bandwidth. The best concurrency limit is a measured policy, not a hardcoded maximum.',
      ],
    },
    {
      heading: 'Integrity and ordering details',
      paragraphs: [
        'Part numbers define object order, not upload completion time. If part 9 finishes before part 4, the final manifest still places part 4 before part 9. A client that sorts by finish time can corrupt the assembled object even though every individual part uploaded successfully.',
        'Checksums should be explicit. Multipart ETags have historically confused teams because they are not always the simple MD5 of the full object, especially with multipart uploads and encryption. Use the checksum fields and verification mode that match the integrity promise your system needs.',
        'Completion should be idempotent at the job level. Record whether completion was requested, what manifest was sent, and what object version or response came back. A retry after a network timeout should not invent a different manifest.',
      ],
    },
    {
      heading: 'Design checklist',
      paragraphs: [
        'Before shipping multipart upload, decide part size, concurrency limit, retry budget, manifest persistence, checksum policy, abort policy, and lifecycle cleanup. Those are not SDK details; they are the reliability contract for large-object transfer.',
        'Also decide how downstream readers learn that the object is complete. Many pipelines write a separate success marker, manifest table row, or transactional catalog update after completion so consumers do not race against in-progress uploads.',
        'For browser and mobile clients, add credential lifetime and network-change behavior to the checklist. A resumable upload that outlives its presigned URLs or authentication session needs a refresh path, not just retry loops.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A warehouse exports an 80 GB Parquet file to S3. The uploader initiates multipart upload, chooses a part size, and uploads parts concurrently. Part 2 fails due to a network timeout, so the client retries only part 2. Each accepted part returns metadata and checksum information.',
        'The client tracks accepted parts, sends CompleteMultipartUpload with part numbers and tags, and downstream engines read one object. If the job is cancelled before completion, the uploader aborts the upload; a lifecycle rule is the safety net for abandoned uploads.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: AWS multipart upload overview at https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html, UploadPart API at https://docs.aws.amazon.com/AmazonS3/latest/API/API_UploadPart.html, multipart checksum tutorial at https://docs.aws.amazon.com/AmazonS3/latest/userguide/tutorial-s3-mpu-additional-checksums.html, and abort-incomplete multipart lifecycle guidance at https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpu-abort-incomplete-mpu-lifecycle-config.html. Study S3 Object Storage Case Study, Content-Defined Chunking & Dedup, Reed-Solomon Erasure Coding, Parquet Columnar Format Case Study, and Transactional Outbox next.',
      ],
    },
  ],
};
