// WebGPU: host arrays become GPUBuffer resources, bind groups connect those
// buffers to shader slots, and command buffers move work onto the GPU queue.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'webgpu-buffer-bind-group-case-study',
  title: 'WebGPU Buffer & Bind Group Case Study',
  category: 'Systems',
  summary: 'How WebGPU moves typed-array data into GPUBuffer objects, binds resources to shader slots, records commands, and submits work to a GPU queue.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['resource binding', 'compute pass'], defaultValue: 'resource binding' },
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

function resourceGraph(title) {
  return graphState({
    nodes: [
      { id: 'js', label: 'JS', x: 0.7, y: 3.6, note: 'host' },
      { id: 'array', label: 'Array', x: 2.4, y: 1.7, note: 'CPU bytes' },
      { id: 'device', label: 'device', x: 2.4, y: 5.7, note: 'logical' },
      { id: 'buffer', label: 'Buffer', x: 4.4, y: 3.7, note: 'flags' },
      { id: 'layout', label: 'Layout', x: 6.4, y: 1.4, note: 'slots' },
      { id: 'bind', label: 'Bind', x: 6.4, y: 5.8, note: 'resources' },
      { id: 'pipe', label: 'Pipe', x: 8.4, y: 2.3, note: 'shader' },
      { id: 'queue', label: 'Queue', x: 9.3, y: 5.0, note: 'submit' },
    ],
    edges: [
      { id: 'e-js-array', from: 'js', to: 'array' },
      { id: 'e-js-device', from: 'js', to: 'device' },
      { id: 'e-array-buffer', from: 'array', to: 'buffer', weight: 'write/copy' },
      { id: 'e-device-buffer', from: 'device', to: 'buffer', weight: 'create' },
      { id: 'e-buffer-bind', from: 'buffer', to: 'bind' },
      { id: 'e-layout-bind', from: 'layout', to: 'bind' },
      { id: 'e-layout-pipe', from: 'layout', to: 'pipe' },
      { id: 'e-bind-pipe', from: 'bind', to: 'pipe' },
      { id: 'e-pipe-queue', from: 'pipe', to: 'queue' },
    ],
  }, { title });
}

function computeGraph(title) {
  return graphState({
    nodes: [
      { id: 'inA', label: 'input A', x: 0.7, y: 2.1, note: 'storage' },
      { id: 'inB', label: 'input B', x: 0.7, y: 5.2, note: 'storage' },
      { id: 'bind', label: 'bind group', x: 2.8, y: 3.6, note: 'slots 0..2' },
      { id: 'shader', label: 'WGSL', x: 4.8, y: 3.6, note: 'kernel' },
      { id: 'dispatch', label: 'dispatch', x: 6.7, y: 3.6, note: 'workgroups' },
      { id: 'out', label: 'output', x: 8.5, y: 2.1, note: 'storage' },
      { id: 'readback', label: 'readback', x: 8.5, y: 5.2, note: 'MAP_READ' },
    ],
    edges: [
      { id: 'e-a-bind', from: 'inA', to: 'bind' },
      { id: 'e-b-bind', from: 'inB', to: 'bind' },
      { id: 'e-bind-shader', from: 'bind', to: 'shader' },
      { id: 'e-shader-dispatch', from: 'shader', to: 'dispatch' },
      { id: 'e-dispatch-out', from: 'dispatch', to: 'out' },
      { id: 'e-out-readback', from: 'out', to: 'readback' },
    ],
  }, { title });
}

