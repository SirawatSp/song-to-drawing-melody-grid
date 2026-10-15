# Sources and verification record

Inspected 16 October 2026 (Asia/Bangkok). This record separates source-read notation, calculated timing, inspected instrument behavior and unperformed verification.

## Melody source

Primary source: [Leiki Ueda's own published piano arrangement PDF](https://www.leikiueda.com/_files/ugd/9bd8f4_3e2b34d2233d4f46a1d8de1c1430d47c.pdf), page 1, first system, bars 1–3. The heading credits composition to Justin Hurwitz and arrangement/engraving to Leiki Ueda. The printed key signature has three sharps; meter is 3/4 and quarter-note tempo is 88.

The opening right-hand line was visually read from a high-resolution rendering:

| Bar | Pitch sequence | Written durations in quarter-note beats |
|---|---|---|
| 1 | C#4, F#4, G#4, A4, G#4, F#4 | 0.5 each |
| 2 | D4 | 3 (dotted half) |
| 3 | D4, F#4, G#4, A4, G#4, F#4 | 0.5 each |

The curves beneath bar 1 and bar 3 are phrase slurs, not additional notes. The left-hand accompaniment is omitted. Source beat events are in `dist/data/mia-sebastian.json`.

**Confidence/limits:** pitches and written values are source-read. This is one arrangement, not a checked note-for-note match to the soundtrack. Duration in seconds is calculated using a constant 88 BPM: `seconds = beats × 60 / 88`, total `9 × 60 / 88 = 6.13636… seconds`. No performance audio, MIDI file, rubato, pedal or articulation has been checked. Do not call it an exact transcription of the recording.

The [licensed Musicnotes piano edition](https://www.musicnotes.com/sheetmusic/la-la-land/mia-sebastians-theme/MN0170630) identifies A major, 3/4 and about 76 BPM. Its tempo differs from the selected arrangement. Its metadata is context, not the data source for this grid. Do not mix its tempo with a claim about Leiki Ueda's arrangement or a specific recording.

## Current Play Music Theory web app

Primary source: [the live `/play` app](https://playmusictheory.net/play). UI inspected in a fresh browser session, and the publicly served source was read to establish formulas that cannot be inferred precisely from the blank canvas. No paid access bypass, code injection or hidden unlock was used.

| Topic | Finding and evidence |
|---|---|
| Access | The Instrument switch opens an upgrade/code dialog in this session. Key, scale, range, quantize, numeric tempo, swing and exports are part of that instrument. The free mode resets to C-major pentatonic, 3 octaves, triplet steps. Observed dialog confirms this; source `setPro` establishes the defaults. |
| Horizontal timing | Desktop widths ≥700px use `BARS=2`, web `PULSES=8`: **16 quarter-note beats per canvas**. Narrow browser uses 8. Formula `loopSeconds = BARS × PULSES × 60/BPM`. The app's internal “bar” is eight beats, not the score's 3/4 measure. Native iPad differs (4 pulses); not supported by this web mapping. |
| Quantize | Options: 1/4, 1/8, 1/8 triplet, 1/16, 1/16 triplet, 1/32 = respectively 1,2,3,4,6,8 steps per quarter-note beat. A point enters `floor(x/W × STEPS)`. This is occupied-cell quantization, not nearest-onset snapping. |
| Pitch | 32 row ranks. A scale's notes are built from MIDI 48, then spread across 32 rows. High keys above F# are shifted down an octave: A contributes −3 semitones, then Octave +1 adds +12. For A major, 1 octave, +1: audible lanes A3 B3 C#4 D4 E4 F#4 G#4 A4. |
| Exact Y centers | Sound uses `row=round((1−y/H) × 31)`. Row-to-degree is `floor(row × numberOfPitches / 32)`. The guide uses the average of all ranks for each pitch. These audible centers are safer than assuming the site's visible labels have octave information. The site's painted grid uses a related 32-band layout and note tags omit octave. |
| Durations | A stroke's occupied consecutive cells establish its held region; timbre envelopes affect audible decay. No independent note-length menu is exposed: source comments confirm the gate control was removed and gate stays 1. Piano-like keys are synthetic and will not have acoustic-piano sustain/pedal. |
| Separate notes | Different strokes have separate voices. For struck voices, the engine triggers on entry from a silent cell. Connecting many onsets in one continuous stroke does not preserve the original attack pattern. Separate strokes are needed, including repeated D4 onsets. |
| Decoration | `pointerMove` interpolates marks; `rowMasks` reads every crossed time column and row. Extra decorative ink is sounding data and can add or change notes/chords. There is no exposed silent-ink layer. Keep connecting contours and ornament in the photo/reference. |
| Background photo | Observed cloud icon opens Sky/+ photo. Public source confirms image input, Fill/Fit/Stretch, and a whole-page CSS background. Photo pixels are not read into `buildGrid`, which reads strokes. This permits a silent reference, but it is not a dedicated canvas-overlay import. Alignment requires viewport calibration. No automatic guide alignment is claimed. |
| Save/export | Public source and UI expose pages/tracks, local draft/save/open, share links, MIDI input, WAV/MIDI export. MIDI **input is live keyboard input**, not an observed MIDI-file import. No direct SVG/MIDI guide-to-notes importer was found. Background photos are not part of the share fragment in the inspected packing function. |
| Swing/tune | Swing only changes straight-step grids; use Off for this study. Tune is cents; keep 0. |

At 88 BPM a desktop loop is 10.90909 seconds. The melody occupies beats 0–9 (56.25% width); beats 9–16 are silence. No rests occur within the selected written melody. The 3-beat D4 is a held note, not a gap.

Calibration observed with viewport 1272×1188: canvas left 204.6667, top 16.6667, width 1046.6667, height 895.3334 CSS pixels. Unlocking/opening panels, resizing, browser zoom or another device may change it. Background export uses those editable values and whole-page Stretch. Normal SVG/PNG exports are framed references, not pixel-perfect photo overlays.

## Validation performed / remaining

The repository tests check note validity, held-note/rest interpretation, fixed anchor geometry between the two styles, PMT pitch-row round trips, quantize errors, mobile overflow, and SVG escaping. Browser QA checks rendering, editing, JSON import/export, view/style controls and actual PNG/SVG downloads. GitHub Pages publication is checked separately against the deployment result.

**Still not performed:** matching a named recording, comparing the site's exported MIDI against the event list after drawing, listening to a paid/unlocked PMT rendering, and confirming photo alignment after the user's instrument unlock. Those are required before claiming the user's drawing reproduces the song's performance. The tool labels its source status and exposes projection errors rather than making that claim.

## Future verification workflow

1. Record the exact audio/MIDI/score source and requested section. Distinguish an arrangement from the soundtrack.
2. Extract melody events and preserve onsets, durations, rests, octave and source tempo map. Do not invent pitches from a song title.
3. Check uncertain notes against audio/notation; mark approximations. For rubato use seconds or a tempo map as source, then explicitly report the approximation needed by a fixed-tempo drawing canvas.
4. Select instrument key/range/quantize; inspect the warnings and occupied-cell timing audit. Do not move pitches to fit a scale silently.
5. Generate both views. Decorations must not change anchors. Check exports visually.
6. Draw separate note strokes, export the instrument MIDI, and compare pitch/onset/duration with source events. Only then label the instrument result as verified, with the scope and tolerance stated.

## Cloud project

The original tool and small source-read study are in a new public GitHub repository for a shareable GitHub Pages preview. No source audio, full score PDF, account information, credentials, or third-party app source is committed. Browser drafts are local, and share fragments carry note data rather than saving to a cloud database.
