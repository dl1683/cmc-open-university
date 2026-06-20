// AudioLDM moves text-to-audio generation into a latent representation:
// CLAP-style text/audio embeddings condition a latent diffusion model, then a
// decoder renders waveform audio.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'audioldm-latent-audio-diffusion-case-study',
  title: 'AudioLDM Latent Audio Diffusion Case Study',
  category: 'AI & ML',
  summary: 'Text-to-audio generation with latent diffusion: CLAP conditioning, audio latents, denoising, waveform decoding, edit masks, and evaluation ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['latent pipeline', 'audio edits'], defaultValue: 'latent pipeline' },
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

function audioGraph(title) {
  return graphState({
    nodes: [
      { id: 'prompt', label: 'text', x: 0.8, y: 3.2, note: 'prompt' },
      { id: 'clapT', label: 'CLAP-T', x: 2.3, y: 2.3, note: 'text emb' },
      { id: 'clapA', label: 'CLAP-A', x: 2.3, y: 4.4, note: 'audio emb' },
      { id: 'latent', label: 'latent', x: 4.2, y: 3.3, note: 'z' },
      { id: 'noise', label: 'noise', x: 5.9, y: 4.4, note: 'zt' },
      { id: 'denoise', label: 'denoise', x: 7.2, y: 3.3, note: 'LDM' },
      { id: 'mel', label: 'mel', x: 8.6, y: 2.4, note: 'spec' },
      { id: 'wave', label: 'wave', x: 9.5, y: 4.0, note: 'audio' },
    ],
    edges: [
      { id: 'e-prompt-clapt', from: 'prompt', to: 'clapT' },
      { id: 'e-clapt-denoise', from: 'clapT', to: 'denoise' },
      { id: 'e-clapa-latent', from: 'clapA', to: 'latent' },
      { id: 'e-latent-noise', from: 'latent', to: 'noise' },
      { id: 'e-noise-denoise', from: 'noise', to: 'denoise' },
      { id: 'e-denoise-mel', from: 'denoise', to: 'mel' },
      { id: 'e-mel-wave', from: 'mel', to: 'wave' },
    ],
  }, { title });
}

function* latentPipeline() {
  yield {
    state: audioGraph('Text-conditioned latent audio generation'),
    highlight: { active: ['prompt', 'clapT', 'denoise', 'e-prompt-clapt', 'e-clapt-denoise'], found: ['latent', 'noise'] },
    explanation: 'AudioLDM conditions latent diffusion with text embeddings from contrastive language-audio pretraining. The denoiser works in a compact latent audio space instead of directly generating every waveform sample.',
    invariant: 'The text condition guides the latent denoising path; the decoder is responsible for turning latents back into audible structure.',
  };

  yield {
    state: labelMatrix(
      'Audio tensors',
      [
        { id: 'wave', label: 'wave' },
        { id: 'mel', label: 'mel' },
        { id: 'latent', label: 'latent' },
        { id: 'embed', label: 'embed' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'job', label: 'job' },
      ],
      [
        ['wav', 'listen'],
        ['t/f', 'decode'],
        ['z grid', 'diff'],
        ['vec', 'cond'],
      ],
    ),
    highlight: { active: ['latent:job', 'embed:job'], compare: ['wave:shape', 'mel:shape'] },
    explanation: 'The implementation is a stack of representations. Waveforms are for playback, spectrogram-like features are for audio rendering, latents are for efficient diffusion, and embeddings carry text-audio alignment.',
  };

  yield {
    state: audioGraph('Denoised latent becomes spectrogram and waveform'),
    highlight: { active: ['noise', 'denoise', 'mel', 'wave', 'e-noise-denoise', 'e-denoise-mel', 'e-mel-wave'], compare: ['clapT'] },
    explanation: 'After iterative denoising, the latent decoder and vocoder-like rendering path produce audible sound. The model has to preserve event timing, texture, and prompt semantics through several representation changes.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'second', min: 0, max: 8 }, y: { label: 'energy', min: 0, max: 100 } },
      series: [
        { id: 'rain', label: 'rain', points: [{ x: 0, y: 40 }, { x: 1, y: 45 }, { x: 2, y: 47 }, { x: 3, y: 49 }, { x: 4, y: 48 }, { x: 5, y: 46 }, { x: 6, y: 44 }, { x: 7, y: 43 }] },
        { id: 'thunder', label: 'thunder', points: [{ x: 0, y: 8 }, { x: 1, y: 12 }, { x: 2, y: 18 }, { x: 3, y: 82 }, { x: 4, y: 35 }, { x: 5, y: 13 }, { x: 6, y: 11 }, { x: 7, y: 10 }] },
      ],
      markers: [
        { id: 'hit', x: 3, y: 82, label: 'event' },
      ],
    }),
    highlight: { active: ['rain', 'thunder', 'hit'] },
    explanation: 'Audio quality is temporal. A good generation does not only match a label such as rain; it places events, ambience, and dynamics at plausible times.',
  };
}

