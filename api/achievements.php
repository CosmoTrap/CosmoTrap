<?php
// Succès débloqués par le joueur.
declare(strict_types=1);
require __DIR__ . '/db.php';

$u = require_user();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
  $st = db()->prepare('SELECT code, created_at FROM achievements WHERE user_id = ?');
  $st->execute([$u['id']]);
  out(['achievements' => array_map(fn($r) => ['code' => $r['code'], 'date' => (int)$r['created_at']], $st->fetchAll())]);
}

if ($method === 'POST') {
  $b = body();
  $codes = array_slice(array_filter((array)($b['codes'] ?? []), fn($c) => is_string($c) && preg_match('/^[a-z_]{2,32}$/', $c)), 0, 30);
  $ins = db()->prepare('INSERT INTO achievements (user_id, code, created_at) VALUES (?, ?, ?)');
  foreach ($codes as $c) {
    try { $ins->execute([$u['id'], $c, time()]); } catch (Throwable $e) { /* déjà débloqué */ }
  }
  out(['ok' => true]);
}

fail('Méthode non autorisée.', 405);
