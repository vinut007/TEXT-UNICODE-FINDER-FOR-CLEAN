/*
  Data-cleaning query for MySQL / MariaDB (utf8mb4).

  Rules implemented:
  1. MOJIBAKE (e.g. 'GarcÃ­a', 'Ã¼', 'â€™') is recovered to its intended
     NATIVE character by re-encoding Latin-1 bytes as UTF-8
     ('GarcÃ­a' -> 'García', 'Ã¼' -> 'ü'). Original language/script is
     preserved -- it is NOT converted to English/ASCII.
  2. CLEAN accented text is stripped to English/ASCII
     ('García' -> 'Garcia', 'é' -> 'e', 'ñ' -> 'n', 'ß' -> 'ss').
  3. EMPTY and NATIVE (non-Latin scripts: CJK, Cyrillic, Arabic, etc.) are
     returned unchanged.
  4. Case normalization (title case) is applied only to CLEAN text, not to
     recovered mojibake.

  Requires MySQL 8.0+ (REGEXP_REPLACE, CONVERT(... USING ...)).
*/
WITH base AS (
  SELECT id, original_text,
    CASE
      WHEN original_text IS NULL OR original_text = '' THEN 'EMPTY'
      WHEN original_text REGEXP '[ÃÂÐÑ]' OR original_text LIKE '%ï¿½%' THEN 'MOJIBAKE'
      WHEN original_text REGEXP '[\\x{0370}-\\x{03FF}\\x{0400}-\\x{04FF}\\x{0590}-\\x{06FF}\\x{0900}-\\x{0DFF}\\x{0E00}-\\x{0E7F}\\x{1000}-\\x{109F}\\x{10A0}-\\x{10FF}\\x{2E80}-\\x{9FFF}\\x{AC00}-\\x{D7AF}]' THEN 'NATIVE'
      ELSE 'CLEAN'
    END AS category
  FROM research.mojibake_test
),
r1 AS (
  SELECT id, original_text, category,
    CASE
      WHEN category = 'MOJIBAKE'
       AND CONVERT(CAST(CONVERT(original_text USING latin1) AS BINARY) USING utf8mb4) IS NOT NULL
       AND CHAR_LENGTH(CONVERT(CAST(CONVERT(original_text USING latin1) AS BINARY) USING utf8mb4)) < CHAR_LENGTH(original_text)
        THEN CONVERT(CAST(CONVERT(original_text USING latin1) AS BINARY) USING utf8mb4)
      ELSE NULL
    END AS x1
  FROM base
),
r2 AS (
  SELECT id, original_text, category, x1,
    CASE
      WHEN x1 IS NULL THEN NULL
      WHEN CONVERT(CAST(CONVERT(x1 USING latin1) AS BINARY) USING utf8mb4) IS NULL THEN x1
      WHEN CHAR_LENGTH(CONVERT(CAST(CONVERT(x1 USING latin1) AS BINARY) USING utf8mb4)) < CHAR_LENGTH(x1)
       AND HEX(CONVERT(CAST(CONVERT(x1 USING latin1) AS BINARY) USING utf8mb4)) <> HEX(x1)
        THEN CONVERT(CAST(CONVERT(x1 USING latin1) AS BINARY) USING utf8mb4)
      ELSE x1
    END AS x2
  FROM r1
),
r3 AS (
  SELECT id, original_text, category, x2,
    CASE
      WHEN x2 IS NULL THEN NULL
      WHEN CONVERT(CAST(CONVERT(x2 USING latin1) AS BINARY) USING utf8mb4) IS NULL THEN x2
      WHEN CHAR_LENGTH(CONVERT(CAST(CONVERT(x2 USING latin1) AS BINARY) USING utf8mb4)) < CHAR_LENGTH(x2)
       AND HEX(CONVERT(CAST(CONVERT(x2 USING latin1) AS BINARY) USING utf8mb4)) <> HEX(x2)
        THEN CONVERT(CAST(CONVERT(x2 USING latin1) AS BINARY) USING utf8mb4)
      ELSE x2
    END AS x3
  FROM r2
),
chosen AS (
  SELECT id, original_text, category,
    CASE
      WHEN category = 'MOJIBAKE' AND x3 IS NOT NULL THEN x3
      WHEN category = 'CLEAN' THEN original_text
      ELSE NULL
    END AS to_clean
  FROM r3
),
stage1 AS (
  SELECT id, original_text, category, to_clean,
    CASE WHEN to_clean IS NULL OR category <> 'CLEAN' THEN to_clean ELSE
      REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
      REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
      REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
        to_clean COLLATE utf8mb4_bin,
        '[\\x{0300}-\\x{036F}]', ''),
        '[\\x{00C0}-\\x{00C5}\\x{0100}\\x{0102}\\x{0104}\\x{01CD}]', 'A'),
        '[\\x{00E0}-\\x{00E5}\\x{0101}\\x{0103}\\x{0105}\\x{01CE}]', 'a'),
        '[\\x{00C8}-\\x{00CB}\\x{0112}\\x{0114}\\x{0116}\\x{0118}\\x{011A}]', 'E'),
        '[\\x{00E8}-\\x{00EB}\\x{0113}\\x{0115}\\x{0117}\\x{0119}\\x{011B}]', 'e'),
        '[\\x{00CC}-\\x{00CF}\\x{0128}\\x{012A}\\x{012C}\\x{012E}\\x{0130}\\x{01CF}]', 'I'),
        '[\\x{00EC}-\\x{00EF}\\x{0129}\\x{012B}\\x{012D}\\x{012F}\\x{0131}\\x{01D0}]', 'i'),
        '[\\x{01D1}]', 'O'),
        '[\\x{01D2}]', 'o'),
        '[\\x{01D3}]', 'U'),
        '[\\x{01D4}]', 'u'),
        '[\\x{1E3E}]', 'M'),
        '[\\x{1E3F}]', 'm'),
        '[\\x{1E54}]', 'P'),
        '[\\x{1E55}]', 'p')
    END AS r1
  FROM chosen
),
stage2 AS (
  SELECT id, original_text, category, to_clean,
    CASE WHEN r1 IS NULL OR category <> 'CLEAN' THEN r1 ELSE
      REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
        r1 COLLATE utf8mb4_bin,
        '[\\x{00D2}-\\x{00D6}\\x{00D8}\\x{014C}\\x{014E}\\x{0150}]', 'O'),
        '[\\x{00F2}-\\x{00F6}\\x{00F8}\\x{014D}\\x{014F}\\x{0151}]', 'o'),
        '[\\x{00D9}-\\x{00DC}\\x{0168}\\x{016A}\\x{016C}\\x{016E}\\x{0170}\\x{0172}]', 'U'),
        '[\\x{00F9}-\\x{00FC}\\x{0169}\\x{016B}\\x{016D}\\x{016F}\\x{0171}\\x{0173}]', 'u'),
        '[\\x{00C7}\\x{0106}\\x{0108}\\x{010A}\\x{010C}]', 'C'),
        '[\\x{00E7}\\x{0107}\\x{0109}\\x{010B}\\x{010D}]', 'c')
    END AS r2
  FROM stage1
),
stage3 AS (
  SELECT id, original_text, category, to_clean,
    CASE WHEN r2 IS NULL OR category <> 'CLEAN' THEN r2 ELSE
      REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
        r2 COLLATE utf8mb4_bin,
        '[\\x{00D1}\\x{0143}\\x{0145}\\x{0147}\\x{014A}\\x{1E46}]', 'N'),
        '[\\x{00F1}\\x{0144}\\x{0146}\\x{0148}\\x{014B}\\x{1E47}]', 'n'),
        '[\\x{015A}\\x{015C}\\x{015E}\\x{0160}\\x{1E62}]', 'S'),
        '[\\x{015B}\\x{015D}\\x{015F}\\x{0161}\\x{1E63}]', 's'),
        '[\\x{0179}\\x{017B}\\x{017D}]', 'Z'),
        '[\\x{017A}\\x{017C}\\x{017E}]', 'z'),
        '[\\x{0218}\\x{015E}]', 'S'),
        '[\\x{0219}\\x{015F}]', 's')
    END AS r3
  FROM stage2
),
stage4 AS (
  SELECT id, original_text, category, to_clean,
    CASE WHEN r3 IS NULL OR category <> 'CLEAN' THEN r3 ELSE
      REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
        r3 COLLATE utf8mb4_bin,
        '[\\x{0154}\\x{0156}\\x{0158}]', 'R'),
        '[\\x{0155}\\x{0157}\\x{0159}]', 'r'),
        '[\\x{0162}\\x{0164}\\x{0166}\\x{1E6C}]', 'T'),
        '[\\x{0163}\\x{0165}\\x{0167}\\x{1E6D}]', 't'),
        '[\\x{00DD}\\x{0176}\\x{0178}]', 'Y'),
        '[\\x{00FD}\\x{00FF}\\x{0177}]', 'y'),
        '[\\x{021A}\\x{0162}]', 'T'),
        '[\\x{021B}\\x{0163}]', 't')
    END AS r4
  FROM stage3
),
stage5 AS (
  SELECT id, original_text, category, to_clean,
    CASE WHEN r4 IS NULL OR category <> 'CLEAN' THEN r4 ELSE
      REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
        r4 COLLATE utf8mb4_bin,
        '[\\x{010E}\\x{0110}\\x{1E0C}]', 'D'),
        '[\\x{010F}\\x{0111}\\x{1E0D}]', 'd'),
        '[\\x{011C}\\x{011E}\\x{0120}\\x{0122}]', 'G'),
        '[\\x{011D}\\x{011F}\\x{0121}\\x{0123}]', 'g'),
        '[\\x{0124}\\x{0126}]', 'H'),
        '[\\x{0125}\\x{0127}]', 'h'),
        '[\\x{00DE}]', 'TH'),
        '[\\x{00FE}]', 'th')
    END AS r5
  FROM stage4
),
stage6 AS (
  SELECT id, original_text, category, to_clean,
    CASE WHEN r5 IS NULL OR category <> 'CLEAN' THEN r5 ELSE
      REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
        r5 COLLATE utf8mb4_bin,
        '[\\x{0134}]', 'J'), '[\\x{0135}]', 'j'),
        '[\\x{0136}]', 'K'), '[\\x{0137}]', 'k'),
        '[\\x{0139}\\x{013B}\\x{013D}\\x{013F}\\x{0141}]', 'L'),
        '[\\x{013A}\\x{013C}\\x{013E}\\x{0140}\\x{0142}]', 'l')
    END AS r6
  FROM stage5
),
stage7 AS (
  SELECT id, original_text, category, to_clean,
    CASE WHEN r6 IS NULL OR category <> 'CLEAN' THEN r6 ELSE
      REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
        r6 COLLATE utf8mb4_bin,
        '[\\x{0174}\\x{1E82}]', 'W'),
        '[\\x{0175}\\x{1E83}]', 'w'),
        '[\\x{00C6}\\x{01FC}\\x{01E2}]', 'AE'),
        '[\\x{00E6}\\x{01FD}\\x{01E3}]', 'ae'),
        '[\\x{0152}]', 'OE'),
        '[\\x{0153}]', 'oe'),
        '[\\x{01FE}]', 'O'),
        '[\\x{01FF}]', 'o')
    END AS r7
  FROM stage6
),
stage8 AS (
  SELECT id, original_text, category, to_clean,
    CASE WHEN r7 IS NULL OR category <> 'CLEAN' THEN r7 ELSE
      REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
        r7 COLLATE utf8mb4_bin,
        '[\\x{00D0}]', 'D'), '[\\x{00F0}]', 'd'),
        '[\\x{00DF}]', 'ss'), '[\\x{1E9E}]', 'SS'),
        '[\\x{00DE}]', 'TH'), '[\\x{00FE}]', 'th')
    END AS r8
  FROM stage7
),
stage9 AS (
  SELECT id, original_text, category, to_clean,
    CASE WHEN r8 IS NULL OR category <> 'CLEAN' THEN r8 ELSE
      REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
        r8 COLLATE utf8mb4_bin,
        '[\\x{1EA0}-\\x{1EB7}]', 'a'),
        '[\\x{1EB8}-\\x{1EC6}]', 'e'),
        '[\\x{1EC8}\\x{1ECA}]', 'i'),
        '[\\x{1ECC}-\\x{1EE2}]', 'o'),
        '[\\x{1EE4}-\\x{1EF0}]', 'u'),
        '[\\x{1EF2}-\\x{1EF8}]', 'y'),
        '[\\x{0218}\\x{015E}]', 'S')
    END AS stripped
  FROM stage8
)
SELECT
  id,
  original_text,
  category,
  CASE
    WHEN category = 'EMPTY' THEN original_text
    WHEN category = 'NATIVE' THEN original_text
    WHEN category = 'MOJIBAKE' AND to_clean IS NULL THEN original_text
    WHEN category = 'MOJIBAKE' THEN stripped   -- recovered NATIVE form (language preserved)
    WHEN stripped IS NULL THEN original_text
    WHEN category = 'CLEAN'
      AND LEFT(stripped, 1) REGEXP '[a-zA-Z]'
      AND stripped NOT REGEXP '[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}'
      AND stripped NOT LIKE 'http%' AND stripped NOT LIKE 'www.%'
      THEN CONCAT(UPPER(LEFT(stripped, 1)), LOWER(SUBSTRING(stripped, 2)))
    ELSE stripped
  END AS final_text
FROM stage9
ORDER BY id;