function* resourceBinding() {
  yield {
    state: resourceGraph('WebGPU starts with a logical device and explicit buffers'),
    highlight: { active: ['js', 'device', 'buffer', 'e-js-device', 'e-device-buffer'], compare: ['array'] },
    explanation: 'A WebGPU app asks the browser for a GPUAdapter and GPUDevice, then creates GPUBuffer objects with explicit usage flags. The buffer is not a JavaScript array; it is a GPU resource with declared allowed uses.',
  };

  yield {
    state: resourceGraph('Typed arrays upload bytes into GPUBuffer storage'),
    highlight: { active: ['array', 'buffer', 'e-array-buffer'], found: ['js'], compare: ['device'] },
    explanation: 'Host data usually starts as a TypedArray. The app writes it into a GPUBuffer with queue.writeBuffer, mapped ranges, or copy commands. This is the same boundary lesson as WebAssembly linear memory: bytes cross explicitly, and layout is the contract.',
    invariant: 'The shader sees bytes with a declared layout; JavaScript object shape is not visible on the GPU.',
  };

  yield {
    state: resourceGraph('Bind group layout names the shader resource contract'),
    highlight: { active: ['layout', 'bind', 'buffer', 'pipe', 'e-layout-bind', 'e-buffer-bind', 'e-layout-pipe'], compare: ['queue'] },
    explanation: 'A bind group layout says which resource slots exist, which shader stages can see them, and whether a buffer is uniform, read-only storage, writable storage, or another resource type. A bind group fills those slots with concrete resources.',
  };

  yield {
    state: labelMatrix(
      'GPUBuffer usage flags',
      [
        { id: 'mapread', label: 'MAP_READ' },
        { id: 'mapwrite', label: 'MAP_WRITE' },
        { id: 'copy', label: 'COPY_SRC/DST' },
        { id: 'vertex', label: 'VERTEX/INDEX' },
        { id: 'uniform', label: 'UNIFORM' },
        { id: 'storage', label: 'STORAGE' },
      ],
      [
        { id: 'purpose', label: 'purpose' },
        { id: 'common pitfall', label: 'common pitfall' },
      ],
      [
        ['read back to CPU', 'must copy from compute output first'],
        ['CPU writes mapped range', 'not a free live JS view'],
        ['staging and transfers', 'missing flag blocks copy'],
        ['draw input streams', 'wrong stride breaks vertices'],
        ['small constants', 'alignment and size limits'],
        ['large shader data', 'race and bounds discipline'],
      ],
    ),
    highlight: { active: ['copy:purpose', 'uniform:purpose', 'storage:purpose'], compare: ['mapread:common pitfall'] },
    explanation: 'Usage flags are a validation data structure. They let the browser reject impossible or unsafe resource transitions before commands reach the driver.',
  };
}

