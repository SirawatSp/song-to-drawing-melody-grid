# Singing Sketchbook

Live app: https://sirawatsp.github.io/song-to-drawing-melody-grid/paint.html

This is an original browser drawing instrument inspired by the draw-to-music interaction in Play Music Theory. Its canvas, event compiler, sound patches and UI are implemented here. No third-party sound engine, app source or instrument samples are embedded. Color meanings follow the palette already discussed with the user; synthesized sound characters are our own.

## What you can do

- Draw with pointer events (mouse, touch or pen); use 16 clearly labeled instrument colors.
- Erase an entire stroke, undo/redo up to 40 changes, clear reversibly, show/hide the grid, choose ink size.
- Play left-to-right, loop or play once, stop, change tempo/volume/key/scale/octave/range/grid subdivision.
- Open PNG/JPEG/WebP drawings (up to 100 MB). Hear approximate palette colors, use one voice, or keep the image silent for tracing. Background/light pixels are ignored with adjustable sensitivity.
- Import a melody guide from the existing grid editor, or load the score-based La La Land study. Guides are silent; a separate button converts their events into colored strokes. Missing pitches and quantization approximation are reported.
- Download editable drawing JSON (including its image), PNG artwork, MP4 video (still drawing + sound), or mono 44.1 kHz PCM WAV audio (one canvas loop plus a 0.5-second release tail).
- Autosave on this device. Imported images are processed in the browser and are not sent to a service. Export JSON for portability. Code and the original garden example live in the existing GitHub cloud repository.

## Musical mapping

The scale is built upward from the selected key and low octave. Middle C is C4/MIDI 60. Time spans exactly the selected 4/8/16/32 quarter-note beats across the canvas. Snap divides each beat into 1/2/3/4/6/8 cells.

Normalized stroke coordinates survive resizing. A point at x enters `floor(x × beats × subdivisions)`; y selects its scale lane from low to high. Interpolated segments occupy every crossed time/pitch cell, so a diagonal curve adds intermediate notes. Horizontal runs at a single pitch become held notes. Separate strokes remain separate note attacks, including adjacent repeated pitches. Brush width is visual only.

Images are fitted without upscaling into a transparent 2:1 image plane. High detail retains up to 4096×2048 pixels and analyzes up to 1024×512; Balanced retains up to 2048×1024 and analyzes up to 512×256. Auto selects Balanced for a mobile viewport or a reported device-memory budget of 4 GB or less. Browsers that omit the memory hint still use the viewport check. High detail is available manually on phones, with the same constrained source-decoding budget.

The importer reads PNG/JPEG/WebP dimensions before decoding: at most 80 megapixels on larger devices or 32 megapixels on constrained devices, and no side above 32,768 pixels. Native resizing, line-preserving contrast pooling, PNG encoding and sound-map analysis run in a module worker with OffscreenCanvas when supported. The fallback uses native asynchronous resizing and yields during pixel analysis; browsers without createImageBitmap accept only sources up to 12 megapixels. Preparation reports progress, supports cancellation, and has a 90-second worker timeout. Batch imports remain sequential and commit only after all images validate.

Contrast pooling preserves fine dark/colored lines that averaging could erase. The strongest qualifying ink sample per 2×2 analysis block is classified to the nearest palette color (or the chosen single voice). Compact version-2 drawing data stores these coordinates as packed samples, at most 131,072 anchors, rather than hundreds of thousands of editable point arrays. Legacy version-1 drawings remain readable. Old clients reject version-2 drawings instead of silently losing their image sound. These samples use the same pitch/time cells as ink. Their musical interpretation is approximate; increased detail is not music transcription or an exact reconstruction of an image's intended melody.

At most 12 notes sound in one time cell. Dense input reports dropped overlaps in the UI. Playback/export refuses more than 1,500 compiled events and asks for coarser Snap or simpler marks. A reference image and a melody guide do not enter the sounding compiler.

## Voices

