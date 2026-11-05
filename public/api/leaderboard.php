<?php
// Classement par difficulté (meilleur temps de chaque joueur) + réplique fantôme du record.
declare(strict_types=1);
require __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$diffs = ['explorer', 'astronaut', 'survival'];
$diff = in_array($_GET['difficulty'] ?? '', $diffs, true) ? $_GET['difficulty'] : 'astronaut';

if ($method === 'GET' && isset($_GET['ghost'])) {
  // trajectoire du meilleur temps de cette difficulté
  $st = db()->prepare('SELECT u.pseudo, s.time_ms, s.ghost FROM scores s JOIN users u ON u.id = s.user_id WHERE s.difficulty = ? AND s.ghost IS NOT NULL ORDER BY s.time_ms ASC LIMIT 1');
  $st->execute([$diff]);
  $r = $st->fetch();
  out(['ghost' => $r ? ['pseudo' => $r['pseudo'], 'timeMs' => (int)$r['time_ms'], 'track' => json_decode($r['ghost'], true)] : null]);
}

if ($method === 'GET') {
  // période : tout (global) ou 7 derniers jours (semaine) ; difficulté : toutes ou une seule
  $since = ($_GET['period'] ?? '') === 'week' ? time() - 7 * 86400 : 0;
  $all = ($_GET['difficulty'] ?? '') === 'all';
  $where = $all ? 's2.created_at >= ?' : 's2.difficulty = ? AND s2.created_at >= ?';
  $args = $all ? [$since] : [$diff, $since];
  // carte : base lunaire ou station spatiale (toutes si non précisée)
  if (in_array($_GET['map'] ?? '', ['base', 'station'], true)) {
    $where .= ' AND s2.map_id = ?';
    $args[] = $_GET['map'];
  }
  $st = db()->prepare("SELECT s.user_id, u.pseudo, u.character_id AS avatar, s.difficulty, s.time_ms, s.hints, s.errors, s.score, s.character_id, s.ending, s.created_at
    FROM scores s JOIN users u ON u.id = s.user_id
    WHERE s.id = (SELECT s2.id FROM scores s2 WHERE s2.user_id = s.user_id AND $where ORDER BY s2.time_ms ASC, s2.id ASC LIMIT 1)
    ORDER BY s.time_ms ASC LIMIT 50");
  $st->execute($args);
  $rows = $st->fetchAll();
  $me = current_user();
  $myRank = null;
  if ($me) foreach ($rows as $i => $r) if ((int)$r['user_id'] === (int)$me['id']) $myRank = $i + 1;
  out(['difficulty' => $diff, 'myRank' => $myRank, 'rows' => array_map(fn($r) => [
    'pseudo' => $r['pseudo'],
    'timeMs' => (int)$r['time_ms'],
    'hints' => (int)$r['hints'],
    'errors' => (int)$r['errors'],
    'score' => (int)$r['score'],
    'character' => $r['character_id'],
    'ending' => $r['ending'],
    'date' => (int)$r['created_at'],
    'me' => $me && (int)$me['id'] === (int)$r['user_id'],
    'avatar' => $r['avatar'],
    'difficulty' => $r['difficulty'],
  ], $rows)]);
}

if ($method === 'POST') {
  $u = require_user();
  $b = body();
  $t = (int)($b['timeMs'] ?? 0);
  // garde-fous : une partie dure au moins 2 min et au plus 2 h
  if ($t < 120000 || $t > 7200000) fail('Temps invalide.');
  $hints = max(0, min(99, (int)($b['hints'] ?? 0)));
  $errors = max(0, min(999, (int)($b['errors'] ?? 0)));
  $score = max(0, min(99999, (int)($b['score'] ?? 0)));
  $char = preg_replace('/[^a-z]/', '', (string)($b['character'] ?? 'nova')) ?: 'nova';
  $ending = preg_replace('/[^a-z_]/', '', (string)($b['ending'] ?? 'rescue')) ?: 'rescue';
  $d = in_array($b['difficulty'] ?? '', $diffs, true) ? $b['difficulty'] : 'astronaut';
  $map = in_array($b['map'] ?? '', ['base', 'station'], true) ? $b['map'] : 'base';
  $ghost = null;
  if (isset($b['ghost']) && is_array($b['ghost']) && count($b['ghost']) <= 40000) {
    $ghost = json_encode(array_map(fn($v) => is_numeric($v) ? $v + 0 : 0, $b['ghost']));
  }
  db()->prepare('INSERT INTO scores (user_id, time_ms, hints, errors, score, character_id, ending, created_at, difficulty, ghost, map_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    ->execute([$u['id'], $t, $hints, $errors, $score, $char, $ending, time(), $d, $ghost, $map]);
  $st = db()->prepare('SELECT COUNT(DISTINCT user_id) AS r FROM scores WHERE difficulty = ? AND time_ms < ?');
  $st->execute([$d, $t]);
  out(['ok' => true, 'rank' => (int)$st->fetch()['r'] + 1]);
}

fail('Méthode non autorisée.', 405);
