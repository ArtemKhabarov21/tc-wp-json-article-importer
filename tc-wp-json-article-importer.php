<?php
/**
 * Plugin Name: TC WP JSON Article Importer
 * Plugin URI:
 * Description: Импорт статей из JSON файла с добавлением изображений через Unsplash API
 * Version: 1.0.1
 * Author: Artem Khabarov
 * Author URI:
 * Text Domain: TC wp-json-article-importer
 */

if (!defined('ABSPATH')) {
    exit;
}

define('WPJAI_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WPJAI_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WPJAI_VERSION', '1.0.1');

spl_autoload_register(function ($class_name) {
    if (strpos($class_name, 'WPJAI_') !== 0) {
        return;
    }

    $class_file = str_replace('WPJAI_', '', $class_name);
    $class_file = strtolower($class_file);
    $class_file = str_replace('_', '-', $class_file);

    $file_path = WPJAI_PLUGIN_DIR . 'includes/class-' . $class_file . '.php';

    if (file_exists($file_path)) {
        require_once $file_path;
    }
});

require_once WPJAI_PLUGIN_DIR . 'includes/class-core.php';
require_once WPJAI_PLUGIN_DIR . 'includes/class-admin.php';
require_once WPJAI_PLUGIN_DIR . 'includes/class-api.php';
require_once WPJAI_PLUGIN_DIR . 'includes/class-posts.php';

function wpjai_init() {
    $core = WPJAI_Core::get_instance();
    $core->init();
}

wpjai_init();