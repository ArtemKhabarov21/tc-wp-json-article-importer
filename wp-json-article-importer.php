<?php
/**
 * Plugin Name: WP JSON Article Importer
 * Plugin URI:
 * Description: Импорт статей из JSON файла с добавлением изображений через Unsplash API
 * Version: 1.0.0
 * Author:
 * Author URI:
 * Text Domain: wp-json-article-importer
 */

// Если файл вызван напрямую, прерываем выполнение
if (!defined('ABSPATH')) {
    exit;
}

// Определяем константы плагина
define('WPJAI_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WPJAI_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WPJAI_VERSION', '1.0.0');

// Автозагрузка классов
spl_autoload_register(function ($class_name) {
    // Проверяем, относится ли класс к нашему плагину
    if (strpos($class_name, 'WPJAI_') !== 0) {
        return;
    }

    // Преобразуем имя класса в путь к файлу
    $class_file = str_replace('WPJAI_', '', $class_name);
    $class_file = strtolower($class_file);
    $class_file = str_replace('_', '-', $class_file);

    // Полный путь к файлу класса
    $file_path = WPJAI_PLUGIN_DIR . 'includes/class-' . $class_file . '.php';

    // Подключаем файл, если он существует
    if (file_exists($file_path)) {
        require_once $file_path;
    }
});

// Подключаем основные файлы
require_once WPJAI_PLUGIN_DIR . 'includes/class-core.php';
require_once WPJAI_PLUGIN_DIR . 'includes/class-admin.php';
require_once WPJAI_PLUGIN_DIR . 'includes/class-api.php';
require_once WPJAI_PLUGIN_DIR . 'includes/class-posts.php';

// Инициализация плагина
function wpjai_init() {
    $core = WPJAI_Core::get_instance();
    $core->init();
}

// Запуск плагина
wpjai_init();