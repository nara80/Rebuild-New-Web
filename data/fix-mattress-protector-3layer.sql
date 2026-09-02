-- 2026-09-02: Align mattress protector copy to 3-layer construction and lock fabrics

UPDATE products
SET description_en = '<h3>3-Layer Waterproof Top Protection — Fitted Sheet Style</h3>
<p>A fitted-sheet-style mattress protector with 3-layer construction on the top panel: quilted cotton, polyester filling, and TPU waterproof backing. The side skirt is cotton fabric for fit and coverage, and does not provide waterproof side protection.</p>
<ul>
<li>Top Layer: Cotton Quilted</li>
<li>Layer 2 (Core): Polyester Filling</li>
<li>Layer 3 (Backing): TPU Waterproof</li>
<li>Fitted cotton side skirt (not waterproof)</li>
<li>Custom-made to your exact mattress dimensions</li>
</ul>
<h3>3-Layer Construction Details</h3>
<p>The top panel combines quilted cotton, polyester filling, and TPU waterproof backing to protect the sleep surface from spills and accidents. The fitted cotton side skirt helps secure fit around the mattress but does not include TPU waterproof side coverage.</p>
<ul>
<li>Top panel waterproof protection</li>
<li>Quiet and low-noise sleep comfort</li>
<li>Cotton side skirt for fit</li>
<li>Full-perimeter elastic hold</li>
</ul>'
WHERE slug = 'mattress-protector-standard';

UPDATE products
SET description_en = '<h3>Family-Size 3-Layer Waterproof Top Protection</h3>
<p>Designed for family mattresses and co-sleeping setups. The top panel uses 3-layer construction, quilted cotton, polyester filling, and TPU waterproof backing to protect from spills through the sleeping surface. The fitted side skirt is cotton fabric and is not waterproof.</p>
<ul>
<li>Top Layer: Cotton Quilted</li>
<li>Layer 2 (Core): Polyester Filling</li>
<li>Layer 3 (Backing): TPU Waterproof</li>
<li>Custom-made to family mattress dimensions</li>
<li>Fitted cotton side skirt (not waterproof)</li>
</ul>
<h3>3-Layer Construction Details</h3>
<p>The top panel combines quilted cotton, polyester filling, and TPU waterproof backing to reduce liquid penetration through the sleeping surface. The cotton side skirt is for fitted hold and side coverage only, and does not provide TPU waterproof side protection.</p>
<ul>
<li>Top panel waterproof protection</li>
<li>Quiet and low-noise sleep comfort</li>
<li>Cotton side skirt with full-perimeter elastic</li>
<li>Family-size dimensions</li>
</ul>'
WHERE slug = 'mattress-protector-family';

UPDATE products
SET description_en = '<h3>Deep Pocket 3-Layer Waterproof Protection</h3>
<p>Standard mattress protectors pop off thick pillow-tops and adjustable beds because the pocket is not deep enough. Our Deep Pocket Protector is custom-made with extra depth and 3-layer top-panel construction for secure waterproof comfort on thick mattresses.</p>
<ul>
<li>Top Layer: Cotton Quilted</li>
<li>Layer 2 (Core): Polyester Filling</li>
<li>Layer 3 (Backing): TPU Waterproof</li>
<li>Extra-deep pocket for thick mattresses</li>
<li>Fits adjustable beds and pillow-tops</li>
</ul>
<h3>3-Layer Construction Details</h3>
<p>The top panel combines quilted cotton, polyester filling, and TPU waterproof backing, while the extra-deep fitted pocket stays secure on thick mattresses, pillow-tops, and adjustable beds.</p>
<ul>
<li>Top panel waterproof protection</li>
<li>Extra-deep pocket with full-perimeter elastic</li>
<li>Quiet and low-noise sleep comfort</li>
<li>Custom-made to your exact dimensions</li>
</ul>'
WHERE slug = 'mattress-protector-deep-pocket';

UPDATE products
SET description_en = '<h3>Built for Life with Pets — 3-Layer Protection</h3>
<p>Pets bring joy and occasional accidents, fur, and scratches. The Pet-Proof Mattress Protector uses 3-layer top-panel construction, BreezePlus top, polyester filling core, and TPU waterproof backing to protect the sleeping surface. The fitted side skirt supports fit and is not a waterproof side barrier.</p>
<ul>
<li>Top Layer: BreezePlus</li>
<li>Layer 2 (Core): Polyester Filling</li>
<li>Layer 3 (Backing): TPU Waterproof</li>
<li>BreezePlus helps pet hair slide off and supports scratch resistance</li>
<li>Custom-made to your mattress dimensions</li>
</ul>
<h3>3-Layer Construction Details</h3>
<p>The top panel combines BreezePlus fabric, polyester filling, and TPU waterproof backing to resist pet hair, scratches, and spills through the sleep surface. Side coverage is fitted and supportive, but not TPU waterproof.</p>
<ul>
<li>Top panel waterproof protection</li>
<li>Cool-to-the-touch comfort and anti-scratch support</li>
<li>Fitted side skirt (not waterproof)</li>
<li>Full-perimeter elastic hold</li>
</ul>'
WHERE slug = 'pet-proof-mattress-protector';

UPDATE products
SET description_en = '<h3>Marine-Ready Waterproof Protection</h3>
<p>Use the same 14-shape marine configurator to match your boat mattress layout, then get an instant protector price with no email back-and-forth. This protector uses a 3-layer waterproof build that guards against humidity, spills, and onboard moisture while staying comfortable for everyday sleep.</p>
<ul>
<li>14 boat-mattress shapes with guided measurement diagrams</li>
<li>3-layer construction: Cotton Quilted + Polyester Filling + TPU Waterproof backing</li>
<li>Instant online pricing from shape area + mattress depth</li>
<li>Custom-made to your exact marine mattress geometry</li>
<li>Skin-safe materials with low-noise comfort</li>
</ul>
<h3>3-Layer Marine Protector Construction</h3>
<p>Built for marine sleeping environments where humidity and spills are common. The TPU waterproof backing blocks liquids, while the quilted top keeps the sleep surface soft and breathable.</p>
<ul>
<li>Top Layer: Cotton Quilted</li>
<li>Layer 2: Polyester Filling</li>
<li>Layer 3: TPU Waterproof backing</li>
<li>Water-spill and accident protection</li>
<li>Machine washable and quick-dry care routine</li>
</ul>'
WHERE slug = 'marine-mattress-protector';

UPDATE products
SET fabric_options = 'tpu'
WHERE slug IN ('mattress-protector-standard', 'mattress-protector-family', 'mattress-protector-deep-pocket', 'marine-mattress-protector');

UPDATE products
SET fabric_options = 'breezeplus'
WHERE slug = 'pet-proof-mattress-protector';
