# Career artifacts

Oceanheart owns the canonical, reusable career documents. Jobpipe selects and
uses them for applications; it does not maintain competing CV copies.

## CVs

Canonical sources:

- `career/cv/forward-deployed-engineer.md`
- `career/cv/applied-ai-engineer.md`

Build all upload-ready and public copies:

```text
uv run exports/build-cv.py
```

Upload these local artifacts:

- `output/pdf/richard-hallett-forward-deployed-engineer.pdf`
- `output/pdf/richard-hallett-applied-ai-engineer.pdf`

The build writes only the intentional public mirrors under `static/cv/`. The
Forward Deployed Engineer variant is the default site CV and compatibility
download at `static/richard-hallett-cv.pdf`.

Source files are authoritative. Never edit a generated PDF directly.

The current output topology is deliberately narrow:

- `career/cv/`: authoritative reusable sources and portrait asset;
- `output/pdf/`: authoritative local upload artifacts;
- `static/cv/`: generated website downloads;
- `static/richard-hallett-cv.pdf`: generated compatibility download.

Do not create competing copies under `exports/`, Downloads, Documents, or
application repositories.

Older Oceanheart authoring material is preserved under
`career/archive/pre-2026-07-23/`. Files under
`/Users/mrkai/vault/career/cv/` are historical evidence snapshots, not upload
sources.

## Cover letters

Application-specific cover letters are private transaction records, so they do
not belong in this public repository. Their canonical location is:

```text
/Users/mrkai/vault/career/applications/<posting-id>-<company>-<role>/
```

Use `cover-letter.md` as the source and create `cover-letter.pdf` only when an
application requires a file upload. Jobpipe's `facts.md` and `answer-bank.md`
remain the reusable drafting sources.
