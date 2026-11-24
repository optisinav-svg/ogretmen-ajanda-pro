const fs = require('node:fs');
const assert = require('node:assert/strict');
const { test } = require('node:test');

test('App navigation does not contain escaped newline text between screen routes', () => {
  const source = fs.readFileSync('App.js', 'utf8');
  assert.equal(/\\\\n\\s*<Stack\\.Screen/.test(source), false);
  assert.match(source, /<SafeAreaProvider>[\\s\\S]*<NavigationContainer>/);
  assert.match(source, /<\\/NavigationContainer><\\/SafeAreaProvider>/);
});
