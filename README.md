# Song-to-Drawing Melody Grid

A persistent, versioned visual reference studio for turning **note events into drawing guides**.

## New: Singing Sketchbook

**Draw and hear your own picture:** https://sirawatsp.github.io/song-to-drawing-melody-grid/paint.html

Choose from nine instrument colors, draw with a mouse/finger/pen, then press Play. Open a PNG/JPEG/WebP to hear its colors, play it with one selected voice, or use it as a silent tracing reference. Save editable drawing JSON, PNG art, a WAV audio loop, or an MP4 video of the drawing with its sound. All drawing controls are available without an unlock. The nine sounds are original synthesized timbres.

The grid editor's **Draw this melody** button sends its current note events to the sketchbook as a silent guide. **Make guide playable** creates separate colored strokes; source pitches outside the selected key/range are flagged, and timing approximated by Snap is reported. The existing melody source and recording-verification limits still apply.

Drawing sequences autosave in this browser. Imported images stay local; they are not uploaded to the repository or a transcription service. Download editable sequence JSON to move drawings between devices. The cloud repository stores the app and our original example, not automatic account-synced personal drawings.

Original example: [garden drawing](dist/downloads/singing-garden.drawing.json), [PNG](dist/downloads/singing-garden.png), [WAV](dist/downloads/singing-garden.wav). Implementation and verification: [docs/drawing-studio.md](docs/drawing-studio.md).

## Arrange plans as a sequence

Use **Import plans as sections** to import several PNG/JPG/WebP drawings at once, or **Add section** for another drawing. Each section keeps its own title, image, strokes, tempo, key, scale and canvas length. Use **Move earlier / Move later**, **Duplicate**, and **Remove section** to arrange the selected section; Undo restores removals and order changes.

**Play drawing** auditions the selected section. **Play sequence** plays every section continuously and switches the visible drawing at each boundary. Loop repeats the whole sequence. Empty or silent sections keep their full duration as rests. Bar grouping can be 3/4, 4/4 or 6/4; this groups quarter-note beats without changing pitches or note times. A section may span multiple bars or finish partway through a bar.

Projects support up to **64 sections**, **256 MB of embedded image data**, and **10 minutes / 12,000 notes** per playback/export, with at most 1,500 notes in any section. Import PNG/JPEG/WebP files up to **100 MB each**. **Auto** keeps up to 4096×2048 pixels on larger devices and 2048×1024 on phones or lower-memory devices; choose **High detail** or **Balanced** in the import dialog. Fine lines are preserved in the sound map, and progress/cancel controls keep large imports manageable. Dense pictures remain approximate pixel interpretations, with up to 12 simultaneous notes. More image detail does not establish a correct melody.

Imports have a decoded-source safety budget of 80 megapixels (32 on phones/lower-memory devices), with no side above 32,768 pixels. Retained PNG data is capped at 48 million characters per image; a noisy image may need Balanced quality. Saved-project input is capped at 384 MB. MP4 output remains 1280×720.

**Save editable sequence** stores all sections, embedded images, order and musical settings in one JSON file. **Open saved project** accepts both sequences and older single-drawing JSON files. Autosave uses IndexedDB on this device (with a small local-storage fallback); older local drafts migrate without deleting their original copy. This is not automatic cloud/account sync. Export JSON for cross-device work and backups.

## Export drawings with sound

Choose **All sections in order** or **Selected section only** for WAV and MP4. PNG saves only the selected drawing without musical guides.

**Video MP4** now creates a **1280×720 animated musical view**: the drawing, pitch lanes, beat/bar grid, key, scale, tempo, bar/beat position, moving playhead, section strip and overall timeline. At each section boundary the drawing and its musical labels change together. Silent melody guides are omitted and do not sound. The source events and visual annotations remain separate.

The snapshot of the whole sequence is frozen at export start. Audio uses the shared WAV renderer, with exact per-section tempo conversion and one 0.5-second final release tail; release sounds may overlap a section boundary naturally. Native recording adds about 0.2 seconds of padding. Preview and choose **Download MP4** after recording. Keep the tab visible; encoding takes about as long as the music. Cancellation/interruption discards incomplete output.

