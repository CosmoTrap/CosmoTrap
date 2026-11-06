<?php
// Inscription, connexion (email + mot de passe), session courante, déconnexion.
declare(strict_types=1);
require __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'me' && $method === 'GET') {
  $u = current_user();
  out(['user' => $u ? public_user($u) : null]);
}

if ($method !== 'POST') fail('Méthode non autorisée.', 405);
$b = body();

if ($action === 'register') {
  $email = strtolower(trim((string)($b['email'] ?? '')));
  $pseudo = trim((string)($b['pseudo'] ?? ''));
  $pass = (string)($b['password'] ?? '');
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Adresse e-mail invalide.');
  valid_pseudo($pseudo);
  if (strlen($pass) < 8) fail('Le mot de passe doit faire au moins 8 caractères.');
  $st = db()->prepare('SELECT id FROM users WHERE email = ? OR LOWER(pseudo) = LOWER(?)');
  $st->execute([$email, $pseudo]);
  if ($st->fetch()) fail('Ce pseudo ou cette adresse est déjà utilisé.', 409);
  db()->prepare('INSERT INTO users (email, pseudo, pass_hash, created_at) VALUES (?, ?, ?, ?)')->execute([$email, $pseudo, password_hash($pass, PASSWORD_DEFAULT), time()]);
  $id = (int)db()->lastInsertId();
  out(['token' => new_session($id), 'user' => ['id' => $id, 'email' => $email, 'pseudo' => $pseudo, 'character' => 'nova']]);
}

if ($action === 'login') {
  // connexion par e-mail ou par pseudo
  $id = trim((string)($b['email'] ?? ''));
  $pass = (string)($b['password'] ?? '');
  $st = db()->prepare('SELECT * FROM users WHERE email = ? OR LOWER(pseudo) = LOWER(?)');
  $st->execute([strtolower($id), $id]);
  $u = $st->fetch();
  // même message dans les deux cas pour ne pas révéler les comptes existants
  if (!$u || !$u['pass_hash'] || !password_verify($pass, $u['pass_hash'])) {
    usleep(300000);
    fail('E-mail ou mot de passe incorrect.', 401);
  }
  out(['token' => new_session((int)$u['id']), 'user' => public_user($u)]);
}

if ($action === 'profile') {
  $u = require_user();
  $pseudo = trim((string)($b['pseudo'] ?? $u['pseudo']));
  $email = strtolower(trim((string)($b['email'] ?? $u['email'])));
  $char = (string)($b['character'] ?? $u['character_id']);
  valid_pseudo($pseudo);
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Adresse e-mail invalide.');
  if (!in_array($char, CHARACTERS, true)) fail('Personnage inconnu.');
  $st = db()->prepare('SELECT id FROM users WHERE (email = ? OR LOWER(pseudo) = LOWER(?)) AND id <> ?');
  $st->execute([$email, $pseudo, $u['id']]);
  if ($st->fetch()) fail('Ce pseudo ou cette adresse est déjà utilisé.', 409);
  db()->prepare('UPDATE users SET pseudo = ?, email = ?, character_id = ? WHERE id = ?')->execute([$pseudo, $email, $char, $u['id']]);
  out(['user' => ['id' => (int)$u['id'], 'email' => $email, 'pseudo' => $pseudo, 'character' => $char]]);
}

if ($action === 'password') {
  $u = require_user();
  $st = db()->prepare('SELECT pass_hash FROM users WHERE id = ?');
  $st->execute([$u['id']]);
  $hash = $st->fetch()['pass_hash'] ?? null;
  if ($hash && !password_verify((string)($b['current'] ?? ''), $hash)) fail('Mot de passe actuel incorrect.', 401);
  $new = (string)($b['password'] ?? '');
  if (strlen($new) < 8) fail('Le mot de passe doit faire au moins 8 caractères.');
  db()->prepare('UPDATE users SET pass_hash = ? WHERE id = ?')->execute([password_hash($new, PASSWORD_DEFAULT), $u['id']]);
  out(['ok' => true]);
}

if ($action === 'forgot') {
  // toujours la même réponse : on ne révèle pas si le compte existe
  $email = strtolower(trim((string)($b['email'] ?? '')));
  $st = db()->prepare('SELECT id, pseudo FROM users WHERE email = ?');
  $st->execute([$email]);
  if ($u = $st->fetch()) {
    $t = bin2hex(random_bytes(24));
    db()->prepare('INSERT INTO resets (token, user_id, expires_at) VALUES (?, ?, ?)')->execute([$t, $u['id'], time() + 3600]);
    $base = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
    $link = $base . '/?reset=' . $t;
    // en local (pas de serveur mail) : le lien est écrit dans le journal du serveur PHP
    if (preg_match('/^(localhost|127\.0\.0\.1)(:\d+)?$/', $_SERVER['HTTP_HOST'] ?? '')) error_log("Cosmotrap reset: $link");
    @mail($email, 'Cosmotrap — nouveau mot de passe', "Bonjour {$u['pseudo']},\n\nPour choisir un nouveau mot de passe, ouvre ce lien (valable 1 h) :\n$link\n\nSi tu n'as rien demandé, ignore ce message.", "From: Cosmotrap <no-reply@" . ($_SERVER['HTTP_HOST'] ?? 'localhost') . ">\r\nContent-Type: text/plain; charset=utf-8");
  }
  out(['ok' => true]);
}

if ($action === 'reset') {
  $t = (string)($b['token'] ?? '');
  $new = (string)($b['password'] ?? '');
  if (strlen($new) < 8) fail('Le mot de passe doit faire au moins 8 caractères.');
  $st = db()->prepare('SELECT user_id FROM resets WHERE token = ? AND expires_at > ?');
  $st->execute([$t, time()]);
  $r = $st->fetch();
  if (!$r) fail('Lien expiré ou invalide.', 400);
  db()->prepare('UPDATE users SET pass_hash = ? WHERE id = ?')->execute([password_hash($new, PASSWORD_DEFAULT), $r['user_id']]);
  db()->prepare('DELETE FROM resets WHERE token = ?')->execute([$t]);
  out(['token' => new_session((int)$r['user_id']), 'ok' => true]);
}

if ($action === 'logout') {
  $t = bearer();
  if ($t) db()->prepare('DELETE FROM sessions WHERE token = ?')->execute([$t]);
  out(['ok' => true]);
}

fail('Action inconnue.', 404);
