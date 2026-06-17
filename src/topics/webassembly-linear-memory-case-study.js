// WebAssembly linear memory: one growable byte array shared between Wasm and
// JavaScript, with pages, typed-array views, explicit pointers, and sandboxed bounds.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'webassembly-linear-memory-case-study',
  title: 'WebAssembly Linear Memory Case Study',
  category: 'Systems',
  summary: 'How Wasm represents memory as pages of raw bytes, exposes an ArrayBuffer to JavaScript, grows memory, and keeps native-style code sandboxed.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['linear memory', 'growth and interop'], defaultValue: 'linear memory' },
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

function memoryGraph(title) {
  return graphState({
    nodes: [
      { id: 'js', label: 'JS', x: 0.8, y: 3.7, note: 'host' },
      { id: 'memory', label: 'Memory', x: 2.7, y: 3.7, note: 'ArrayBuffer' },
      { id: 'u8', label: 'Uint8', x: 4.8, y: 1.8, note: 'bytes' },
      { id: 'u32', label: 'Uint32', x: 4.8, y: 3.7, note: 'words' },
      { id: 'f64', label: 'Float64', x: 4.8, y: 5.6, note: 'numbers' },
      { id: 'wasm', label: 'Wasm', x: 7.0, y: 3.7, note: 'instance' },
      { id: 'load', label: 'load/store', x: 9.0, y: 2.3, note: 'offset' },
      { id: 'bounds', label: 'bounds', x: 9.0, y: 5.1, note: 'trap' },
    ],
    edges: [
      { id: 'e-js-memory', from: 'js', to: 'memory' },
      { id: 'e-memory-u8', from: 'memory', to: 'u8' },
      { id: 'e-memory-u32', from: 'memory', to: 'u32' },
      { id: 'e-memory-f64', from: 'memory', to: 'f64' },
      { id: 'e-memory-wasm', from: 'memory', to: 'wasm' },
      { id: 'e-wasm-load', from: 'wasm', to: 'load' },
      { id: 'e-load-bounds', from: 'load', to: 'bounds' },
    ],
  }, { title });
}

function interopGraph(title) {
  return graphState({
    nodes: [
      { id: 'malloc', label: 'malloc', x: 0.8, y: 3.7, note: 'reserve' },
      { id: 'ptr', label: 'ptr', x: 2.5, y: 3.7, note: 'number' },
      { id: 'view', label: 'view', x: 4.2, y: 2.0, note: 'typed array' },
      { id: 'call', label: 'call', x: 4.2, y: 5.3, note: 'export' },
      { id: 'grow', label: 'grow', x: 6.1, y: 3.7, note: '+pages' },
      { id: 'old', label: 'old view', x: 7.9, y: 2.0, note: 'stale' },
      { id: 'new', label: 'new view', x: 7.9, y: 5.3, note: 'refresh' },
      { id: 'free', label: 'free', x: 9.3, y: 3.7, note: 'manual' },
    ],
    edges: [
      { id: 'e-malloc-ptr', from: 'malloc', to: 'ptr' },
      { id: 'e-ptr-view', from: 'ptr', to: 'view' },
      { id: 'e-ptr-call', from: 'ptr', to: 'call' },
      { id: 'e-call-grow', from: 'call', to: 'grow' },
      { id: 'e-grow-old', from: 'grow', to: 'old' },
      { id: 'e-grow-new', from: 'grow', to: 'new' },
      { id: 'e-new-free', from: 'new', to: 'free' },
    ],
  }, { title });
}

