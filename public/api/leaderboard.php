<?php
// Classement : les parties terminées les plus rapides (meilleur temps par joueur).
declare(strict_types=1);
require __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
  $rows = db()->query('SELECT s.user_id, u.pseudo, s.time_ms, s.hints, s.errors, s.score, s.character_id, s.ending, s.created_at
    FROM scores s JOIN users u ON u.id = s.user_id
    WHERE s.id = (SELECT s2.id FROM scores s2 WHERE s2.user_id = s.user_id ORDER BY s2.time_ms ASC, s2.id ASC LIMIT 1)
    ORDER BY s.time_ms ASC LIMIT 50')->fetchAll();
  $me = current_user();
  out(['rows' => array_map(fn($r) => [
    'pseudo' => $r['pseudo'],
    'timeMs' => (int)$r['time_ms'],
    'hints' => (int)$r['hints'],
    'errors' => (int)$r['errors'],
    'score' => (int)$r['score'],
    'character' => $r['character_id'],
    'ending' => $r['ending'],
    'date' => (int)$r['created_at'],
    'me' => $me && (int)$me['id'] === (int)$r['user_id'],
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
  db()->prepare('INSERT INTO scores (user_id, time_ms, hints, errors, score, character_id, ending, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    ->execute([$u['id'], $t, $hints, $errors, $score, $char, $ending, time()]);
  $st = db()->prepare('SELECT COUNT(DISTINCT user_id) AS r FROM scores WHERE time_ms < ?');
  $st->execute([$t]);
  out(['ok' => true, 'rank' => (int)$st->fetch()['r'] + 1]);
}

fail('Méthode non autorisée.', 405);
