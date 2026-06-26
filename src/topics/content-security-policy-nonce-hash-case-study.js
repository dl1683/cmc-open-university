// Content Security Policy: nonce and hash based script authorization as a
// browser-side allow graph for code execution.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'content-security-policy-nonce-hash-case-study',
  title: 'CSP Nonce & Hash Policy',
  category: 'Security',
  summary: 'How strict Content Security Policy uses nonces, hashes, script-src, strict-dynamic, reports, and rollout modes to reduce XSS execution.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['nonce flow', 'hash policy'], defaultValue: 'nonce flow' },
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

function cspGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'server', label: 'server', x: 0.8, y: 4.8, note: notes.server ?? 'renders HTML' },
      { id: 'header', label: 'policy', x: 2.5, y: 6.0, note: notes.header ?? 'script-src' },
      { id: 'parser', label: 'parser', x: 4.2, y: 4.8, note: notes.parser ?? 'checks script' },
      { id: 'good', label: 'script', x: 6.0, y: 6.0, note: notes.good ?? 'trusted' },
      { id: 'bad', label: 'inject', x: 6.0, y: 3.6, note: notes.bad ?? 'attacker' },
      { id: 'exec', label: 'exec', x: 8.0, y: 5.8, note: notes.exec ?? 'allowed' },
      { id: 'report', label: 'report', x: 8.0, y: 3.6, note: notes.report ?? 'violation' },
    ],
    edges: [
      { id: 'e-server-header', from: 'server', to: 'header', weight: '' },
      { id: 'e-server-parser', from: 'server', to: 'parser', weight: '' },
      { id: 'e-header-parser', from: 'header', to: 'parser', weight: '' },
      { id: 'e-parser-good', from: 'parser', to: 'good', weight: '' },
      { id: 'e-parser-bad', from: 'parser', to: 'bad', weight: '' },
      { id: 'e-good-exec', from: 'good', to: 'exec', weight: '' },
      { id: 'e-bad-report', from: 'bad', to: 'report', weight: '' },
    ],
  }, { title });
}

function* nonceFlow() {
  yield {
    state: cspGraph('The server emits a fresh nonce and policy', { header: "nonce 'r7'", good: "nonce='r7'", bad: 'no nonce' }),
    highlight: { active: ['server', 'header', 'good', 'e-server-header'], compare: ['bad'] },
    explanation: 'A nonce policy starts on the server. For each response, the server generates a fresh unpredictable nonce, puts it in the Content-Security-Policy header, and attaches it to trusted script elements.',
    invariant: 'A nonce is per response, not a global password.',
  };

  yield {
    state: cspGraph('The parser authorizes the matching script', { header: "nonce 'r7'", parser: 'match', good: 'nonce ok', exec: 'runs' }),
    highlight: { found: ['header', 'parser', 'good', 'exec', 'e-header-parser', 'e-parser-good', 'e-good-exec'] },
    explanation: 'When the browser reaches a script, it checks the policy. If the script carries the exact nonce from the response header, it is allowed to execute.',
  };

  yield {
    state: cspGraph('Injected inline code lacks the nonce and is blocked', { bad: 'onclick=...', report: 'blocked' }),
    highlight: { removed: ['bad', 'e-parser-bad'], active: ['report', 'e-bad-report'], found: ['good'] },
    explanation: 'An attacker who can inject markup does not automatically get execution. Inline handlers, script tags without the nonce, and disallowed sources are blocked and can generate violation reports.',
  };

  yield {
    state: cspGraph('strict-dynamic transfers trust from a nonce script', { good: 'loader', exec: 'loads app', header: 'strict dyn', bad: 'host list' }),
    highlight: { active: ['good', 'exec', 'e-good-exec'], compare: ['bad'], found: ['header'] },
    explanation: 'strict-dynamic lets a nonce- or hash-authorized loader create additional scripts without listing every host. That supports modern bundlers, but it makes the trusted loader a more important security boundary.',
  };

  yield {
    state: labelMatrix(
      'Rollout modes',
      [
        { id: 'report', label: 'report' },
        { id: 'enforce', label: 'enforce' },
        { id: 'legacy', label: 'legacy' },
        { id: 'clean', label: 'clean' },
      ],
      [
        { id: 'mode', label: 'mode' },
        { id: 'goal', label: 'goal' },
      ],
      [
        ['observe', 'find breaks'],
        ['block', 'reduce XSS'],
        ['allowlist', 'migrate'],
        ['strict', 'least code'],
      ],
    ),
    highlight: { active: ['report:mode'], found: ['enforce:goal', 'clean:mode'], compare: ['legacy:mode'] },
    explanation: 'A safe rollout often starts in Report-Only, fixes real violations, then enforces. The end state is strict enough to block injected execution without breaking intentional scripts.',
  };
}

