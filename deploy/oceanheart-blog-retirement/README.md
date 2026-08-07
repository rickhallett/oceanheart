# oceanheart.blog retirement service

This directory is the root of the dedicated Vercel project serving:

- `oceanheart.blog`
- `www.oceanheart.blog`

Approved identity routes return `301`. Every other content route reaches the
catch-all function and returns `410 Gone` with a short retirement page.

The current `www.oceanheart.ai` Hugo project does not use this directory as its
Vercel root.

When changing DNS, preserve the domain's existing MX and SPF records.
