const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../scripts/build-products.js');
let code = fs.readFileSync(filePath, 'utf8');

const targetStart = "if (slug === 'bedbridge-connector') {";
const targetEnd = "if (slug === 'mattress-lift-helper') {";

const startIndex = code.indexOf(targetStart);
const endIndex = code.indexOf(targetEnd);

if (startIndex === -1 || endIndex === -1) {
  console.error('Error: Could not locate targets in build-products.js');
  process.exit(1);
}

// Extract the part of code before and after the BedBridge block
const before = code.substring(0, startIndex);
const after = code.substring(endIndex);

const newBedBridgeCode = `if (slug === 'bedbridge-connector') {
    let html = '';
    html += '<div class="container" style="max-width:1280px; padding:0 24px;">';
    html += '<div style="padding:32px 0;">';
    
    // Overview
    html += '<div style="margin-bottom:40px;">';
    html += '<h2 style="font-size:1.8rem; margin-bottom:12px; color:var(--color-heading);">Split mattresses? Meet your seamless new bed.</h2>';
    html += '<p style="font-size:1.1rem; color:var(--color-muted); line-height:1.6; max-width:800px;">The MildMate BedBridge Connector is designed to bridge the gap between two mattresses (like two Twin XLs or Double beds), instantly creating one large, seamless sleeping surface. Ideal for couples with different mattress preferences and guest room conversions.</p>';
    html += '</div>';

    // How it works
    html += '<div style="background:var(--color-surface); border-radius:var(--radius); padding:32px; margin-bottom:40px; border:1px solid var(--color-border);">';
    html += '<h3 style="margin-bottom:20px; font-size:1.4rem; color:var(--color-heading);">How It Works</h3>';
    html += '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:24px;">';
    
    html += '<div style="background:#fff; padding:20px; border-radius:6px; border:1px solid var(--color-border);">';
    html += '<span style="display:inline-block; width:28px; height:28px; line-height:28px; background:var(--color-primary); color:#fff; text-align:center; border-radius:50%; font-weight:bold; margin-bottom:12px;">1</span>';
    html += '<h4 style="margin-bottom:8px; color:var(--color-heading); font-size:1.05rem;">Position the Wedge</h4>';
    html += '<p style="font-size:0.875rem; color:var(--color-muted); line-height:1.5; margin:0;">Place the T-shaped wedge between the two mattresses. The center stem slides deep into the gap while the wide top panel rests flat on the beds.</p>';
    html += '</div>';

    html += '<div style="background:#fff; padding:20px; border-radius:6px; border:1px solid var(--color-border);">';
    html += '<span style="display:inline-block; width:28px; height:28px; line-height:28px; background:var(--color-primary); color:#fff; text-align:center; border-radius:50%; font-weight:bold; margin-bottom:12px;">2</span>';
    html += '<h4 style="margin-bottom:8px; color:var(--color-heading); font-size:1.05rem;">Push Beds Together</h4>';
    html += '<p style="font-size:0.875rem; color:var(--color-muted); line-height:1.5; margin:0;">Push mattresses flush. The high-density microfiber compresses slightly, sealing the gap and creating a secure, friction-based fit without straps.</p>';
    html += '</div>';

    html += '<div style="background:#fff; padding:20px; border-radius:6px; border:1px solid var(--color-border);">';
    html += '<span style="display:inline-block; width:28px; height:28px; line-height:28px; background:var(--color-primary); color:#fff; text-align:center; border-radius:50%; font-weight:bold; margin-bottom:12px;">3</span>';
    html += '<h4 style="margin-bottom:8px; color:var(--color-heading); font-size:1.05rem;">Cover with Sheet</h4>';
    html += '<p style="font-size:0.875rem; color:var(--color-muted); line-height:1.5; margin:0;">Cover both mattresses and the bridge with a single high-tension fitted sheet (we recommend MildMate deep-pocket sheets for the tightest, most secure fit).</p>';
    html += '</div>';

    html += '</div>';
    html += '</div>';

    // Key Benefits / Solutions
    html += '<div style="margin-bottom:40px;">';
    html += '<h3 style="margin-bottom:24px; font-size:1.4rem; color:var(--color-heading);">Why It Works Better</h3>';
    html += '<div style="display:grid; grid-template-columns:1fr; gap:20px;">';

    const benefits = [
      {
        title: 'Seamless "Split-to-King" Conversion',
        desc: 'Bridge two Twin XL mattresses to create an on-demand King-size bed. Perfect for guest rooms, holiday homes, and couples who prefer different mattress firmness levels.'
      },
      {
        title: 'True-Flush Tapered Design',
        desc: 'Traditional bed bridges create a raised hump down the center. Ours features thin, tapered edges that sit flush against your mattresses for a uniform sleeping plane under your sheets.'
      },
      {
        title: 'No-Strap Friction System',
        desc: 'Avoid the hassle of wrapping straps and buckles around the perimeter of your bed. The high-density T-profile stays locked in place through lateral pressure and compression alone.'
      },
      {
        title: 'Full-Length 190cm Coverage',
        desc: 'Offers full-length gap protection (190cm / 75") to fit standard Twin XL and Double mattresses from head to toe, leaving zero gaps.'
      },
      {
        title: 'Deep-Pocket Synergy',
        desc: 'Designed to work in tandem with 360-degree elasticated sheets. The sheet pulls the mattresses inward, providing the compression needed to lock the bridge firmly in place.'
      }
    ];

    benefits.forEach(b => {
      html += '<div style="display:flex; gap:16px; align-items:flex-start; padding-bottom:16px; border-bottom:1px solid var(--color-border);">';
      html += '<span style="color:var(--color-primary); font-size:1.25rem; font-weight:bold; line-height:1.2;">✓</span>';
      html += '<div>';
      html += '<h4 style="margin:0 0 6px 0; color:var(--color-heading); font-size:1.1rem; font-weight:600;">' + b.title + '</h4>';
      html += '<p style="margin:0; color:var(--color-muted); font-size:0.9375rem; line-height:1.5;">' + b.desc + '</p>';
      html += '</div>';
      html += '</div>';
    });

    html += '</div>';
    html += '</div>';

    // Care Instructions
    html += '<div>';
    html += '<h3 style="margin-bottom:16px; font-size:1.4rem; color:var(--color-heading);">Care Instructions</h3>';
    html += '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">';
    const careItems = ['Machine wash cold — gentle cycle', 'Do not bleach', 'Tumble dry low', 'No ironing needed'];
    careItems.forEach(c => {
      html += '<div style="background:var(--color-surface); padding:16px; border-radius:6px; display:flex; gap:12px; align-items:center; border:1px solid var(--color-border);">';
      html += '<span style="color:var(--color-primary); font-size:1rem;">●</span>';
      html += '<span style="font-size:0.875rem; color:var(--color-text); font-weight:500;">' + c + '</span>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    html += '</div></div>';
    return html;
  }

  `;

fs.writeFileSync(filePath, before + newBedBridgeCode + after, 'utf8');
console.log('Successfully replaced BedBridge Connector description block in build-products.js.');
