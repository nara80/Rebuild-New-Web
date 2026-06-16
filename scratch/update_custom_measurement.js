const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '../public/custom-measurement/index.html');
const thPath = path.join(__dirname, '../public/th/custom-measurement/index.html');

// --- 1. ENGLISH PAGE ---
let enHtml = fs.readFileSync(enPath, 'utf8');

// Title & Meta tags
enHtml = enHtml.replace(
  '<title>Custom Measurement Guide  -  MildMate</title>',
  '<title>Custom Bedding for Any Size, Shape, or Space | MildMate</title>'
);
enHtml = enHtml.replace(
  '<meta name="description" content="Engineering-grade measurement protocol for custom boat mattresses, RV bedding, and specialized shapes. Get a precision quote with our schematic drafting service.">',
  '<meta name="description" content="Custom bedding for overseas dorms, adjustable beds, joined family beds, extra-deep mattresses, boats, RVs, and unique mattress shapes. Get a custom quote.">'
);
enHtml = enHtml.replace(
  '<meta property="og:title" content="Custom Measurement Guide  -  MildMate">',
  '<meta property="og:title" content="Custom Bedding for Any Size, Shape, or Space | MildMate">'
);
enHtml = enHtml.replace(
  '<meta property="og:description" content="Engineering-grade measurement protocol for custom boat mattresses, RV bedding, and specialized shapes. Get a precision quote with our schematic drafting service.">',
  '<meta property="og:description" content="Custom bedding for overseas dorms, adjustable beds, joined family beds, extra-deep mattresses, boats, RVs, and unique mattress shapes. Get a custom quote.">'
);
enHtml = enHtml.replace(
  '<meta name="twitter:title" content="Custom Measurement Guide  -  MildMate">',
  '<meta name="twitter:title" content="Custom Bedding for Any Size, Shape, or Space | MildMate">'
);
enHtml = enHtml.replace(
  '<meta name="twitter:description" content="Engineering-grade measurement protocol for custom boat mattresses, RV bedding, and specialized shapes. Get a precision quote with our schematic drafting service.">',
  '<meta name="twitter:description" content="Custom bedding for overseas dorms, adjustable beds, joined family beds, extra-deep mattresses, boats, RVs, and unique mattress shapes. Get a custom quote.">'
);

