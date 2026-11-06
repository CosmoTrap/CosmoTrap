<?php
// Configuration de l'API Cosmotrap.
// En production (Hostinger) : créer config.local.php avec les identifiants MySQL, par exemple :
//   <?php return ['driver' => 'mysql', 'host' => 'localhost', 'name' => 'u123_cosmo', 'user' => 'u123_cosmo', 'pass' => '...'];
// Sans config.local.php, l'API utilise une base SQLite rangée hors du dossier web (../../cosmotrap-data/).
$defaults = [
  'driver' => 'sqlite',
  'sqlite_path' => dirname(__DIR__, 2) . '/cosmotrap-data/cosmotrap.sqlite',
  'host' => 'localhost',
  'name' => '',
  'user' => '',
  'pass' => '',
  'session_days' => 30,
];
// COSMOTRAP_CONFIG : autre fichier de configuration (tests sur MySQL en local)
$file = getenv('COSMOTRAP_CONFIG') ?: __DIR__ . '/config.local.php';
$local = file_exists($file) ? require $file : [];
return array_merge($defaults, is_array($local) ? $local : []);
