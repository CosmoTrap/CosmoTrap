<?php
// Vérification après mise en ligne : la base répond-elle ? (aucune donnée sensible renvoyée)
declare(strict_types=1);
require __DIR__ . '/db.php';

try {
  db()->query('SELECT COUNT(*) FROM users')->fetchColumn();
  // ?auth=1 avec un en-tête « Authorization: Bearer <64 hex> » : vérifie qu'il arrive bien jusqu'à PHP
  out(['ok' => true, 'driver' => $CFG['driver'], 'php' => PHP_VERSION, 'authHeader' => isset($_GET['auth']) ? bearer() !== null : null]);
} catch (Throwable $e) {
  out(['ok' => false, 'error' => 'Base de données injoignable.'], 500);
}
