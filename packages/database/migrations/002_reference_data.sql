-- Manchengo ERP - Reference Data Migration
-- Version: 2
-- Description: Seed reference data for units and Algerian wilayas

-- ============================================================================
-- UNITS OF MEASURE
-- ============================================================================

INSERT OR IGNORE INTO ref_units (code, name, name_fr, base_unit, conversion_factor) VALUES
    ('KG', 'Kilogram', 'Kilogramme', NULL, 1.0),
    ('G', 'Gram', 'Gramme', 'KG', 0.001),
    ('T', 'Ton', 'Tonne', 'KG', 1000.0),
    ('L', 'Litre', 'Litre', NULL, 1.0),
    ('ML', 'Millilitre', 'Millilitre', 'L', 0.001),
    ('PC', 'Piece', 'Pièce', NULL, 1.0),
    ('CTN', 'Carton', 'Carton', NULL, 1.0),
    ('PAL', 'Palette', 'Palette', NULL, 1.0),
    ('SAC', 'Bag', 'Sac', NULL, 1.0),
    ('BTE', 'Box', 'Boîte', NULL, 1.0);

-- ============================================================================
-- PRODUCT CATEGORIES
-- ============================================================================

-- Raw Material Categories (MP)
INSERT OR IGNORE INTO ref_categories (id, code, name, parent_id, category_type) VALUES
    ('cat-mp-lait', 'MP-LAIT', 'Lait et produits laitiers', NULL, 'MP'),
    ('cat-mp-ferment', 'MP-FERM', 'Ferments et présure', NULL, 'MP'),
    ('cat-mp-sel', 'MP-SEL', 'Sel et additifs', NULL, 'MP'),
    ('cat-mp-emb', 'MP-EMB', 'Emballages', NULL, 'MP'),
    ('cat-mp-autre', 'MP-AUTRE', 'Autres matières premières', NULL, 'MP');

-- Finished Product Categories (PF)
INSERT OR IGNORE INTO ref_categories (id, code, name, parent_id, category_type) VALUES
    ('cat-pf-fromage', 'PF-FROM', 'Fromages', NULL, 'PF'),
    ('cat-pf-from-frais', 'PF-FROM-FRAIS', 'Fromages frais', 'cat-pf-fromage', 'PF'),
    ('cat-pf-from-pate-molle', 'PF-FROM-PM', 'Fromages à pâte molle', 'cat-pf-fromage', 'PF'),
    ('cat-pf-from-pate-pressee', 'PF-FROM-PP', 'Fromages à pâte pressée', 'cat-pf-fromage', 'PF'),
    ('cat-pf-beurre', 'PF-BEUR', 'Beurres', NULL, 'PF'),
    ('cat-pf-creme', 'PF-CREM', 'Crèmes', NULL, 'PF'),
    ('cat-pf-lait', 'PF-LAIT', 'Laits conditionnés', NULL, 'PF'),
    ('cat-pf-autre', 'PF-AUTRE', 'Autres produits finis', NULL, 'PF');

-- ============================================================================
-- ALGERIAN WILAYAS (58 wilayas)
-- ============================================================================

INSERT OR IGNORE INTO ref_wilayas (code, name, name_ar) VALUES
    ('01', 'Adrar', 'أدرار'),
    ('02', 'Chlef', 'الشلف'),
    ('03', 'Laghouat', 'الأغواط'),
    ('04', 'Oum El Bouaghi', 'أم البواقي'),
    ('05', 'Batna', 'باتنة'),
    ('06', 'Béjaïa', 'بجاية'),
    ('07', 'Biskra', 'بسكرة'),
    ('08', 'Béchar', 'بشار'),
    ('09', 'Blida', 'البليدة'),
    ('10', 'Bouira', 'البويرة'),
    ('11', 'Tamanrasset', 'تمنراست'),
    ('12', 'Tébessa', 'تبسة'),
    ('13', 'Tlemcen', 'تلمسان'),
    ('14', 'Tiaret', 'تيارت'),
    ('15', 'Tizi Ouzou', 'تيزي وزو'),
    ('16', 'Alger', 'الجزائر'),
    ('17', 'Djelfa', 'الجلفة'),
    ('18', 'Jijel', 'جيجل'),
    ('19', 'Sétif', 'سطيف'),
    ('20', 'Saïda', 'سعيدة'),
    ('21', 'Skikda', 'سكيكدة'),
    ('22', 'Sidi Bel Abbès', 'سيدي بلعباس'),
    ('23', 'Annaba', 'عنابة'),
    ('24', 'Guelma', 'قالمة'),
    ('25', 'Constantine', 'قسنطينة'),
    ('26', 'Médéa', 'المدية'),
    ('27', 'Mostaganem', 'مستغانم'),
    ('28', 'M''Sila', 'المسيلة'),
    ('29', 'Mascara', 'معسكر'),
    ('30', 'Ouargla', 'ورقلة'),
    ('31', 'Oran', 'وهران'),
    ('32', 'El Bayadh', 'البيض'),
    ('33', 'Illizi', 'إليزي'),
    ('34', 'Bordj Bou Arréridj', 'برج بوعريريج'),
    ('35', 'Boumerdès', 'بومرداس'),
    ('36', 'El Tarf', 'الطارف'),
    ('37', 'Tindouf', 'تندوف'),
    ('38', 'Tissemsilt', 'تيسمسيلت'),
    ('39', 'El Oued', 'الوادي'),
    ('40', 'Khenchela', 'خنشلة'),
    ('41', 'Souk Ahras', 'سوق أهراس'),
    ('42', 'Tipaza', 'تيبازة'),
    ('43', 'Mila', 'ميلة'),
    ('44', 'Aïn Defla', 'عين الدفلى'),
    ('45', 'Naâma', 'النعامة'),
    ('46', 'Aïn Témouchent', 'عين تموشنت'),
    ('47', 'Ghardaïa', 'غرداية'),
    ('48', 'Relizane', 'غليزان'),
    -- New wilayas (2019)
    ('49', 'El M''Ghair', 'المغير'),
    ('50', 'El Meniaa', 'المنيعة'),
    ('51', 'Ouled Djellal', 'أولاد جلال'),
    ('52', 'Bordj Badji Mokhtar', 'برج باجي مختار'),
    ('53', 'Béni Abbès', 'بني عباس'),
    ('54', 'Timimoun', 'تيميمون'),
    ('55', 'Touggourt', 'تقرت'),
    ('56', 'Djanet', 'جانت'),
    ('57', 'In Salah', 'عين صالح'),
    ('58', 'In Guezzam', 'عين قزام');

-- ============================================================================
-- DEFAULT WAREHOUSE
-- ============================================================================

INSERT OR IGNORE INTO warehouses (id, code, name, is_default) VALUES
    ('wh-default', 'WH-MAIN', 'Entrepôt Principal', 1);

-- ============================================================================
-- DEFAULT ADMIN USER
-- SECURITY: Password hash below is intentionally invalid (DISABLED).
-- You MUST set a real password via the application before production use.
-- Generate a valid hash through: POST /auth/users endpoint
-- ============================================================================

INSERT OR IGNORE INTO users (id, username, password_hash, full_name, role) VALUES
    ('user-admin', 'admin', '$argon2id$v=19$m=65536,t=3,p=4$DISABLED_CHANGE_VIA_APP$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Administrateur', 'ADMIN');
