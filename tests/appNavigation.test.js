const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');

test('App navigation has valid route separators and resolvable screen imports', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');

  // A literal backslash-n between JSX routes becomes an unintended text child.
  assert.equal(/\\\\n\\s*<Stack\\.Screen/.test(source), false);

  const imports = [...source.matchAll(/from\\s+['"]\\.\\/([^'"]+)['"]/g)]
    .map(match => match[1]);
  assert.ok(imports.length > 0, 'App.js should import screen modules');

  for (const modulePath of imports) {
    assert.ok(
      fs.existsSync(path.join(__dirname, '..', modulePath + '.js')),
      `Missing App.js screen module: ${modulePath}.js`,
    );
  }

  const routeNames = [...source.matchAll(/<Stack\\.Screen\\s+name="([^"]+)"/g)]
    .map(match => match[1]);
  assert.ok(routeNames.length > 0, 'App.js should register navigation routes');
  assert.equal(new Set(routeNames).size, routeNames.length, 'Navigation route names must be unique');
});
