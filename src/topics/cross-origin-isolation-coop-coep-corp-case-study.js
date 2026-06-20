// Cross-origin isolation: COOP separates browsing context groups, COEP requires
// explicit resource opt-in, and CORP/CORS make subresource embedding auditable.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'cross-origin-isolation-coop-coep-corp-case-study',
  title: 'Cross-Origin Isolation: COOP, COEP & CORP',
  category: 'Security',
  summary: 'How COOP, COEP, CORS, CORP, credentialless loading, opener isolation, subresource audits, workers, and SharedArrayBuffer gating fit together.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['header triad', 'resource audit'], defaultValue: 'header triad' },
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

function isolationGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'doc', label: 'doc', x: 0.5, y: 4.1, note: notes.doc ?? 'app page' },
      { id: 'coop', label: 'COOP', x: 2.2, y: 5.6, note: notes.coop ?? 'opener' },
      { id: 'coep', label: 'COEP', x: 2.2, y: 2.7, note: notes.coep ?? 'embedder' },
      { id: 'bcg', label: 'BCG', x: 4.5, y: 5.6, note: notes.bcg ?? 'isolated' },
      { id: 'subres', label: 'assets', x: 4.5, y: 2.7, note: notes.subres ?? 'scripts/img' },
      { id: 'corp', label: 'CORP', x: 6.4, y: 2.0, note: notes.corp ?? 'same-site' },
      { id: 'cors', label: 'CORS', x: 6.4, y: 3.4, note: notes.cors ?? 'explicit' },
      { id: 'worker', label: 'worker', x: 8.0, y: 4.1, note: notes.worker ?? 'module' },
      { id: 'sab', label: 'SAB', x: 9.4, y: 4.1, note: notes.sab ?? 'allowed?' },
    ],
    edges: [
      { id: 'e-doc-coop', from: 'doc', to: 'coop', weight: '' },
      { id: 'e-doc-coep', from: 'doc', to: 'coep', weight: '' },
      { id: 'e-coop-bcg', from: 'coop', to: 'bcg', weight: '' },
      { id: 'e-coep-subres', from: 'coep', to: 'subres', weight: '' },
      { id: 'e-subres-corp', from: 'subres', to: 'corp', weight: '' },
      { id: 'e-subres-cors', from: 'subres', to: 'cors', weight: '' },
      { id: 'e-bcg-worker', from: 'bcg', to: 'worker', weight: '' },
      { id: 'e-cors-worker', from: 'cors', to: 'worker', weight: '' },
      { id: 'e-worker-sab', from: 'worker', to: 'sab', weight: '' },
    ],
  }, { title });
}

function* headerTriad() {
  yield {
    state: isolationGraph('Cross-origin isolation is a document state, not one header', { sab: 'locked' }),
    highlight: { active: ['doc', 'coop', 'coep', 'e-doc-coop', 'e-doc-coep'], compare: ['sab'] },
    explanation: 'A page becomes cross-origin isolated only when the opener relationship and embedded resources satisfy the isolation rules. COOP and COEP work together.',
    invariant: 'SharedArrayBuffer availability depends on the resulting crossOriginIsolated state.',
  };

  yield {
    state: isolationGraph('COOP moves the page into the right browsing context group', { coop: 'same-origin', bcg: 'new group' }),
    highlight: { active: ['doc', 'coop', 'bcg', 'e-doc-coop', 'e-coop-bcg'], removed: ['sab'] },
    explanation: 'Cross-Origin-Opener-Policy controls whether the document shares a browsing context group with cross-origin opener or opened pages. That limits powerful opener relationships.',
  };

  yield {
    state: isolationGraph('COEP requires cross-origin resources to opt in', { coep: 'require', subres: 'checked' }),
    highlight: { active: ['doc', 'coep', 'subres', 'e-doc-coep', 'e-coep-subres'], compare: ['corp', 'cors'] },
    explanation: 'Cross-Origin-Embedder-Policy changes the loading contract. Cross-origin no-cors resources need an explicit grant, usually through CORP, CORS, or a credentialless mode.',
  };

  yield {
    state: labelMatrix(
      'Header roles',
      [
        { id: 'coop', label: 'COOP' },
        { id: 'coep', label: 'COEP' },
        { id: 'corp', label: 'CORP' },
        { id: 'cors', label: 'CORS' },
      ],
      [
        { id: 'controls', label: 'controls' },
        { id: 'mistake' },
      ],
      [
        ['opener', 'asset gate'],
        ['embed rules', 'opener'],
        ['resource says', 'page state'],
        ['read grant', 'all embeds'],
      ],
    ),
    highlight: { active: ['coop:controls', 'coep:controls', 'corp:controls', 'cors:controls'], compare: ['corp:mistake'] },
    explanation: 'COOP, COEP, CORP, and CORS are easy to mix up because they all sit near cross-origin policy. The data structure to remember is a two-sided contract: the page opts into isolation, and each resource opts into being embedded or fetched.',
  };

  yield {
    state: isolationGraph('When the audit passes, workers can share memory safely', { worker: 'isolated', sab: 'enabled' }),
    highlight: { active: ['bcg', 'worker', 'sab', 'e-bcg-worker', 'e-worker-sab'], found: ['coop', 'coep', 'corp', 'cors'] },
    explanation: 'After the opener boundary and resource boundary both pass, APIs such as SharedArrayBuffer can be enabled for worker pipelines that need shared memory and Atomics.',
  };
}

