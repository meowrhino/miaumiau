PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    tripcode TEXT,
    color TEXT NOT NULL DEFAULT 'Coral',
    theme TEXT NOT NULL DEFAULT 'oscuro',
    avatar_seed INTEGER NOT NULL,
    bio TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
, account_name TEXT, display_name TEXT, password_hash TEXT);
INSERT INTO "users" ("id","username","tripcode","color","theme","avatar_seed","bio","created_at","last_seen_at","account_name","display_name","password_hash") VALUES(1,'manu','3tu8qr7q','Gold','oscuro',3299467960,'ホァ！　エストイ　うサンド　にゃにゃ　です','2026-03-31 11:24:18','2026-03-31 15:14:15','manu','manu',NULL);
INSERT INTO "users" ("id","username","tripcode","color","theme","avatar_seed","bio","created_at","last_seen_at","account_name","display_name","password_hash") VALUES(2,'gatito_test','1xo0bvgb','HotPink','oscuro',42424242,'soy un gato de prueba miau','2026-03-31 11:53:24','2026-03-31 11:53:24','gatito_test','gatito_test',NULL);
INSERT INTO "users" ("id","username","tripcode","color","theme","avatar_seed","bio","created_at","last_seen_at","account_name","display_name","password_hash") VALUES(3,'luna_bcn','4nasv6lq','Orchid','oscuro',88888888,'[TEST] gatita nocturna de gracia','2026-03-31 15:19:15','2026-03-31 15:19:15','luna_bcn','luna_bcn',NULL);
INSERT INTO "users" ("id","username","tripcode","color","theme","avatar_seed","bio","created_at","last_seen_at","account_name","display_name","password_hash") VALUES(4,'pixel_cat','6csdba02','DodgerBlue','oscuro',55555555,'[TEST] miau digital','2026-03-31 15:19:15','2026-03-31 15:19:15','pixel_cat','pixel_cat',NULL);
INSERT INTO "users" ("id","username","tripcode","color","theme","avatar_seed","bio","created_at","last_seen_at","account_name","display_name","password_hash") VALUES(5,'sardina','2a7l0ny9','MediumSeaGreen','oscuro',33333333,'[TEST] me gustan las sardinas y dormir','2026-03-31 15:19:15','2026-03-31 15:19:15','sardina','sardina',NULL);
INSERT INTO "users" ("id","username","tripcode","color","theme","avatar_seed","bio","created_at","last_seen_at","account_name","display_name","password_hash") VALUES(6,'hola_test','2ax0apmw','Coral','oscuro',1571258387,'','2026-04-27 10:32:44','2026-04-27 10:32:44','hola_test','hola_test',NULL);
INSERT INTO "users" ("id","username","tripcode","color","theme","avatar_seed","bio","created_at","last_seen_at","account_name","display_name","password_hash") VALUES(7,'test',NULL,'Teal','oscuro',2818426026,'','2026-04-28 13:23:48','2026-04-28 13:23:48','test','test','pbkdf2$100000$5CHN00dfaY5tG2m4k/Ld6g==$1S9MeLvhuWJgioeoaXuY6RCsdCneBztCpTPWnvKqqlk=');
INSERT INTO "users" ("id","username","tripcode","color","theme","avatar_seed","bio","created_at","last_seen_at","account_name","display_name","password_hash") VALUES(8,'aaaa',NULL,'Coral','oscuro',2346078788,'','2026-05-21 08:54:59','2026-05-21 08:54:59','aaaa','aaaa','pbkdf2$100000$z1+jjoQphX64jeE6cnBG0g==$UCxBYhggXw2Ms2WLcLDskNk7Qu6D8MjCZUjTICtEFpE=');
INSERT INTO "users" ("id","username","tripcode","color","theme","avatar_seed","bio","created_at","last_seen_at","account_name","display_name","password_hash") VALUES(9,'aaaaaa',NULL,'Coral','oscuro',3824276494,'','2026-06-02 14:15:40','2026-06-02 14:15:40','aaaaaa','aaaaa','pbkdf2$100000$taweSgd0jAN675qRkWiywA==$diDLdHXyWj64SvYrBBX6Pb0TmvnKGZyGvTUVReNb7/M=');
CREATE TABLE tweets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    parent_id INTEGER REFERENCES tweets(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reports INTEGER DEFAULT 0,
    hidden INTEGER DEFAULT 0
);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(1,1,'holaaa',NULL,'2026-03-31 11:33:35',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(2,1,'me cambie de avatar',NULL,'2026-03-31 11:39:23',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(3,2,'[TEST] primer miau de prueba, esto es un test del timeline',NULL,'2026-03-31 11:53:38',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(4,2,'[TEST] segundo miau! los gatos dominaran internet, otra vez',NULL,'2026-03-31 11:53:38',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(5,2,'[TEST] alguien ha visto un raton por aqui? pregunto para un amigo',NULL,'2026-03-31 11:53:38',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(6,1,'[TEST] hola gatito_test! bienvenido al mundo miau',NULL,'2026-03-31 11:53:38',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(7,2,'[TEST] miau miau miau miau miau (traduccion: esta app mola)',NULL,'2026-03-31 11:53:38',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(8,1,'[TEST] acabo de cambiarme el avatar y estoy muy guapo',NULL,'2026-03-31 11:53:38',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(9,2,'[TEST] quien quiere jugar? estoy aburrido y son las 3am',NULL,'2026-03-31 11:53:38',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(10,2,'[TEST] dato curioso: los gatos duermen 16 horas al dia. yo tambien',NULL,'2026-03-31 11:53:38',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(11,3,'[TEST] acabo de llegar a bcn y ya me he perdido 3 veces',NULL,'2026-03-31 15:19:44',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(12,4,'[TEST] alguien sabe si los gatos pueden programar? pregunto por motivos personales',NULL,'2026-03-31 15:19:44',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(13,5,'[TEST] sardina fresca > sardina de lata, no acepto debate',NULL,'2026-03-31 15:19:44',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(14,3,'[TEST] hay algun evento de musica esta noche en el raval?',NULL,'2026-03-31 15:19:44',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(15,4,'[TEST] debugging a las 4am con mi gato encima del teclado, normal',NULL,'2026-03-31 15:19:44',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(16,5,'[TEST] tip: si te sientas en el ordenador de tu humano, te da comida',NULL,'2026-03-31 15:19:44',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(17,3,'[TEST] la sagrada familia pero para gatos cuando??',NULL,'2026-03-31 15:19:44',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(18,4,'[TEST] mi humano cree que trabaja desde casa, en realidad trabaja para mi',NULL,'2026-03-31 15:19:44',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(19,1,'[TEST] que bonito es esto, somos 5 gatos ya!',NULL,'2026-03-31 15:19:44',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(20,5,'[TEST] me acabo de despertar de mi siesta numero 7 del dia',NULL,'2026-03-31 15:19:44',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(21,3,'[TEST] buscando piso en barcelona ser como: miau miau 1500 miau',NULL,'2026-03-31 15:19:44',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(22,4,'[TEST] fun fact: este tweet esta hecho con vanilla js y pesa 0 frameworks',NULL,'2026-03-31 15:19:44',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(23,1,'[TEST] bienvenida luna! gracia es el mejor barrio gatuno',11,'2026-03-31 15:19:44',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(24,5,'[TEST] totalmente de acuerdo, el raval tambien mola',11,'2026-03-31 15:19:44',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(25,3,'[TEST] jajaja sardina tiene razon con lo del ordenador',16,'2026-03-31 15:19:44',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(26,1,'holaaaa bon diaa pel mati',NULL,'2026-04-01 08:38:35',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(27,6,'tengo un nuevo user!! molaaa',NULL,'2026-04-27 10:32:52',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(28,1,'test',NULL,'2026-04-28 13:05:20',0,0);
INSERT INTO "tweets" ("id","user_id","content","parent_id","created_at","reports","hidden") VALUES(29,9,'holaaa',NULL,'2026-06-02 14:48:57',0,0);
CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    caption TEXT DEFAULT '',
    media_key TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reports INTEGER DEFAULT 0,
    hidden INTEGER DEFAULT 0
);
INSERT INTO "posts" ("id","user_id","caption","media_key","created_at","reports","hidden") VALUES(1,3,'[TEST] atardecer desde el bunker del carmel','test_placeholder.webp','2026-03-31 15:20:09',0,0);
INSERT INTO "posts" ("id","user_id","caption","media_key","created_at","reports","hidden") VALUES(2,4,'[TEST] mi setup de programacion (con gato incluido)','test_placeholder.webp','2026-03-31 15:20:09',0,0);
INSERT INTO "posts" ("id","user_id","caption","media_key","created_at","reports","hidden") VALUES(3,5,'[TEST] sardina del dia','test_placeholder.webp','2026-03-31 15:20:09',0,0);
CREATE TABLE post_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "post_comments" ("id","post_id","user_id","content","created_at") VALUES(1,1,1,'[TEST] que bonito! yo tambien fui ayer','2026-03-31 15:20:09');
INSERT INTO "post_comments" ("id","post_id","user_id","content","created_at") VALUES(2,1,4,'[TEST] el mejor mirador de bcn sin duda','2026-03-31 15:20:09');
INSERT INTO "post_comments" ("id","post_id","user_id","content","created_at") VALUES(3,2,5,'[TEST] ese gato tiene mejor postura que yo programando','2026-03-31 15:20:09');
INSERT INTO "post_comments" ("id","post_id","user_id","content","created_at") VALUES(4,3,3,'[TEST] que hambre me ha dado esto','2026-03-31 15:20:09');
CREATE TABLE reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    emoji TEXT NOT NULL DEFAULT '😻',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, target_type, target_id)
);
INSERT INTO "reactions" ("id","user_id","target_type","target_id","emoji","created_at") VALUES(1,1,'tweet',11,'😻','2026-03-31 15:20:09');
INSERT INTO "reactions" ("id","user_id","target_type","target_id","emoji","created_at") VALUES(2,1,'tweet',14,'😻','2026-03-31 15:20:09');
INSERT INTO "reactions" ("id","user_id","target_type","target_id","emoji","created_at") VALUES(3,3,'tweet',3,'😻','2026-03-31 15:20:09');
INSERT INTO "reactions" ("id","user_id","target_type","target_id","emoji","created_at") VALUES(4,4,'tweet',5,'😻','2026-03-31 15:20:09');
INSERT INTO "reactions" ("id","user_id","target_type","target_id","emoji","created_at") VALUES(5,5,'tweet',11,'😻','2026-03-31 15:20:09');
INSERT INTO "reactions" ("id","user_id","target_type","target_id","emoji","created_at") VALUES(6,3,'post',1,'😻','2026-03-31 15:20:09');
INSERT INTO "reactions" ("id","user_id","target_type","target_id","emoji","created_at") VALUES(7,4,'post',1,'😻','2026-03-31 15:20:09');
INSERT INTO "reactions" ("id","user_id","target_type","target_id","emoji","created_at") VALUES(8,5,'post',2,'😻','2026-03-31 15:20:09');
CREATE TABLE stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    media_key TEXT NOT NULL,
    layers_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);
INSERT INTO "stories" ("id","user_id","media_key","layers_json","created_at","expires_at") VALUES(1,3,'test_story_1.webp','{"texts":[{"x":0.5,"y":0.3,"text":"[TEST] buenas noches bcn","size":20,"color":"#fff"}]}','2026-03-31 15:20:09','2026-04-01 15:20:09');
INSERT INTO "stories" ("id","user_id","media_key","layers_json","created_at","expires_at") VALUES(2,4,'test_story_2.webp','{"texts":[{"x":0.5,"y":0.5,"text":"[TEST] coding time","size":24,"color":"#0ff"}]}','2026-03-31 15:20:09','2026-04-01 15:20:09');
INSERT INTO "stories" ("id","user_id","media_key","layers_json","created_at","expires_at") VALUES(3,5,'test_story_3.webp','{"texts":[{"x":0.5,"y":0.7,"text":"[TEST] zzz siesta","size":18,"color":"#ff9"}]}','2026-03-31 15:20:09','2026-04-01 15:20:09');
INSERT INTO "stories" ("id","user_id","media_key","layers_json","created_at","expires_at") VALUES(4,1,'s_1777381574858_1.webp','{"texts":[],"links":[]}','2026-04-28 13:06:15','2026-04-29T13:06:15.059Z');
CREATE TABLE story_views (
    story_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (story_id, user_id)
);
INSERT INTO "story_views" ("story_id","user_id","viewed_at") VALUES(1,1,'2026-03-31 15:39:48');
INSERT INTO "story_views" ("story_id","user_id","viewed_at") VALUES(2,1,'2026-03-31 15:39:51');
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    receiver_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    media_key TEXT,
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","media_key","read_at","created_at") VALUES(1,3,1,'[TEST] hola manu! me encanta la app',NULL,'2026-03-31 15:41:28','2026-03-31 15:20:09');
INSERT INTO "messages" ("id","sender_id","receiver_id","content","media_key","read_at","created_at") VALUES(2,1,3,'[TEST] gracias luna! bienvenida',NULL,NULL,'2026-03-31 15:20:09');
INSERT INTO "messages" ("id","sender_id","receiver_id","content","media_key","read_at","created_at") VALUES(3,3,1,'[TEST] como se cambia el color del gato?',NULL,'2026-03-31 15:41:28','2026-03-31 15:20:09');
INSERT INTO "messages" ("id","sender_id","receiver_id","content","media_key","read_at","created_at") VALUES(4,1,3,'[TEST] en tu gato > editar mi gato',NULL,NULL,'2026-03-31 15:20:09');
INSERT INTO "messages" ("id","sender_id","receiver_id","content","media_key","read_at","created_at") VALUES(5,4,1,'[TEST] manu esto es increible, zero frameworks!!',NULL,'2026-03-31 15:41:22','2026-03-31 15:20:09');
INSERT INTO "messages" ("id","sender_id","receiver_id","content","media_key","read_at","created_at") VALUES(6,1,4,'[TEST] vanilla js puro, como los gatos: simples y elegantes',NULL,NULL,'2026-03-31 15:20:09');
INSERT INTO "messages" ("id","sender_id","receiver_id","content","media_key","read_at","created_at") VALUES(7,5,3,'[TEST] luna tienes sardinas?',NULL,NULL,'2026-03-31 15:20:09');
INSERT INTO "messages" ("id","sender_id","receiver_id","content","media_key","read_at","created_at") VALUES(8,3,5,'[TEST] jajaja no sardina, pero tengo atun',NULL,NULL,'2026-03-31 15:20:09');
INSERT INTO "messages" ("id","sender_id","receiver_id","content","media_key","read_at","created_at") VALUES(9,1,4,'zorra',NULL,NULL,'2026-03-31 15:41:24');
INSERT INTO "messages" ("id","sender_id","receiver_id","content","media_key","read_at","created_at") VALUES(10,1,4,'holaa',NULL,NULL,'2026-04-27 13:31:57');
CREATE TABLE conversations (
    user_a INTEGER NOT NULL,
    user_b INTEGER NOT NULL,
    last_message_at TEXT,
    last_message_preview TEXT,
    PRIMARY KEY (user_a, user_b)
);
INSERT INTO "conversations" ("user_a","user_b","last_message_at","last_message_preview") VALUES(1,3,'2026-03-31 15:20:09','en tu gato > editar mi gato');
INSERT INTO "conversations" ("user_a","user_b","last_message_at","last_message_preview") VALUES(1,4,'2026-04-27 13:31:57','holaa');
INSERT INTO "conversations" ("user_a","user_b","last_message_at","last_message_preview") VALUES(3,5,'2026-03-31 15:20:09','jajaja no sardina, pero tengo atun');
CREATE TABLE bereals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    media_key TEXT NOT NULL,
    caption TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "bereals" ("id","user_id","media_key","caption","created_at") VALUES(1,3,'test_br_1.webp','[TEST] desayunando en el born','2026-03-31 15:26:51');
INSERT INTO "bereals" ("id","user_id","media_key","caption","created_at") VALUES(2,4,'test_br_2.webp','[TEST] codigo a las 8am, mi gato no me deja dormir','2026-03-31 15:26:51');
INSERT INTO "bereals" ("id","user_id","media_key","caption","created_at") VALUES(3,5,'test_br_3.webp','[TEST] mirando por la ventana, hay pajaros','2026-03-31 15:26:51');
INSERT INTO "bereals" ("id","user_id","media_key","caption","created_at") VALUES(4,1,'test_br_4.webp','[TEST] en el super comprando sardinas','2026-03-31 15:26:51');
INSERT INTO "bereals" ("id","user_id","media_key","caption","created_at") VALUES(5,1,'br_1777380388978_1.webp','hol  text hol qqerz','2026-04-28 12:46:29');
CREATE TABLE friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL REFERENCES users(id),
    target_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(requester_id, target_id)
);
INSERT INTO "friendships" ("id","requester_id","target_id","status","created_at") VALUES(1,1,3,'accepted','2026-03-31 15:32:15');
INSERT INTO "friendships" ("id","requester_id","target_id","status","created_at") VALUES(2,1,4,'accepted','2026-03-31 15:32:15');
INSERT INTO "friendships" ("id","requester_id","target_id","status","created_at") VALUES(3,5,1,'accepted','2026-03-31 15:32:15');
INSERT INTO "friendships" ("id","requester_id","target_id","status","created_at") VALUES(4,3,4,'accepted','2026-03-31 15:32:15');
INSERT INTO "friendships" ("id","requester_id","target_id","status","created_at") VALUES(5,3,5,'accepted','2026-03-31 15:32:15');
INSERT INTO "friendships" ("id","requester_id","target_id","status","created_at") VALUES(6,6,1,'pending','2026-04-27 10:32:59');
CREATE TABLE presence (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    zone TEXT,                  -- one of: tweets|posts|stories|chat|bereal|profile|plaza|null
    x INTEGER NOT NULL DEFAULT 640,
    y INTEGER NOT NULL DEFAULT 374,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "presence" ("user_id","zone","x","y","updated_at") VALUES(1,'plaza',1120,720,'2026-06-04 13:24:53');
INSERT INTO "presence" ("user_id","zone","x","y","updated_at") VALUES(7,'plaza',640,374,'2026-04-28 18:39:03');
INSERT INTO "presence" ("user_id","zone","x","y","updated_at") VALUES(8,'plaza',640,420,'2026-06-02 10:32:42');
INSERT INTO "presence" ("user_id","zone","x","y","updated_at") VALUES(9,'tweets',1280,720,'2026-06-08 12:59:58');
CREATE TABLE system_flags (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "system_flags" ("key","value","updated_at") VALUES('maintenance_mode','0','2026-04-27 14:14:56');
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,                 -- NULL for anon
    kind TEXT NOT NULL,              -- e.g. 'view:section', 'create:tweet', 'enter:zone'
    props_json TEXT,                 -- arbitrary props blob; small JSON
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(1,NULL,'view:section','{"section":"tweets"}','2026-04-27 14:45:18');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(2,NULL,'view:section','{"section":"city"}','2026-04-27 14:47:01');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(3,NULL,'enter:zone','{"zone":"tweets"}','2026-04-27 14:47:18');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(4,NULL,'enter:zone','{"zone":"bereal"}','2026-04-27 14:48:11');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(5,NULL,'enter:zone','{"zone":"profile"}','2026-04-27 14:48:17');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(6,NULL,'view:section','{"section":"tweets"}','2026-04-27 14:48:41');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(7,NULL,'view:section','{"section":"city"}','2026-04-27 14:48:43');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(8,NULL,'view:section','{"section":"profile"}','2026-04-27 14:49:48');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(9,NULL,'view:section','{"section":"tweets"}','2026-04-28 08:55:04');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(10,NULL,'view:section','{"section":"tweets"}','2026-04-28 08:55:12');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(11,NULL,'view:section','{"section":"tweets"}','2026-04-28 08:55:13');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(12,NULL,'view:section','{"section":"city"}','2026-04-28 08:55:14');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(13,NULL,'enter:zone','{"zone":"tweets"}','2026-04-28 08:55:20');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(14,NULL,'enter:zone','{"zone":"chat"}','2026-04-28 08:55:22');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(15,NULL,'enter:zone','{"zone":"bereal"}','2026-04-28 08:55:29');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(16,NULL,'enter:zone','{"zone":"profile"}','2026-04-28 08:56:07');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(17,NULL,'view:section','{"section":"city"}','2026-04-28 08:56:19');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(18,NULL,'view:section','{"section":"tweets"}','2026-04-28 09:54:59');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(19,NULL,'view:section','{"section":"city"}','2026-04-28 09:55:04');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(20,NULL,'view:section','{"section":"city"}','2026-04-28 09:55:07');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(21,NULL,'enter:zone','{"zone":"bereal"}','2026-04-28 09:55:49');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(22,NULL,'enter:zone','{"zone":"posts"}','2026-04-28 09:55:53');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(23,NULL,'view:section','{"section":"city"}','2026-04-28 11:29:08');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(24,NULL,'enter:zone','{"zone":"posts"}','2026-04-28 11:29:12');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(25,NULL,'view:section','{"section":"city"}','2026-04-28 11:30:24');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(26,NULL,'enter:zone','{"zone":"posts"}','2026-04-28 12:33:35');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(27,NULL,'enter:zone','{"zone":"profile"}','2026-04-28 12:33:35');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(28,NULL,'enter:zone','{"zone":"stories"}','2026-04-28 12:33:35');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(29,NULL,'enter:zone','{"zone":"posts"}','2026-04-28 12:39:27');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(30,NULL,'view:section','{"section":"city"}','2026-04-28 12:44:59');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(31,NULL,'view:section','{"section":"city"}','2026-04-28 12:45:00');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(32,NULL,'view:section','{"section":"city"}','2026-04-28 12:45:00');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(33,NULL,'enter:zone','{"zone":"posts"}','2026-04-28 12:45:10');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(34,NULL,'enter:zone','{"zone":"stories"}','2026-04-28 12:45:11');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(35,NULL,'enter:zone','{"zone":"chat"}','2026-04-28 12:45:16');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(36,NULL,'enter:zone','{"zone":"chat"}','2026-04-28 12:45:20');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(37,NULL,'enter:zone','{"zone":"bereal"}','2026-04-28 12:45:23');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(38,NULL,'enter:zone','{"zone":"profile"}','2026-04-28 12:46:34');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(39,NULL,'enter:zone','{"zone":"stories"}','2026-04-28 12:46:38');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(40,NULL,'view:section','{"section":"city"}','2026-04-28 13:04:08');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(41,NULL,'view:section','{"section":"city"}','2026-04-28 13:04:10');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(42,NULL,'enter:zone','{"zone":"profile"}','2026-04-28 13:04:18');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(43,NULL,'enter:zone','{"zone":"posts"}','2026-04-28 13:04:21');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(44,NULL,'enter:zone','{"zone":"posts"}','2026-04-28 13:04:27');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(45,NULL,'enter:zone','{"zone":"posts"}','2026-04-28 13:04:33');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(46,NULL,'enter:zone','{"zone":"posts"}','2026-04-28 13:04:36');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(47,NULL,'enter:zone','{"zone":"bereal"}','2026-04-28 13:04:39');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(48,NULL,'enter:zone','{"zone":"posts"}','2026-04-28 13:04:40');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(49,NULL,'enter:zone','{"zone":"tweets"}','2026-04-28 13:04:43');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(50,NULL,'enter:zone','{"zone":"tweets"}','2026-04-28 13:05:15');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(51,NULL,'create:tweet','{"len":4}','2026-04-28 13:05:20');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(52,NULL,'enter:zone','{"zone":"bereal"}','2026-04-28 13:05:23');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(53,NULL,'enter:zone','{"zone":"stories"}','2026-04-28 13:05:27');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(54,NULL,'view:section','{"section":"stories"}','2026-04-28 13:06:15');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(55,NULL,'menu:open',NULL,'2026-04-28 13:06:33');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(56,NULL,'view:section','{"section":"posts"}','2026-04-28 13:06:35');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(57,NULL,'menu:open',NULL,'2026-04-28 13:06:37');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(58,NULL,'view:section','{"section":"tweets"}','2026-04-28 13:06:38');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(59,NULL,'view:section','{"section":"city"}','2026-04-28 13:21:10');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(60,NULL,'menu:open',NULL,'2026-04-28 13:21:20');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(61,NULL,'menu:open',NULL,'2026-04-28 13:21:33');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(62,NULL,'enter:zone','{"zone":"posts"}','2026-04-28 13:21:56');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(63,NULL,'enter:zone','{"zone":"profile"}','2026-04-28 13:22:05');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(64,NULL,'enter:zone','{"zone":"profile"}','2026-04-28 13:22:07');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(65,NULL,'enter:zone','{"zone":"posts"}','2026-04-28 13:22:14');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(66,NULL,'enter:zone','{"zone":"chat"}','2026-04-28 13:22:19');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(67,NULL,'enter:zone','{"zone":"chat"}','2026-04-28 13:22:20');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(68,NULL,'enter:zone','{"zone":"tweets"}','2026-04-28 13:22:26');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(69,NULL,'enter:zone','{"zone":"tweets"}','2026-04-28 13:22:27');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(70,NULL,'enter:zone','{"zone":"posts"}','2026-04-28 13:22:38');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(71,NULL,'auth:register','{"color":"Teal"}','2026-04-28 13:23:48');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(72,NULL,'view:section','{"section":"city"}','2026-04-28 13:23:48');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(73,NULL,'enter:zone','{"zone":"posts"}','2026-04-28 13:23:52');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(74,NULL,'enter:zone','{"zone":"posts"}','2026-04-28 13:24:43');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(75,NULL,'view:section','{"section":"chat"}','2026-04-28 13:24:49');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(76,NULL,'city:hello','{"to":7}','2026-04-28 13:24:54');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(77,NULL,'view:section','{"section":"posts"}','2026-04-28 18:39:03');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(78,NULL,'view:section','{"section":"city"}','2026-04-28 19:35:38');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(79,NULL,'view:section','{"section":"city"}','2026-04-29 05:25:02');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(80,NULL,'view:section','{"section":"city"}','2026-04-29 05:45:28');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(81,NULL,'view:section','{"section":"city"}','2026-04-29 05:54:50');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(82,NULL,'enter:zone','{"zone":"profile"}','2026-04-29 05:54:56');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(83,NULL,'view:section','{"section":"city"}','2026-04-29 12:20:26');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(84,NULL,'enter:zone','{"zone":"posts"}','2026-04-29 12:20:34');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(85,NULL,'enter:zone','{"zone":"chat"}','2026-04-29 12:20:39');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(86,NULL,'view:section','{"section":"city"}','2026-04-29 15:13:27');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(87,NULL,'view:section','{"section":"city"}','2026-04-29 15:13:28');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(88,NULL,'view:section','{"section":"city"}','2026-04-29 15:13:29');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(89,NULL,'view:section','{"section":"city"}','2026-04-29 15:13:29');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(90,NULL,'view:section','{"section":"city"}','2026-04-29 15:42:47');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(91,NULL,'enter:zone','{"zone":"posts"}','2026-04-29 15:42:51');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(92,NULL,'enter:zone','{"zone":"posts"}','2026-04-29 15:42:53');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(93,NULL,'enter:zone','{"zone":"tweets"}','2026-04-29 15:42:53');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(94,NULL,'enter:zone','{"zone":"posts"}','2026-04-29 15:42:54');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(95,NULL,'enter:zone','{"zone":"posts"}','2026-04-29 15:42:55');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(96,NULL,'view:section','{"section":"city"}','2026-04-29 20:14:27');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(97,NULL,'view:section','{"section":"city"}','2026-04-29 20:14:29');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(98,NULL,'enter:zone','{"zone":"posts"}','2026-04-29 20:14:36');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(99,NULL,'enter:zone','{"zone":"posts"}','2026-04-29 20:14:37');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(100,NULL,'enter:zone','{"zone":"posts"}','2026-04-29 20:25:05');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(101,NULL,'enter:zone','{"zone":"posts"}','2026-04-29 20:25:06');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(102,NULL,'enter:zone','{"zone":"posts"}','2026-04-29 20:25:26');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(103,NULL,'enter:zone','{"zone":"tweets"}','2026-04-29 20:25:27');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(104,NULL,'enter:zone','{"zone":"tweets"}','2026-04-29 20:25:30');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(105,NULL,'enter:zone','{"zone":"posts"}','2026-04-29 20:25:30');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(106,NULL,'enter:zone','{"zone":"chat"}','2026-04-29 20:25:50');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(107,NULL,'enter:zone','{"zone":"posts"}','2026-04-29 20:25:53');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(108,NULL,'view:section','{"section":"city"}','2026-04-30 07:37:31');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(109,NULL,'view:section','{"section":"city"}','2026-05-05 08:54:07');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(110,NULL,'enter:zone','{"zone":"posts"}','2026-05-05 08:54:08');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(111,NULL,'view:section','{"section":"city"}','2026-05-05 08:54:14');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(112,NULL,'enter:zone','{"zone":"chat"}','2026-05-05 08:54:16');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(113,NULL,'enter:zone','{"zone":"stories"}','2026-05-05 08:54:22');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(114,NULL,'enter:zone','{"zone":"bereal"}','2026-05-05 08:54:24');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(115,NULL,'enter:zone','{"zone":"posts"}','2026-05-05 08:54:26');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(116,NULL,'enter:zone','{"zone":"tweets"}','2026-05-05 08:54:29');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(117,NULL,'auth:register','{"color":"Coral"}','2026-05-21 08:55:00');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(118,NULL,'view:section','{"section":"city"}','2026-05-21 08:55:00');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(119,NULL,'view:section','{"section":"city"}','2026-05-21 08:55:03');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(120,NULL,'enter:zone','{"zone":"posts"}','2026-05-21 08:55:07');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(121,NULL,'enter:zone','{"zone":"posts"}','2026-05-21 08:55:09');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(122,NULL,'view:section','{"section":"city"}','2026-05-23 17:16:38');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(123,NULL,'enter:zone','{"zone":"posts"}','2026-05-23 17:16:51');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(124,NULL,'view:section','{"section":"city"}','2026-05-31 18:16:09');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(125,NULL,'view:section','{"section":"city"}','2026-06-01 20:43:29');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(126,NULL,'view:section','{"section":"city"}','2026-06-01 20:46:53');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(127,NULL,'view:section','{"section":"city"}','2026-06-01 21:00:03');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(128,NULL,'view:section','{"section":"city"}','2026-06-01 21:00:06');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(129,NULL,'enter:zone','{"zone":"posts"}','2026-06-01 21:02:18');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(130,NULL,'enter:zone','{"zone":"tweets"}','2026-06-01 21:02:19');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(131,NULL,'enter:zone','{"zone":"posts"}','2026-06-01 21:02:20');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(132,NULL,'enter:zone','{"zone":"posts"}','2026-06-01 21:02:21');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(133,NULL,'view:section','{"section":"city"}','2026-06-01 21:03:35');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(134,NULL,'view:section','{"section":"city"}','2026-06-01 21:06:48');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(135,NULL,'view:section','{"section":"city"}','2026-06-01 21:06:49');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(136,NULL,'view:section','{"section":"city"}','2026-06-01 21:06:50');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(137,NULL,'view:section','{"section":"city"}','2026-06-01 21:06:51');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(138,NULL,'view:section','{"section":"city"}','2026-06-01 21:06:52');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(139,NULL,'view:section','{"section":"city"}','2026-06-01 21:06:54');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(140,NULL,'view:section','{"section":"city"}','2026-06-02 10:32:42');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(141,NULL,'view:section','{"section":"city"}','2026-06-02 10:32:50');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(142,NULL,'auth:register','{"color":"Coral"}','2026-06-02 14:15:40');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(143,NULL,'view:section','{"section":"city"}','2026-06-02 14:15:40');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(144,NULL,'enter:zone','{"zone":"tweets"}','2026-06-02 14:15:42');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(145,NULL,'view:section','{"section":"city"}','2026-06-02 14:15:52');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(146,NULL,'enter:zone','{"zone":"tweets"}','2026-06-02 14:15:57');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(147,NULL,'view:section','{"section":"city"}','2026-06-02 14:18:15');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(148,NULL,'view:section','{"section":"city"}','2026-06-02 14:23:44');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(149,NULL,'menu:open',NULL,'2026-06-02 14:24:43');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(150,NULL,'view:section','{"section":"city"}','2026-06-02 14:35:43');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(151,NULL,'view:section','{"section":"city"}','2026-06-02 14:48:43');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(152,NULL,'enter:zone','{"zone":"tweets"}','2026-06-02 14:48:47');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(153,NULL,'enter:zone','{"zone":"tweets"}','2026-06-02 14:48:51');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(154,NULL,'create:tweet','{"len":6}','2026-06-02 14:48:58');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(155,NULL,'view:section','{"section":"city"}','2026-06-02 20:40:41');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(156,NULL,'enter:zone','{"zone":"tweets"}','2026-06-02 20:40:42');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(157,NULL,'view:section','{"section":"city"}','2026-06-02 22:26:43');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(158,NULL,'view:section','{"section":"city"}','2026-06-02 22:35:38');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(159,NULL,'view:section','{"section":"city"}','2026-06-02 22:39:17');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(160,NULL,'view:section','{"section":"city"}','2026-06-02 22:48:28');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(161,NULL,'enter:zone','{"zone":"bereal"}','2026-06-02 22:53:16');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(162,NULL,'enter:zone','{"zone":"posts"}','2026-06-02 22:53:28');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(163,NULL,'enter:zone','{"zone":"tweets"}','2026-06-02 22:53:42');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(164,NULL,'view:section','{"section":"city"}','2026-06-02 22:53:46');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(165,NULL,'view:section','{"section":"city"}','2026-06-02 22:57:36');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(166,NULL,'view:section','{"section":"city"}','2026-06-02 23:01:07');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(167,NULL,'enter:zone','{"zone":"tweets"}','2026-06-02 23:01:09');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(168,NULL,'view:section','{"section":"city"}','2026-06-02 23:01:12');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(169,NULL,'enter:zone','{"zone":"tweets"}','2026-06-02 23:01:21');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(170,NULL,'view:section','{"section":"city"}','2026-06-03 07:15:56');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(171,NULL,'view:section','{"section":"city"}','2026-06-03 07:20:00');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(172,NULL,'view:section','{"section":"city"}','2026-06-03 07:24:26');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(173,NULL,'view:section','{"section":"city"}','2026-06-03 07:27:12');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(174,NULL,'view:section','{"section":"city"}','2026-06-03 07:36:18');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(175,NULL,'view:section','{"section":"city"}','2026-06-03 07:42:47');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(176,NULL,'view:section','{"section":"city"}','2026-06-03 12:00:23');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(177,NULL,'view:section','{"section":"city"}','2026-06-03 12:00:29');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(178,NULL,'view:section','{"section":"city"}','2026-06-03 12:11:08');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(179,NULL,'enter:zone','{"zone":"tweets"}','2026-06-03 12:11:24');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(180,NULL,'enter:zone','{"zone":"tweets"}','2026-06-03 12:11:27');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(181,NULL,'view:section','{"section":"city"}','2026-06-03 12:12:00');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(182,NULL,'view:section','{"section":"city"}','2026-06-03 12:14:37');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(183,NULL,'menu:open',NULL,'2026-06-03 12:15:06');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(184,NULL,'enter:zone','{"zone":"stories"}','2026-06-03 12:15:14');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(185,NULL,'view:section','{"section":"city"}','2026-06-04 07:38:23');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(186,NULL,'enter:zone','{"zone":"posts"}','2026-06-04 07:52:47');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(187,NULL,'view:section','{"section":"city"}','2026-06-04 08:20:24');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(188,NULL,'enter:zone','{"zone":"tweets"}','2026-06-04 08:20:49');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(189,NULL,'view:section','{"section":"city"}','2026-06-04 09:06:13');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(190,NULL,'view:section','{"section":"city"}','2026-06-04 09:06:14');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(191,NULL,'enter:zone','{"zone":"chat"}','2026-06-04 09:06:27');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(192,NULL,'enter:zone','{"zone":"chat"}','2026-06-04 09:06:28');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(193,NULL,'view:section','{"section":"city"}','2026-06-04 09:07:59');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(194,NULL,'enter:zone','{"zone":"tweets"}','2026-06-04 09:09:52');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(195,NULL,'view:section','{"section":"city"}','2026-06-04 09:13:28');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(196,NULL,'enter:zone','{"zone":"tweets"}','2026-06-04 09:13:31');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(197,NULL,'view:section','{"section":"city"}','2026-06-04 09:22:19');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(198,NULL,'view:section','{"section":"city"}','2026-06-04 09:38:12');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(199,NULL,'view:section','{"section":"city"}','2026-06-04 09:38:13');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(200,NULL,'view:section','{"section":"city"}','2026-06-04 09:40:57');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(201,NULL,'view:section','{"section":"city"}','2026-06-04 09:48:02');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(202,NULL,'enter:zone','{"zone":"tweets"}','2026-06-04 09:48:04');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(203,NULL,'view:section','{"section":"city"}','2026-06-04 09:55:55');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(204,NULL,'view:section','{"section":"city"}','2026-06-04 10:01:27');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(205,NULL,'enter:zone','{"zone":"tweets"}','2026-06-04 10:01:29');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(206,NULL,'view:section','{"section":"city"}','2026-06-04 11:45:51');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(207,NULL,'view:section','{"section":"city"}','2026-06-04 12:30:31');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(208,NULL,'enter:zone','{"zone":"tweets"}','2026-06-04 12:30:35');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(209,NULL,'menu:open',NULL,'2026-06-04 12:31:25');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(210,NULL,'enter:zone','{"zone":"posts"}','2026-06-04 12:31:36');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(211,NULL,'view:section','{"section":"city"}','2026-06-04 12:56:13');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(212,NULL,'view:section','{"section":"city"}','2026-06-04 12:56:44');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(213,NULL,'view:section','{"section":"city"}','2026-06-04 13:05:56');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(214,NULL,'view:section','{"section":"city"}','2026-06-04 13:06:59');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(215,NULL,'view:section','{"section":"city"}','2026-06-04 13:07:04');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(216,NULL,'view:section','{"section":"city"}','2026-06-04 13:07:09');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(217,NULL,'view:section','{"section":"city"}','2026-06-04 13:07:10');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(218,NULL,'view:section','{"section":"city"}','2026-06-04 13:07:10');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(219,NULL,'view:section','{"section":"city"}','2026-06-04 13:07:11');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(220,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:45');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(221,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:46');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(222,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:47');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(223,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:47');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(224,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:48');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(225,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:48');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(226,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:48');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(227,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:49');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(228,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:49');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(229,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:50');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(230,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:50');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(231,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:50');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(232,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:50');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(233,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:50');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(234,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:51');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(235,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:51');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(236,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:51');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(237,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:51');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(238,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:51');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(239,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:51');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(240,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:52');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(241,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:52');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(242,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:52');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(243,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:52');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(244,NULL,'view:section','{"section":"city"}','2026-06-04 13:24:52');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(245,NULL,'view:section','{"section":"city"}','2026-06-04 13:28:31');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(246,NULL,'view:section','{"section":"city"}','2026-06-04 13:28:35');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(247,NULL,'view:section','{"section":"city"}','2026-06-04 14:13:05');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(248,NULL,'view:section','{"section":"city"}','2026-06-04 14:13:13');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(249,NULL,'view:section','{"section":"city"}','2026-06-04 14:26:27');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(250,NULL,'view:section','{"section":"city"}','2026-06-04 14:26:33');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(251,NULL,'view:section','{"section":"city"}','2026-06-04 14:29:56');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(252,NULL,'enter:zone','{"zone":"tweets"}','2026-06-04 14:29:58');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(253,NULL,'view:section','{"section":"city"}','2026-06-04 14:30:00');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(254,NULL,'view:section','{"section":"city"}','2026-06-04 14:30:00');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(255,NULL,'view:section','{"section":"city"}','2026-06-04 14:30:01');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(256,NULL,'enter:zone','{"zone":"tweets"}','2026-06-04 14:30:02');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(257,NULL,'view:section','{"section":"city"}','2026-06-04 14:30:14');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(258,NULL,'enter:zone','{"zone":"tweets"}','2026-06-04 14:30:16');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(259,NULL,'view:section','{"section":"city"}','2026-06-04 14:42:41');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(260,NULL,'view:section','{"section":"city"}','2026-06-04 18:37:09');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(261,NULL,'view:section','{"section":"city"}','2026-06-04 19:23:09');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(262,NULL,'view:section','{"section":"city"}','2026-06-05 13:18:20');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(263,NULL,'view:section','{"section":"city"}','2026-06-08 12:59:56');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(264,NULL,'enter:zone','{"zone":"tweets"}','2026-06-08 12:59:58');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(265,NULL,'view:section','{"section":"city"}','2026-07-03 05:26:30');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(266,NULL,'enter:zone','{"zone":"tweets"}','2026-07-03 05:26:31');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(267,NULL,'city:recado-start','{"from":"Rosa","to":"Quique","kind":"errand"}','2026-07-03 05:26:33');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(268,NULL,'city:recado-done','{"kind":"errand","to":"Quique","chain":1}','2026-07-03 05:26:54');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(269,NULL,'enter:zone','{"zone":"bereal"}','2026-07-03 05:51:10');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(270,NULL,'enter:zone','{"zone":"stories"}','2026-07-03 05:51:16');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(271,NULL,'view:section','{"section":"city"}','2026-07-03 06:08:39');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(272,NULL,'view:section','{"section":"city"}','2026-07-03 06:08:41');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(273,NULL,'view:section','{"section":"city"}','2026-07-03 06:08:53');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(274,NULL,'enter:zone','{"zone":"tweets"}','2026-07-03 06:08:57');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(275,NULL,'city:recado-start','{"from":"Tomás","to":"Marisa","kind":"errand"}','2026-07-03 06:09:23');
INSERT INTO "events" ("id","user_id","kind","props_json","created_at") VALUES(276,NULL,'menu:open',NULL,'2026-07-03 06:09:28');
CREATE TABLE city_waves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE story_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id  INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id   INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    content   TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE admin_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date  TEXT NOT NULL,
    title TEXT NOT NULL,
    descr TEXT DEFAULT '',
    emoji TEXT DEFAULT '📅',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE city_chat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    zone TEXT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "city_chat" ("id","user_id","zone","content","created_at") VALUES(6,9,'plaza','holaa','2026-06-08 12:59:57');
INSERT INTO "city_chat" ("id","user_id","zone","content","created_at") VALUES(7,9,'tweets','hay alguien?','2026-06-08 13:00:01');
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('users',9);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('tweets',29);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('posts',3);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('post_comments',4);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('reactions',8);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('stories',4);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('messages',10);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('bereals',5);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('friendships',6);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('events',276);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('city_chat',7);
CREATE INDEX idx_tweets_created ON tweets(created_at DESC);
CREATE INDEX idx_tweets_parent ON tweets(parent_id);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_comments_post ON post_comments(post_id);
CREATE INDEX idx_reactions_target ON reactions(target_type, target_id);
CREATE INDEX idx_stories_expires ON stories(expires_at);
CREATE INDEX idx_stories_user ON stories(user_id);
CREATE INDEX idx_messages_conv ON messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX idx_messages_unread ON messages(receiver_id, read_at);
CREATE INDEX idx_conv_a ON conversations(user_a, last_message_at DESC);
CREATE INDEX idx_conv_b ON conversations(user_b, last_message_at DESC);
CREATE INDEX idx_bereals_created ON bereals(created_at DESC);
CREATE INDEX idx_friendships_target ON friendships(target_id, status);
CREATE INDEX idx_friendships_requester ON friendships(requester_id, status);
CREATE UNIQUE INDEX idx_users_account_name ON users(account_name) WHERE account_name IS NOT NULL;
CREATE UNIQUE INDEX idx_users_display_lower ON users(LOWER(display_name)) WHERE display_name IS NOT NULL;
CREATE INDEX idx_presence_updated ON presence(updated_at DESC);
CREATE INDEX idx_events_kind_created ON events(kind, created_at DESC);
CREATE INDEX idx_events_user ON events(user_id, created_at DESC);
CREATE INDEX idx_city_waves_created ON city_waves(created_at DESC);
CREATE INDEX idx_story_comments_story ON story_comments(story_id, created_at);
CREATE INDEX idx_admin_events_date ON admin_events(date);
CREATE INDEX idx_city_chat_created ON city_chat(created_at DESC);
