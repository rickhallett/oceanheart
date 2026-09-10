import { expect, test } from "@playwright/test";

const taskTitle = "Prepare intake forms 2026-09-10_05-12-57";
const clientName = "Bloom Physical Therapy 2026-09-10_05-12-57";

test("long task client labels keep the open editor inside 400px and 320px", async ({
  page,
}, testInfo) => {
  await page.setContent(`
    <style>html, body { margin: 0; }</style>
    <div class="lp-root">
      <main class="lp-main">
        <section class="lp-tasks">
          <ul class="lp-task-list">
            <li data-task-id="task-local">
              <div class="lp-task-row">
                <input type="checkbox" aria-label="${taskTitle}">
                <span>${taskTitle}</span>
                <button class="lp-task-client" type="button">${clientName}</button>
                <span class="lp-task-state">Open</span>
              </div>
              <form class="lp-task-editor">
                <label>Task title<input value="${taskTitle}"></label>
                <label>Due date<input type="date"></label>
                <label for="client-search">Search clients</label>
                <div class="lp-inline"><input id="client-search" placeholder="Search by name or email"></div>
                <label for="client-select">Client</label>
                <div class="lp-inline">
                  <select id="client-select"><option selected>${clientName}</option></select>
                </div>
                <span class="lp-task-actions">
                  <button>Save</button><button>Use latest</button><button>Cancel</button>
                </span>
              </form>
            </li>
          </ul>
        </section>
      </main>
    </div>
  `);
  await page.addStyleTag({ path: "src/components/practice/practice.css" });
  await page.addStyleTag({ path: "src/components/practice/task-maintenance.css" });

  for (const width of [400, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      path: testInfo.outputPath(`task-client-editor-${width}.png`),
      fullPage: true,
    });
    const layout = await page.evaluate(() => ({
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      offenders: [...document.querySelectorAll("*")]
        .filter((element) => element.getBoundingClientRect().right > innerWidth)
        .map((element) => ({
          tag: element.tagName,
          className: element.className,
          right: Math.ceil(element.getBoundingClientRect().right),
        })),
    }));
    expect(layout, `${width}px overflow`).toEqual({
      viewport: width,
      document: width,
      offenders: [],
    });
  }
});
