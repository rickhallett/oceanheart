# Studio branches, environments and routes

Verified against Vercel on 10 September 2026.

| Source branch | Deployment | Purpose |
| --- | --- | --- |
| `studio/dev` | Custom `staging` environment | Integrated application development and acceptance |
| `main` | `studio.oceanheart.ai` | Production; requires explicit release approval |
| Feature branches | Temporary Vercel previews | Review candidates; not the staging environment |

Studio Vercel project: `oceanheart-studio` (`prj_zCDCU0lztKcswuy7iNvD37f2ZMd5`), root directory `studio`. The separate `oceanheart` project serves the public website from this same repository. A branch name is not a URL route.

The staging URL is https://oceanheart-studio-env-staging-rick-halletts-projects.vercel.app/app . The only application UI development target is the reviewed Precision workspace at `/app` and `/app/<section>`. Configured deployments use real WorkOS identity and Convex records there. `/practice` redirects to that workspace for existing bookmarks and integration callbacks; it is not a second application. Unconfigured local/preview builds retain the sample workspace without importing samples into authenticated data.

Staging uses `dev:charming-albatross-632`. Vercel frontend deployment does not deploy backend functions. Every significant delivery records the exact frontend SHA, ready backend/schema/indexes, and hosted acceptance evidence.

At the verification checkpoint, staging served `9a4342fd7f37c9ede2d8292d495fa4b9d1513c61`; production still served `5c258979c6eb7a86809498a4873eb2d6170f0a18`. These are recorded snapshots, not aliases that update this document. The local `main` checkout can lag the remote branch and is not proof of the deployed revision.

Do not merge a Studio release into `main` or promote a deployment without explicit approval for that concrete production release. Public website Studio introduction PR35 remains a separate visual-approval hold.
