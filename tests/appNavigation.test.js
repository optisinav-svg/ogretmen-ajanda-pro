const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');

test('App navigation has valid route separators and resolvable screen imports', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');

  // A literal backslash-n between JSX routes becomes an unintended text child.
  assert.equal(/\\n\s*<Stack\.Screen/.test(source), false);

  const imports = [...source.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)]
    .map(match => match[1]);
  assert.ok(imports.length > 0, 'App.js should import screen modules');

  for (const modulePath of imports) {
    assert.ok(
      fs.existsSync(path.join(__dirname, '..', modulePath + '.js')),
      'Missing App.js screen module: ' + modulePath + '.js',
    );
  }

  const routeNames = [...source.matchAll(/<Stack\.Screen\s+name="([^"]+)"/g)]
    .map(match => match[1]);
  assert.ok(routeNames.length > 0, 'App.js should register navigation routes');
  assert.equal(new Set(routeNames).size, routeNames.length, 'Navigation route names must be unique');
});


test('Spark deployment configuration exports no Cloud Functions', () => {
  const root = path.join(__dirname, '..');
  const firebaseJson = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
  assert.equal(Object.prototype.hasOwnProperty.call(firebaseJson, 'functions'), false);
  const functionsIndex = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
  assert.match(functionsIndex, /module\.exports\s*=\s*\{\s*\}/);
});

test('Spark application screens and services do not call Cloud Functions', () => {
  const root = path.join(__dirname, '..');
  const sourceRoots = ['screens', 'services'];
  const files = [path.join(root, 'App.js'), path.join(root, 'firebaseConfig.js')];

  function collect(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(fullPath);
      else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) files.push(fullPath);
    }
  }

  for (const sourceRoot of sourceRoots) collect(path.join(root, sourceRoot));
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(
      /httpsCallable\s*\(|getFunctions\s*\(|from\s+['"]firebase\/functions['"]|import\s*\{[^}]*\bfunctions\b[^}]*\}\s*from\s*['"][^'"]*firebaseConfig/.test(source),
      false,
      'Spark app source must not depend on Firebase Functions: ' + path.relative(root, file),
    );
  }
});
