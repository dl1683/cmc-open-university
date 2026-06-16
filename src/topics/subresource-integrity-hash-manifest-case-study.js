// Subresource Integrity as a browser-side digest check: integrity metadata,
// CORS mode, build manifests, hash selection, and block/report rollout.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'subresource-integrity-hash-manifest-case-study',
  title: 'Subresource Integrity Hash Manifest',
  category: 'Security',
  summary: 'How SRI lets browsers verify CDN scripts and styles with integrity hashes, CORS mode, build manifests, strict rollout, and failure handling.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['hash check', 'deployment policy'], defaultValue: 'hash check' },
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

function sriGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'build', label: 'build', x: 0.8, y: 4.7, note: notes.build ?? 'bundle' },
      { id: 'manifest', label: 'manifest', x: 2.6, y: 5.7, note: notes.manifest ?? 'hashes' },
      { id: 'html', label: 'HTML', x: 2.6, y: 3.5, note: notes.html ?? 'script tag' },
      { id: 'cdn', label: 'CDN', x: 4.8, y: 4.7, note: notes.cdn ?? 'asset bytes' },
      { id: 'cors', label: 'CORS', x: 6.6, y: 5.7, note: notes.cors ?? 'readable' },
      { id: 'digest', label: 'digest', x: 6.6, y: 3.5, note: notes.digest ?? 'sha384' },
      { id: 'browser', label: 'browser', x: 8.0, y: 4.7, note: notes.browser ?? 'compare' },
      { id: 'decision', label: 'result', x: 9.8, y: 4.7, note: notes.decision ?? 'load/block' },
    ],
    edges: [
      { id: 'e-build-manifest', from: 'build', to: 'manifest', weight: '' },
      { id: 'e-manifest-html', from: 'manifest', to: 'html', weight: 'integrity' },
      { id: 'e-html-cdn', from: 'html', to: 'cdn', weight: 'src' },
      { id: 'e-cdn-cors', from: 'cdn', to: 'cors', weight: '' },
      { id: 'e-cdn-digest', from: 'cdn', to: 'digest', weight: '' },
      { id: 'e-cors-browser', from: 'cors', to: 'browser', weight: '' },
      { id: 'e-digest-browser', from: 'digest', to: 'browser', weight: '' },
      { id: 'e-browser-decision', from: 'browser', to: 'decision', weight: '' },
    ],
  }, { title });
}

