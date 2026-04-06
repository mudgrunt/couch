-- 001_init.sql
-- Lookup tables

CREATE TABLE account_role (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE -- e.g., 'admin', 'user', etc.
) STRICT;

CREATE TABLE currency (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE CHECK (LENGTH(code) = 3), -- ISO 4217 (eg. USD, EUR)
    symbol TEXT NOT NULL CHECK (LENGTH(symbol) <= 5 AND LENGTH(symbol) > 0), -- Currency symbol (eg. $, kr)
    name TEXT NOT NULL UNIQUE COLLATE NOCASE -- Full currency name (eg. US Dollar, Euro)
) STRICT;

CREATE TABLE developer (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE
) STRICT;

CREATE TABLE entity_type (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE -- e.g., 'developer', 'game', 'genre', 'publisher', 'tag'
) STRICT;

CREATE TABLE feature (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE -- e.g., 'Single-player', 'Multiplayer', 'Co-op', etc.
) STRICT;

CREATE TABLE genre (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE -- e.g., 'Action', 'RPG', 'Strategy', etc.
) STRICT;

CREATE TABLE library (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE CHECK (lower(code) = code), -- e.g., 'steam', 'epic', 'gog', etc.
    name TEXT NOT NULL UNIQUE COLLATE NOCASE -- e.g., 'Steam', 'Epic Games Store', 'GOG', etc.
) STRICT;

CREATE TABLE locale (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (
        LENGTH(code) >= 2
        AND LENGTH(code) <= 35
        AND code GLOB '[A-Za-z][A-Za-z]*'
        AND NOT code GLOB '*[^a-zA-Z0-9-]*'
        AND NOT code GLOB '*--*'
        AND NOT code GLOB '-*'
        AND NOT code GLOB '*-'
    ), -- BCP 47 language tag (e.g., 'en', 'en-US', 'fr', 'fr-CA', etc.)
    name TEXT NOT NULL UNIQUE COLLATE NOCASE -- Full language name (e.g., 'English', 'French', etc.)
) STRICT;

CREATE TABLE media_type (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE -- e.g., 'cover', 'screenshot', 'icon', etc.
) STRICT;

CREATE TABLE platform (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE CHECK (lower(code) = code), -- e.g., 'snes', 'psx', 'ps5', etc.
    name TEXT NOT NULL UNIQUE COLLATE NOCASE -- e.g., 'Super Nintendo Entertainment System', 'PlayStation', 'PlayStation 5', etc.
) STRICT;

CREATE TABLE publisher (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE
) STRICT;

CREATE TABLE rating_source (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE -- e.g., 'ESRB', 'PEGI', 'CERO', etc.
) STRICT;

CREATE TABLE region (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE CHECK (LENGTH(code) = 2), -- ISO 3166-1 alpha-2 (eg. US, GB, FR)
    name TEXT NOT NULL UNIQUE COLLATE NOCASE -- Full region name (eg. United States, United Kingdom, France)
) STRICT;

CREATE TABLE score_source (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE -- e.g., 'Metacritic', 'Steam', etc.
) STRICT;

CREATE TABLE status (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE -- e.g., 'playing', 'completed', 'wishlist', etc.
) STRICT;

CREATE TABLE tag (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE -- e.g., 'retro', 'indie', 'management' etc.
) STRICT;

-- Entity tables

CREATE TABLE account (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL COLLATE NOCASE,
    pin_hash TEXT NOT NULL,
    role_id INTEGER NOT NULL REFERENCES account_role(id) ON DELETE RESTRICT,
    avatar_url TEXT DEFAULT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT DEFAULT NULL
) STRICT;

CREATE UNIQUE INDEX idx_account_username_active ON account(username COLLATE NOCASE) WHERE deleted_at IS NULL;

CREATE TABLE collection (
    id INTEGER PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT DEFAULT NULL
) STRICT;

CREATE UNIQUE INDEX idx_collection_name_active ON collection(account_id, name COLLATE NOCASE) WHERE deleted_at IS NULL;