// Main content replace
const enMainStart = enHtml.indexOf('<main>');
const enMainEnd = enHtml.indexOf('</main>');
if (enMainStart !== -1 && enMainEnd !== -1) {
  const newEnMain = `<main>
    
    <!-- ===== HERO ===== -->
    <section class="custom-hero">
      <div class="custom-hero-inner">
        <h1>Custom Bedding for Any Size, Shape, or Space</h1>
        <p class="hero-sub">Need bedding for an overseas dorm, adjustable bed, joined family bed, boat, RV, truck sleeper, extra-deep mattress, or unique mattress shape? Send us the details, and we’ll help you identify the measurements needed for a custom-made solution.</p>
      </div>
    </section>

    <div class="custom-main">
      <div class="custom-container">

        <!-- ===== PROTOCOL ===== -->
        <div class="protocol-section">
          <div class="section-kicker">How We Design Your Perfect Fit</div>
          <h2>Your Custom Design Journey</h2>
          <p>We ensure your custom bedding fits like a glove, whether it is for an overseas dorm, adjustable bed, joined family bed, extra-deep mattress, boat, RV, or unique mattress shape. Here is how we work together to create your custom masterpiece.</p>

          <div class="workflow-grid">
            
            <!-- Step 1 -->
            <div class="workflow-step">
              <div class="step-number-box">01</div>
              <div class="step-content">
                <h3>Share Your Bed Details</h3>
                <p>Send the mattress size, bed model, destination requirements, photo, or a simple sketch. For vehicles and boats, include the model and year when available.</p>
              </div>
              <img src="/images/Measurement/workflow-step1-sketch.jpg" class="step-visual-thumb" alt="Share your model sketch">
            </div>

            <!-- Step 2 -->
            <div class="workflow-step">
              <div class="step-number-box">02</div>
              <div class="step-content">
                <h3>We Identify the Measurements Needed</h3>
                <p>Using the information you provide, we prepare a measurement guide or proposed shape drawing showing the dimensions that need to be checked. Previous references may be used as a starting point when available.</p>
              </div>
              <img src="/images/Measurement/workflow-step2-cad.jpg" class="step-visual-thumb" alt="Technical blueprint drafting">
            </div>

            <!-- Step 3 -->
            <div class="workflow-step">
              <div class="step-number-box">03</div>
              <div class="step-content">
                <h3>Measure and Confirm</h3>
                <p>Use a tape measure to check every marked dimension. This is our preferred method for confirming production measurements.</p>
                <p style="margin-top: 8px; font-size: 0.875rem; color: var(--color-muted);"><strong>Optional Visual Reference:</strong> If a dimension cannot be measured directly, you may include a photo with a standard-size card placed flat beside the mattress as a visual scale reference. This does not replace the confirmed tape measurements required for production.</p>
              </div>
              <img src="/images/Measurement/workflow-step3-verification.jpg" class="step-visual-thumb" alt="Tape measure check">
            </div>

            <!-- Step 4 -->
            <div class="workflow-step">
              <div class="step-number-box">04</div>
              <div class="step-content">
                <h3>Confirm the Details and Choose Your Fabric</h3>
                <p>Once the measurements and shape are confirmed, we provide the final measurement record and help you choose a fabric that suits the intended climate, care routine, comfort preference, and use.</p>
                <a href="/fabric/" style="display:inline-block; margin-top:12px; color:var(--color-primary); font-weight:700; text-decoration:none;">Explore Our Fabric Collections</a>
              </div>
              <img src="/images/Measurement/workflow-step4-fabrics.jpg" class="step-visual-thumb" alt="Fabric selection">
            </div>

            <!-- Step 5 -->
            <div class="workflow-step">
              <div class="step-number-box">05</div>
              <div class="step-content">
                <h3>Review Your Quote and Start Production</h3>
                <p>We prepare the quotation based on the confirmed dimensions, product type, fabric, and delivery destination. After approval and payment, the order moves into made-to-order production.</p>
              </div>
              <img src="/images/Measurement/workflow-step5-quote.jpg" class="step-visual-thumb" alt="Tailored quote approval">
            </div>

          </div>

          <!-- Marketing Visuals -->
          <div class="visual-gallery">
            <div class="gallery-item">
              <div class="gallery-label">Marine & Yacht</div>
              <img src="/images/Measurement/marine-vberth-lifestyle.jpg" alt="Marine V-Berth custom bedding">
            </div>
            <div class="gallery-item">
              <div class="gallery-label">RVs & Trucks</div>
              <img src="/images/Measurement/truck-cab-lifestyle.jpg" alt="RV and truck cab custom mattress">
            </div>
          </div>
        </div>

        <!-- ===== CTA ===== -->
        <div class="cta-block">
          <h2>Can’t Find Bedding That Fits?</h2>
          <p>Send us your mattress size, bed model, destination requirements, photo, or sketch. Whether it is for an overseas dorm, adjustable bed, family bed, extra-deep mattress, boat, RV, or unique shape, our team will help you identify the next step.</p>
          <a href="/contact/" class="btn-primary" style="background:var(--color-primary); color:#fff; padding:16px 48px; border-radius:var(--radius); text-decoration:none; font-weight:700; font-size:1.1rem; display:inline-block;">Start Your Custom Quote</a>
          <p style="margin-top: 12px; font-size: 0.875rem; opacity: 0.85; margin-bottom: 0;">Not sure what to measure? Send what you have—we’ll guide you.</p>
        </div>

      </div>
    </div>

  </main>`;
  enHtml = enHtml.substring(0, enMainStart) + newEnMain + enHtml.substring(enMainEnd + 7);
  fs.writeFileSync(enPath, enHtml, 'utf8');
  console.log('Successfully updated English page.');
} else {
  console.error('Error: Could not find main tags in English page.');
}


