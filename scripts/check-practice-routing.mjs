import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { practiceHref } from '../website/lib/practice-routing.mjs';
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url)));
assert.deepEqual(config.rewrites, [{source:'/',has:[{type:'host',value:'dev.oceanheart.ai'}],destination:'/dev.html'}]);
for (const route of ['practice','sessions','act','breathwork','deep-tissue-massage','events']) {
 assert.equal(practiceHref('/'+route,'localhost'),'/'+route);
 assert.equal(practiceHref('/'+route,'dev.oceanheart.ai'),'https://www.oceanheart.ai/'+route);
 const html=await readFile(new URL(`../public/${route}.html`,import.meta.url),'utf8');
 assert.ok(html.includes('https://www.oceanheart.ai/'+route));
}
for (const route of ['systems-work','conversations-with-ai','selected-work','selected-work/the-pit','engineering','cv']) {
 assert.equal(practiceHref('/'+route,'www.oceanheart.ai'),'https://dev.oceanheart.ai/'+route);
 assert.equal(practiceHref('/'+route,'preview.vercel.app'),'/'+route);
}
assert.equal(practiceHref('/dev','www.oceanheart.ai'),'https://dev.oceanheart.ai/');
assert.equal(practiceHref('#book','www.oceanheart.ai'),'#book');
assert.equal(practiceHref('mailto:rick@oceanheart.ai','dev.oceanheart.ai'),'mailto:rick@oceanheart.ai');
const home=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
assert.ok(home.includes('Make room for yourself in a world that asks a lot.'));
assert.ok(!home.includes('href="/dev"'));
assert.ok(!home.includes('href="/systems-work"'));
console.log('Flagship pages, dev routing and homepage separation verified.');
