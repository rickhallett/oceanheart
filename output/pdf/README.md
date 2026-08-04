# CV attachment names

Use only these role-neutral files for job applications:

- `richard-hallett.pdf`: Forward Deployed Engineer variant
- `richard-j-hallett.pdf`: Applied AI Engineer variant

The middle initial is the variant marker. Select the CV by its contents, then
attach the matching neutral filename.

The longer role-specific filenames in this folder are internal build artifacts.
Do not upload them to an application portal. A role name in an attachment can
signal that the candidate is targeting a different function, especially when a
job explicitly rejects applicants seeking a temporary move before changing
functions.

The four Full Complement variants are experimental local artifacts. Before an
application, copy the selected PDF into that application's private directory as
`Richard-Hallett-CV.pdf`, then upload and record the hash of that private copy.
They are not public website downloads.

The source files live in `career/cv/`. Rebuild with
`uv run exports/build-cv.py`; never edit a generated PDF directly.
