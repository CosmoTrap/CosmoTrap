<?php
// Sauvegarde de la progression (une par joueur) : GET pour reprendre, POST pour enregistrer, DELETE pour effacer.
declare(strict_types=1);
require __DIR__ . '/db.php';

$u = require_user();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
  $st = db()->prepare('SELECT data, updated_at FROM saves WHERE user_id = ?');
  $st->execute([$u['id']]);
  $r = $st->fetch();
  out(['save' => $r ? json_decode($r['data'], true) : null, 'updatedAt' => $r ? (int)$r['updated_at'] : null]);
}

if ($method === 'POST') {
  $b = body();
  if (!isset($b['save']) || !is_array($b['save'])) fail('Sauvegarde manquante.');
  $data = json_encode($b['save'], JSON_UNESCAPED_UNICODE);
  $now = time();
  $pdo = db();
  $up = $pdo->prepare('UPDATE saves SET data = ?, updated_at = ? WHERE user_id = ?');
  $up->execute([$data, $now, $u['id']]);
  if ($up->rowCount() === 0) $pdo->prepare('INSERT INTO saves (user_id, data, updated_at) VALUES (?, ?, ?)')->execute([$u['id'], $data, $now]);
  out(['ok' => true, 'updatedAt' => $now]);
}

if ($method === 'DELETE') {
  db()->prepare('DELETE FROM saves WHERE user_id = ?')->execute([$u['id']]);
  out(['ok' => true]);
}

fail('Méthode non autorisée.', 405);
