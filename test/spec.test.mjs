/**
 * spec.test.mjs -- the module's HubL, fields and cookie name agree
 * Author: Jibril Sulaiman · Created: 2026-09-28 (split 2026-10-06) · Run: npm test
 * Why: the module's files are pasted into Design Manager separately; nothing but this
 *      test notices when they drift apart, or from the header script's cookie name.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { read } from './helpers.mjs';

test('the module reads the cookie the UTM repo header script writes (site_attr)', () => {
  const moduleName = read('module/order-form-stripe.module/module.js').match(/var COOKIE_NAME = '([^']+)'/)[1];
  assert.equal(moduleName, 'site_attr');
});

test('fields.json declares every module field the HubL reads', () => {
  const fields = JSON.parse(read('module/order-form-stripe.module/fields.json')).map((f) => f.name);
  const hubl = read('module/order-form-stripe.module/module.html').replace(/\{#[\s\S]*?#\}/g, '');   // drop HubL comments
  const used = [...hubl.matchAll(/module\.([a-z_0-9]+)/g)].map((m) => m[1]);
  for (const name of new Set(used)) assert.ok(fields.includes(name), `${name} missing from fields.json`);
});
