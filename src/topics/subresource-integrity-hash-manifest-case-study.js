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
      heading: 'Why this exists',
      paragraphs: [
        `Web pages often load scripts and styles from build output, CDNs, package mirrors, analytics vendors, and third-party widgets. If those bytes change unexpectedly, the browser may run code the site owner did not intend to ship. HTTPS protects the connection to the host, but it does not prove that the host served the same artifact the release pipeline produced.`,
        `Subresource Integrity exists to let the page declare the expected digest of a script or stylesheet. The browser downloads the resource, hashes the actual bytes, compares the result with the integrity metadata, and only then executes the script or applies the stylesheet. The decision happens inside the browser before the resource is trusted.`,
        {type:'callout', text:`SRI makes release bytes addressable by digest so the browser can block silent asset mutation before execution.`},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/2/2b/Cryptographic_Hash_Function.svg', alt:'Several text inputs passing through a cryptographic hash function to produce very different digests.', caption:'SHA-1 avalanche-effect diagram; Jorge Stolfi based on work by Helix84, public domain, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious approach is to trust HTTPS, cache-busting filenames, and the CDN. A file named app.8f3a.js looks content-addressed, and a TLS connection to the CDN looks secure. Those layers help, but they do not catch every supply-chain or deployment mistake. The wrong bytes can still be uploaded to the right path, rewritten by a proxy, or served by a compromised edge after the HTML was generated.`,
        `Another tempting approach is to treat integrity attributes as hand-written markup. That fails because the hash must match the final emitted bytes exactly. A small minifier change, line-ending change, banner insertion, or CDN transform can change the digest. Integrity metadata belongs in the build and release manifest, not in a developer's memory.`,
      ],
    },
    {
      heading: 'Naive failure modes',
      paragraphs: [
        `Hashed filenames and SRI solve different problems. A hashed filename helps caches distinguish versions. SRI verifies the bytes fetched for a particular tag. If the HTML points to a trusted URL but the response body changed, the filename alone may not save you. If the HTML itself is compromised and the attacker can change both URL and hash, SRI cannot save you either.`,
        `CORS is another place naive deployments fail. Cross-origin SRI needs the browser to be allowed to read the response for integrity checking. A tag may have the right integrity value but still fail because the CDN does not return the expected Access-Control-Allow-Origin header or because the crossorigin mode is missing or wrong.`,
      ],
    },
    {
      heading: 'Core model',
      paragraphs: [
        `The data structure is a release manifest: asset URL or logical asset id to one or more allowed digest values. At build time, after bundling and minification produce final files, the pipeline computes a sha256, sha384, or sha512 digest. At render time, the HTML tag includes that digest in the integrity attribute.`,
        `The invariant is simple: the hash names the expected bytes. If the browser fetches different bytes, the hash comparison fails. A matching script loads. A mismatching script is treated as a load failure instead of being executed. That turns silent mutation into an explicit block.`,
      ],
    },
    {
      heading: 'How the browser check works',
      paragraphs: [
        `The HTML parser discovers a script or stylesheet tag with src or href plus integrity metadata. The browser fetches the resource using the tag's CORS mode. For cross-origin resources, crossorigin="anonymous" is common because it asks for a CORS-readable response without credentials. The CDN must return headers that make the response eligible.`,
        `Before execution or application, the browser hashes the fetched bytes and compares the digest with the allowed values on the tag. If more than one hash strength is present, browsers use the strongest supported candidates. If none match, the browser refuses the resource. From the page's point of view, it looks like a network load failure.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The hash-check view proves the provenance chain: build artifact to manifest, manifest to HTML tag, HTML tag to CDN fetch, CDN bytes to browser digest, browser digest to load-or-block decision. The important security moment is after download but before execution. The browser is not trusting the CDN response merely because it arrived.`,
        `The deployment-policy view proves that SRI is one layer in a larger resource policy. Hashed filenames protect cache identity. SRI verifies fetched bytes. CORS makes the cross-origin bytes visible enough for checking. Content Security Policy decides which script sources are allowed at all. These layers overlap, but they are not substitutes for one another.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Cryptographic hashes are designed so that changing the input bytes changes the digest unpredictably. If the release pipeline recorded the digest of the intended file, an attacker or broken deployment step cannot serve altered bytes that still match without finding a practical hash collision. Using sha384 or sha512 leaves a comfortable security margin for modern browsers.`,
        `The browser is the right place for the final check because it sees the actual bytes that would execute. A build system can record intent, and a CDN can promise delivery, but only the browser can compare the declared digest with the exact response body it received for that page load.`,
      ],
    },
    {
      heading: 'Build manifest design',
      paragraphs: [
        `A practical SRI deployment treats the manifest as release evidence. Each emitted asset gets a digest computed from final bytes. The template or server-side renderer reads that manifest and writes the integrity attribute into script and link tags. The HTML should not invent hashes independently, and engineers should not paste digests by hand during normal releases.`,
        `The manifest also needs consistency rules. If filenames are content-hashed, the digest should agree with the same artifact. If a CDN upload rewrites files, the digest must be computed after the rewrite or the rewrite must be disabled. If a release can serve old HTML with new assets, retention and cache rules must keep old digest-to-byte pairs available long enough for users with cached pages.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `The runtime cost is usually small: hashing happens during resource loading, and large scripts are already expensive to download and parse. The operational cost is higher. Every script and stylesheet that needs integrity must have stable final bytes, a correct manifest entry, matching HTML, and compatible CORS headers.`,
        `Strict enforcement can break pages. If one required script lacks integrity, has a stale digest, or is served with bad CORS headers, the browser blocks it. That is exactly the safety behavior, but users experience it as a broken application. Report-only rollout, staging checks, and release gates reduce the chance that the first strict deployment discovers missing coverage in production.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `SRI wins for stable external scripts and styles where the publisher knows the expected bytes. Vendor bundles on a CDN, framework files, analytics libraries, font stylesheets, and shared assets across many pages are natural targets. It is especially useful when the asset host is operationally separate from the HTML host.`,
        `A concrete incident pattern is a CDN rewrite or stale upload. The HTML says vendor.js should have digest H, but an edge serves bytes with digest H2. Without SRI, the browser may execute the changed file and the incident becomes a behavioral mystery. With SRI, the browser blocks the file and the failure points directly at asset provenance.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `SRI does not protect a compromised HTML document that can change the integrity value. It does not decide whether a URL is allowed. It does not prove that the code is safe, only that the bytes match the publisher-declared digest. It also does not fix runtime attacks after a valid script starts executing.`,
        `The common deployment failures are stale manifests, templates that omit integrity on some tags, CDN transformations after hashing, missing CORS headers, mixed credential modes, and strict policy before coverage is complete. Debugging should compare the final served bytes, the manifest digest, the HTML attribute, and the response headers rather than guessing from the console error alone.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study CSP Nonce & Hash Policy to understand source allowlists, nonces, and inline-script hashing. Study CORS Preflight Cache for the cross-origin rules that make browser reads safe. HTTP Cache ETag Revalidation explains a nearby validation mechanism for freshness, while Resource Hints: Preload & Preconnect shows how resource loading is optimized without changing trust.`,
        `For the supply-chain side, study Software Supply Chain Provenance Graph, Transparency Log Witnessing Case Study, Merkle Tree, Package Lockfile Dependency Resolution, and Sigstore Fulcio Rekor Case Study. SRI is a browser-side byte check; those topics show how artifacts can be built, signed, logged, resolved, and audited before the browser ever asks for them.`,
      ],
    },
  ],
};