function* audioEdits() {
  yield {
    state: labelMatrix(
      'Edit masks',
      [
        { id: 'inpaint', label: 'paint' },
        { id: 'style', label: 'style' },
        { id: 'super', label: 'super' },
        { id: 'mix', label: 'mix' },
      ],
      [
        { id: 'mask', label: 'mask' },
        { id: 'condition', label: 'cond' },
      ],
      [
        ['span', 'gap'],
        ['global', 'texture'],
        ['band', 'restore'],
        ['stems', 'mix'],
      ],
    ),
    highlight: { active: ['inpaint:mask', 'style:condition', 'super:mask'], compare: ['mix:condition'] },
    explanation: 'Latent audio diffusion can support edits because the state is structured. Masks can target time spans, frequency bands, style vectors, or separated stems depending on the product.',
  };

  yield {
    state: audioGraph('Inpainting preserves context and regenerates a gap'),
    highlight: { active: ['latent', 'noise', 'denoise', 'mel'], found: ['prompt'], compare: ['wave'] },
    explanation: 'For inpainting, the known audio context stays fixed while the masked latent span is noised and regenerated. The prompt and surrounding sound both condition the missing segment.',
  };

  yield {
    state: labelMatrix(
      'Evaluation ledger',
      [
        { id: 'fd', label: 'FD' },
        { id: 'sem', label: 'sem' },
        { id: 'pref', label: 'human' },
        { id: 'safety', label: 'safety' },
      ],
      [
        { id: 'asks', label: 'asks' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['dist', 'proxy'],
        ['match', 'shallow'],
        ['prefs', 'cost'],
        ['policy', 'miss'],
      ],
    ),
    highlight: { active: ['fd:asks', 'sem:asks', 'pref:asks', 'safety:asks'], compare: ['fd:risk', 'sem:risk'] },
    explanation: 'Audio evaluation needs several ledgers. Distribution metrics, prompt matching, human preference, safety review, and latency all catch different failure modes.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'guidance', min: 0, max: 10 }, y: { label: 'relative score', min: 0, max: 100 } },
      series: [
        { id: 'align', label: 'align', points: [{ x: 1, y: 40 }, { x: 3, y: 62 }, { x: 5, y: 78 }, { x: 7, y: 85 }, { x: 9, y: 88 }] },
        { id: 'natural', label: 'natural', points: [{ x: 1, y: 86 }, { x: 3, y: 84 }, { x: 5, y: 78 }, { x: 7, y: 66 }, { x: 9, y: 48 }] },
      ],
      markers: [
        { id: 'trade', x: 5, y: 78, label: 'route' },
      ],
    }),
    highlight: { active: ['align', 'natural', 'trade'] },
    explanation: 'Guidance can improve prompt adherence while hurting naturalness. A production tool often routes preview, final render, and edit modes to different guidance and sampler settings.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'latent pipeline') yield* latentPipeline();
  else if (view === 'audio edits') yield* audioEdits();
  else throw new InputError('Pick an AudioLDM view.');
}

