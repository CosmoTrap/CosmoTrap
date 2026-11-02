<?php
// Connexion PDO + création des tables + utilitaires communs.
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$CFG = require __DIR__ . '/config.php';

function out($data, int $code = 200): void {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function fail(string $msg, int $code = 400): void {
  out(['error' => $msg], $code);
}

function body(): array {
  $raw = file_get_contents('php://input') ?: '';
  if (strlen($raw) > 300000) fail('Requête trop volumineuse.', 413);
  $j = json_decode($raw, true);
  return is_array($j) ? $j : [];
}

function db(): PDO {
  global $CFG;
  static $pdo = null;
  if ($pdo) return $pdo;
  if ($CFG['driver'] === 'mysql') {
    $pdo = new PDO("mysql:host={$CFG['host']};dbname={$CFG['name']};charset=utf8mb4", $CFG['user'], $CFG['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $auto = 'INT AUTO_INCREMENT PRIMARY KEY';
    $text = 'VARCHAR(191)';
    $long = 'MEDIUMTEXT';
  } else {
    $dir = dirname($CFG['sqlite_path']);
    if (!is_dir($dir)) mkdir($dir, 0700, true);
    $pdo = new PDO('sqlite:' . $CFG['sqlite_path'], null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $auto = 'INTEGER PRIMARY KEY AUTOINCREMENT';
    $text = 'TEXT';
    $long = 'TEXT';
  }
  $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
  $pdo->exec("CREATE TABLE IF NOT EXISTS users (
    id $auto,
    email $text NOT NULL UNIQUE,
    pseudo $text NOT NULL,
    pass_hash $text,
    google_sub $text,
    created_at INTEGER NOT NULL
  )");
  $pdo->exec("CREATE TABLE IF NOT EXISTS sessions (
    token $text PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )");
  $pdo->exec("CREATE TABLE IF NOT EXISTS saves (
    user_id INTEGER PRIMARY KEY,
    data $long NOT NULL,
    updated_at INTEGER NOT NULL
  )");
  $pdo->exec("CREATE TABLE IF NOT EXISTS scores (
    id $auto,
    user_id INTEGER NOT NULL,
    time_ms INTEGER NOT NULL,
    hints INTEGER NOT NULL,
    errors INTEGER NOT NULL,
    score INTEGER NOT NULL,
    character_id $text NOT NULL,
    ending $text NOT NULL,
    created_at INTEGER NOT NULL
  )");
  return $pdo;
}

function bearer(): ?string {
  $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
  if (!$h && function_exists('getallheaders')) {
    foreach (getallheaders() as $k => $v) if (strtolower($k) === 'authorization') $h = $v;
  }
  if (preg_match('/^Bearer\s+([a-f0-9]{64})$/i', trim($h), $m)) return strtolower($m[1]);
  return null;
}

function current_user(): ?array {
  $t = bearer();
  if (!$t) return null;
  $st = db()->prepare('SELECT u.id, u.email, u.pseudo FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?');
  $st->execute([$t, time()]);
  $u = $st->fetch();
  return $u ?: null;
}

function require_user(): array {
  $u = current_user();
  if (!$u) fail('Session expirée, reconnecte-toi.', 401);
  return $u;
}

function new_session(int $userId): string {
  global $CFG;
  $t = bin2hex(random_bytes(32));
  db()->prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')->execute([$t, $userId, time() + 86400 * (int)$CFG['session_days']]);
  return $t;
}

function public_user(array $u): array {
  return ['id' => (int)$u['id'], 'email' => $u['email'], 'pseudo' => $u['pseudo']];
}