Green Keys, orange Pluck, purple Bell, amber Marimba, blue Flute, pink Strings, light blue Chime, charcoal Bass, peach 8-bit. Each has an original Web Audio patch with its own oscillator spectrum and attack/decay/release. All colors obey the same pitch lanes; choosing Bass does not silently transpose the written pitch.

Playback and offline WAV export use the same synthesis function. A compressor and volume control manage overlapping voices. Stop cancels current, upcoming-loop, release-tail and audition oscillators. Playback also stops when the page is hidden.

## Source and performance limits

The La La Land reference remains the opening three bars of Leiki Ueda's arrangement, at printed 88 BPM. Written note events fit eighth-note cells and survive conversion to 13 separate strokes. No soundtrack performance, acoustic piano pedal or rubato is claimed. Imported or traced music needs its own verification against the exact source.

## Verification (16 October 2026, Asia/Bangkok)

- 18 Node tests cover scale centers, continuous runs, repeated-note attacks, curve interpolation, voice separation, silent backgrounds/guides, image classification, source-event preservation, dense-input reporting, import bounds, PCM headers and cancellation of scheduled next-loop audio, as well as the existing grid tests.
- Real browser pointer drag produced one stroke and four notes; Undo removed it and Redo restored it. Playback advanced its playhead and Stop worked.
- Garden example produced 35 strokes / 82 notes. Actual exported WAV: mono, 44.1 kHz, 5.071 seconds, nonzero waveform, peak PCM magnitude 17,229 (below clipping). PNG and editable JSON downloads succeeded.
- An uploaded exported garden image produced sounding notes; switching it to a reference produced zero notes. Image interpretation/density warnings were displayed. Local draft reload and editable-project import worked.
- A nine-color test project compiled to nine notes. Browser WAV export yielded nonzero signal in each of its nine instrument windows. No browser audio or JavaScript errors were logged.
- Grid editor → drawing studio bridge loaded the guide silently with A major, low octave 3, 88 BPM. Make guide playable produced 13 strokes / 13 notes and kept the recording-verification caveat.
- Visual review confirmed all short imported notes render as dots and the long D4 renders as a line. Erasing D4 changed 13 strokes/notes to 12; Undo restored 13.
- At a 390-pixel touch viewport the complete canvas fits its available width; it does not require horizontal panning. The temporary test viewport was reset.
- Cloud deployment runs the test suite before publishing. Publication is confirmed separately from local checks.

## Technical references

Implementation uses the browser's standard [Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Using_Pointer_Events), [AudioContext resume](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume) and [OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext). No API keys or server dependencies are needed.

## Ordered drawing sections and animated MP4

`drawing-sequence.mjs` validates complete project JSON, migrates legacy single drawings, compiles each section's quarter-note beats to absolute seconds, and resolves drawing/bar/playhead position from elapsed audio time. Existing normalized pixel/ink interpretation remains unchanged. Each section retains independent tempo, key, scale, range and subdivision. Empty/silent sections occupy time. A note's release may ring across the next section; no gap or release tail is inserted between sections.

The editor supports batch image import, title editing, selection, duplicate, removal, reordering and project-wide Undo/Redo (up to 20 revisions; the oldest image-heavy revisions are trimmed to keep retained image data within the project budget). Batch import creates one section per file and reuses an initial empty sheet. It applies the chosen image treatment and sensitivity to all selected files. All imports are validated before the project changes. Project JSON includes every embedded image and musical setting; legacy drawing imports become one section.

`drawing-storage.mjs` uses a device-local IndexedDB draft to accommodate several plan images. It falls back to localStorage only if IndexedDB is unavailable. Legacy localStorage is retained after migration. Writes are serialized and success is reported only after the transaction completes. Page hiding flushes pending saves. This is local persistence, not cloud synchronization; JSON is the cross-device backup.

Project limits: 64 sections, 256 million combined embedded image characters, 100 MB per input image, 48 million retained PNG data-URL characters per image, 384 MB project JSON input. Noisy images that exceed the retained-data budget must use Balanced quality. Playback/export limits: 10 minutes, 12,000 events total, 1,500 events per section and the existing 12-note simultaneous interpretation limit. Per-section bounds still apply. Rejections keep the current project intact.

