# Studio development baseline

The accepted application lives on `studio/dev`. Start with [development and release](docs/DEVELOPMENT.md), [the canonical style guide](docs/STYLE_GUIDE.md), and [the RAD roadmap](docs/RAD-ROADMAP.md). Older implementation notes below may describe the pre-promotion prototype.

# Oceanheart Studio

Next.js 16 App Router + TypeScript + Chakra UI for Oceanheart Studio's public site and practice workspace.

## Local development

```sh
npm ci
npm run dev
npm run build
npm run typecheck
```

## Design system

Chakra UI's free, open-source components provide the shared interface foundation. `src/theme.ts` owns semantic colours and component recipes; `StudioProvider` applies them across the public site, `/app` and `/practice`. Brand typography and domain layouts remain in scoped CSS. See [the component map and development conventions](docs/CHAKRA-UI.md).

`src/components/ui.tsx` exports the brand mark, primary link, text link and eyebrow. `practice-preview.tsx` is a client component with fictional, in-memory demonstration data; it does not store personal or clinical information or connect to business systems.

The contact links open an email draft addressed to rick@oceanheart.ai. There is no server-side enquiry collection or claim of successful delivery.

## Deployment

Public site: https://oceanheart-studio.vercel.app
Vercel project: oceanheart-studio (Rick Hallett’s projects).
This application lives in the repository's `studio/` directory, separately from the existing company website. Configure the Git integration Root Directory as `studio` and framework as Next.js. Marketing changes should use feature branches and preview deployments before merging to main.

The ocean background is an original generated asset derived from the approved design. Fonts are served by Next.js through next/font. Lucide supplies the interface icons.

## Validation

Production build and TypeScript checks; browser verification at desktop (1536px) and mobile (390px), workspace navigation, detail open/close, task completion, date controls, section navigation, email destination, JavaScript errors and horizontal overflow.

## Interactive practice app

The `/app` workspace expands the homepage preview into a connected, browser-persistent mock. See [PROTOTYPE.md](PROTOTYPE.md) for journeys, coverage and simulation boundaries. Its roadmap view exports feature priorities and notes for MVP planning. The app requires no API keys or paid model usage.

## Production foundation

The independent [backend package](backend/README.md) contains the first Convex tenant, membership and atomic booking slice. Its integration suite uses a real local backend and signed test tokens. The public mock is not yet connected to this backend; hosted identity and persistence are separate delivery steps.

See [verification commands](VERIFICATION.md), [worktree and migration boundaries](docs/DELIVERY.md), and the [backend decision](backend/docs/ADR-001-backend-choice.md). Track implementation and human gates in [Linear](https://linear.app/tinyrick/project/oceanheart-studio-8ed48b4b1722).

The authenticated `/practice` uses WorkOS AuthKit and Convex for practice creation,
selection and persisted tasks. See [configuration and acceptance](docs/WORKOS-PRACTICE.md).
The public `/app` remains an independent browser-local prototype.
