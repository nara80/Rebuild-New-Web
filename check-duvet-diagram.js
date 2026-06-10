const https = require('https');
https.get('https://mildmate-new.pages.dev/product/3-sided-duvet/', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const idx = d.indexOf('dim-diagram">');
    if (idx >= 0) {
      const start = d.lastIndexOf('<div', idx);
      const end = d.indexOf('</div>', idx) + 6;
      console.log('FOUND:', d.substring(start, end));
    } else {
      // Check CSS context
      const cssIdx = d.indexOf('.dim-diagram');
      const bodyIdx = d.indexOf('"dim-diagram', cssIdx + 100);
      if (bodyIdx >= 0) {
        const start = d.lastIndexOf('<div', bodyIdx);
        const end = d.indexOf('</div>', bodyIdx) + 6;
        console.log('FOUND via CSS skip:', d.substring(start, end));
      } else {
        console.log('NOT FOUND in HTML body');
        // check the custom tab content
        const customIdx = d.indexOf('tab-custom');
        if (customIdx >= 0) {
          console.log('Custom tab context:', d.substring(customIdx, customIdx + 600));
        }
      }
    }
  });
});