`drawing-visual.mjs` paints an independent 1280×720 export canvas: artwork, pitch labels, beat/bar grid, key/scale/tempo, section title/index, bar/beat position, moving golden cursor and overall section timeline. Frame selection and cursor position use the same cumulative seconds as the audio events, including mixed tempos. Visual grids never enter the note compiler. Reference images retain their reference opacity; melody guides remain silent and are omitted from export.

`drawing-video.mjs` resumes its AudioContext within the initiating user gesture, awaits image preparation and shared offline sound rendering, then records canvas frames and audio via native MediaRecorder. Frames are repainted from `AudioContext.currentTime` at approximately 30 fps. Music starts independently of the recorder's `start` event to avoid a media-start deadlock. The current selection or entire sequence can be exported as MP4 or WAV; PNG always saves only the selected drawing.

MP4 capability prefers H.264/AAC, then H.264/Opus, then native `video/mp4`. A file must have an ISO BMFF `ftyp` signature; WebM is never renamed. Encoding/playback support varies by device. Cancellation, tab hiding, audio suspension and encoder failures discard partial output and release resources. No microphone, camera, server API or runtime dependency is needed.

Validation includes Node timing/order/migration tests, native browser import/save/reload/reorder/undo/playback flows, and FFmpeg video/audio inspection. The sequence browser check extracts frames on either side of the drawing boundary and measures playhead movement across frames. Physical mobile Safari is not covered by the Chromium viewport check.

Source API references: [MediaRecorder support detection](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static), [canvas captureStream](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream), [Web Audio stream destination](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamDestination), [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).

The PR workflow runs Node and browser checks and uploads screenshot/video evidence with read-only repository permissions. Main-only publication remains separate.


### Higher-detail import verification

The import upgrade adds unit coverage for profile selection, image-header preflight, limits before decoding, fine-line preservation, compact/legacy sound equivalence, malformed packed samples and a two-image playback cache. PR browser checks exercise an actual 4096×3072 PNG larger than 10 MB through preparation, editable JSON, IndexedDB reload, sound and MP4 export; they also cover cancellation, oversized dimensions, mobile Auto quality and the no-worker fallback. Timing measurements are recorded as CI observations, not a promise of equal speed on every device.

Section cards use small thumbnails. Playback and video keep only the current and next decoded full-size images, releasing earlier images as the sequence advances. The first two are prepared before playback; if the next image cannot be prepared in time, playback stops with an actionable message. Immutable image data is shared across undo snapshots. Oldest undo/redo snapshots are trimmed when retaining replaced images would exceed the 256-million-character raster budget. Export video resolution remains 1280×720.


### Orchestral palette

Seven appended voices bring the palette to 16: violin, cello, oboe, clarinet, French horn, trumpet and harp. The original nine IDs, indices, colors and synthesis patches remain stable. The Orchestra filter includes the new voices and existing flute/strings; Original 9 and All 16 remain available. Voice preview lasts 0.6 seconds plus its release so sustained instruments can be heard. The original eight-beat paper-orchestra example adds a section instead of replacing nonempty work, and can be undone.

The shared Web Audio scheduler renders all voices for live playback, WAV and MP4. Bowed tones use differing harmonic balances, attack and subtle cents-based vibrato. Reeds use distinct harmonic spectra; brass uses pitch-tracked filters and attack brightness; harp uses decaying near-harmonic partials. These are original synthesized approximations, not recordings or soundfonts. At most four sound oscillators plus one shared vibrato oscillator are used per new note; existing polyphony/event limits remain. No sample download, service, dependency, reverb tail or recording permission is added.

The compact image map already reserves four bits for a voice; indices 9–15 extend it without repacking old samples. Automatic color matching includes all 16 colors; existing stored maps are never reclassified. Newly importing an old exported raster may choose additional voices for intermediate/antialiased colors. Older clients may reject projects containing unfamiliar voices; use the upgraded app when opening them.
