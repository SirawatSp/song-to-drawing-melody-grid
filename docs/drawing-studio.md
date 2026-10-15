# Singing Sketchbook

Live app: https://sirawatsp.github.io/song-to-drawing-melody-grid/paint.html

This is an original browser drawing instrument inspired by the draw-to-music interaction in Play Music Theory. Its canvas, event compiler, sound patches and UI are implemented here. No third-party sound engine, app source or instrument samples are embedded. Color meanings follow the palette already discussed with the user; synthesized sound characters are our own.

## What you can do

- Draw with pointer events (mouse, touch or pen); use nine clearly labeled instrument colors.
- Erase an entire stroke, undo/redo up to 40 changes, clear reversibly, show/hide the grid, choose ink size.
- Play left-to-right, loop or play once, stop, change tempo/volume/key/scale/octave/range/grid subdivision.
- Open PNG/JPEG/WebP drawings (up to 10 MB). Hear approximate palette colors, use one voice, or keep the image silent for tracing. Background/light pixels are ignored with adjustable sensitivity.
- Import a melody guide from the existing grid editor, or load the score-based La La Land study. Guides are silent; a separate button converts their events into colored strokes. Missing pitches and quantization approximation are reported.
- Download editable drawing JSON (including its image), PNG artwork, or mono 44.1 kHz PCM WAV audio (one canvas loop plus a 0.5-second release tail).
- Autosave on this device. Imported images are processed in the browser and are not sent to a service. Export JSON for portability. Code and the original garden example live in the existing GitHub cloud repository.

## Musical mapping

The scale is built upward from the selected key and low octave. Middle C is C4/MIDI 60. Time spans exactly the selected 4/8/16/32 quarter-note beats across the canvas. Snap divides each beat into 1/2/3/4/6/8 cells.

Normalized stroke coordinates survive resizing. A point at x enters `floor(x × beats × subdivisions)`; y selects its scale lane from low to high. Interpolated segments occupy every crossed time/pitch cell, so a diagonal curve adds intermediate notes. Horizontal runs at a single pitch become held notes. Separate strokes remain separate note attacks, including adjacent repeated pitches. Brush width is visual only.

Images are fitted into a 1024×512 transparent image plane and sampled on a 256×128 grid. Opaque dark/colored samples are classified to the nearest palette color (or the chosen single voice). These samples use the same pitch/time cells as ink. Their musical interpretation is approximate; it is not music transcription or an exact reconstruction of an image's intended melody.

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
