# Studio staging and release policy

Studio work follows `feature branch → PR → studio/dev → staging acceptance → approved release PR → main`. Keep each feature PR atomic: one useful outcome, its server/permission work where needed, relevant checks and evidence. Preserve the accepted [workspace style](STYLE_GUIDE.md).

## Verification and review

GitHub Actions runs on GitHub-hosted `ubuntu-24.04` runners. `studio-verify.yml` checks Studio changes on PRs and pushes to `studio/dev` or `main`: the application build, TypeScript, Playwright browser suite, backend TypeScript and integration tests. Browser failure artifacts are retained for seven days. The root Oceanheart workflow also checks PRs. These jobs verify code; they do not deploy it.

Require successful checks on the current PR revision before merging. Configure required checks in GitHub branch protection/rulesets after confirming their names from an actual run. Studio verification uses path filters; requiring its checks for every repository PR can leave unrelated PRs waiting on checks that never run. Use an applicable required-workflow rule or introduce an always-running change-detection gate before making Studio checks universally required. Do not bypass a failed relevant Studio check because the root check passed.

Use CodeRabbit PR review for each completed atomic batch. Resolve material findings, or record a reasoned disposition, before merging. Confirm the GitHub app is installed for this repository and reviews PRs targeting `studio/dev`; repository documentation cannot establish that provider setting. Avoid requesting a fresh full review after every small fix. Read existing findings and verify fixes locally first.

Use the CodeRabbit CLI occasionally at meaningful milestones: for example, before the first persisted tenant-scoped slice or an intentional release candidate. Select the actual base (`studio/dev` for a feature branch, `main` for a release). Do not add CLI review to every CI run or an automatic retry loop. Do not enable usage billing, pass `--use-credits`, or accept a paid continuation without explicit user authorization. A rate limit or payment prompt is a recorded review limitation, not a reason to trigger repeated reviews. See the supplied [CLI documentation](https://docs.coderabbit.ai/cli) for command details.

Stay on hosted runners initially. Measure job duration, queue delay and Actions minutes before considering Blacksmith. Adopt it only when capacity or measured cost justifies the migration. No Docker layer is needed for the existing Node/Playwright workflows.

## Hosted staging integration

Before treating staging as available, verify and record the actual Vercel project, Git connection, root directory `studio`, development branch mapping, stable URL and deployed commit SHA. Keep the existing production project on `main`. Staging identity, backend and external-service data must be isolated from production; never copy production secrets or import browser sample data automatically.

The minimal integration is a Vercel non-production deployment of `studio/dev`, plus an acceptance URL and the environment configuration required by the current slice. Existing Vercel Git integration can build previews without adding deployment credentials to GitHub Actions. A Vercel preview can start before CI finishes: treat it as a candidate until checks and browser acceptance pass. Do not describe that arrangement as CI-gated deployment.

If deployment must start only after CI, add a staging-only job depending on both Studio verification jobs, restricted to successful `push` events on `refs/heads/studio/dev`. Use a GitHub `staging` environment and a verified staging-only provider target. Provision credentials through the provider/GitHub secret interface after the target is confirmed. Do not embed project IDs, secrets, or an unverified deploy hook in the workflow, expose credentials to PR jobs, or add a production deploy command. Avoid duplicate Git-triggered and Actions-triggered deployments by choosing one staging deployment owner.

At each staging acceptance, record the revision, deployment URL, relevant CI runs, browser evidence and the meaningful failure-case checks. For the first persisted slice, acceptance includes sign-in, tenant isolation and persistence after reload. A green build alone does not establish a working hosted application.

## Production boundary

`studio-release-policy.yml` checks PRs targeting `main` and requires changes under `studio/` or the Studio workflows to come from this repository's `studio/dev` branch. Its `Studio release source` check always runs on main-targeted PRs, including unrelated PRs. Make it required in the main ruleset and disallow direct pushes/bypasses where the repository's permissions allow. The source check is a guardrail; it does not prove staging acceptance or user approval.

Open a release PR from `studio/dev` to `main` with the accepted staging SHA, verification evidence, relevant configuration/migration steps and rollback plan. Obtain explicit user approval for that concrete production release before merging. General permission to implement, review or merge feature work into development does not authorize production. If Vercel automatically deploys `main`, merging that PR is the production-triggering action and must wait for approval.

Before release, verify production's Vercel Git branch, root directory, environment configuration and current deployed SHA. After an approved release, verify the provider's deployed SHA and the affected live journey. Repository workflows alone cannot enforce this human approval boundary or change existing Vercel auto-deployment settings.
