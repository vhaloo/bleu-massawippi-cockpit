import assert from 'node:assert/strict';
import { safeInlineMediaPreview } from './inline-media-preview.mjs';
const jpeg = 'data:image/jpeg;base64,' + Buffer.from([0xff,0xd8,0xff,0xe0,0x00,0x00,0xff,0xd9]).toString('base64');
assert.equal(safeInlineMediaPreview(jpeg), jpeg);
for (const input of [null, {}, '', 'https://example.org/a.jpg', 'javascript:alert(1)',
  'data:text/html;base64,/9j/AAAA', 'data:image/svg+xml;base64,/9j/AAAA',
  'data:image/jpeg;base64,SGVsbG8=', jpeg + '" onerror="alert(1)',
  jpeg.replace('/9j/', '/9j '), jpeg.slice(0,-1), jpeg + 'A'.repeat(220000)]) {
  assert.equal(safeInlineMediaPreview(input), '', 'Reject unsafe or malformed private preview.');
}
console.log('Private JPEG preview: strict format, signature, padding, size and injection boundaries verified.');