export const article = {
  references: [
    { title: 'AudioLDM: Text-to-Audio Generation with Latent Diffusion Models', url: 'https://proceedings.mlr.press/v202/liu23f.html' },
    { title: 'AudioLDM project page', url: 'https://audioldm.github.io/' },
    { title: 'AudioLDM paper PDF', url: 'https://proceedings.mlr.press/v202/liu23f/liu23f.pdf' },
  ],
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "latent pipeline" view traces the forward path of text-to-audio generation: a text prompt enters CLAP-T for embedding, the latent space is noised, the denoiser iterates conditioned on the text embedding, and the result decodes through a mel spectrogram into a waveform. Active (green) nodes are the current processing stage. Found (blue) marks the latent and noise tensors that become reachable once CLAP conditioning is established.',
        'The "audio edits" view shows how latent structure enables post-generation editing: inpainting masks, style transfer, super-resolution, and stem mixing. Active items are the mask-condition pair being applied. Compare (orange) marks the evaluation metrics that judge the result.',
        {
          type: 'note',
          text: 'The matrix frames use label encoding. The "shape" column shows the tensor geometry; the "job" column shows what that representation does in the pipeline. The energy plot shows event placement over time -- a test of whether generation captures temporal structure, not just label presence.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Text-to-audio generation must produce acoustic scenes, not labels. "Rain in a metal warehouse with distant thunder" requires reverberant metal surfaces, continuous rain texture at steady energy, a transient thunder event placed at a plausible time, and distance cues that separate the thunder from the foreground rain. A classifier can tag "rain" and "thunder." A generative model must compose them into a physically coherent sound field.',
        {
          type: 'quote',
          text: 'We propose AudioLDM, a text-to-audio generation framework that leverages a latent space trained with audio data only, while conditioning is provided by CLAP text embeddings at inference.',
          attribution: 'Liu et al., AudioLDM (ICML 2023)',
        },
        'The core tension: audio has extreme temporal resolution. At 16 kHz mono, a 10-second clip is 160,000 samples. At 48 kHz stereo, the same clip is 960,000 samples. Generating each sample autoregressively or diffusing directly in waveform space makes the sequence length problem orders of magnitude harder than image generation, where a 256x256 image is only 65,536 pixels.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The straightforward path is waveform-domain diffusion: train a denoising model that operates directly on raw audio samples. WaveGrad and DiffWave demonstrated this works -- the model iteratively refines a noise signal into a clean waveform.',
        'This approach has real merit. It avoids lossy compression, preserves phase information, and needs no separate decoder. For short, single-speaker utterances, waveform diffusion produces high-fidelity results.',
        {
          type: 'table',
          headers: ['Approach', 'Strength', 'Scaling wall'],
          rows: [
            ['Waveform diffusion', 'No compression loss; preserves phase', 'Sequence length explodes with duration and sample rate'],
            ['Autoregressive waveform (WaveNet)', 'Exact likelihood; high fidelity', 'O(n) sequential generation; cannot parallelize'],
            ['Clip retrieval + concatenation', 'Perfect fidelity for known assets', 'Cannot compose novel scenes; catalog size limits vocabulary'],
            ['Spectrogram generation + vocoder', 'Shorter sequence than raw audio', 'Phase reconstruction artifacts; vocoder quality ceiling'],
          ],
        },
        'Teams reach for waveform diffusion because it feels like the honest approach: generate the thing you actually want. The problem is that "the thing you actually want" is a very long sequence with strict perceptual constraints.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Waveform diffusion hits a compute-fidelity wall as duration or sample rate increases. A 10-second clip at 16 kHz requires the denoiser to operate on a 160,000-length sequence at every diffusion step. With 200 denoising steps, that is 32 million forward-pass sample positions for one generation. Doubling the sample rate doubles the sequence. Adding stereo doubles it again.',
        {
          type: 'bullets',
          items: [
            'Memory: the U-Net must hold the full waveform tensor plus intermediate activations at each step. A 10-second 48 kHz stereo clip at fp32 is ~3.7 MB just for the input tensor, multiplied by batch size, model width, and activation checkpointing overhead.',
            'Latency: each denoising step processes the entire sequence. More steps improve quality but multiply wall-clock time linearly.',
            'Conditioning mismatch: text embeddings are semantic (hundreds of dimensions). Waveform samples are acoustic (tens of thousands of time points). The cross-attention bridge between these scales is expensive and often shallow -- the model learns to match broad categories rather than fine temporal placement.',
            'Training data: paired text-audio datasets are small compared to image-text datasets. AudioCaps has ~50,000 clips. LAION-Audio-630K helped, but even 630K is modest for training a model that must generalize across environmental sounds, music, speech, and effects.',
          ],
        },
        'The wall is not that waveform diffusion produces bad audio. It produces good audio slowly, at high cost, and with difficulty scaling to the durations and sample rates that production sound design requires.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Compress audio into a learned latent space first. Run diffusion in that compact space. Decode back to audio only once, at the end.',
        {
          type: 'diagram',
          label: 'AudioLDM three-stage pipeline',
          text: 'Stage 1: Audio compression (trained separately)\n  waveform --> mel spectrogram --> VAE encoder --> latent z\n  latent z --> VAE decoder --> mel spectrogram --> HiFi-GAN --> waveform\n\nStage 2: Latent diffusion (the generative model)\n  z_0 (clean latent) --> add noise --> z_T (pure noise)\n  z_T --> denoise with U-Net conditioned on CLAP text embedding --> z_0\n\nStage 3: Conditioning bridge (CLAP)\n  (text, audio) pairs --> contrastive pretraining --> shared embedding space\n  At inference: text --> CLAP text encoder --> condition vector for U-Net',
        },
        'The latent space is the key compression. A 10-second mel spectrogram at 16 kHz might be shaped [1, 64, 624] (64 mel bins, 624 time frames). The VAE compresses this to, say, [1, 8, 78] -- an 8-channel latent with 78 time steps. The diffusion model now operates on 624 values per channel instead of 160,000 waveform samples. That is a ~256x reduction in sequence length.',
        {
          type: 'note',
          text: 'AudioLDM borrows this architecture from Stable Diffusion (Rombach et al., 2022), which proved latent diffusion for images. The insight transfers: if you can train a good autoencoder for the target domain, you can run diffusion in the bottleneck and recover full-resolution output through the decoder.',
        },
        'The second insight is the conditioning trick. AudioLDM trains the latent diffusion model using CLAP audio embeddings as the condition -- not text. At inference time, it substitutes CLAP text embeddings instead, because CLAP was trained to align text and audio into the same vector space. This means the diffusion model never sees a text-audio pair during training. It only needs audio and the corresponding CLAP audio embedding. Text enters only at inference through the shared CLAP space.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'AudioLDM has three independently trained components. Understanding the pipeline means understanding each one and the interfaces between them.',
        {
          type: 'table',
          headers: ['Component', 'Input', 'Output', 'Trained on'],
          rows: [
            ['VAE (audio autoencoder)', 'Mel spectrogram', 'Latent z (compact tensor)', 'Audio reconstruction loss + KL regularization'],
            ['Latent diffusion U-Net', 'Noised latent z_t + CLAP condition', 'Predicted noise (or denoised z_0)', 'Noise prediction loss in latent space'],
            ['CLAP', 'Text or audio', 'Embedding vector', 'Contrastive text-audio pairs'],
            ['HiFi-GAN vocoder', 'Mel spectrogram', 'Waveform', 'Adversarial + mel reconstruction loss'],
          ],
        },
        'The forward pass at inference:',
        {
          type: 'code',
          language: 'python',
          text: '# Pseudocode: AudioLDM inference\ndef generate(prompt, steps=200, guidance_scale=2.5, seed=42):\n    # 1. Encode text prompt via CLAP text encoder\n    c_text = clap.encode_text(prompt)        # shape: [1, 512]\n\n    # 2. Sample pure noise in latent space\n    z_T = torch.randn(1, 8, 78, generator=seed)  # latent shape\n\n    # 3. Iterative denoising conditioned on text embedding\n    z_t = z_T\n    for t in reversed(range(steps)):\n        # Classifier-free guidance: blend conditional and unconditional\n        noise_cond = unet(z_t, t, condition=c_text)\n        noise_uncond = unet(z_t, t, condition=null_embedding)\n        noise_pred = noise_uncond + guidance_scale * (noise_cond - noise_uncond)\n        z_t = scheduler.step(noise_pred, t, z_t)\n\n    # 4. Decode latent to mel spectrogram\n    mel = vae.decode(z_t)                    # shape: [1, 64, 624]\n\n    # 5. Vocoder: mel spectrogram to waveform\n    waveform = hifigan(mel)                  # shape: [1, 160000]\n    return waveform',
        },
        {
          type: 'note',
          text: 'The classifier-free guidance trick is critical. During training, the condition embedding is randomly dropped (replaced with a null vector) some fraction of the time. At inference, the model generates both a conditioned and unconditioned noise prediction, then amplifies the difference. Higher guidance_scale pushes the output harder toward the prompt but can hurt naturalness.',
        },
        'The VAE is trained first and frozen. Its encoder maps mel spectrograms to a compact latent distribution; its decoder reconstructs mel spectrograms from latent samples. The diffusion U-Net is trained second, operating entirely in this frozen latent space. CLAP is also pretrained and frozen. This modular design means each component can be improved or replaced independently.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Three properties make the pipeline correct.',
        {
          type: 'bullets',
          items: [
            'Reconstruction fidelity: the VAE preserves enough acoustic structure that decoding a clean latent produces recognizable audio. The mel spectrogram intermediate representation already discards phase (which HiFi-GAN reconstructs), so the VAE only needs to compress magnitude-frequency information -- a smoother, lower-dimensional signal than raw waveforms.',
            'Conditioning alignment: CLAP maps text and audio into a shared embedding space via contrastive learning. Because "the sound of rain" and an actual rain recording land near each other in CLAP space, the diffusion model trained on audio embeddings responds meaningfully to text embeddings at inference.',
            'Iterative refinement: diffusion provides a gradual denoising trajectory. Early steps establish coarse structure (is this rain or music?). Later steps refine texture and timing. Guidance can steer the trajectory toward the prompt without requiring the model to produce the right answer in a single forward pass.',
          ],
        },
        'The training trick -- conditioning on CLAP audio embeddings, then swapping in CLAP text embeddings at inference -- works because CLAP was specifically trained to close the modality gap. If the CLAP text encoder maps "thunder" far from actual thunder audio embeddings, the substitution fails and the generated audio drifts from the prompt.',
        {
          type: 'quote',
          text: 'AudioLDM achieves state-of-the-art text-to-audio generation with latent diffusion models trained on audio embeddings without utilizing text data during training.',
          attribution: 'Liu et al., AudioLDM abstract',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Prompt: "rain in a metal warehouse with distant thunder."',
        {
          type: 'table',
          headers: ['Step', 'Operation', 'Tensor shape', 'What happens'],
          rows: [
            ['1', 'CLAP text encode', '[1, 512]', 'Prompt mapped to a vector near rain/metal/thunder audio embeddings in CLAP space'],
            ['2', 'Sample noise', '[1, 8, 78]', 'Pure Gaussian noise in the 8-channel latent space; 78 time frames cover ~10 seconds'],
            ['3', 'Denoise (200 steps)', '[1, 8, 78]', 'U-Net gradually shapes noise into a latent with rain-like energy distribution and a transient peak around frame 40'],
            ['4', 'VAE decode', '[1, 64, 624]', 'Latent expands to a 64-bin mel spectrogram with 624 time frames'],
            ['5', 'HiFi-GAN vocoder', '[1, 160000]', 'Mel spectrogram converted to 16 kHz waveform; phase reconstructed by the vocoder'],
          ],
        },
        'A successful generation shows continuous broadband rain energy, a reverberant character consistent with an enclosed metal space, and a thunder transient that rises and decays over ~1-2 seconds at a plausible time offset. A failed generation might produce generic outdoor rain (no warehouse reverb), place thunder as a sharp click instead of a rolling transient, or generate steady-state noise with no event structure at all.',
        {
          type: 'note',
          text: 'The guidance scale controls the tradeoff. At guidance_scale=1.0 (no guidance), the output is diverse but may ignore the prompt. At guidance_scale=5.0, the output adheres more tightly to "rain" and "thunder" but may sound harsh or repetitive. AudioLDM reports best results around guidance_scale=2.5 for general audio.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Parameter', 'Effect on cost', 'Typical range'],
          rows: [
            ['Denoising steps', 'Linear increase in latency per generation', '50 (fast preview) to 200 (high quality)'],
            ['Guidance scale', 'No extra denoising steps, but 2x U-Net calls per step (conditional + unconditional)', '1.0 to 5.0; paper default 2.5'],
            ['Audio duration', 'Increases latent time dimension; memory and compute scale proportionally', '2s to 10s typical; longer requires chunking'],
            ['Sample rate', 'Higher rate increases mel resolution and vocoder cost; does not change latent diffusion cost if VAE is retrained', '16 kHz (AudioLDM default), 48 kHz (AudioLDM 2)'],
            ['Batch size', 'Linear memory scaling; enables best-of-N selection', '1 (interactive) to 16 (batch evaluation)'],
          ],
        },
        'Latent diffusion reduces the sequence length by ~256x compared to waveform diffusion, but the denoising loop still dominates wall-clock time. A 200-step generation takes seconds on a GPU, not milliseconds. The VAE decode and vocoder are single forward passes and comparatively cheap.',
        'For production serving, teams often run three quality tiers:',
        {
          type: 'bullets',
          items: [
            'Preview: 50 steps, guidance 2.0, 4-second clips. Enough to judge prompt relevance. Sub-second on a modern GPU.',
            'Standard: 200 steps, guidance 2.5, 10-second clips. Publication quality for most use cases.',
            'Edit mode: same step count but only denoises the masked latent region. Surrounding context is fixed, so the cost scales with mask size, not clip length.',
          ],
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Domain', 'Use case', 'Why latent audio diffusion fits'],
          rows: [
            ['Game development', 'Procedural ambience and foley', 'Infinite variation from text prompts; no need to license every asset'],
            ['Film/video prototyping', 'Scratch audio for rough cuts', 'Directors hear a scene concept before commissioning final sound design'],
            ['Accessibility', 'Audio descriptions and sonification', 'Generate illustrative sounds from text descriptions for visually impaired users'],
            ['Dataset augmentation', 'Training data for audio classifiers', 'Expand rare event categories (glass breaking, specific bird calls) without field recording'],
            ['Interactive art', 'Generative soundscapes', 'Real-time audience interaction with evolving audio scenes'],
          ],
        },
        'AudioLDM 2 (2024) extended the architecture to handle audio, music, and speech in a unified model by adding a GPT-2-based "language of audio" intermediate representation. This expanded the domain from environmental sounds to a broader range of audio types, though music and speech remain harder than ambience.',
        'Latent audio editing is a distinct product surface. A sound designer generates a 10-second clip, likes 8 seconds of it, masks the 2-second gap, and regenerates just that region under a refined prompt. The latent structure makes this natural because the mask operates on a small tensor, not 32,000 waveform samples.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Shallow prompt adherence: the model matches broad categories ("rain," "thunder") but misses compositional detail ("metallic reverb," "distant"). CLAP embeddings compress rich text descriptions into a single 512-d vector, losing spatial and relational nuance.',
            'Transient smearing: diffusion models tend to blur sharp events. A thunderclap or gunshot may spread across multiple time frames, losing the attack sharpness that makes it sound real.',
            'Texture looping: steady-state sounds (rain, wind, traffic) can develop audible repetition patterns when the latent space has limited temporal capacity.',
            'Phase artifacts: the mel spectrogram discards phase information. HiFi-GAN reconstructs plausible phase, but the result can sound slightly "synthetic" on careful listening, especially for tonal content.',
            'Training data bias: AudioLDM was trained primarily on AudioCaps and environmental sound datasets. Prompts outside that distribution (specific musical instruments, non-English speech, industrial machinery) produce unreliable results.',
            'Edit boundary seams: latent inpainting can create audible discontinuities at mask edges. The transition between preserved and regenerated regions needs careful crossfading that the raw model does not guarantee.',
          ],
        },
        {
          type: 'note',
          text: 'The Frechet Audio Distance (FAD) metric commonly used to evaluate audio generation correlates poorly with human preference for individual clips. A model can achieve good FAD (distribution-level realism) while producing individual clips that sound wrong. Production evaluation requires listening tests, not just aggregate statistics.',
        },
        'Latent audio generation is inappropriate for domains requiring exact acoustic fidelity: forensic audio evidence, medical auscultation, safety-critical alarms, voice identity, and music production where licensing and timbral accuracy matter. In those domains, "plausible but not real" is a liability.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'AudioLDM paper (ICML 2023): https://proceedings.mlr.press/v202/liu23f.html -- the core architecture, CLAP conditioning trick, and AudioCaps/AudioSet evaluation.',
            'AudioLDM project page: https://audioldm.github.io/ -- audio samples, model weights, and comparison with DiffSound and other baselines.',
            'Stable Diffusion / Latent Diffusion (Rombach et al., CVPR 2022): https://arxiv.org/abs/2112.10752 -- the image-domain predecessor that AudioLDM adapts for audio.',
            'CLAP (LAION): https://arxiv.org/abs/2211.06687 -- contrastive language-audio pretraining that provides the text-audio embedding bridge.',
            'HiFi-GAN (Kong et al., NeurIPS 2020): https://arxiv.org/abs/2010.05646 -- the mel-to-waveform vocoder used in AudioLDM decoding.',
          ],
        },
        'Prerequisite: study Diffusion Models for the denoising loop mechanics (noise schedules, score matching, classifier-free guidance). Study Variational Autoencoders for the latent compression stage (encoder-decoder, KL regularization, reconstruction loss).',
        'Extension: AudioLDM 2 unifies audio, music, and speech generation by adding a GPT-2-based semantic planning stage before latent diffusion. Study that for how the architecture evolves beyond environmental sounds.',
        'Contrast: WaveNet and WaveGrad generate audio directly in waveform space -- no latent compression, no vocoder. Comparing them to AudioLDM clarifies exactly what latent compression buys (speed, scalability) and what it costs (reconstruction fidelity, phase artifacts).',
      ],
    },
  ],
};