function* resourceAudit() {
  yield {
    state: isolationGraph('Start with an inventory of everything the page embeds', { subres: 'inventory', sab: 'blocked' }),
    highlight: { active: ['doc', 'coep', 'subres', 'e-doc-coep', 'e-coep-subres'], compare: ['sab'] },
    explanation: 'The migration problem is a dependency graph. Every script, worker, image, font, WASM module, iframe, and analytics tag needs a path through CORS, CORP, same-origin hosting, or credentialless loading.',
    invariant: 'Isolation rollouts fail at the weakest embedded-resource edge.',
  };

  yield {
    state: labelMatrix(
      'Resource audit',
      [
        { id: 'app', label: 'app JS' },
        { id: 'wasm', label: 'WASM' },
        { id: 'cdn', label: 'CDN img' },
        { id: 'tag', label: 'tag' },
        { id: 'frame', label: 'iframe' },
      ],
      [
        { id: 'path' },
        { id: 'risk' },
      ],
      [
        ['same-origin', 'low'],
        ['CORS', 'headers'],
        ['CORP', 'no creds'],
        ['vendor', 'breakage'],
        ['isolate?', 'policy'],
      ],
    ),
    highlight: { active: ['app:path', 'wasm:path', 'cdn:path'], compare: ['tag:risk', 'frame:risk'] },
    explanation: 'Treat third-party tags and iframes as explicit dependencies. Some can move behind server-side proxies, some need vendor headers, and some are incompatible with strict isolation.',
  };

  yield {
    state: isolationGraph('A failing third-party script blocks the isolated state', { subres: 'vendor JS', corp: 'missing', cors: 'missing', sab: 'blocked' }),
    highlight: { active: ['subres', 'corp', 'cors', 'e-subres-corp', 'e-subres-cors'], removed: ['sab'] },
    explanation: 'COEP is intentionally strict. If a required cross-origin resource cannot prove it is safe to embed in the isolated page, the page should fail closed instead of silently enabling shared memory.',
  };

  yield {
    state: isolationGraph('Credentialless can load some no-cors resources without cookies', { coep: 'credentialless', subres: 'no-cors', corp: 'optional', cors: 'none', sab: 'maybe' }),
    highlight: { active: ['coep', 'subres', 'corp', 'cors'], compare: ['worker', 'sab'] },
    explanation: 'COEP credentialless is a compatibility path for some no-cors subresources. It trades away credentials on those requests, which can be safer than letting ambient cookies leak into every cross-origin asset load.',
  };

  yield {
    state: isolationGraph('The complete case study is a browser-based IDE with WASM workers', { doc: 'IDE', subres: 'WASM/CDN', worker: 'compiler', sab: 'enabled' }),
    highlight: { active: ['doc', 'coop', 'coep', 'bcg', 'subres', 'worker', 'sab'], found: ['corp', 'cors'] },
    explanation: 'A browser IDE wants a WASM compiler and a SharedArrayBuffer-backed worker pool. The team adds COOP and COEP, inventories CDN assets, moves incompatible tags out of the compiler page, and gates rollout on crossOriginIsolated.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'header triad') yield* headerTriad();
  else if (view === 'resource audit') yield* resourceAudit();
  else throw new InputError('Pick a cross-origin isolation view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The graph traces how a document reaches the `crossOriginIsolated` state. Each node is a header, policy check, or runtime capability. Each edge is a dependency that must pass before the next node activates.',
        {
          type: 'bullets',
          items: [
            'Active nodes are the header or resource being evaluated right now.',
            'Compare nodes are constraints not yet resolved -- the grant or path still missing.',
            'Found nodes are checks that passed: their contract is satisfied and cannot regress.',
            'Removed nodes are capabilities the browser withholds because a check failed.',
          ],
        },
        {
          type: 'note',
          text: 'The "header triad" view walks the three-header contract. The "resource audit" view walks a migration dependency graph. Both end at the same gate: crossOriginIsolated true or false.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Spectre-class CPU attacks proved that any process sharing an address space with cross-origin data can extract that data through timing side channels. SharedArrayBuffer and high-resolution timers make the attack practical from JavaScript. Browsers disabled SharedArrayBuffer entirely in January 2018, then brought it back only for pages that prove their cross-origin boundaries are explicit.',
        {
          type: 'quote',
          text: 'To be able to use SharedArrayBuffer, your document needs to be in a secure context. For top-level documents, two headers need to be set to cross-origin isolate your site.',
          attribution: 'MDN, "SharedArrayBuffer" documentation',
        },
        'Cross-origin isolation is the document state that proves those boundaries. It requires two cooperating checks: the page must sever implicit opener relationships with cross-origin windows (COOP), and every embedded cross-origin resource must explicitly consent to being used in this context (COEP). The browser grants powerful APIs only after both pass.',
        {
          type: 'table',
          headers: ['Capability', 'Without isolation', 'With isolation'],
          rows: [
            ['SharedArrayBuffer', 'Blocked', 'Available'],
            ['performance.now() precision', '100 us (coarsened)', '5 us or better'],
            ['Atomics.wait()', 'Blocked on main thread', 'Available in workers'],
            ['measureUserAgentSpecificMemory()', 'Blocked', 'Available'],
            ['window.opener to cross-origin', 'Available', 'Severed by COOP'],
          ],
        },
        {
          type: 'note',
          text: 'CSP restricts where resources load from. Cross-origin isolation asks a different question: has every loaded resource opted into being embedded by this isolated document? The two are complementary, not substitutes.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is two response headers on the app route:',
        {
          type: 'code',
          language: 'text',
          text: [
            '# Attempt: add both headers',
            'Cross-Origin-Opener-Policy: same-origin',
            'Cross-Origin-Embedder-Policy: require-corp',
          ].join('\n'),
          label: 'The standard header pair for strict isolation',
        },
        'This is not naive. COOP `same-origin` moves the page into its own browsing context group. COEP `require-corp` demands that every cross-origin resource carry explicit permission. On a small first-party page with same-origin scripts and a CORS font, those two headers are enough.',
        'The attempt breaks on the first uncontrolled dependency. A third-party analytics script, a CDN image without CORP, an ad iframe, or a payment popup that relies on `window.opener` -- any one of them blocks the isolated state for the entire document.',
        {
          type: 'bullets',
          items: [
            'Header-only rollout works when the route owns every resource and popup.',
            'Worker-only rollout fails because SharedArrayBuffer is gated by the embedding document, not the worker.',
            'CSP-only rollout fails because CSP controls allowed sources, not whether resources opted into an isolated embedder.',
            'CORS-only rollout fails because many browser embeds use no-cors mode unless the element explicitly opts into CORS.',
          ],
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Cross-origin isolation is all-or-nothing at the document boundary. One failing resource edge blocks the entire isolated state.',
        {
          type: 'diagram',
          text: [
            '  doc (COOP + COEP)',
            '   |',
            '   +-- app.js          same-origin   --> PASS',
            '   +-- compiler.wasm   same-origin   --> PASS',
            '   +-- fonts.gstatic   CORS headers  --> PASS',
            '   +-- cdn.images      CORP header   --> PASS',
            '   +-- analytics.js    no headers    --> BLOCK  <-- wall',
            '   +-- payment iframe  no headers    --> BLOCK',
            '   |',
            '   crossOriginIsolated = false',
          ].join('\n'),
          label: 'One missing header on one resource blocks isolation for the entire page',
        },
        'The invariant is conjunctive: isolation = COOP passes AND every resource edge passes COEP. There is no "mostly isolated." The browser evaluates a boolean, not a score.',
        {
          type: 'table',
          headers: ['Asset edge', 'Typical request mode', 'Passing path', 'Common failure'],
          rows: [
            ['Same-origin JS', 'same-origin', 'Served by isolated origin', 'Redirect to another origin'],
            ['CDN WASM binary', 'cors or no-cors', 'CORS + crossorigin attr, or CORP', 'COEP violation blocks worker SAB'],
            ['CDN image / font', 'no-cors', 'CORP: cross-origin, or credentialless', 'Resource blocked; visual breakage'],
            ['Analytics script', 'no-cors (vendor-controlled)', 'Vendor adds headers, or remove from route', 'Vendor cannot or will not set headers'],
            ['OAuth / payment popup', 'top-level navigation', 'Redesign to postMessage handoff', 'Opener channel severed by COOP'],
            ['Cross-origin iframe', 'nested browsing context', 'Frame satisfies compatible COEP', 'Frame blocked or isolation lost'],
          ],
        },
        {
          type: 'note',
          text: 'The wall is stricter than "does the page load?" A page can render correctly and still fail the isolation gate. The only reliable deployment test is the runtime boolean plus resource-level diagnostics.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Cross-origin isolation is a two-sided contract. The page declares it wants isolation (COOP + COEP). Each resource declares it consents to being embedded by an isolated page (CORS or CORP). The browser verifies both sides before granting capabilities.',
        {
          type: 'diagram',
          text: [
            '       PAGE SIDE                  RESOURCE SIDE',
            '  +---------------------+    +------------------------+',
            '  | COOP: same-origin   |    | CORS: Access-Control-  |',
            '  |  severs opener refs |    |  Allow-Origin (read    |',
            '  |                     |    |  grant for cors loads) |',
            '  | COEP: require-corp  |    |                        |',
            '  |  demands resource   |    | CORP: cross-origin     |',
            '  |  opt-in on every    |    |  (embed consent for    |',
            '  |  cross-origin load  |    |   no-cors loads)       |',
            '  +---------------------+    +------------------------+',
            '            |                           |',
            '            +---- both satisfied? ------+',
            '                        |',
            '               crossOriginIsolated = true',
          ].join('\n'),
          label: 'Isolation requires mutual consent: the page opts in, each resource opts in',
        },
        'CORP and CORS are not synonyms. CORS is a request/response protocol allowing cross-origin reads. CORP is a resource-side header telling browsers which origins may consume the response in no-cors contexts. COEP uses both declarations to decide whether an isolated document may embed each resource.',
        {
          type: 'note',
          text: 'The invariant is fail-closed: every privileged execution path must branch on the browser-observed isolated state, and every resource edge must have one declared reason it is allowed to load.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The browser evaluates two independent checks when loading a document with COOP and COEP headers.',
        {
          type: 'table',
          headers: ['Check', 'Header', 'Evaluates', 'Failure effect'],
          rows: [
            ['Opener', 'COOP', 'Is the opener same-origin?', 'Page moves to new browsing context group; window.opener nulled'],
            ['Embedder', 'COEP', 'Does every cross-origin subresource carry CORS or CORP?', 'Non-compliant resources are blocked from loading'],
          ],
        },
        'The opener check runs first. `COOP: same-origin` puts the document into a new browsing context group if its opener is cross-origin. This severs the bidirectional `window.opener` reference -- the page can no longer be scripted by a cross-origin window that opened it.',
        'The embedder check runs on every subresource load. For each cross-origin no-cors request, the browser looks for a `Cross-Origin-Resource-Policy` header on the response. For cross-origin cors requests, normal CORS validation applies. If any resource fails, it is blocked, and `crossOriginIsolated` stays false.',
        {
          type: 'code',
          language: 'text',
          text: [
            '# Response headers for a fully isolated page:',
            'Cross-Origin-Opener-Policy: same-origin',
            'Cross-Origin-Embedder-Policy: require-corp',
            '',
            '# Each cross-origin resource must include one of:',
            'Cross-Origin-Resource-Policy: cross-origin   # for no-cors loads',
            'Access-Control-Allow-Origin: https://app.example  # for cors loads',
          ].join('\n'),
          label: 'Minimal header set for the strict isolation path',
        },
        'There is also a compatibility path. `COEP: credentialless` loads cross-origin no-cors resources without sending cookies or client certificates. Resources that depend on ambient credentials break, but public CDN assets that simply lack CORP headers will load.',
        {
          type: 'table',
          headers: ['COEP value', 'Cross-origin no-cors behavior', 'Credentials sent', 'CORP required'],
          rows: [
            ['unsafe-none', 'Load normally', 'Yes', 'No'],
            ['require-corp', 'Blocked unless CORS or CORP', 'Yes', 'Yes'],
            ['credentialless', 'Load without credentials', 'No', 'No'],
          ],
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The security argument rests on one property: an isolated page has no opaque cross-origin data in its process.',
        {
          type: 'bullets',
          items: [
            'COOP ensures no cross-origin window shares a browsing context group, so no cross-origin data is accessible through opener references.',
            'COEP ensures every cross-origin resource explicitly opted in, so no opaque response body leaked through no-cors fetches.',
            'Together, the process contains only same-origin data and cross-origin data whose owners granted explicit access.',
          ],
        },
        'Because there is no secret cross-origin data to extract, Spectre-class timing attacks against the process cannot leak anything the attacker does not already have permission to read. This is why the browser re-enables SharedArrayBuffer: the precondition for the attack -- cohabitation with opaque cross-origin data -- has been eliminated.',
        {
          type: 'quote',
          text: 'The two headers complement each other: COOP protects your document from being accessed by other origins, while COEP prevents your document from accessing data from other origins that have not explicitly granted permission.',
          attribution: 'Eiji Kitamura and Domenic Denicola, "Making your website cross-origin isolated" (web.dev, 2021)',
        },
        {
          type: 'table',
          headers: ['Policy', 'Question it answers', 'What it does NOT answer'],
          rows: [
            ['COOP', 'Can this document share a browsing context group with its opener?', 'Whether scripts, images, fonts, or iframes are allowed to load'],
            ['COEP', 'Must cross-origin resources prove they can be embedded here?', 'Whether another window may keep an opener reference'],
            ['CORP', 'Is this no-cors response willing to be consumed by this document?', 'Whether JavaScript may read the response body via fetch'],
            ['CORS', 'Did the server allow this cross-origin read path?', 'Whether unrelated no-cors embeds are acceptable'],
          ],
        },
        'The policy is mechanical, not reputational. The browser does not judge whether a vendor is trustworthy. It checks whether the vendor set a header. This makes the guarantee auditable.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cross-origin isolation has zero runtime overhead. It is a policy check at document and resource load time. The complexity is entirely operational: finding every dependency, coordinating headers with third parties, and preventing future regressions.',
        {
          type: 'table',
          headers: ['Cost center', 'What grows', 'Mitigation'],
          rows: [
            ['Resource audit', 'Every script, worker, WASM, font, image, iframe, stylesheet, source map', 'Automated staging audit plus browser DevTools reports'],
            ['Vendor negotiation', 'Third-party resources whose headers you cannot set', 'Move off isolated route, proxy through same origin, or replace vendor'],
            ['Credential behavior', 'Resources depending on cookies or HTTP auth', 'Prefer CORS with explicit credentials; avoid credentialless for personalized assets'],
            ['Popup compatibility', 'OAuth, payment, chat, document-preview flows', 'Use non-isolated handoff route or postMessage redesign'],
            ['Regression risk', 'New vendor tags added after launch', 'CI check that fails when isolated pages lose crossOriginIsolated'],
          ],
        },
        'Cost scales with the number of cross-origin dependencies, not with traffic or data volume. A page with 3 same-origin scripts and 1 CORS font is trivial to isolate. A page with 40 vendor tags, 6 ad iframes, and a payment popup may be impossible without architectural changes.',
        {
          type: 'note',
          text: 'Popup flows are the most common surprise. OAuth redirect flows often rely on window.opener to pass tokens. COOP: same-origin severs that reference. The fix is usually postMessage with a known target origin, or a redirect-based flow that avoids opener.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A web IDE ships a Rust-to-WASM compiler. Single-threaded compilation takes 18 seconds on a large project. A shared-memory worker pool cuts it to 7 seconds by letting parser, type-checker, optimizer, and codegen workers coordinate through a shared work queue backed by SharedArrayBuffer.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Gate: only enable shared-memory workers if isolated',
            'if (globalThis.crossOriginIsolated) {',
            '  const shared = new SharedArrayBuffer(64 * 1024 * 1024);',
            '  worker.postMessage({ type: "compile", buffer: shared });',
            '} else {',
            '  const copy = new ArrayBuffer(64 * 1024 * 1024);',
            '  worker.postMessage({ type: "compile", buffer: copy }, [copy]);',
            '  console.warn("SAB unavailable -- check isolation headers");',
            '}',
          ].join('\n'),
          label: 'Production code gates on crossOriginIsolated, never assumes it',
        },
        'The team inventories every resource on the compiler route:',
        {
          type: 'table',
          headers: ['Resource', 'Origin', 'Current state', 'Migration path'],
          rows: [
            ['app.js', 'same-origin', 'Passes', 'None needed'],
            ['compiler.wasm', 'same-origin', 'Passes', 'None needed'],
            ['editor.css', 'same-origin', 'Passes', 'None needed'],
            ['Google Fonts', 'fonts.gstatic.com', 'CORS present', 'Already compatible'],
            ['CDN images', 'cdn.example.com', 'No CORP', 'Add CORP: cross-origin'],
            ['Analytics tag', 'analytics.vendor.com', 'No headers, opaque', 'Move off compiler page'],
            ['Payment iframe', 'pay.vendor.com', 'Uses window.opener', 'Redesign to postMessage'],
          ],
        },
        'The analytics vendor cannot add CORP. The team moves the tag to marketing pages that do not need isolation. The payment flow is redesigned to use postMessage instead of window.opener.',
        {
          type: 'diagram',
          text: [
            '  Before:                            After:',
            '  /editor (no isolation)              /editor (isolated)',
            '    +-- app.js                          +-- app.js',
            '    +-- compiler.wasm                   +-- compiler.wasm',
            '    +-- fonts (CORS)                    +-- fonts (CORS)',
            '    +-- cdn images (no CORP)            +-- cdn images (CORP added)',
            '    +-- analytics.js (opaque)           +-- payment (postMessage)',
            '    +-- payment (opener)                crossOriginIsolated = true',
            '    crossOriginIsolated = false',
            '                                      /marketing (no isolation)',
            '                                        +-- analytics.js',
            '                                        +-- ads, widgets',
          ].join('\n'),
          label: 'Isolate the route that needs SharedArrayBuffer, not the entire site',
        },
        {
          type: 'table',
          headers: ['Step', 'Action', 'State change'],
          rows: [
            ['1', 'Add COOP + COEP to /editor only', 'Route enters strict policy path'],
            ['2', 'Inventory assets in DevTools', 'Find 7 resource edges, 2 failing'],
            ['3', 'Move core assets to same origin', 'app.js, compiler.wasm, worker.js pass'],
            ['4', 'Serve font with CORS + crossorigin attr', 'Font uses explicit CORS path'],
            ['5', 'Remove analytics from compiler route', 'Vendor-controlled blocker eliminated'],
            ['6', 'Route login through /auth/return', 'OAuth keeps handoff without weakening COOP'],
            ['7', 'Gate runtime on crossOriginIsolated', 'SAB enabled only when browser confirms'],
            ['8', 'Add staging assertion + report endpoint', 'Future regressions caught pre-production'],
          ],
        },
        {
          type: 'note',
          text: 'A useful migration log names the first failing edge. "crossOriginIsolated is false" is too coarse. "compiler.wasm loaded from cdn.example without CORS or CORP" is actionable.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Cross-origin isolation earns its migration cost when shared memory or high-resolution timing changes what the product can do.',
        {
          type: 'table',
          headers: ['Application class', 'Why isolation matters'],
          rows: [
            ['Browser IDEs (StackBlitz, CodeSandbox)', 'WASM compiler workers sharing memory across threads'],
            ['Media encoders (Squoosh, ffmpeg.wasm)', 'Video/image pipelines with SharedArrayBuffer frame queues'],
            ['Scientific notebooks', 'Large matrix operations coordinated across worker threads'],
            ['CAD / 3D editors', 'Geometry buffers shared between render and physics workers'],
            ['ML inference demos', 'Model weight buffers shared with WASM inference workers'],
            ['Game engines (Unity WebGL)', 'Frame-synchronized shared state across audio, physics, render'],
          ],
        },
        'Isolation also serves as an architecture forcing function. Moving ads, opaque analytics, and vendor widgets off the high-performance page makes the execution surface cleaner and the dependency graph auditable.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Isolation fails when the page cannot control its resource edges.',
        {
          type: 'bullets',
          items: [
            'Ad networks inject opaque cross-origin iframes and scripts that rarely carry CORP or CORS. A page with ads is usually incompatible with require-corp.',
            'Legacy analytics tags load via no-cors with no header negotiation path. The vendor must change, or the tag leaves the isolated page.',
            'Partner widgets (chat, support, surveys) often depend on window.opener or ambient cookies. Both break under isolation.',
            'CDN resources without CORP require the CDN operator to add headers. If you do not control the config, you cannot fix the edge.',
            'credentialless softens COEP but strips cookies, breaking any resource that depends on session state.',
          ],
        },
        'Isolation is not a substitute for other defenses. It does not prevent XSS, validate input, enforce CSP, secure cookies, or gate Fetch Metadata. It narrows one attack surface -- opaque cross-origin data in the process -- so powerful APIs can be re-enabled safely.',
        {
          type: 'table',
          headers: ['Mistake', 'Why it fails', 'Better decision'],
          rows: [
            ['Enable SAB without runtime check', 'One resource or Permissions Policy can block isolation', 'Branch on crossOriginIsolated at runtime'],
            ['Set CORP: cross-origin on everything', 'Exposes resources to broader no-cors consumption', 'Choose same-origin / same-site / cross-origin per asset'],
            ['Isolate the whole site at once', 'Vendor-heavy pages create unrelated breakage', 'Isolate only the route that needs shared memory'],
            ['Treat credentialless as transparent', 'Cookies are stripped; personalized responses break', 'Test authenticated resources separately'],
            ['Ignore popup flows', 'COOP severs opener used by OAuth or payments', 'Design postMessage handoff or separate route'],
          ],
        },
        {
          type: 'note',
          text: 'The worst failure mode is partial confidence: a team adds COOP and COEP, assumes SAB works, ships no fallback, and discovers in production that a vendor tag silently blocked isolation. Always gate on the runtime boolean.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'Covers'],
          rows: [
            ['MDN: Cross-Origin-Opener-Policy', 'COOP values, browsing context group mechanics'],
            ['MDN: Cross-Origin-Embedder-Policy', 'COEP values, require-corp vs. credentialless'],
            ['MDN: Cross-Origin-Resource-Policy', 'CORP values: same-origin / same-site / cross-origin'],
            ['MDN: crossOriginIsolated', 'Runtime boolean, worker property, gating pattern'],
            ['web.dev: "Making your website cross-origin isolated"', 'End-to-end migration guide with worked examples'],
            ['WHATWG Fetch spec', 'Normative CORS, no-cors, and embedder policy algorithms'],
            ['HTML spec: cross-origin embedder policy', 'Browsing context group creation and opener enforcement'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: CORS Preflight Cache -- understand the CORS protocol before reasoning about COEP.',
            'Extension: SharedArrayBuffer & Atomics Wait/Notify -- the capability isolation unlocks.',
            'Related: Subresource Integrity Hash Manifest -- another resource-edge verification mechanism.',
            'Contrast: CSP Nonce & Hash Policy -- restricts resource sources but does not require resource consent.',
            'Deeper: Fetch Metadata Request Gate -- server-side complement to browser-side isolation.',
          ],
        },
      ],
    },
  ],
};