function* hashPolicy() {
  yield {
    state: cspGraph('A hash policy approves exact script bytes', { server: 'build', header: 'sha256...', good: 'same bytes', parser: 'hash' }),
    highlight: { active: ['server', 'header', 'good', 'e-server-header'], found: ['parser'] },
    explanation: 'A hash policy records a cryptographic hash of an inline script. At parse time, the browser hashes the script content and compares it with the allowed hash in script-src.',
    invariant: 'Hashes authorize exact bytes; nonces authorize selected elements for this response.',
  };

  yield {
    state: cspGraph('Exact bytes match, so execution is allowed', { parser: 'hash match', exec: 'runs', report: 'quiet' }),
    highlight: { found: ['parser', 'good', 'exec', 'e-parser-good', 'e-good-exec'] },
    explanation: 'Hashes fit static inline bootstraps that do not change per response. If the content is exactly the approved content, the script runs without a per-request nonce.',
  };

  yield {
    state: cspGraph('A tiny script change breaks the hash', { good: 'changed', parser: 'hash miss', report: 'blocked' }),
    highlight: { removed: ['good', 'e-good-exec'], active: ['report', 'e-bad-report'], compare: ['header'] },
    explanation: 'The hash is intentionally brittle. A whitespace, build, or injection change means the bytes no longer match, so the browser blocks execution unless the policy is updated.',
  };

  yield {
    state: labelMatrix(
      'Policy choices',
      [
        { id: 'nonce', label: 'nonce' },
        { id: 'hash', label: 'hash' },
        { id: 'host', label: 'host' },
        { id: 'unsafe', label: 'unsafe' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['dynamic', 'leak value'],
        ['static', 'brittle'],
        ['external', 'JSONP/CDN'],
        ['legacy', 'XSS runs'],
      ],
    ),
    highlight: { found: ['nonce:fit', 'hash:fit'], compare: ['host:risk'], removed: ['unsafe:risk'] },
    explanation: 'Nonce and hash policies are preferred for strict CSP because they authorize intended code rather than broad locations. Host allowlists are easier to bypass when a trusted host can serve attacker-controlled script.',
  };

  yield {
    state: cspGraph('A complete migration removes inline execution sinks', { server: 'templates', header: 'strict CSP', good: 'boot hash', bad: 'handler', report: 'telemetry' }),
    highlight: { found: ['header', 'good', 'exec'], removed: ['bad'], active: ['report'] },
    explanation: 'The complete case study is a legacy app migration: remove inline event handlers, move dynamic data into JSON script tags or data attributes safely, add nonces or hashes, collect reports, then enforce.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'nonce flow') yield* nonceFlow();
  else if (view === 'hash policy') yield* hashPolicy();
  else throw new InputError('Pick a CSP view.');
}


export const article = { sections: [
  { heading: 'How to read the animation', paragraphs: [
    'The nonce-flow view follows one fresh value from server header to trusted script element. Active nodes are the browser decision point, found nodes are scripts allowed to execute, and removed nodes are injected code blocked before execution.',
    'The hash-policy view changes the proof from selected element to exact bytes. A matching hash means the browser can run that inline script; one byte of drift means the proof no longer names the script.',
  ] },
  { heading: 'Why this exists', paragraphs: [
    'Cross-site scripting, or XSS, means attacker-controlled JavaScript runs with the page\'s authority. Once that happens, the script can read page state, call same-origin APIs, and act through the user\'s browser session.',
    'Content Security Policy, or CSP, gives the browser an execution policy before a script runs. A strict script policy turns execution into a proof check instead of trusting any inline code that lands in the document.',
    {type:'callout', text:'Strict CSP shifts script execution from placement trust to browser-verified proof: a matching nonce, exact hash, or policy-approved trust chain.'},
  ] },
  { heading: 'The obvious approach', paragraphs: [
    'The obvious approach is output encoding and sanitization. That is still required, because CSP is a defense layer and not permission to place unsafe HTML in templates.',
    'A second approach is a host allowlist such as script-src cdn.example. That is weaker because a trusted host may serve attacker-controlled script through uploads, JSONP, old libraries, or a compromised third party.',
  ] },
  { heading: 'The wall', paragraphs: [
    'The wall is that XSS bugs are often one missed sink. One template path, inline event handler, javascript URL, or string-to-code call can turn attacker text into same-origin code.',
    'Host lists also fail as a proof of intent. They authorize locations, not the exact script element or exact script bytes the page author meant to run.',
  ] },
  { heading: 'The core insight', paragraphs: [
    'Authorize script execution by proof close to the execution boundary. A nonce proves that the server selected this script element for this response; a hash proves that the bytes match an approved script.',
    'The invariant is simple: a script may execute only if it matches a nonce, a hash, or another allowed policy rule. Injected markup does not gain that proof merely by appearing in the DOM.',
  ] },
  { heading: 'How it works', paragraphs: [
    'In nonce mode, the server generates an unpredictable value for each response, places it in the Content-Security-Policy header, and places the same value on trusted script elements. The browser compares the element nonce with the policy nonce at parse time.',
    'In hash mode, the policy contains a SHA-256, SHA-384, or SHA-512 digest of stable script bytes. The browser hashes the candidate script and runs it only if the digest matches; static pages can use this without per-response server rendering.',
  ] },
  { heading: 'Why it works', paragraphs: [
    'Nonce policies work because an attacker who injects HTML after rendering usually cannot predict the fresh nonce. Hash policies work because changing the script changes the digest.',
    'The proof fails if the attacker can read the nonce, inject into a trusted script body, control a trusted loader under strict-dynamic, keep unsafe-inline, or load attacker-controlled code from an allowed host. CSP reduces execution risk; it does not replace input handling.',
  ] },
  { heading: 'Cost and complexity', paragraphs: [
    'Nonces cost server plumbing and caching complexity. A page with 12 trusted scripts needs the same fresh nonce on each trusted script for that response, and full-page static caching becomes harder because the nonce changes each time.',
    'Hashes cost deployment discipline. If a build changes 1 byte, the hash changes; a forgotten policy update blocks the script, while an automated policy update must still avoid blessing attacker-controlled content.',
  ] },
  { heading: 'Real-world uses', paragraphs: [
    'Strict CSP fits account pages, payment flows, admin consoles, dashboards, and authenticated applications where one XSS bug has high impact. It is strongest when the team controls templates and can remove inline handlers.',
    'It also fits legacy cleanup. Report-Only mode collects violations, teams remove eval and inline event handlers, then enforcement blocks injected execution while violation reports watch for regressions.',
  ] },
  { heading: 'Where it fails', paragraphs: [
    'CSP fails when the policy keeps unsafe-inline, broad host allowlists, or a trusted loader that turns user input into script URLs. In that shape, the policy may look strict while still authorizing the attacker\'s path.',
    'It also does not solve every DOM sink. Trusted Types is the adjacent tool for restricting which code can write strings into dangerous DOM APIs, and server authorization still controls what actions an authenticated user may take.',
  ] },
  { heading: 'Worked example', paragraphs: [
    'A server renders Content-Security-Policy: script-src \'nonce-r7\' \'strict-dynamic\'; object-src \'none\'; base-uri \'none\'. It marks the intended bootstrap script with nonce="r7" and generates a different value on the next response.',
    'An attacker injects <script>steal()</script> through a comment bug. The tag is in the DOM, but it has no nonce and no listed hash, so the browser blocks it and sends a violation report; the trusted bootstrap can still load the application bundle under strict-dynamic.',
  ] },
  { heading: 'Sources and study next', paragraphs: [
    'Primary sources: MDN Content Security Policy guide, MDN script-src reference, MDN nonce attribute reference, W3C CSP Level 3, and the OWASP CSP Cheat Sheet. Study nonces, hashes, strict-dynamic, report-only rollout, and Trusted Types next.',
    'Then compare Subresource Integrity, CORS Preflight Cache, Cross-Origin Isolation, SameSite cookies, and DOM XSS sink guards. CSP is one browser gate in a larger client-side security system.',
  ] },
] };
