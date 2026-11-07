// node build-board.js -> board.html (engine inlined so the page is one file)
const fs = require('fs');
const p = require('path').join.bind(null, __dirname);
const html = fs.readFileSync(p('board.src.html'), 'utf8').replace('/*ENGINE*/', () => fs.readFileSync(p('puff-sounds.js'), 'utf8'));
fs.writeFileSync(p('board.html'), html);
console.log('board.html', (html.length / 1024).toFixed(1) + ' KB');