// --- 2. THAI PAGE ---
let thHtml = fs.readFileSync(thPath, 'utf8');

// Title & Meta tags
thHtml = thHtml.replace(
  '<title>คู่มือการวัดขนาดสั่งทำ  -  MildMate</title>',
  '<title>เครื่องนอนสั่งตัดสำหรับทุกขนาด ทุกรูปทรง และทุกพื้นที่ | MildMate</title>'
);
thHtml = thHtml.replace(
  '<meta name="description" content="กระบวนการวัดขนาดแบบวิศวกรรมสำหรับที่นอนเรือสั่งทำ ผ้าปูรถบ้าน และรูปทรงพิเศษ รับใบเสนอราคาที่แม่นยำด้วยบริการร่างแบบของเรา">',
  '<meta name="description" content="เครื่องนอนสั่งตัดสำหรับหอพักต่างประเทศ เตียงปรับระดับ เตียงครอบครัว ที่นอนหนาพิเศษ เรือ รถบ้าน และที่นอนรูปทรงเฉพาะ รับใบเสนอราคาที่แม่นยำดั่งใจ">'
);
thHtml = thHtml.replace(
  '<meta property="og:title" content="คู่มือการวัดขนาดสั่งทำ  -  MildMate">',
  '<meta property="og:title" content="เครื่องนอนสั่งตัดสำหรับทุกขนาด ทุกรูปทรง และทุกพื้นที่ | MildMate">'
);
thHtml = thHtml.replace(
  '<meta property="og:description" content="กระบวนการวัดขนาดแบบวิศวกรรมสำหรับที่นอนเรือสั่งทำ ผ้าปูรถบ้าน และรูปทรงพิเศษ รับใบเสนอราคาที่แม่นยำด้วยบริการร่างแบบของเรา">',
  '<meta property="og:description" content="เครื่องนอนสั่งตัดสำหรับหอพักต่างประเทศ เตียงปรับระดับ เตียงครอบครัว ที่นอนหนาพิเศษ เรือ รถบ้าน และที่นอนรูปทรงเฉพาะ รับใบเสนอราคาที่แม่นยำดั่งใจ">'
);
thHtml = thHtml.replace(
  '<meta name="twitter:title" content="คู่มือการวัดขนาดสั่งทำ  -  MildMate">',
  '<meta name="twitter:title" content="เครื่องนอนสั่งตัดสำหรับทุกขนาด ทุกรูปทรง และทุกพื้นที่ | MildMate">'
);
thHtml = thHtml.replace(
  '<meta name="twitter:description" content="กระบวนการวัดขนาดแบบวิศวกรรมสำหรับที่นอนเรือสั่งทำ ผ้าปูรถบ้าน และรูปทรงพิเศษ รับใบเสนอราคาที่แม่นยำด้วยบริการร่างแบบของเรา">',
  '<meta name="twitter:description" content="เครื่องนอนสั่งตัดสำหรับหอพักต่างประเทศ เตียงปรับระดับ เตียงครอบครัว ที่นอนหนาพิเศษ เรือ รถบ้าน และที่นอนรูปทรงเฉพาะ รับใบเสนอราคาที่แม่นยำดั่งใจ">'
);