function* hashCheck() {
  yield {
    state: sriGraph('Build output creates integrity metadata'),
    highlight: { active: ['build', 'manifest', 'html', 'e-build-manifest', 'e-manifest-html'], found: ['cdn'] },
    explanation: 'Subresource Integrity starts before the browser. The build computes a cryptographic digest of the exact script or stylesheet bytes and writes that digest into the integrity attribute.',
    invariant: 'The hash names the expected bytes.',
  };

  yield {
    state: sriGraph('The browser fetches the subresource and needs CORS', { html: 'crossorigin', cors: 'ACAO ok', cdn: 'cdn.js' }),
    highlight: { active: ['html', 'cdn', 'cors', 'e-html-cdn', 'e-cdn-cors'], compare: ['digest'] },
    explanation: 'Cross-origin SRI requires the response to be CORS-readable. That is why CDN scripts with integrity usually include crossorigin="anonymous" and the CDN returns Access-Control-Allow-Origin.',
  };

  yield {
    state: sriGraph('Downloaded bytes are hashed before execution', { digest: 'actual hash', browser: 'compare', decision: 'not run yet' }),
    highlight: { active: ['cdn', 'digest', 'browser', 'e-cdn-digest', 'e-digest-browser'], compare: ['decision'] },
    explanation: 'Before executing a script or applying a stylesheet, the browser hashes the fetched bytes and compares the result against the integrity metadata from the tag.',
  };

  yield {
    state: sriGraph('A match loads; a mismatch becomes a network error', { digest: 'mismatch', browser: 'fail', decision: 'blocked' }),
    highlight: { removed: ['decision'], active: ['digest', 'browser', 'e-browser-decision'], compare: ['cdn'] },
    explanation: 'If no allowed hash matches, the browser refuses to load the resource. The page sees a load failure instead of executing bytes that differ from what the publisher declared.',
  };

  yield {
    state: labelMatrix(
      'Hash choices',
      [
        { id: 'sha256', label: 'sha256' },
        { id: 'sha384', label: 'sha384' },
        { id: 'sha512', label: 'sha512' },
        { id: 'multi', label: 'multi' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['allowed', 'weaker'],
        ['common', 'long attr'],
        ['strong', 'longer'],
        ['fallback', 'drift'],
      ],
    ),
    highlight: { found: ['sha384:role', 'sha512:role'], compare: ['multi:risk'] },
    explanation: 'SRI allows sha256, sha384, and sha512. When several strengths are present, browsers use the strongest available set, so the manifest must be generated deliberately.',
  };
}

function* deploymentPolicy() {
  yield {
    state: labelMatrix(
      'Asset plan',
      [
        { id: 'hashed', label: 'hash name' },
        { id: 'sri', label: 'SRI' },
        { id: 'cors', label: 'CORS' },
        { id: 'csp', label: 'CSP' },
      ],
      [
        { id: 'protects', label: 'protects' },
        { id: 'misses', label: 'misses' },
      ],
      [
        ['cache drift', 'CDN swap'],
        ['byte tamper', 'HTML tamper'],
        ['read check', 'wrong ACL'],
        ['script src', 'bad hash'],
      ],
    ),
    highlight: { found: ['hashed:protects', 'sri:protects', 'csp:protects'], compare: ['sri:misses'] },
    explanation: 'SRI is one layer. Hashed filenames protect cache identity, SRI protects fetched bytes, CORS makes the cross-origin response eligible for checking, and CSP controls which scripts are allowed to execute at all.',
    invariant: 'SRI verifies bytes; it does not decide whether the URL was trustworthy.',
  };

  yield {
    state: sriGraph('Report-only rollout finds missing metadata', { build: 'inventory', manifest: 'coverage', html: 'some tags', decision: 'reports' }),
    highlight: { active: ['build', 'manifest', 'html', 'decision', 'e-build-manifest', 'e-manifest-html'], compare: ['browser'] },
    explanation: 'A strict integrity policy can break pages if any required script or stylesheet lacks metadata. Report-only rollout discovers missing integrity before enforcing blocks.',
  };

  yield {
    state: sriGraph('CDN rewrite failure is caught at the browser', { cdn: 'changed bytes', digest: 'new hash', browser: 'no match', decision: 'blocked' }),
    highlight: { removed: ['decision'], active: ['cdn', 'digest', 'browser', 'e-cdn-digest', 'e-digest-browser'] },
    explanation: 'The complete case study is a CDN incident. If the CDN, proxy, or supply-chain step serves bytes that do not match the build manifest, SRI turns the silent mutation into an explicit load failure.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'asset', label: 'asset' },
        { id: 'html', label: 'HTML' },
        { id: 'cors', label: 'CORS' },
        { id: 'policy', label: 'policy' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['blocked', 'new hash'],
        ['bad tag', 'template'],
        ['network err', 'ACAO'],
        ['too strict', 'report first'],
      ],
    ),
    highlight: { found: ['asset:fix', 'cors:fix'], compare: ['policy:symptom'] },
    explanation: 'Operationally, most SRI failures are manifest drift, HTML template drift, CORS headers missing from the CDN, or policy enforcement before coverage is complete.',
  };

  yield {
    state: sriGraph('SRI links browser security to supply-chain provenance', { build: 'trusted build', manifest: 'digest list', html: 'release', decision: 'gate' }),
    highlight: { found: ['build', 'manifest', 'html', 'browser', 'decision'], active: ['e-manifest-html', 'e-browser-decision'] },
    explanation: 'The data-structure lesson is a small provenance graph: build artifact to digest manifest to HTML tag to fetched bytes to browser decision. Each edge must stay consistent.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'hash check') yield* hashCheck();
  else if (view === 'deployment policy') yield* deploymentPolicy();
  else throw new InputError('Pick an SRI view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Subresource Integrity lets a page declare the expected cryptographic hash of a script or stylesheet. The browser downloads the resource, computes a digest of the bytes, and refuses to execute or apply the resource if the digest does not match the integrity metadata.',
        'The data structure is a release manifest: asset URL to allowed digest values, plus HTML tags that carry those values into the browser. It turns a CDN or proxy byte change into a detectable load failure.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At build time, compute a sha256, sha384, or sha512 digest of the final bytes. At render time, put the digest in integrity on the script or stylesheet tag. For cross-origin resources, use CORS by adding crossorigin and serving an appropriate Access-Control-Allow-Origin header.',
        'At load time, the browser fetches the resource, selects the strongest hash set available in the attribute, hashes the response, and compares. A match loads. No match blocks.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A web app loads vendor.js from a CDN. The build produces vendor.abcd.js and a manifest entry with sha384. The HTML template writes script src, integrity, and crossorigin. The CDN serves CORS-readable bytes. If a misconfigured minifier, compromised edge, or stale upload changes the bytes, the browser blocks the script instead of executing the unexpected file.',
        'SRI pairs naturally with CSP Nonce & Hash Policy. CSP decides which sources and inline scripts are allowed. SRI verifies that an allowed external resource has the exact bytes the publisher expected.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'SRI does not protect a compromised HTML document that can replace both the URL and the hash. It does not decide whether a CDN is allowed by policy. It does not fix a missing CORS response. It only verifies that the fetched bytes match the declared hash.',
        'Do not generate integrity before the final minification, compression-independent content, or bundling step. The hash must match the actual resource bytes the browser checks.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Subresource Integrity at https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity, W3C Subresource Integrity at https://www.w3.org/TR/sri-2/, MDN SRI implementation guide at https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/SRI, and MDN CORS guide at https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS. Study CSP Nonce & Hash Policy, CORS Preflight Cache, HTTP Cache ETag Revalidation, Resource Hints: Preload & Preconnect, and Software Supply Chain Provenance Graph next.',
        'Cross-Origin Isolation: COOP, COEP & CORP is the next browser-resource policy layer: SRI verifies bytes, while COEP/CORP decide whether cross-origin resources are allowed into an isolated document at all.',
      ],
    },
  ],
};
