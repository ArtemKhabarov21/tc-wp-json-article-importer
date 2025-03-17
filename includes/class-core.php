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

        register_activation_hook(WPJAI_PLUGIN_DIR . 'wp-json-article-importer.php', array($this, 'activate'));
        register_deactivation_hook(WPJAI_PLUGIN_DIR . 'wp-json-article-importer.php', array($this, 'deactivate'));

        // Добавление AJAX обработчика для определения SEO плагинов
        add_action('wp_ajax_detect_seo_plugins', array($this, 'ajax_detect_seo_plugins'));
    }

    /**
     * Загрузка настроек плагина
     */
    private function load_settings() {
        $this->settings = get_option('wp_json_article_importer_settings', array(
            'json_file_url' => '',
            'api_keys' => 'VKikqorzQ57Wt305oVCfGvi-KIWFKfvo2cDW7-pPY_M',
            'default_post_type' => 'page', // По умолчанию страницы, а не посты
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
                'api_keys' =>  'KdfyxxKfkUFqNBcD2Oj-7VjN-WrGHjgeW73VBkhGam0', //'VKikqorzQ57Wt305oVCfGvi-KIWFKfvo2cDW7-pPY_M',
                'default_post_type' => 'page', // По умолчанию страницы, а не посты
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

    /**
     * AJAX: Определение установленных SEO плагинов
     */
    public function ajax_detect_seo_plugins() {
        // Проверка nonce
        check_ajax_referer('wp_json_article_importer_nonce', 'nonce');

        // Проверка прав доступа
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Недостаточно прав');
        }

        $active_plugins = $this->get_active_seo_plugins();

        wp_send_json_success(array(
            'plugins' => $active_plugins,
            'default_post_type' => isset($this->settings['default_post_type']) ? $this->settings['default_post_type'] : 'page'
        ));
    }

    /**
     * Получение списка активных SEO плагинов
     */
    private function get_active_seo_plugins() {
        $seo_plugins = array();

        // Yoast SEO
        if (is_plugin_active('wordpress-seo/wp-seo.php')) {
            $seo_plugins[] = 'yoast';
        }

        // SEO Framework
        if (is_plugin_active('autodescription/autodescription.php')) {
            $seo_plugins[] = 'seo_framework';
        }

        // CDS Simple SEO
        if (is_plugin_active('cds-simple-seo/cds-simple-seo.php')) {
            $seo_plugins[] = 'cds_simple_seo';
        }

        // SEOPress
        if (is_plugin_active('wp-seopress/seopress.php')) {
            $seo_plugins[] = 'seopress';
        }

        return $seo_plugins;
    }
}