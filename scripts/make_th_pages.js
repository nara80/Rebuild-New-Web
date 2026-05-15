const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '..', 'public');

const templatePath = path.join(base, 'th', 'fitted-sheets', 'index.html');
const template = fs.readFileSync(templatePath, 'utf8');

const replacements = {
  'duvet-covers': { h1: 'ผ้าคลุมผ้าสวย', sub: 'ไซส์มาตรฐานสำหรับ 8 ภูมิภาค พร้อมราคาเฉพาะคิวสำหรับทุกขนาดและรูปแบบเตียงพิเศษ' },
  'pillowcases':   { h1: 'ถุงหมอน', sub: 'ไซส์มาตรฐาน 3 รูปแบบซิป ราคาเฉพาะคิวสำหรับหมอนพิเศษและหมอนโดริแมกุระ' },
  'mattress-protectors': { h1: 'ผ้าปูกันเปื้อนที่นอนและหมอน', sub: 'ไซส์มาตรฐาน (6 ด้าน + ถุงหมอน) ราคาเฉพาะคิวสำหรับเตียง RV รถบรรทุก และทุกรูปแบบพิเศษ' },
  'marine': { h1: 'เรือและยอร์ช', sub: 'ผ้าปู V-Berth และที่นอนเรือ ทุกชิ้นสั่งตัดตามขนาดกระเป๋าและห้องเรือของคุณ' },
  'family': { h1: 'ครอบครัวและการนอนร่วม', sub: 'เตียงใหญ่พิเศษและที่นอนรวม ไร้รอยต่อ ตัวเลือกมาตรฐานและราคาเฉพาะคิวสำหรับทุกการกำหนดค่าครอบครัว' },
  'pets': { h1: 'ผ้าปูสำหรับผู้เลี้ยงสัตว์', sub: 'ผ้าปูและผ้าคลุม BreezePlus กันขนสัตว์ ไซส์มาตรฐานและราคาเฉพาะคิวสำหรับบ้านที่มีสัตว์เลี้ยง' },
  'duvet': { h1: 'ผ้าคลุมผ้าสวยง่าย', sub: 'ซิป 3 ด้านเปลี่ยนง่าย ไซส์มาตรฐานและราคาเฉพาะคิวสำหรับทุกขนาดผ้าคลุม' },
  'protection': { h1: 'การปกป้อง', sub: 'ผ้าปูกันน้ำ TPU และกำจัดไรฝุ่น ไซส์มาตรฐานและราคาเฉพาะคิวสำหรับที่นอนทุกรูปแบบ' },
  'rv-truck': { h1: 'ผ้าปูสำหรับรถ RV และรถบรรทุก', sub: 'สำหรับเตียงสั้น ชั้นล่าง V-berths และเตียงมุมตัด ตัวเลือกมาตรฐานและราคาเฉพาะคิวสำหรับพื้นที่จำกัด' },
};

const searchH1 = 'ผ้าปูที่นอน';
const searchSub = 'ไซส์มาตรฐานสำหรับ 8 ภูมิภาค พร้อมราคาเฉพาะคิวสำหรับ V-Berth ที่นอนปรับได้ และทุกรูปแบบพิเศษ';

Object.entries(replacements).forEach(([folder, { h1, sub }]) => {
  const folderPath = path.join(base, 'th', folder);
  fs.mkdirSync(folderPath, { recursive: true });
  const filePath = path.join(folderPath, 'index.html');
  const content = template.replace(searchH1, h1).replace(searchSub, sub);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Created:', filePath);
});

console.log('Done.');
