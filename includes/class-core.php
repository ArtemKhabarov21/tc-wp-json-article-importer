<?php
/**
 * Ядро плагина WP JSON Article Importer
 */

class WPJAI_Core {
    /**
     * Экземпляр класса (для реализации паттерна singleton)
     */
    private static $instance = null;

    /**
     * Хранение настроек плагина
     */
    private $settings;

    /**
     * Приватный конструктор для предотвращения создания нескольких экземпляров
     */
    private function __construct() {
        $this->load_settings();
    }

    /**
     * Получение экземпляра класса
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Инициализация плагина
     */
    public function init() {
        // Инициализация административной части
        $admin = new WPJAI_Admin();
        $admin->init();

        // Инициализация API части
        $api = new WPJAI_API();
        $api->init();

        // Инициализация работы с постами
        $posts = new WPJAI_Posts();
        $posts->init();

        // Регистрация хуков активации и деактивации
        register_activation_hook(WPJAI_PLUGIN_DIR . 'wp-json-article-importer.php', array($this, 'activate'));
        register_deactivation_hook(WPJAI_PLUGIN_DIR . 'wp-json-article-importer.php', array($this, 'deactivate'));
    }

    /**
     * Загрузка настроек плагина
     */
    private function load_settings() {
        $this->settings = get_option('wp_json_article_importer_settings', array(
            'json_file_url' => '',
            'api_keys' => 'VKikqorzQ57Wt305oVCfGvi-KIWFKfvo2cDW7-pPY_M', // Значение по умолчанию
        ));
    }

    /**
     * Получение настроек плагина
     */
    public function get_settings() {
        return $this->settings;
    }

    /**
     * Обновление настроек плагина
     */
    public function update_settings($settings) {
        $this->settings = $settings;
        update_option('wp_json_article_importer_settings', $settings);
    }

    /**
     * Действия при активации плагина
     */
    public function activate() {
        // Проверяем, установлены ли начальные настройки
        if (!get_option('wp_json_article_importer_settings')) {
            // Устанавливаем настройки по умолчанию
            add_option('wp_json_article_importer_settings', array(
                'json_file_url' => '',
                'api_keys' => 'VKikqorzQ57Wt305oVCfGvi-KIWFKfvo2cDW7-pPY_M',
            ));
        }
    }

    /**
     * Действия при деактивации плагина
     */
    public function deactivate() {
        // Удаляем временные данные
        delete_transient('wp_json_article_importer_articles');
    }
}