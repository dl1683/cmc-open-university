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
      heading: 'What it is',
      paragraphs: [
        'S3 multipart upload is the large-object upload protocol for splitting one object upload into numbered parts. The client initiates an upload, receives an upload ID, uploads parts independently, and then completes the upload by naming the parts to assemble.',
        'The data-structure view is a temporary manifest keyed by upload ID. Each part record has a part number, server-side part tag, optional checksum information, size, and state. Completion turns that temporary manifest into one object.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'After CreateMultipartUpload, the client can call UploadPart for part 1, part 2, and so on. Parts can be uploaded in parallel and retried independently. If one transfer fails, that part can be resent without disturbing accepted parts.',
        'CompleteMultipartUpload is the commit operation. The request provides the ordered part list. S3 assembles the object in part-number order and exposes it as a normal object. AbortMultipartUpload is the cleanup operation for upload state that should not become an object.',
      ],
    },
    {
      heading: 'Complete case study: 80 GB Parquet export',
      paragraphs: [
        'A warehouse exports an 80 GB Parquet file to S3. The uploader initiates multipart upload, chooses a part size, and uploads parts concurrently. Part 2 fails due to a network timeout, so the client retries only part 2. Each accepted part returns metadata and checksum information.',
        'The client lists or tracks accepted parts, sends CompleteMultipartUpload with part numbers and tags, and then downstream engines read one object. If the job is cancelled before completion, the uploader aborts the upload; a lifecycle rule is the safety net for abandoned uploads.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Multipart upload improves throughput and failure recovery for large objects, but it adds state. Clients must choose part sizes, track upload IDs, persist retry state, validate checksums, complete exactly once, and abort abandoned uploads. Small objects usually do not need this machinery.',
        'ETag handling is a common pitfall. For multipart and encrypted objects, the ETag should not be assumed to be the plain MD5 digest of the entire object. Use the checksum features and object metadata appropriate for the integrity contract you need.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: AWS multipart upload overview at https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html, UploadPart API at https://docs.aws.amazon.com/AmazonS3/latest/API/API_UploadPart.html, multipart checksum tutorial at https://docs.aws.amazon.com/AmazonS3/latest/userguide/tutorial-s3-mpu-additional-checksums.html, and abort-incomplete multipart lifecycle guidance at https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpu-abort-incomplete-mpu-lifecycle-config.html. Study S3 Object Storage Case Study, Content-Defined Chunking & Dedup, Reed-Solomon Erasure Coding, Parquet Columnar Format Case Study, and Transactional Outbox next.',
      ],
    },
  ],
};