Everything runs locally without microphone/camera access, uploads, an external encoder or runtime dependencies. MP4 support is checked before encoding; H.264/AAC is preferred, followed by H.264/Opus or the native MP4 choice. Codec availability and playback compatibility depend on the browser/device. PNG/WAV remain available when native MP4 encoding is unsupported.

## Melody grid

- Live studio: https://SirawatSp.github.io/song-to-drawing-melody-grid/
- Drawing instrument: https://playmusictheory.net/play
- Default study: opening three bars of **Mia & Sebastian's Theme**, from Leiki Ueda's own arrangement. Right-hand melody only; about **6.14 seconds at the score's printed 88 BPM**.
- Status: **score-read arrangement; recording timing unverified**. No soundtrack recording or MIDI comparison has been performed. This does not claim to reproduce the soundtrack performance.

## Use

1. Open the studio. Compare Skeleton and Aesthetic overlay. Both preserve identical anchors and duration bars.
2. Choose **Play Music Theory · full canvas** when transferring to the instrument.
3. Use A / Major / 1 octave / Octave +1 / 88 BPM / 1/8 / Swing Off / Tune 0. Choose green keys; switch beat accompaniments off.
4. Use the site's ordinary Instrument unlock. A fresh free session is C-major pentatonic with triplet timing, and cannot reproduce this study's A-major pitches.
5. Draw one separate horizontal stroke per note. Tap near the center of a half-beat cell for an eighth note. For the D4 at beat 3, extend across six half-beat cells, through beat 5.75; lift before drawing the next D4 at beat 6.25. The guide's anchor is the exact onset; the app hears the entire occupied cell.
6. Leave the tail after beat 9 blank. The desktop canvas spans 16 beats (10.91 seconds at 88 BPM); the phrase uses 56.25% of its width. Phone canvas spans 8 beats, so this 9-beat phrase needs splitting or shortening.
7. Do not trace the connecting contour or ornament as sounding ink. They are visual-only. Extra strokes affect the music.

## Silent photo reference

The site's cloud/background control supports a photo, including Stretch. It is a page background, not a dedicated canvas-overlay importer. **PMT background PNG** exports a whole-viewport reference with the grid positioned inside the measured canvas rectangle. Defaults were measured at a 1272 × 1188 viewport; remeasure if the layout changes. Use cloud → + photo → Stretch. A normal framed SVG/PNG is best viewed beside the instrument.

## Future songs

Provide a title plus exact recording link/clip and section, or a reliable score/MIDI source. Research and verification happen in the chat; the tool does not pretend to transcribe a title or audio automatically. Paste a project or an events array into JSON, or edit the note table.

```json
{"title":"My melody","section":"opening","bpm":100,"beatsPerBar":4,"totalBeats":4,"events":[{"pitch":"C4","start":0,"duration":1},{"pitch":"E4","start":2,"duration":1}]}
```

Pitch accepts MIDI integers or scientific note names (C4 = MIDI 60). Start and duration use **quarter-note beats**, with beat 0 as the start. Gaps are rests. Events may overlap. The generator rejects invalid values and flags pitches or timing that the chosen instrument grid cannot represent. The time audit shows PMT occupied-cell start/end errors rather than hiding approximation.

## Persistence

The code, source notes, documentation and first study are versioned in this cloud repository. GitHub Actions tests and deploys `dist/` after a push to `main`. Git history is retained; updates use normal commits.

Your in-browser edits autosave **on that device**, with up to 20 explicitly saved revisions. Export JSON for backup. A shareable URL carries the current note data in its fragment; it is portable but is not automatic account/cloud sync. Imported/shared notes are labeled unverified. Local reference audio stays on the device and is not transcribed, uploaded or embedded in links.

## Development

No build step or runtime dependencies. Run `npm test`, then serve `dist/` with a static HTTP server (for example `python -m http.server 8000 --directory dist`). Open http://localhost:8000. Opening `index.html` as a file does not support module/data loading in normal browsers.

Source references and detailed limits: [docs/verification.md](docs/verification.md). Downloadable initial references: [dist/downloads](dist/downloads).

Original tool code may be reused under the MIT license. The referenced song and arranger's score remain their respective owners' works; no full score, recording, or third-party app source is redistributed here.
