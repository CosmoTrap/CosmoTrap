<?php
// Inscription, connexion (email + mot de passe ou Google), session courante, déconnexion.
declare(strict_types=1);
require __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'me' && $method === 'GET') {
  $u = current_user();
  out(['user' => $u ? public_user($u) : null, 'google' => $CFG['google_client_id'] !== '']);
}

if ($method !== 'POST') fail('Méthode non autorisée.', 405);
$b = body();

if ($action === 'register') {
  $email = strtolower(trim((string)($b['email'] ?? '')));
  $pseudo = trim((string)($b['pseudo'] ?? ''));
  $pass = (string)($b['password'] ?? '');
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Adresse e-mail invalide.');
  if (mb_strlen($pseudo) < 2 || mb_strlen($pseudo) > 20) fail('Le pseudo doit faire entre 2 et 20 caractères.');
  if (!preg_match('/^[\p{L}\p{N} _\-\.]+$/u', $pseudo)) fail('Le pseudo contient des caractères non autorisés.');
  if (strlen($pass) < 8) fail('Le mot de passe doit faire au moins 8 caractères.');
  $st = db()->prepare('SELECT id FROM users WHERE email = ?');
  $st->execute([$email]);
  if ($st->fetch()) fail('Un compte existe déjà avec cette adresse.', 409);
  db()->prepare('INSERT INTO users (email, pseudo, pass_hash, created_at) VALUES (?, ?, ?, ?)')->execute([$email, $pseudo, password_hash($pass, PASSWORD_DEFAULT), time()]);
  $id = (int)db()->lastInsertId();
  out(['token' => new_session($id), 'user' => ['id' => $id, 'email' => $email, 'pseudo' => $pseudo]]);
}

if ($action === 'login') {
  $email = strtolower(trim((string)($b['email'] ?? '')));
  $pass = (string)($b['password'] ?? '');
  $st = db()->prepare('SELECT * FROM users WHERE email = ?');
  $st->execute([$email]);
  $u = $st->fetch();
  // même message dans les deux cas pour ne pas révéler les comptes existants
  if (!$u || !$u['pass_hash'] || !password_verify($pass, $u['pass_hash'])) {
    usleep(300000);
    fail('E-mail ou mot de passe incorrect.', 401);
  }
  out(['token' => new_session((int)$u['id']), 'user' => public_user($u)]);
}

if ($action === 'google') {
  if ($CFG['google_client_id'] === '') fail('Connexion Google non configurée sur ce serveur.', 501);
  $cred = (string)($b['credential'] ?? '');
  if (!preg_match('/^[A-Za-z0-9_\-\.]+$/', $cred)) fail('Jeton Google invalide.');
  $resp = @file_get_contents('https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($cred));
  $info = $resp ? json_decode($resp, true) : null;
  if (!$info || ($info['aud'] ?? '') !== $CFG['google_client_id'] || ($info['email_verified'] ?? '') !== 'true') fail('Connexion Google refusée.', 401);
  $email = strtolower($info['email']);
  $st = db()->prepare('SELECT * FROM users WHERE email = ?');
  $st->execute([$email]);
  $u = $st->fetch();
  if (!$u) {
    $pseudo = mb_substr(preg_replace('/[^\p{L}\p{N} _\-\.]/u', '', $info['given_name'] ?? explode('@', $email)[0]) ?: 'Astronaute', 0, 20);
    db()->prepare('INSERT INTO users (email, pseudo, google_sub, created_at) VALUES (?, ?, ?, ?)')->execute([$email, $pseudo, $info['sub'], time()]);
    $u = ['id' => (int)db()->lastInsertId(), 'email' => $email, 'pseudo' => $pseudo];
  }
  out(['token' => new_session((int)$u['id']), 'user' => public_user($u)]);
}

if ($action === 'logout') {
  $t = bearer();
  if ($t) db()->prepare('DELETE FROM sessions WHERE token = ?')->execute([$t]);
  out(['ok' => true]);
}

fail('Action inconnue.', 404);
