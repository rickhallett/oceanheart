# Oceanheart Studio

Next.js 16 App Router + TypeScript landing page for Oceanheart Studio.

## Local development

```sh
npm ci
npm run dev
npm run build
npm run typecheck
```

## Design system

`src/app/globals.css` owns shared colour, typography, surface and spacing styles. `src/components/ui.tsx` exports the brand mark, primary link, text link and eyebrow. Website and future portal routes can share these components within the same Next.js application. `practice-preview.tsx` is a client component with fictional, in-memory demonstration data; it does not store personal or clinical information or connect to business systems.

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
