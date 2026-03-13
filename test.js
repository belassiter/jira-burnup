const txt = '<h2>Chart 1</h2><p><strong>Last published:</strong> A</p><p><ac:image><ri:attachment ri:filename="file1"/></ac:image></p><h2>Chart 2</h2><p><strong>Last published:</strong> B</p><p><ac:image><ri:attachment ri:filename="file2"/></ac:image></p>';
const target = 'file2';

const regexSafeFilename = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const attachmentPattern = '<ri:attachment[^>]*ri:filename="' + regexSafeFilename + '"[^>]*?(?:/>|></ri:attachment>)';
const imagePattern = '<ac:image[^>]*>\\s*' + attachmentPattern + '\\s*</ac:image>';
const pWrappedImagePattern = '(?:<p[^>]*>\\s*)?' + imagePattern + '(?:\\s*</p>)?';
const timestampPattern = '(?:<p[^>]*>\\s*<strong>Last published:</strong>.*?</p>\\s*)?';
const headingPattern = '(?:<h[1-6][^>]*>.*?</h[1-6]>\\s*)?';

const regex = new RegExp(headingPattern + timestampPattern + pWrappedImagePattern, 'g');

console.log('REGEX:', regex);
console.log('--- OUTPUT ---');
console.log(txt.replace(regex, '[REPLACED]'));