CREATE TABLE franchise (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    created_by INTEGER REFERENCES account(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES account(id) ON DELETE SET NULL,
    deleted_by INTEGER REFERENCES account(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT DEFAULT NULL
) STRICT;

CREATE UNIQUE INDEX idx_franchise_name_active ON franchise(name COLLATE NOCASE) WHERE deleted_at IS NULL;

CREATE TABLE series (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    created_by INTEGER REFERENCES account(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES account(id) ON DELETE SET NULL,
    deleted_by INTEGER REFERENCES account(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT DEFAULT NULL
) STRICT;

CREATE UNIQUE INDEX idx_series_name_active ON series(name COLLATE NOCASE) WHERE deleted_at IS NULL;

CREATE TABLE game (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    display_title TEXT DEFAULT NULL,
    alias TEXT DEFAULT NULL,
    size_bytes INTEGER CHECK (size_bytes >= 0),
    description TEXT,
    release_date TEXT,
    version TEXT,
    release_status TEXT,
    edition TEXT DEFAULT NULL,
    install_dir TEXT DEFAULT NULL,
    launch_target TEXT DEFAULT NULL,
    is_owned INTEGER DEFAULT 0 CHECK (is_owned IN (0,1)),
    min_players INTEGER CHECK (min_players >= 1),
    max_players INTEGER CHECK (max_players >= min_players),
    hltb_main_min INTEGER CHECK (hltb_main_min >= 0),
    hltb_main_extra_min INTEGER CHECK (hltb_main_extra_min >= 0),
    hltb_completionist_min INTEGER CHECK (hltb_completionist_min >= 0),
    sort_title TEXT GENERATED ALWAYS AS (
        CASE
            WHEN LOWER(COALESCE(display_title, title)) LIKE 'the %'
                THEN TRIM(SUBSTR(COALESCE(display_title, title), 5))
            WHEN LOWER(COALESCE(display_title, title)) LIKE 'an %'
                THEN TRIM(SUBSTR(COALESCE(display_title, title), 4))
            WHEN LOWER(COALESCE(display_title, title)) LIKE 'a %'
                THEN TRIM(SUBSTR(COALESCE(display_title, title), 3))
            ELSE COALESCE(display_title, title)
        END
    ) STORED,
    updated_by INTEGER REFERENCES account(id) ON DELETE SET NULL,
    deleted_by INTEGER REFERENCES account(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT DEFAULT NULL
) STRICT;

CREATE INDEX idx_game_title ON game(title COLLATE NOCASE);
CREATE INDEX idx_game_display_title ON game(display_title COLLATE NOCASE);
CREATE INDEX idx_game_sort_title ON game(sort_title COLLATE NOCASE);

CREATE TABLE dlc (
    id INTEGER PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    release_date TEXT,
    is_owned INTEGER DEFAULT 0 CHECK (is_owned IN (0,1)),
    size_bytes INTEGER CHECK (size_bytes >= 0),
    updated_by INTEGER REFERENCES account(id) ON DELETE SET NULL,
    deleted_by INTEGER REFERENCES account(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT DEFAULT NULL
) STRICT;

CREATE UNIQUE INDEX idx_dlc_title_active ON dlc(game_id, title COLLATE NOCASE) WHERE deleted_at IS NULL;
CREATE INDEX idx_dlc_game_id ON dlc(game_id);

-- Single Dependency Tables

CREATE TABLE game_achievement (
    id INTEGER PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    rarity REAL CHECK (rarity >= 0 AND rarity <= 100),
    secret INTEGER DEFAULT 0 CHECK (secret IN (0,1)),
    progress_total INTEGER DEFAULT 0,
    progress_current INTEGER DEFAULT 0,
    unlocked_at TEXT,
    UNIQUE(game_id, name COLLATE NOCASE),
    CHECK (progress_current >= 0 AND progress_current <= progress_total)
) STRICT;

CREATE INDEX idx_gameachievements_game_id ON game_achievement(game_id);

CREATE TABLE rating_descriptor (
    id INTEGER PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES rating_source(id) ON DELETE CASCADE,
    descriptor TEXT NOT NULL, -- e.g., "Violence", "Strong Language", "Sexual Content", etc.
    UNIQUE(source_id, descriptor COLLATE NOCASE)
) STRICT;

CREATE TABLE rating (
    id INTEGER PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES rating_source(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., "E", "T", "M" for ESRB; "3", "7", "12", "16", "18" for PEGI, etc.
    min_age INTEGER NOT NULL CHECK (min_age >= 0), -- e.g. 0 for "E", 13 for "T", 17 for "M" in ESRB; 3 for "3", 7 for "7", etc. in PEGI
    UNIQUE(source_id, name COLLATE NOCASE)
) STRICT;

CREATE TABLE account_schedule (
    id INTEGER PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
    allow_start_min INTEGER NOT NULL CHECK (allow_start_min >= 0 AND allow_start_min < 1440), -- 0-1439 (24*60-1)
    allow_end_min INTEGER NOT NULL CHECK (allow_end_min >= 0 AND allow_end_min < 1440),
    max_duration_min INTEGER CHECK (max_duration_min IS NULL OR max_duration_min >= 0),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
    UNIQUE(account_id, day_of_week, allow_start_min, allow_end_min),
    CHECK (allow_start_min < allow_end_min)
) STRICT;

-- Junction Tables

CREATE TABLE blocked_entity (
    account_id INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    entity_type_id INTEGER NOT NULL REFERENCES entity_type(id) ON DELETE CASCADE,
    entity_id INTEGER NOT NULL,
    PRIMARY KEY (account_id, entity_type_id, entity_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_blocked_entity_entity ON blocked_entity(entity_type_id, entity_id);

CREATE TABLE game_collection (
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    collection_id INTEGER NOT NULL REFERENCES collection(id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, collection_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_game_collection_collection_id ON game_collection(collection_id);

CREATE TABLE game_developer (
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    developer_id INTEGER NOT NULL REFERENCES developer(id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, developer_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_game_developer_developer_id ON game_developer(developer_id);

-- Store URL is implied from library + external_id
CREATE TABLE entity_external_id (
    entity_id INTEGER NOT NULL,
    library_id INTEGER NOT NULL REFERENCES library(id) ON DELETE CASCADE,
    entity_type_id INTEGER NOT NULL REFERENCES entity_type(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL CHECK (LENGTH(external_id) > 0),
    PRIMARY KEY (entity_id, library_id, entity_type_id),
    UNIQUE(external_id, library_id, entity_type_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_entity_external_id_library ON entity_external_id(library_id);

CREATE TABLE game_feature (
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    feature_id INTEGER NOT NULL REFERENCES feature(id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, feature_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_game_feature_feature_id ON game_feature(feature_id);

CREATE TABLE game_franchise (
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    franchise_id INTEGER NOT NULL REFERENCES franchise(id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, franchise_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_game_franchise_franchise_id ON game_franchise(franchise_id);

CREATE TABLE game_genre (
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    genre_id INTEGER NOT NULL REFERENCES genre(id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, genre_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_game_genre_genre_id ON game_genre(genre_id);

CREATE TABLE game_library (
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    library_id INTEGER NOT NULL REFERENCES library(id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, library_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_game_library_library_id ON game_library(library_id);

CREATE TABLE game_locale (
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    locale_id INTEGER NOT NULL REFERENCES locale(id) ON DELETE CASCADE,
    audio INTEGER NOT NULL DEFAULT 0 CHECK (audio IN (0,1)),
    interface INTEGER NOT NULL DEFAULT 0 CHECK (interface IN (0,1)),
    subtitles INTEGER NOT NULL DEFAULT 0 CHECK (subtitles IN (0,1)),
    PRIMARY KEY (game_id, locale_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_game_locale_locale_id ON game_locale(locale_id);

CREATE TABLE entity_media (
    entity_id INTEGER NOT NULL,
    media_type_id INTEGER NOT NULL REFERENCES media_type(id) ON DELETE CASCADE,
    entity_type_id INTEGER NOT NULL REFERENCES entity_type(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    PRIMARY KEY(entity_id, media_type_id, entity_type_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_entity_media_media_type_id ON entity_media(media_type_id);

CREATE TABLE entity_price (
    entity_id INTEGER NOT NULL,
    currency_id INTEGER NOT NULL REFERENCES currency(id) ON DELETE CASCADE,
    entity_type_id INTEGER NOT NULL REFERENCES entity_type(id) ON DELETE CASCADE,
    price REAL NOT NULL CHECK (price >= 0),
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (entity_id, currency_id, entity_type_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_entity_price_currency_id ON entity_price(currency_id);

CREATE TABLE game_publisher (
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    publisher_id INTEGER NOT NULL REFERENCES publisher(id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, publisher_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_game_publisher_publisher_id ON game_publisher(publisher_id);

CREATE TABLE game_platform (
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    platform_id INTEGER NOT NULL REFERENCES platform(id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, platform_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_game_platform_platform_id ON game_platform(platform_id);

CREATE TABLE game_rating_descriptor (
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    descriptor_id INTEGER NOT NULL REFERENCES rating_descriptor(id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, descriptor_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_game_rating_descriptor_descriptor_id ON game_rating_descriptor(descriptor_id);

CREATE TABLE game_rating (
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    rating_id INTEGER NOT NULL REFERENCES rating(id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, rating_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_game_rating_rating_id ON game_rating(rating_id);

CREATE TABLE game_region (
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    region_id INTEGER NOT NULL REFERENCES region(id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, region_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_game_region_region_id ON game_region(region_id);

CREATE TABLE game_score (
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    source_id INTEGER NOT NULL REFERENCES score_source(id) ON DELETE CASCADE,
    score REAL NOT NULL CHECK (score >= 0 AND score <= 100),
    PRIMARY KEY (game_id, source_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_game_score_source_id ON game_score(source_id);

CREATE TABLE game_series (
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    series_id INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    series_order INTEGER CHECK (series_order > 0),
    PRIMARY KEY (game_id, series_id),
    UNIQUE(series_id, series_order)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_game_series_series_id ON game_series(series_id);

CREATE TABLE game_tag (
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, tag_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_game_tag_tag_id ON game_tag(tag_id);

CREATE TABLE account_game_session (
    id INTEGER PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TEXT,
    CHECK (ended_at IS NULL OR ended_at >= started_at)
) STRICT;

CREATE INDEX idx_account_game_session_account_id ON account_game_session(account_id);
CREATE INDEX idx_account_game_session_game_id ON account_game_session(game_id);
CREATE INDEX idx_account_game_session_started_at ON account_game_session(started_at);
CREATE INDEX idx_account_game_session_ended_at ON account_game_session(ended_at);

CREATE TABLE account_game (
    id INTEGER PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    notes TEXT,
    score REAL CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
    is_favorite INTEGER DEFAULT 0 CHECK (is_favorite IN (0,1)),
    is_hidden INTEGER DEFAULT 0 CHECK (is_hidden IN (0,1)),
    status_id INTEGER REFERENCES status(id) ON DELETE SET NULL,
    completion_date TEXT,
    last_played TEXT,
    time_played_min INTEGER CHECK (time_played_min >= 0),
    UNIQUE(account_id, game_id)
) STRICT;

CREATE INDEX idx_account_game_game_id ON account_game(game_id);
CREATE INDEX idx_account_game_status_id ON account_game(status_id);
CREATE INDEX idx_account_game_is_favorite ON account_game(is_favorite);
CREATE INDEX idx_account_game_is_hidden ON account_game(is_hidden);

CREATE TRIGGER account_game_session_end 
AFTER UPDATE OF ended_at ON account_game_session 
WHEN OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL
BEGIN
    UPDATE account_game
    SET
        time_played_min = COALESCE(time_played_min, 0) + CAST((strftime('%s', NEW.ended_at) - strftime('%s', NEW.started_at)) / 60 AS INTEGER),
        last_played = NEW.ended_at
    WHERE account_id = NEW.account_id AND game_id = NEW.game_id;
END;

CREATE TABLE account_parental_control (
    account_id INTEGER PRIMARY KEY REFERENCES account(id) ON DELETE CASCADE,
    max_age INTEGER NOT NULL CHECK (max_age >= 0),
    max_day_duration_min INTEGER CHECK (max_day_duration_min IS NULL OR max_day_duration_min >= 0),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1))
) STRICT, WITHOUT ROWID;

-- Views

CREATE VIEW game_detail_view AS
SELECT
    g.id,
    g.title,
    g.display_title,
    g.alias,
    g.size_bytes,
    g.description,
    g.release_date,
    g.version,
    g.release_status,
    g.is_owned,
    g.min_players,
    g.max_players,
    g.hltb_main_min,
    g.hltb_main_extra_min,
    g.hltb_completionist_min,
    g.edition,
    g.install_dir,
    g.launch_target,
    g.created_at,
    g.updated_at,
    COALESCE((
        SELECT json_group_array(json_object('id', d.id, 'name', d.name))
        FROM game_developer gd JOIN developer d ON gd.developer_id = d.id
        WHERE gd.game_id = g.id
    ), json('[]')) AS developers,
    COALESCE((
        SELECT json_group_array(json_object('id', p.id, 'name', p.name))
        FROM game_publisher gp JOIN publisher p ON gp.publisher_id = p.id
        WHERE gp.game_id = g.id
    ), json('[]')) AS publishers,
    COALESCE((
        SELECT json_group_array(json_object('id', gen.id, 'name', gen.name))
        FROM game_genre gg JOIN genre gen ON gg.genre_id = gen.id
        WHERE gg.game_id = g.id
    ), json('[]')) AS genres,
    COALESCE((
        SELECT json_group_array(json_object('id', t.id, 'name', t.name))
        FROM game_tag gt JOIN tag t ON gt.tag_id = t.id
        WHERE gt.game_id = g.id
    ), json('[]')) AS tags,
    COALESCE((
        SELECT json_group_array(json_object('id', f.id, 'name', f.name))
        FROM game_feature gf JOIN feature f ON gf.feature_id = f.id
        WHERE gf.game_id = g.id
    ), json('[]')) AS features,
    COALESCE((
        SELECT json_group_array(json_object('id', fr.id, 'name', fr.name))
        FROM game_franchise gfr JOIN franchise fr ON gfr.franchise_id = fr.id
        WHERE gfr.game_id = g.id
    ), json('[]')) AS franchises,
    COALESCE((
        SELECT json_group_array(json_object('id', s.id, 'name', s.name, 'series_order', gs.series_order))
        FROM game_series gs JOIN series s ON gs.series_id = s.id
        WHERE gs.game_id = g.id
    ), json('[]')) AS series,
    COALESCE((
        SELECT json_group_array(json_object('id', r.id, 'code', r.code, 'name', r.name))
        FROM game_region gr JOIN region r ON gr.region_id = r.id
        WHERE gr.game_id = g.id
    ), json('[]')) AS regions,
    COALESCE((
        SELECT json_group_array(json_object(
            'id', dlc.id,
            'title', dlc.title,
            'description', dlc.description,
            'release_date', dlc.release_date,
            'is_owned', dlc.is_owned,
            'size_bytes', dlc.size_bytes
        ))
        FROM dlc dlc
        WHERE dlc.game_id = g.id AND dlc.deleted_at IS NULL
    ), json('[]')) AS dlcs,
    COALESCE((
        SELECT json_group_array(json_object(
            'id', ga.id,
            'name', ga.name,
            'description', ga.description,
            'rarity', ga.rarity,
            'secret', ga.secret,
            'progress_current', ga.progress_current,
            'progress_total', ga.progress_total,
            'unlocked_at', ga.unlocked_at
        ))
        FROM game_achievement ga
        WHERE ga.game_id = g.id
    ), json('[]')) AS achievements,
    COALESCE((
        SELECT json_group_array(json_object(
            'id', l.id,
            'code', l.code,
            'name', l.name,
            'audio', gl.audio,
            'interface', gl.interface,
            'subtitles', gl.subtitles
        ))
        FROM game_locale gl JOIN locale l ON gl.locale_id = l.id
        WHERE gl.game_id = g.id
    ), json('[]')) AS locales,
    COALESCE((
        SELECT json_group_array(json_object(
            'source', rs.name,
            'rating', ra.name,
            'min_age', ra.min_age
        ))
        FROM game_rating gra
        JOIN rating ra ON gra.rating_id = ra.id
        JOIN rating_source rs ON ra.source_id = rs.id
        WHERE gra.game_id = g.id
    ), json('[]')) AS ratings,
    COALESCE((
        SELECT json_group_array(json_object(
            'source', rs.name,
            'descriptor', rd.descriptor
        ))
        FROM game_rating_descriptor grd
        JOIN rating_descriptor rd ON grd.descriptor_id = rd.id
        JOIN rating_source rs ON rd.source_id = rs.id
        WHERE grd.game_id = g.id
    ), json('[]')) AS rating_descriptors,
    COALESCE((
        SELECT json_group_array(json_object('source', ss.name, 'score', gs2.score))
        FROM game_score gs2 JOIN score_source ss ON gs2.source_id = ss.id
        WHERE gs2.game_id = g.id
    ), json('[]')) AS scores,
    COALESCE((
        SELECT json_group_array(json_object('id', lib.id, 'code', lib.code, 'name', lib.name))
        FROM game_library gl2 JOIN library lib ON gl2.library_id = lib.id
        WHERE gl2.game_id = g.id
    ), json('[]')) AS libraries,
    COALESCE((
        SELECT json_group_array(json_object('id', plt.id, 'code', plt.code, 'name', plt.name))
        FROM game_platform gp2 JOIN platform plt ON gp2.platform_id = plt.id
        WHERE gp2.game_id = g.id
    ), json('[]')) AS platforms,
    COALESCE((
        SELECT json_group_array(json_object('library', lib.code, 'external_id', eei.external_id))
        FROM entity_external_id eei
        JOIN library lib ON eei.library_id = lib.id
        WHERE eei.entity_id = g.id
            AND eei.entity_type_id = (SELECT id FROM entity_type WHERE name = 'game')
    ), json('[]')) AS external_ids,
    COALESCE((
        SELECT json_group_array(json_object('type', mt.name, 'path', em.path))
        FROM entity_media em
        JOIN media_type mt ON em.media_type_id = mt.id
        WHERE em.entity_id = g.id
            AND em.entity_type_id = (SELECT id FROM entity_type WHERE name = 'game')
    ), json('[]')) AS media,
    COALESCE((
        SELECT json_group_array(json_object(
            'currency_code', c.code,
            'currency_symbol', c.symbol,
            'price', ep.price,
            'updated_at', ep.updated_at
        ))
        FROM entity_price ep
        JOIN currency c ON ep.currency_id = c.id
        WHERE ep.entity_id = g.id
            AND ep.entity_type_id = (SELECT id FROM entity_type WHERE name = 'game')
    ), json('[]')) AS prices
FROM game g
WHERE g.deleted_at IS NULL;

CREATE VIEW game_grid_view AS
SELECT
    g.id,
    g.title,
    g.display_title,
    g.sort_title,
    (
        SELECT em.path
        FROM entity_media em
        JOIN media_type mt ON em.media_type_id = mt.id
        WHERE em.entity_id = g.id
            AND em.entity_type_id = (SELECT id FROM entity_type WHERE name = 'game')
            AND mt.name = 'cover'
        LIMIT 1
    ) AS cover
FROM game g
WHERE g.deleted_at IS NULL;

CREATE VIEW game_list_view AS
SELECT
    g.id,
    g.title,
    g.display_title,
    g.sort_title
FROM game g
WHERE g.deleted_at IS NULL;

CREATE VIEW dlc_list_view AS
SELECT
    dlc.id,
    dlc.game_id,
    dlc.title,
    dlc.release_date
FROM dlc
WHERE dlc.deleted_at IS NULL;

-- Full-Text Search

CREATE VIEW game_search_view AS
SELECT
    g.id AS id,
    COALESCE(g.title, '') AS title,
    COALESCE(g.display_title, '') AS display_title,
    COALESCE(g.alias, '') AS alias,
    COALESCE((
        SELECT GROUP_CONCAT(DISTINCT f.name)
        FROM game_franchise gf
        JOIN franchise f ON gf.franchise_id = f.id
        WHERE gf.game_id = g.id
    ), '') AS franchise,
    COALESCE((
        SELECT GROUP_CONCAT(DISTINCT s.name)
        FROM game_series gs
        JOIN series s ON gs.series_id = s.id
        WHERE gs.game_id = g.id
    ), '') AS series,
    COALESCE((
        SELECT GROUP_CONCAT(DISTINCT d.name)
        FROM game_developer gd
        JOIN developer d ON gd.developer_id = d.id
        WHERE gd.game_id = g.id
    ), '') AS developers,
    COALESCE((
        SELECT GROUP_CONCAT(DISTINCT p.name)
        FROM game_publisher gp
        JOIN publisher p ON gp.publisher_id = p.id
        WHERE gp.game_id = g.id
    ), '') AS publishers,
    COALESCE((
        SELECT GROUP_CONCAT(DISTINCT ge.name)
        FROM game_genre gg
        JOIN genre ge ON gg.genre_id = ge.id
        WHERE gg.game_id = g.id
    ), '') AS genres,
    COALESCE((
        SELECT GROUP_CONCAT(DISTINCT t.name)
        FROM game_tag gt
        JOIN tag t ON gt.tag_id = t.id
        WHERE gt.game_id = g.id
    ), '') AS tags,
    COALESCE((
        SELECT GROUP_CONCAT(DISTINCT dlc.title)
        FROM dlc dlc
        WHERE dlc.game_id = g.id
    ), '') AS dlc_titles,
    COALESCE(g.description, '') AS description,
    COALESCE((
        SELECT GROUP_CONCAT(DISTINCT l.name)
        FROM game_locale gl
        JOIN locale l ON gl.locale_id = l.id
        WHERE gl.game_id = g.id
    ), '') AS locales,
    COALESCE((
        SELECT GROUP_CONCAT(DISTINCT ee.external_id)
        FROM entity_external_id ee
        WHERE ee.entity_id = g.id 
        AND ee.entity_type_id = (SELECT id FROM entity_type WHERE name = 'game')
    ), '') AS external_id
FROM game g
WHERE g.deleted_at IS NULL;

CREATE VIRTUAL TABLE game_search USING fts5(
    title,
    display_title,
    alias,
    franchise,
    series,
    developers,
    publishers,
    genres,
    tags,
    dlc_titles,
    description,
    locales,
    external_id,
    content='game_search_view',
    content_rowid='id'
);

-- Triggers for updated_at fields
CREATE TRIGGER account_updated_at AFTER UPDATE ON account 
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE account SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER collection_updated_at AFTER UPDATE ON collection 
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE collection SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER game_updated_at AFTER UPDATE ON game 
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE game SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER dlc_updated_at AFTER UPDATE ON dlc 
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE dlc SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER franchise_updated_at AFTER UPDATE ON franchise 
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE franchise SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER series_updated_at AFTER UPDATE ON series 
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE series SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER entity_price_updated_at AFTER UPDATE ON entity_price 
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE entity_price SET updated_at = CURRENT_TIMESTAMP WHERE entity_id = NEW.entity_id AND currency_id = NEW.currency_id AND entity_type_id = NEW.entity_type_id;
END;