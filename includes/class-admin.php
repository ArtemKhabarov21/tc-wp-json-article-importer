<?php
/**
 * Административный интерфейс плагина WP JSON Article Importer
 */

class WPJAI_Admin {
    /**
     * Инициализация класса
     */
    public function init() {
        // Добавление пунктов меню
        add_action('admin_menu', array($this, 'add_admin_menu'));

        // Загрузка скриптов и стилей
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));

        // Обработка загрузки локального JSON файла
        add_action('admin_init', array($this, 'handle_local_json_upload'));
    }

    /**
     * Добавление пункта меню в консоль администратора
     */
    public function add_admin_menu() {
        add_menu_page(
            'JSON Article Importer',
            'JSON Importer',
            'manage_options',
            'wp-json-article-importer',
            array($this, 'render_admin_page'),
            'dashicons-upload',
            30
        );
    }

    /**
     * Подключение скриптов и стилей для админки
     */
    public function enqueue_admin_scripts($hook) {
        if ('toplevel_page_wp-json-article-importer' !== $hook) {
            return;
        }

        // Подключение стилей
        wp_enqueue_style(
            'wp-json-article-importer-css',
            WPJAI_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            WPJAI_VERSION
        );

        // Подключение скриптов
        wp_enqueue_script(
            'wp-json-article-importer-js',
            WPJAI_PLUGIN_URL . 'assets/js/admin.js',
            array('jquery'),
            WPJAI_VERSION,
            true
        );

        // Локализация скрипта
        wp_localize_script('wp-json-article-importer-js', 'wp_json_importer', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('wp_json_article_importer_nonce'),
        ));
    }

    /**
     * Отображение страницы администратора
     */
    public function render_admin_page() {
        // Проверка прав доступа
        if (!current_user_can('manage_options')) {
            return;
        }

        // Получение настроек
        $core = WPJAI_Core::get_instance();
        $settings = $core->get_settings();

        include WPJAI_PLUGIN_DIR . 'templates/admin-page.php';
    }

    /**
     * Обработка загрузки локального JSON файла
     */
    public function handle_local_json_upload() {
        // Проверка прав доступа
        if (!current_user_can('manage_options')) {
            return;
        }

        if (isset($_FILES['local_json_file'])) {
            if ($_FILES['local_json_file']['error'] !== UPLOAD_ERR_OK) {
                add_settings_error(
                    'wp_json_article_importer',
                    'json_upload_error',
                    'Ошибка загрузки файла: ' . $_FILES['local_json_file']['error'],
                    'error'
                );
                return;
            }

            $file_content = file_get_contents($_FILES['local_json_file']['tmp_name']);
            if ($file_content === false) {
                add_settings_error(
                    'wp_json_article_importer',
                    'json_read_error',
                    'Не удалось прочитать содержимое файла',
                    'error'
                );
                return;
            }

            $data = json_decode($file_content, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                add_settings_error(
                    'wp_json_article_importer',
                    'json_decode_error',
                    'Ошибка декодирования JSON: ' . json_last_error_msg(),
                    'error'
                );
                return;
            }

            if (empty($data) || !isset($data['articles'])) {
                add_settings_error(
                    'wp_json_article_importer',
                    'json_format_error',
                    'Неверный формат JSON: отсутствуют статьи',
                    'error'
                );
                return;
            }

            // Сохраняем статьи в сессии
            set_transient('wp_json_article_importer_articles', $data['articles'], 12 * HOUR_IN_SECONDS);

            add_settings_error(
                'wp_json_article_importer',
                'json_upload_success',
                'JSON файл успешно загружен. Найдено статей: ' . count($data['articles']),
                'success'
            );
        }
    }
}