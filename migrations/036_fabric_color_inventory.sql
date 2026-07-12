-- MildMate Migration 036
-- Fabric color inventory — admin can mark colors as out of stock
-- Product pages disable out-of-stock swatches in real time

CREATE TABLE IF NOT EXISTS fabric_color_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fabric TEXT NOT NULL,
  color  TEXT NOT NULL,
  in_stock INTEGER NOT NULL DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(fabric, color)
);

-- Seed all BreezePlus colors
INSERT OR IGNORE INTO fabric_color_inventory (fabric, color, in_stock) VALUES
  ('breezeplus', 'dark-grey',  1),
  ('breezeplus', 'silver',     1),
  ('breezeplus', 'sand',       1),
  ('breezeplus', 'sky',        0),
  ('breezeplus', 'emerald',    1),
  ('breezeplus', 'sea',        1),
  ('breezeplus', 'pure-white', 1),
  ('breezeplus', 'baby-pink',  0),
  ('breezeplus', 'ivory',      1);

-- Seed all CloudSoft colors
INSERT OR IGNORE INTO fabric_color_inventory (fabric, color, in_stock) VALUES
  ('cloudsoft', 'mint',      1),
  ('cloudsoft', 'charcoal',  1),
  ('cloudsoft', 'grey',      1),
  ('cloudsoft', 'sapphire',  1),
  ('cloudsoft', 'forest',    1),
  ('cloudsoft', 'denim',     1),
  ('cloudsoft', 'rosegold',  1),
  ('cloudsoft', 'beige',     1),
  ('cloudsoft', 'ovaltine',  1),
  ('cloudsoft', 'white',     1),
  ('cloudsoft', 'lavender',  1),
  ('cloudsoft', 'olive',     1);

-- Seed PremaCotton + EcoLuxe colors
INSERT OR IGNORE INTO fabric_color_inventory (fabric, color, in_stock) VALUES
  ('premacotton', 'snow-white',     1),
  ('ecoluxe',     'vanilla-linen',  1);
