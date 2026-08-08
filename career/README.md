# Career artifacts

Oceanheart owns the canonical, reusable career documents. Jobpipe selects and
uses them for applications; it does not maintain competing CV copies.

## CVs

Canonical sources:

- `career/cv/forward-deployed-engineer.md`
- `career/cv/applied-ai-engineer.md`

Experimental Full Complement sources:

- `career/cv/full-complement/frontend-developer.md`
- `career/cv/full-complement/full-stack-developer.md`
- `career/cv/full-complement/workflow-automation-engineer.md`
- `career/cv/full-complement/technical-operations-engineer.md`

Build all upload-ready and public copies:

```text
uv run exports/build-cv.py
```

Upload only these role-neutral local artifacts:

- `output/pdf/richard-hallett.pdf`: Forward Deployed Engineer variant
- `output/pdf/richard-j-hallett.pdf`: Applied AI Engineer variant

The build writes only the intentional public mirrors under `static/cv/`. The
Forward Deployed Engineer variant is the default site CV and compatibility
download at `static/richard-hallett-cv.pdf`.

Full Complement PDFs are local application artifacts under `output/pdf/` and
are not mirrored into the public site. Copy the selected variant into the
private application directory with a role-neutral filename before upload.

The role-specific filenames under `output/pdf/` and `static/cv/` are internal
build and website artifacts. Never upload them to an application portal. A
role name in the attachment filename can signal that the CV was prepared for a
different function.

Source files are authoritative. Never edit a generated PDF directly.

The current output topology is deliberately narrow:

- `career/cv/`: authoritative reusable sources and portrait asset;
- `output/pdf/`: authoritative local upload artifacts;
- `static/cv/`: generated website downloads;
- `static/richard-hallett-cv.pdf`: generated compatibility download.

Do not create competing copies under `exports/`, Downloads, Documents, or
application repositories.

Files under `/Users/mrkai/vault/career/cv/` are historical evidence snapshots,
not upload sources.

## Cover letters

Application-specific cover letters are private transaction records, so they do
not belong in this public repository. Their canonical location is:

```text
/Users/mrkai/vault/career/applications/<posting-id>-<company>-<role>/
```

Use `cover-letter.md` as the source and create `cover-letter.pdf` only when an
application requires a file upload. Jobpipe's `facts.md` and `answer-bank.md`
remain the reusable drafting sources.
