# Song-to-Drawing Melody Grid

A persistent, versioned visual reference studio for turning **note events into drawing guides**.

## New: Singing Sketchbook

**Draw and hear your own picture:** https://sirawatsp.github.io/song-to-drawing-melody-grid/paint.html

Choose from nine instrument colors, draw with a mouse/finger/pen, then press Play. Open a PNG/JPEG/WebP to hear its colors, play it with one selected voice, or use it as a silent tracing reference. Save editable drawing JSON, PNG art, or a WAV audio loop. All drawing controls are available without an unlock. The nine sounds are original synthesized timbres.

The grid editor's **Draw this melody** button sends its current note events to the sketchbook as a silent guide. **Make guide playable** creates separate colored strokes; source pitches outside the selected key/range are flagged, and timing approximated by Snap is reported. The existing melody source and recording-verification limits still apply.

Drawing data autosaves in this browser. Imported images stay local; they are not uploaded to the repository or a transcription service. Download editable JSON to move a drawing between devices. The cloud repository stores the app and our original example, not automatic account-synced personal drawings.

Original example: [garden drawing](dist/downloads/singing-garden.drawing.json), [PNG](dist/downloads/singing-garden.png), [WAV](dist/downloads/singing-garden.wav). Implementation and verification: [docs/drawing-studio.md](docs/drawing-studio.md).

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