function* computePass() {
  yield {
    state: computeGraph('A compute pass binds buffers and dispatches workgroups'),
    highlight: { active: ['inA', 'inB', 'bind', 'shader', 'dispatch', 'e-a-bind', 'e-b-bind', 'e-bind-shader', 'e-shader-dispatch'], compare: ['out'] },
    explanation: 'A compute shader reads storage buffers through a bind group, runs many invocations grouped into workgroups, and writes results into another storage buffer. This is GPU data-parallelism exposed inside the browser.',
  };

  yield {
    state: labelMatrix(
      'Resource type fit',
      [
        { id: 'uniform', label: 'uniform buffer' },
        { id: 'storage', label: 'storage buffer' },
        { id: 'vertex', label: 'vertex buffer' },
        { id: 'index', label: 'index buffer' },
        { id: 'readback', label: 'readback buffer' },
      ],
      [
        { id: 'shader access', label: 'shader access' },
        { id: 'data structure shape', label: 'data structure shape' },
      ],
      [
        ['read constants', 'small config block'],
        ['read/write arrays', 'large flat arrays'],
        ['read per vertex', 'struct stream'],
        ['read indices', 'compact topology'],
        ['CPU map after copy', 'staging result'],
      ],
    ),
    highlight: { active: ['storage:shader access', 'vertex:data structure shape', 'index:data structure shape'], found: ['uniform:data structure shape'] },
    explanation: 'Choosing the buffer type is choosing the access pattern. Uniforms are compact constants, storage buffers are large arrays, vertex and index buffers are draw-specific streams, and readback buffers are CPU-visible staging space.',
  };

  yield {
    state: resourceGraph('Command encoding separates recording from execution'),
    highlight: { active: ['pipe', 'queue', 'e-pipe-queue'], found: ['bind'], compare: ['js'] },
    explanation: 'WebGPU records work into a command encoder, finishes a command buffer, then submits it to the queue. JavaScript is describing future GPU work, not executing each shader invocation directly.',
    invariant: 'The queue timeline and the JavaScript event loop are related but not the same timeline.',
  };

  yield {
    state: computeGraph('Readback copies GPU output into a mappable buffer'),
    highlight: { active: ['out', 'readback', 'e-out-readback'], found: ['dispatch'], compare: ['inA', 'inB'] },
    explanation: 'Compute output usually lives in a storage buffer that is not directly mappable for CPU reads. The usual path is copyBufferToBuffer into a MAP_READ staging buffer, then mapAsync and read the ArrayBuffer after the GPU has completed the copy.',
  };

  yield {
    state: labelMatrix(
      'Complete case study: sparse PageRank in the browser',
      [
        { id: 'rowptr', label: 'rowPtr' },
        { id: 'colidx', label: 'colIdx' },
        { id: 'rank', label: 'rank values' },
        { id: 'next', label: 'next values' },
        { id: 'control', label: 'iteration params' },
      ],
      [
        { id: 'WebGPU resource', label: 'WebGPU resource' },
        { id: 'source topic', label: 'source topic' },
      ],
      [
        ['read-only storage', 'Compressed Sparse Row Graph'],
        ['read-only storage', 'Compressed Sparse Row Graph'],
        ['storage buffer', 'PageRank'],
        ['writable storage', 'PageRank'],
        ['uniform buffer', 'algorithm constants'],
      ],
    ),
    highlight: { active: ['rowptr:WebGPU resource', 'colidx:WebGPU resource', 'rank:WebGPU resource', 'next:WebGPU resource'], found: ['control:WebGPU resource'] },
    explanation: 'The case-study bridge is concrete: a CSR graph becomes flat storage buffers, a PageRank iteration becomes a compute dispatch, and the browser app reads back only summaries or the final rank vector.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'resource binding') yield* resourceBinding();
  else if (view === 'compute pass') yield* computePass();
  else throw new InputError('Pick a WebGPU view.');
}

export const article = {
  sections: [
    {
      heading: 'Why WebGPU Needs This',
      paragraphs: [
        'WebGPU exists because the browser needs a portable, explicit way to use the GPU without exposing driver-specific APIs. JavaScript is good at building objects and responding to events. A GPU is good at running the same small program over many data elements. Those worlds do not share memory, timing, or object layout. The bridge has to be deliberate.',
        'The central object in this case study is the GPUBuffer. It is not a JavaScript array with extra speed. It is a resource owned by the GPU device, created with a fixed size and usage flags. Shaders can only use it through bindings that match declared layouts. That explicitness is the price of predictable validation, security, and parallel execution inside the browser.',
      ],
    },
    {
      heading: 'The Naive Approach',
      paragraphs: [
        'The obvious plan is to hand an array to a shader and let the GPU figure it out. That fails immediately. The GPU cannot see JavaScript object fields, prototypes, Maps, sparse arrays, or closures. It sees bytes. If the shader expects a struct with a float, an integer, and padding, the bytes have to be packed that way before the dispatch begins.',
        'A second naive plan is to create one general buffer and use it for everything: upload, shader read, shader write, vertex input, copy source, and CPU readback. WebGPU rejects that looseness. Usage flags are part of the resource contract. They let the browser validate commands before work reaches the driver. Missing a flag is not a small hint; it makes the command illegal.',
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        'The core insight is that GPU programming is data-structure programming. Before the shader is fast, the data has to become flat, typed, aligned, and addressable. A TypedArray is often the host-side staging form because it already has a byte-level representation. A GPUBuffer is the device-side resource that receives those bytes.',
        'This is why WebAssembly Linear Memory, Apache Arrow Columnar Memory, and Compressed Sparse Row Graph are good prerequisites. They all teach the same lesson: when code crosses a low-level boundary, object shape disappears and layout becomes the API. WebGPU makes that lesson visible with validation errors instead of undefined driver behavior.',
      ],
    },
    {
      heading: 'Buffers And Usage Flags',
      paragraphs: [
        'A GPUBuffer has a size and a set of allowed uses. A uniform buffer is for small constant data such as dimensions, coefficients, or camera matrices. A storage buffer is for larger arrays that a compute shader may read or write. Vertex and index buffers feed draw calls. Copy source and copy destination flags allow transfer commands. Map flags allow controlled CPU access.',
        'These flags are a validation data structure. They prevent an app from accidentally reading from a write-only result buffer, mapping a buffer that should stay GPU-only, or copying into a resource that was never declared as a transfer destination. The cost is verbosity. The benefit is that resource intent is visible before the queue starts executing.',
      ],
    },
    {
      heading: 'Bind Groups As An ABI',
      paragraphs: [
        'A bind group layout is the shader-facing contract. It says slot 0 is a read-only storage buffer, slot 1 is a writable storage buffer, slot 2 is a uniform buffer, and so on. A bind group fills those slots with actual resources. The layout is like an ABI between JavaScript and WGSL: both sides must agree before work can run.',
        'This indirection matters because pipelines and resources change at different rates. A compute pipeline can be reused while different buffers are bound for different inputs. A render pipeline can draw many meshes by swapping bind groups. The layout keeps the shader contract stable while the concrete resources vary from pass to pass.',
      ],
    },
    {
      heading: 'Command Recording',
      paragraphs: [
        'WebGPU separates describing work from running work. JavaScript records commands into an encoder: begin a compute pass, set the pipeline, set the bind group, dispatch workgroups, end the pass, finish the command buffer, then submit it to the queue. The shader invocations do not run one by one as JavaScript reaches each line.',
        'This split is essential for performance and correctness. The browser can validate a complete command stream, schedule it on the GPU queue, and let JavaScript continue. It also means observation is delayed. If a shader writes an output buffer, JavaScript cannot read the result until the GPU has completed the work and the data has been copied into mappable memory.',
      ],
    },
    {
      heading: 'What The Visual Proves',
      paragraphs: [
        'The resource-binding view proves that there are two separate translations. First, host data becomes GPUBuffer bytes through writes, maps, or copies. Second, those buffers become shader-visible resources through a bind group layout and a bind group. The shader never receives the original JavaScript structure. It receives slots backed by typed bytes.',
        'The compute-pass view proves the timeline. Input buffers feed a bind group. The shader runs across workgroups. Output lands in a storage buffer. CPU readback requires a copy into staging memory and an asynchronous map. The important distinction is description versus execution: JavaScript submits a plan, while the GPU completes that plan later.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The model works because every boundary has an explicit contract. Buffer usage flags describe legal operations. Bind group layouts describe shader access. WGSL declarations describe how bytes are interpreted. Command encoders describe order. Queue submission describes when the GPU is allowed to start. None of those pieces is optional ceremony.',
        'That explicitness lets WebGPU be both low-level and safe for the web. The browser can reject inconsistent resource use before it becomes a driver crash or a security problem. The developer gets a predictable mental model: if the bytes, bindings, and commands line up, the GPU can run the work without needing to understand JavaScript objects.',
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        'The first cost is setup. Creating buffers, writing bytes, building layouts, creating pipelines, recording commands, and reading results can dominate tiny workloads. A CPU loop may beat a GPU dispatch when the data set is small or when every step needs immediate JavaScript feedback. WebGPU rewards batches, not chatty back-and-forth calls.',
        'The second cost is layout discipline. WGSL alignment, struct padding, array strides, and storage-buffer bounds all matter. A single mismatch between JavaScript packing and shader declarations can produce wrong answers. Writable storage buffers also require race discipline: many invocations writing the same location need atomics, reductions, or a different algorithm shape.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'WebGPU wins when the data is large, flat, and parallel. A sparse PageRank example is ideal: rowPtr and colIdx from a CSR graph become read-only storage buffers, rank values become a storage buffer, next-rank values become a writable buffer, and constants fit in a uniform buffer. One dispatch can process many vertices independently.',
        'Graphics workloads use the same resource model. Texture atlases, depth buffers, G-buffers, and framegraph resources are all explicit GPU resources with lifetimes and access patterns. Compute workloads add another path: prefix scans, compaction, particle updates, physics steps, and small machine-learning kernels can stay on the GPU for many frames.',
      ],
    },
    {
      heading: 'Failure Modes',
      paragraphs: [
        'The most common failure is transfer dominance. Uploading a small array, running one tiny shader, and pulling the whole result back can be slower than doing the work on the CPU. Another failure is accidental synchronization: frequent MAP_READ readbacks force JavaScript to wait for the GPU and erase most of the parallelism.',
        'Other failures are structural. A buffer may miss a required usage flag. A bind group may not match the layout. A shader may assume a stride different from the TypedArray packing. A dispatch may use too many workgroups or forget bounds checks. These bugs are easier to debug when every buffer has a written table: name, size, usage, binding, producer, consumer, and readback need.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Primary references are the WebGPU specification, the WGSL specification, and MDN pages for WebGPU, GPUBuffer, GPUBindGroup, GPUDevice.createBindGroupLayout, and GPUCommandEncoder. WebGPU Fundamentals is a practical companion for storage buffers and compute examples.',
        'Study WebAssembly Linear Memory and Apache Arrow Columnar Memory before writing complex buffers. Then study Compressed Sparse Row Graph and PageRank to see a real flat data structure become GPU input. For graphics, continue with Texture Atlas and Mipmaps, Depth Buffer Z-Test, Deferred G-Buffer, and Render Graph Framegraph Resource Lifetimes. For compute, continue with WebGPU Parallel Prefix Scan and GPU All-Reduce.',
      ],
    },
  ],
};
