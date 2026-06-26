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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a provenance chain from build bytes to browser execution. A digest is a cryptographic hash of exact bytes, a manifest is the release record mapping assets to digests, and Subresource Integrity is the browser check that compares declared and fetched bytes. Active nodes show where trust is being carried forward.',
        'Visited nodes are steps already bound to a specific artifact. Removed decisions show a blocked load after a mismatch. The safe inference is that the browser should not execute a script or apply a stylesheet unless one declared integrity hash matches the bytes it received.',
        {type:'callout', text:`SRI makes release bytes addressable by digest so the browser can block silent asset mutation before execution.`},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/2/2b/Cryptographic_Hash_Function.svg', alt:'Several text inputs passing through a cryptographic hash function to produce very different digests.', caption:'SHA-1 avalanche-effect diagram; Jorge Stolfi based on work by Helix84, public domain, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Web pages often load scripts and styles from CDNs, package mirrors, analytics vendors, and shared asset hosts. HTTPS protects the connection to a host, but it does not prove that the host served the same bytes the publisher built. A compromised edge, stale upload, or transform can change code after release.',
        'Subresource Integrity exists so the HTML can declare expected bytes. The browser fetches the resource, hashes the response body, compares it with the integrity attribute, and blocks execution or application on mismatch. The check happens before the changed code can run.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to trust the URL and TLS. A filename like app.8f3a.js looks stable, and the CDN may be operationally trusted. Those layers help, but they do not detect every wrong-body-at-right-URL failure.',
        'Another obvious approach is to paste hashes manually. That fails because the hash must match final bytes exactly. A minifier change, banner insertion, compression transform, line-ending change, or stale template can make the attribute wrong.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that resource identity and resource location are different. A URL tells the browser where to ask. A digest tells the browser which bytes are acceptable. If deployment treats those as the same, silent mutation can become script execution.',
        'Cross-origin loading adds another wall. For cross-origin SRI, the response must be CORS-readable under the tag mode. A correct hash with missing CORS headers can still fail because the browser cannot perform the integrity check in the required security mode.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Bind HTML tags to build artifacts by digest. The release pipeline computes sha256, sha384, or sha512 over final emitted bytes and writes the result to a manifest. The HTML renderer reads that manifest and emits integrity metadata for each script or stylesheet.',
        'The invariant is simple: the declared hash names the only acceptable bytes for that tag. If the fetched body differs, the browser treats the resource as a load failure. SRI verifies bytes; it does not decide whether the URL should have been trusted in the first place.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The HTML parser discovers a script or link tag with an integrity attribute. The browser fetches the resource using the element CORS mode, often crossorigin="anonymous" for CDN assets without credentials. The CDN must return headers that make the response eligible for checking.',
        'Before executing a script or applying a stylesheet, the browser hashes the fetched bytes. If any allowed digest of the strongest supported set matches, loading continues. If none match, the resource is blocked and the page observes a load failure.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Cryptographic hash functions are designed so that a small input change produces an unpredictable digest change. Given a strong digest recorded from the intended artifact, serving altered bytes that still match is computationally infeasible under normal assumptions. The browser sees the final response body, so it is the right place for the last comparison.',
        'Correctness depends on protecting the HTML and manifest path. If an attacker can change both the script URL and the integrity value in the HTML, SRI cannot help. The guarantee is byte integrity for subresources referenced by a trusted document.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Runtime hashing costs CPU proportional to resource size, but scripts and styles already cost network, parse, and execution time. The larger cost is release discipline. Every protected asset needs stable final bytes, a manifest entry, matching HTML, correct CORS headers, and retention of old assets for cached pages.',
        'Strict rollout can break production if coverage is incomplete. Report-only policy, staging checks, manifest validation, and CDN byte comparison reduce that risk. When asset count doubles, the manifest and template coverage surface doubles too.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SRI fits stable scripts and styles served from CDNs or vendors, shared framework bundles, analytics libraries, and assets whose host is separate from the HTML host. The page owner knows the expected bytes and wants the browser to reject different bytes.',
        'It is also useful for supply-chain incident response. If an edge serves vendor.js with digest H2 while the release manifest declares H1, the browser blocks the file. The failure points to artifact provenance instead of becoming a mysterious runtime behavior change.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails if the trusted HTML is compromised because the attacker can update the integrity attribute. It does not prove code is safe, prevent malicious behavior in a valid file, or replace Content Security Policy. It also does not protect resources that do not carry integrity metadata.',
        'Operationally, it fails through stale manifests, CDN transforms after hashing, missing crossorigin attributes, missing Access-Control-Allow-Origin headers, and strict enforcement before all required tags are covered. Debugging must compare served bytes, manifest digest, HTML attribute, and response headers.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A build emits app.js with 200,000 bytes and computes a sha384 digest. The manifest maps app.js to sha384-AbCd..., and the HTML renderer emits script src="https://cdn.example/app.js" integrity="sha384-AbCd..." crossorigin="anonymous". The browser fetches the CDN response and hashes exactly the received body.',
        'If the CDN serves the same 200,000 bytes, the digest matches and execution proceeds. If a proxy injects a 40-byte banner, the body length and hash change, so no allowed digest matches. The browser blocks the script before any injected byte executes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources start with MDN Subresource Integrity at https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity. Then read the W3C SRI specification at https://www.w3.org/TR/SRI/ and MDN Content Security Policy at https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP.',
        'Study Content Security Policy Nonce and Hash Policy for script source control and CORS for cross-origin response eligibility. Then use HTTP Cache ETag Revalidation, Software Supply Chain Provenance Graph, and Transparency Logs to place SRI inside a larger release system.',
      ],
    },
  ],
};