function* linearMemory() {
  yield {
    state: memoryGraph('Wasm memory is one indexed byte array'),
    highlight: { active: ['js', 'memory', 'wasm', 'e-js-memory', 'e-memory-wasm'], found: ['u8', 'u32', 'f64'] },
    explanation: 'WebAssembly linear memory is a contiguous mutable byte array. JavaScript sees it through WebAssembly.Memory.buffer. Wasm code sees it through numeric offsets used by load and store instructions.',
  };

  yield {
    state: labelMatrix(
      'Pages and regions inside one memory',
      [
        { id: 'p0', label: 'page 0' },
        { id: 'p1', label: 'page 1' },
        { id: 'p2', label: 'page 2' },
        { id: 'p3', label: 'page 3' },
      ],
      [
        { id: 'size', label: 'size' },
        { id: 'typical use', label: 'typical use' },
      ],
      [
        ['64 KiB', 'data segment'],
        ['64 KiB', 'stack'],
        ['64 KiB', 'heap'],
        ['64 KiB', 'future grow'],
      ],
    ),
    highlight: { active: ['p0:size', 'p1:size', 'p2:size', 'p3:size'], compare: ['p3:typical use'] },
    explanation: 'Memory grows in WebAssembly pages. One page is 64 KiB. Toolchains divide the byte array into regions such as static data, stack, and heap, but those regions are conventions built on the same byte address space.',
    invariant: 'A pointer is an offset into linear memory, not a JavaScript object reference.',
  };

  yield {
    state: memoryGraph('Typed arrays are overlapping interpretations'),
    highlight: { active: ['memory', 'u8', 'u32', 'f64', 'e-memory-u8', 'e-memory-u32', 'e-memory-f64'], compare: ['wasm'] },
    explanation: 'A Uint8Array, Uint32Array, and Float64Array can all view the same bytes. The data is not copied when a view is created; only the interpretation changes. That is why byte offsets, alignment, and encoding matter.',
  };

  yield {
    state: labelMatrix(
      'Load/store safety boundary',
      [
        { id: 'address', label: 'address' },
        { id: 'bounds', label: 'bounds check' },
        { id: 'trap', label: 'trap' },
        { id: 'sandbox', label: 'sandbox' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['integer offset', 'portable pointer'],
        ['inside memory?', 'host safety'],
        ['fail fast', 'no native memory escape'],
        ['separate store', 'browser/runtime isolation'],
      ],
    ),
    highlight: { found: ['bounds:why', 'trap:why', 'sandbox:why'] },
    explanation: 'Wasm can be low-level without giving a module native pointers. Loads and stores target linear memory and are checked against its bounds. An out-of-bounds access traps instead of reading arbitrary host memory.',
  };
}

function* growthAndInterop() {
  yield {
    state: interopGraph('Interop passes pointers and lengths across the boundary'),
    highlight: { active: ['malloc', 'ptr', 'view', 'call', 'e-malloc-ptr', 'e-ptr-view', 'e-ptr-call'], compare: ['grow'] },
    explanation: 'JavaScript and Wasm usually exchange compound data by passing a pointer and length. JavaScript writes bytes into memory, calls an exported function with the pointer, and reads bytes back through a typed-array view.',
  };

  yield {
    state: labelMatrix(
      'Memory growth edge cases',
      [
        { id: 'grow', label: 'memory.grow' },
        { id: 'old', label: 'old ArrayBuffer' },
        { id: 'new', label: 'new buffer' },
        { id: 'shared', label: 'shared memory' },
      ],
      [
        { id: 'behavior', label: 'behavior' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['adds pages', 'capacity changes'],
        ['detached', 'views go stale'],
        ['fresh length', 'recreate views'],
        ['not detached', 'length caveat'],
      ],
    ),
    highlight: { removed: ['old:behavior'], found: ['new:lesson'], compare: ['shared:behavior'] },
    explanation: 'For non-shared memory, memory.grow detaches references to the old buffer, even grow(0). Code that caches a Uint8Array over memory.buffer must recreate the view after calls that may grow memory.',
    invariant: 'Store pointer and length; recreate the typed-array view when needed.',
  };

  yield {
    state: interopGraph('Manual allocation makes JavaScript a guest in the heap'),
    highlight: { active: ['malloc', 'ptr', 'new', 'free', 'e-malloc-ptr', 'e-new-free'], removed: ['old'] },
    explanation: 'If the Wasm module owns malloc/free, JavaScript must treat returned pointers like foreign heap addresses. A pointer can outlive a temporary JS view, but the allocation still needs an ownership rule and a matching free.',
  };

  yield {
    state: labelMatrix(
      'Interop checklist',
      [
        { id: 'bytes', label: 'bytes' },
        { id: 'strings', label: 'strings' },
        { id: 'structs', label: 'structs' },
        { id: 'growth', label: 'growth' },
        { id: 'threads', label: 'threads' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'failure', label: 'failure if ignored' },
      ],
      [
        ['use Uint8Array', 'wrong element width'],
        ['encode/decode UTF-8', 'garbled text'],
        ['match layout', 'bad offsets'],
        ['refresh views', 'empty stale arrays'],
        ['SharedArrayBuffer rules', 'race or isolation issue'],
      ],
    ),
    highlight: { active: ['bytes:rule', 'strings:rule', 'structs:rule', 'growth:rule', 'threads:rule'] },
    explanation: 'The hard bugs are ordinary memory bugs wearing a browser costume: width mismatch, string encoding, struct layout, stale views, and shared-memory races. The fix is to write explicit boundary contracts.',
  };

  yield {
    state: labelMatrix(
      'What toolchains add',
      [
        { id: 'heap', label: 'HEAP views' },
        { id: 'ccall', label: 'ccall/cwrap' },
        { id: 'malloc', label: 'malloc/free' },
        { id: 'fs', label: 'virtual FS' },
      ],
      [
        { id: 'adds', label: 'adds' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['typed views', 'view refresh'],
        ['function bridge', 'export config'],
        ['C heap API', 'manual lifetime'],
        ['file illusion', 'sync and packaging'],
      ],
    ),
    highlight: { found: ['heap:adds', 'ccall:adds', 'malloc:adds'], compare: ['fs:cost'] },
    explanation: 'Emscripten and similar toolchains hide much of the ceremony, but they do not remove the model. Underneath, data still crosses as bytes, pointers, typed views, and runtime-managed heap conventions.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'linear memory') yield* linearMemory();
  else if (view === 'growth and interop') yield* growthAndInterop();
  else throw new InputError('Pick a WebAssembly memory view.');
}

const legacyArticle = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'WebAssembly needs to run low-level code without handing that code native pointers into the browser or host process. C, C++, Rust, and other compiled languages still need addresses, loads, stores, stacks, heaps, structs, and byte buffers. Linear memory is the compromise: one sandboxed byte array that Wasm can address directly.',
        'The official core specification describes linear memory as a mutable byte array, and MDN describes WebAssembly.Memory as the resizable buffer accessed by a WebAssembly instance: https://www.w3.org/TR/wasm-core-2/ and https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory. This topic is the bridge between arrays, allocators, typed arrays, browser runtimes, and sandboxing.',
      ],
    },
    {
      heading: 'The tempting wrong answer',
      paragraphs: [
        'The easy mistake is to treat a Wasm pointer like a JavaScript object reference. It is not one. A pointer is just an integer offset into the module memory. JavaScript cannot follow it as an object, and Wasm cannot use it to escape into the host heap.',
        'Another mistake is to cache typed-array views forever. For non-shared memory, memory.grow detaches references to the old buffer, even grow(0), so code that keeps a Uint8Array over memory.buffer must recreate the view after any call that may grow memory: https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory/grow.',
      ],
    },
    {
      heading: 'Core model',
      paragraphs: [
        'A memory has an initial size measured in pages. One WebAssembly page is 64 KiB. A module can import memory from JavaScript or create and export memory to JavaScript. JavaScript creates typed-array views such as Uint8Array, Uint32Array, or Float64Array over the same buffer. Those views do not copy data; they reinterpret the same bytes with different element widths.',
        'The invariant is pointer plus length. Compound values cross the boundary by writing bytes into memory, passing an offset and length to an exported function, and reading bytes back through a fresh view. Loads and stores are bounds-checked against linear memory, so an out-of-bounds access traps instead of reading arbitrary host memory.',
        'Toolchains such as Emscripten add calling helpers, string conversion, malloc/free wrappers, and HEAP8/HEAPU8/HEAP32-style views, but the model underneath is still bytes plus offsets: https://emscripten.org/docs/api_reference/preamble.js.html.',
      ],
    },
    {
      heading: 'Legacy visual note',
      paragraphs: [
        'In the linear-memory view, watch one buffer fan out into Uint8, Uint32, and Float64 interpretations. The point is not that there are three copies; the point is that one byte store can be viewed with several element widths, so offsets, alignment, and encoding become part of the contract.',
        'In the growth-and-interop view, malloc returns a numeric pointer, JavaScript creates a view over that range, and growth makes old views unsafe for non-shared memory. The safe rule is to store pointer and length, recreate views after growth, and pair ownership with free when the module owns the heap. If you remember only one thing, remember that the pointer is a number inside Wasm memory, not a host object.',
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        'Linear memory wins when native-style code needs predictable byte layout, portable sandboxing, and efficient bulk exchange with JavaScript. It connects Buddy Allocator Free Lists and Slab Allocator Size Classes to browser execution because compiled allocators manage a heap inside this byte array. It also connects Apache Arrow Columnar Memory Case Study because both rely on byte buffers, typed views, and offsets.',
        'It fails when callers forget the boundary contract. JavaScript strings are not raw C strings. Struct layout needs agreed alignment and field widths. Cached views can go stale. Shared memory introduces Atomics and cross-origin isolation requirements. The sandbox prevents host-memory escape, but C code can still corrupt its own heap inside linear memory.',
        'WebAssembly is not only a browser feature. The core format is portable, though browsers expose it through JavaScript APIs. V8 4GB Wasm Memory is a useful example of how runtime and toolchain details affect large memories in practice: https://v8.dev/blog/4gb-wasm-memory.',
      ],
    },
    {
      heading: 'Practical guidance',
      paragraphs: [
        'Write the boundary contract down: encoding, pointer, length, element width, alignment, ownership, and whether the call may grow memory. Most Wasm interop bugs are violations of one of those small agreements.',
        'Prefer bulk transfer over chatty calls. Copy a buffer, call once, and read a buffer back when possible. Crossing the JS/Wasm boundary repeatedly for tiny fields can erase the benefit of running low-level code.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: W3C WebAssembly Core Specification at https://www.w3.org/TR/wasm-core-2/, MDN WebAssembly.Memory at https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory, MDN memory.grow at https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory/grow, MDN text-format memory examples at https://developer.mozilla.org/en-US/docs/WebAssembly/Guides/Understanding_the_text_format, Emscripten preamble.js at https://emscripten.org/docs/api_reference/preamble.js.html, Emscripten deployment memory notes at https://emscripten.org/docs/compiling/Deploying-Pages.html, and V8 4GB Wasm Memory at https://v8.dev/blog/4gb-wasm-memory. Study Bytecode Stack Virtual Machine, Interpreter Dispatch Table & Threaded Code, Buddy Allocator Free Lists, Slab Allocator Size Classes, TLSF Real-Time Allocator Bitmap Index, Apache Arrow Columnar Memory Case Study, Structured Clone & Transferables, SharedArrayBuffer & Atomics, Web Workers, Service Workers, Ring Buffer, and V8 Generational Garbage Collection next.',
      ],
    },
  ],
};

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'WebAssembly linear memory exists to give compiled code a simple, portable memory model inside a host such as the browser. C, C++, Rust, Zig, and other languages expect something like a byte-addressed address space. JavaScript objects and garbage-collected references are not that.',
        'Linear memory is the compromise: a module gets a contiguous array of bytes, indexed by integer offsets. The WebAssembly program can load and store numbers at those offsets, while the host keeps the memory sandboxed from the rest of the process.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious browser integration would let compiled code directly use JavaScript arrays, objects, or DOM memory. That would be unsafe and too tied to one host. It would also make compiled languages fight JavaScript object layout and garbage collection.',
        'Another tempting model is a real native pointer into process memory. That is not acceptable on the web. A Wasm module must not read arbitrary browser memory, corrupt the host, or depend on machine-specific addresses. Linear memory gives pointer-like offsets without exposing real process pointers.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A Wasm memory is an ArrayBuffer-like byte store divided into pages. A pointer in Wasm is usually just an integer offset into that store. Loads and stores check that the accessed range is inside the memory bounds.',
        'This makes memory explicit. The module owns its heap discipline: stack layout, allocator metadata, structs, arrays, and strings all become bytes at offsets. The host can inspect or copy those bytes, but it does not understand their meaning unless the ABI defines it.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A module declares or imports a memory with an initial page count and often a maximum page count. One WebAssembly page is 64 KiB. Instructions such as i32.load, i64.store, and f32.load read and write typed values at computed offsets.',
        'The compiler lowers high-level data structures into memory layout. A Rust string passed to Wasm may become a pointer and length. A C struct becomes fields at fixed offsets. An allocator manages free and used regions. None of that is automatic JavaScript object sharing; it is an ABI contract.',
        'Memory can grow with memory.grow, but growth can detach or replace the host view depending on the integration path. Host code that keeps a typed array view over memory must be prepared to refresh it after growth.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The byte-grid view proves that Wasm memory is not a bag of objects. It is one indexed byte array. A string, struct, image buffer, or stack frame exists only because code agrees how to interpret bytes starting at an offset.',
        'The bounds-check view proves the sandbox. A bad offset is not supposed to wander into browser internals. The access traps or fails at the memory boundary. That is the security value of linear memory.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The model works because compiled languages can target integer offsets efficiently. The compiler can generate familiar load and store operations, while the runtime can validate the module and enforce memory bounds.',
        'It also works as a host boundary. JavaScript can pass numbers, copy bytes, create typed views, or call exported functions. The host does not need to understand every source-language object model, only the agreed memory layout and function signatures.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Linear memory is fast and portable, but it creates copying and ABI costs. Passing a string from JavaScript to Wasm often means encoding it into bytes, allocating space, copying it, and passing pointer plus length. Returning complex data has the same problem in reverse.',
        'Manual memory management can also return. A language runtime may provide an allocator and garbage collector inside Wasm, but the host will not automatically free arbitrary allocations unless the ABI exposes that behavior. Leaks can happen across the boundary.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Linear memory wins for compute-heavy code, codecs, compression, cryptography, image processing, game engines, parsers, simulation kernels, and existing C/C++ or Rust libraries compiled to the web or an edge runtime.',
        'It is especially useful when large buffers stay inside Wasm for many operations. The less often data crosses the host boundary, the more the module benefits from dense memory and compiled code.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first failure is treating offsets as safe high-level references. An offset can be stale, point to freed memory, or refer to bytes whose meaning changed. The host must respect the module ABI rather than guessing.',
        'The second failure is repeated boundary copying. If every small operation copies data in and out of memory, the Wasm speedup can vanish. Good designs batch work, share buffers carefully, and minimize crossings.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Define the ABI explicitly: how strings, arrays, errors, and ownership are represented. Decide who allocates, who frees, and whether the host may retain pointers after a call returns.',
        'Refresh typed array views after memory growth. Track pointer-plus-length pairs together. Validate lengths before copying. Treat exported allocator and free functions as part of the public contract, not as incidental helpers.',
        'Measure boundary cost separately from compute cost. A benchmark that calls one large Wasm function may look excellent while a product workload that calls thousands of tiny functions does not.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose JavaScript wants to pass an image buffer to a Wasm filter. The host allocates a region in linear memory, copies RGBA bytes into that region, and calls an exported function with pointer, width, height, and length. The Wasm code treats the pointer as the start of a byte array.',
        'If the filter returns a new image, it may return pointer plus length to another memory region. The host creates a typed array view, copies or consumes the bytes, and then calls an exported free function if ownership has moved back to the host. Without that ownership rule, memory leaks or use-after-free bugs become likely.',
        'The example shows why linear memory is powerful and awkward. It makes compiled code fast on dense buffers, but every boundary crossing needs layout, ownership, and lifetime discipline that ordinary JavaScript objects normally hide.',
      ],
    },
    {
      heading: 'How to choose it',
      paragraphs: [
        'Use WebAssembly when the hot work is compute-heavy, buffer-oriented, or already exists in a systems language. It is usually a poor fit for code that constantly calls back into the DOM, manipulates many JavaScript objects, or crosses the host boundary for tiny operations.',
        'The best Wasm modules have a narrow API and do large chunks of work per call. Parse this buffer, compress this block, run this simulation step, transform this image, verify this proof. The less chatty the boundary, the more linear memory helps.',
        'For teams, the decision should include debugging and packaging. Source maps, panic handling, allocator diagnostics, binary size, startup time, and compatibility with CSP or edge runtimes can matter as much as raw compute speed.',
      ],
    },
    {
      heading: 'What to watch in production',
      paragraphs: [
        'The operational question is not simply whether Wasm is fast. It is whether the data layout, ownership model, and deployment path stay understandable after several engineers touch the boundary. A clean module exposes a small set of functions whose pointer rules can be written on one page.',
        'Watch memory growth, allocator pressure, and copied byte volume. A leak inside the module may not look like a JavaScript object leak, and a copy storm may show up as ordinary CPU time rather than as an obvious Wasm problem. Good telemetry counts allocations, frees, bytes copied, traps, and calls per user action.',
        'Also decide how failure should cross the boundary. Panics, error codes, thrown host exceptions, and poisoned memory states need a documented contract. Otherwise the fastest part of the system becomes the hardest part to debug when malformed input or edge-runtime differences appear.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study ArrayBuffer and TypedArray, Operating-System Virtual Memory, WebGPU Buffer and Bind Group, Protobuf Wire Format, Arena Allocators, and Browser Security Sandboxing. A useful exercise is to pass a UTF-8 string into Wasm, return a transformed string, and write down every allocation and copy.',
      ],
    },
  ],
};