// Main content replace
const thMainStart = thHtml.indexOf('<main>');
const thMainEnd = thHtml.indexOf('</main>');
if (thMainStart !== -1 && thMainEnd !== -1) {
  const newThMain = `<main>
    
    <!-- ===== HERO ===== -->
    <section class="custom-hero">
      <div class="custom-hero-inner">
        <h1>เครื่องนอนสั่งตัดสำหรับทุกขนาด ทุกรูปทรง และทุกพื้นที่</h1>
        <p class="hero-sub">ไม่ว่าจะเป็นเตียงหอพักต่างประเทศ เตียงปรับระดับ เตียงครอบครัว ที่นอนหนาพิเศษ เรือ รถบ้าน ห้องนอนรถบรรทุก หรือที่นอนรูปทรงเฉพาะ ส่งข้อมูลมาให้เรา แล้วทีม MildMate จะช่วยแนะนำขนาดที่ต้องใช้สำหรับการผลิตตามสั่ง</p>
      </div>
    </section>

    <div class="custom-main">
      <div class="custom-container">

        <!-- ===== PROTOCOL ===== -->
        <div class="protocol-section">
          <div class="section-kicker">ขั้นตอนการวัดและยืนยันขนาด</div>
          <h2>เริ่มต้นเครื่องนอนสั่งตัดของคุณ</h2>
          <p>เราช่วยแนะนำการวัดและตรวจสอบข้อมูลทีละขั้นตอน เพื่อให้ผลิตเครื่องนอนตามขนาดและรูปทรงที่คุณยืนยัน ไม่ว่าจะเป็นเตียงหอพักต่างประเทศ เตียงปรับระดับ เตียงครอบครัว ที่นอนหนาพิเศษ หรือรูปทรงเฉพาะของเรือและรถบ้าน</p>

          <div class="workflow-grid">
            
            <!-- Step 1 -->
            <div class="workflow-step">
              <div class="step-number-box">01</div>
              <div class="step-content">
                <h3>ส่งรายละเอียดเตียงหรือที่นอน</h3>
                <p>ส่งขนาดที่นอน รุ่นเตียง ข้อกำหนดของสถานที่ รูปถ่าย หรือภาพร่างง่าย ๆ สำหรับเรือและยานพาหนะ กรุณาแจ้งรุ่นและปีหากมีข้อมูล</p>
              </div>
              <img src="/images/Measurement/workflow-step1-sketch.jpg" class="step-visual-thumb" alt="Share your model sketch">
            </div>

            <!-- Step 2 -->
            <div class="workflow-step">
              <div class="step-number-box">02</div>
              <div class="step-content">
                <h3>เราร่างแบบแปลนของคุณ</h3>
                <p>จากข้อมูลที่คุณส่งมา เราจะจัดทำแนวทางการวัดหรือภาพรูปทรงเบื้องต้น พร้อมระบุตำแหน่งขนาดที่ต้องตรวจสอบ หากมีข้อมูลอ้างอิงเดิม เราอาจใช้เป็นจุดเริ่มต้นก่อนให้คุณยืนยัน</p>
              </div>
              <img src="/images/Measurement/workflow-step2-cad.jpg" class="step-visual-thumb" alt="Technical blueprint drafting">
            </div>

            <!-- Step 3 -->
            <div class="workflow-step">
              <div class="step-number-box">03</div>
              <div class="step-content">
                <h3>วัดและยืนยันขนาด</h3>
                <p>ใช้สายวัดตรวจสอบทุกตำแหน่งที่ระบุ วิธีนี้เป็นวิธีหลักที่เราแนะนำสำหรับยืนยันขนาดก่อนผลิต</p>
                <p style="margin-top: 8px; font-size: 0.875rem; color: var(--color-muted);"><strong>ตัวเลือกเสริมสำหรับอ้างอิงสัดส่วน:</strong> หากมีบางตำแหน่งที่วัดโดยตรงได้ยาก สามารถถ่ายรูปโดยวางบัตรขนาดมาตรฐานราบข้างที่นอน เพื่อใช้เป็นตัวอ้างอิงสัดส่วนเบื้องต้นได้ แต่ไม่ใช้แทนขนาดจากสายวัดที่ต้องยืนยันก่อนผลิต</p>
              </div>
              <img src="/images/Measurement/workflow-step3-verification.jpg" class="step-visual-thumb" alt="Tape measure check">
            </div>

            <!-- Step 4 -->
            <div class="workflow-step">
              <div class="step-number-box">04</div>
              <div class="step-content">
                <h3>ยืนยันรายละเอียดและเลือกเนื้อผ้า</h3>
                <p>เมื่อยืนยันขนาดและรูปทรงเรียบร้อยแล้ว เราจะจัดส่งข้อมูลวัดขนาดฉบับสุดท้าย และช่วยเลือกเนื้อผ้าที่เหมาะกับสภาพอากาศ การดูแลรักษา ความสบาย และรูปแบบการใช้งาน</p>
                <a href="/fabric/" style="display:inline-block; margin-top:12px; color:var(--color-primary); font-weight:700; text-decoration:none;">ดูคอลเลกชันเนื้อผ้า</a>
              </div>
              <img src="/images/Measurement/workflow-step4-fabrics.jpg" class="step-visual-thumb" alt="Fabric selection">
            </div>

            <!-- Step 5 -->
            <div class="workflow-step">
              <div class="step-number-box">05</div>
              <div class="step-content">
                <h3>ตรวจสอบใบเสนอราคาและเริ่มผลิต</h3>
                <p>เราจัดทำใบเสนอราคาตามขนาดที่ยืนยัน ประเภทสินค้า เนื้อผ้า และปลายทางจัดส่ง หลังอนุมัติและชำระเงินแล้ว คำสั่งซื้อจะเข้าสู่กระบวนการผลิตตามสั่ง</p>
              </div>
              <img src="/images/Measurement/workflow-step5-quote.jpg" class="step-visual-thumb" alt="Tailored quote approval">
            </div>

          </div>

          <!-- Marketing Visuals -->
          <div class="visual-gallery">
            <div class="gallery-item">
              <div class="gallery-label">เครื่องนอนเรือยอชต์</div>
              <img src="/images/Measurement/marine-vberth-lifestyle.jpg" alt="เครื่องนอนสั่งทำ V-Berth สำหรับเรือ">
            </div>
            <div class="gallery-item">
              <div class="gallery-label">รถบ้านและเครื่องนอนในรถบรรทุก</div>
              <img src="/images/Measurement/truck-cab-lifestyle.jpg" alt="ที่นอนสั่งทำสำหรับรถบ้านและรถบรรทุก">
            </div>
          </div>
        </div>

        <!-- ===== CTA ===== -->
        <div class="cta-block">
          <h2>หาเครื่องนอนที่พอดีกับเตียงไม่ได้ใช่ไหม?</h2>
          <p>ส่งขนาดที่นอน รุ่นเตียง ข้อกำหนดของสถานที่ รูปถ่าย หรือภาพร่างมาให้เรา ไม่ว่าจะเป็นหอพักต่างประเทศ เตียงปรับระดับ เตียงครอบครัว ที่นอนหนาพิเศษ เรือ รถบ้าน หรือรูปทรงเฉพาะ ทีม MildMate จะช่วยแนะนำขั้นตอนถัดไป</p>
          <a href="/contact/" class="btn-primary" style="background:var(--color-primary); color:#fff; padding:16px 48px; border-radius:var(--radius); text-decoration:none; font-weight:700; font-size:1.1rem; display:inline-block;">เริ่มขอใบเสนอราคา</a>
          <p style="margin-top: 12px; font-size: 0.875rem; opacity: 0.85; margin-bottom: 0;">ไม่แน่ใจว่าต้องวัดอะไรบ้าง? ส่งข้อมูลที่มีมาได้ แล้วเราจะช่วยแนะนำ</p>
        </div>

      </div>
    </div>

  </main>`;
  thHtml = thHtml.substring(0, thMainStart) + newThMain + thHtml.substring(thMainEnd + 7);
  fs.writeFileSync(thPath, thHtml, 'utf8');
  console.log('Successfully updated Thai page.');
} else {
  console.error('Error: Could not find main tags in Thai page.');
}
