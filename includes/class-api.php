<?php
/**
 * Работа с API для плагина WP JSON Article Importer
 */
class WPJAI_API {
    private $api_keys = [];
    private $current_key_index = 0;
    private $key_index_option = 'wpjai_current_key_index';

    /**
     * Инициализация класса
     */
    public function init() {

        $this->load_api_keys();

        $this->current_key_index = get_option($this->key_index_option, 0);

        add_action('wp_ajax_fetch_json_articles', array($this, 'ajax_fetch_json_articles'));
        add_action('wp_ajax_fetch_unsplash_images', array($this, 'ajax_fetch_unsplash_images'));
        add_action('wp_ajax_get_article_by_index', array($this, 'ajax_get_article_by_index'));
        add_action('wp_ajax_save_plugin_settings', array($this, 'ajax_save_plugin_settings'));
        add_action('wp_ajax_get_plugin_settings', array($this, 'ajax_get_plugin_settings'));
    }

    /**
     * Загрузка API ключей
     */
    private function load_api_keys() {

        $config_file = WPJAI_PLUGIN_DIR . 'includes/config-keys.php';

        if (file_exists($config_file)) {
            include $config_file;

            if (isset($unsplash_api_keys) && is_array($unsplash_api_keys) && !empty($unsplash_api_keys)) {
                $this->api_keys = $unsplash_api_keys;
                return;
            }
        }

        $core = WPJAI_Core::get_instance();
        $settings = $core->get_settings();

        if (!empty($settings['api_keys'])) {
            $this->api_keys = array_map('trim', explode(',', $settings['api_keys']));
        }
    }

    /**
     * Получение следующего API ключа с ротацией
     */
    private function get_next_api_key() {
        if (empty($this->api_keys)) {
            return '';
        }

        $key = $this->api_keys[$this->current_key_index];

        $this->current_key_index = ($this->current_key_index + 1) % count($this->api_keys);

        update_option($this->key_index_option, $this->current_key_index);

        return $key;
    }

    /**
     * Получение всех API ключей
     */
    public function get_all_api_keys() {
        return $this->api_keys;
    }

    /**
     * Получение информации о текущем состоянии ротации ключей
     */
    public function get_keys_rotation_info() {
        return array(
            'total_keys' => count($this->api_keys),
            'current_index' => $this->current_key_index,
            'next_index' => ($this->current_key_index + 1) % count($this->api_keys),
            'current_key' => !empty($this->api_keys) ?
                substr($this->api_keys[$this->current_key_index], 0, 4) . '...' .
                substr($this->api_keys[$this->current_key_index], -4) : '',
        );
    }

    /**
     * AJAX: Загрузка статей из JSON
     */
    public function ajax_fetch_json_articles() {

        check_ajax_referer('wp_json_article_importer_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error('Недостаточно прав');
        }

        $json_data = '';
        $source_type = isset($_POST['source_type']) ? sanitize_text_field($_POST['source_type']) : 'url';
        if ($source_type === 'url') {
            $core = WPJAI_Core::get_instance();
            $settings = $core->get_settings();
            $json_url = !empty($_POST['json_url']) ? esc_url_raw($_POST['json_url']) : $settings['json_file_url'];
            if (empty($json_url)) {
                wp_send_json_error('URL JSON файла не указан');
            }
            $response = wp_remote_get($json_url);
            if (is_wp_error($response)) {
                wp_send_json_error('Ошибка загрузки JSON: ' . $response->get_error_message());
            }
            $json_data = wp_remote_retrieve_body($response);
        } else if ($source_type === 'local') {
            if (empty($_FILES['local_json_file'])) {
                wp_send_json_error('Локальный JSON файл не выбран');
            }
            if ($_FILES['local_json_file']['error'] !== UPLOAD_ERR_OK) {
                wp_send_json_error('Ошибка загрузки файла: ' . $_FILES['local_json_file']['error']);
            }
            $json_data = file_get_contents($_FILES['local_json_file']['tmp_name']);
            if ($json_data === false) {
                wp_send_json_error('Не удалось прочитать содержимое файла');
            }
        } else {
            wp_send_json_error('Неизвестный источник данных');
        }

        $data = json_decode($json_data, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            wp_send_json_error('Ошибка декодирования JSON: ' . json_last_error_msg());
        }

        if (empty($data) || !isset($data['articles'])) {
            wp_send_json_error('Неверный формат JSON: отсутствуют статьи');
        }

        set_transient('wp_json_article_importer_articles', $data['articles'], 12 * HOUR_IN_SECONDS);

        wp_send_json_success(array(
            'count' => count($data['articles']),
            'first_article' => isset($data['articles'][0]) ? $data['articles'][0] : null,
        ));
    }

    /**
     * AJAX: Получение статьи по индексу
     */
    public function ajax_get_article_by_index() {

        check_ajax_referer('wp_json_article_importer_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error('Недостаточно прав');
        }

        $index = isset($_POST['index']) ? intval($_POST['index']) : 0;

        $articles = get_transient('wp_json_article_importer_articles');

        if (!$articles || !isset($articles[$index])) {
            wp_send_json_error('Статья не найдена или истек срок кэширования');
        }

        wp_send_json_success(array(
            'article' => $articles[$index]
        ));
    }

    /**
     * AJAX: Поиск изображений Unsplash
     */
    public function ajax_fetch_unsplash_images() {
        check_ajax_referer('wp_json_article_importer_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error('Недостаточно прав');
        }

        $query = isset($_POST['query']) ? sanitize_text_field($_POST['query']) : '';

        if (empty($query)) {
            wp_send_json_error('Запрос для поиска не указан');
        }

        $api_key = $this->get_next_api_key();

        if (empty($api_key)) {
            wp_send_json_error('API ключи не настроены');
        }

        $url = add_query_arg(
            array(
                'query' => urlencode($query),
                'per_page' => 20,
                'client_id' => $api_key,
            ),
            'https://api.unsplash.com/search/photos'
        );

        $response = wp_remote_get($url, array(
            'headers' => array(
                'Accept-Version' => 'v1',
            ),
        ));

        if (is_wp_error($response)) {
            wp_send_json_error('Ошибка API Unsplash: ' . $response->get_error_message());
        }

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            wp_send_json_error('Ошибка декодирования ответа: ' . json_last_error_msg());
        }

        $images = array();

        if (isset($data['results']) && !empty($data['results'])) {
            foreach ($data['results'] as $image) {
                $images[] = array(
                    'id' => $image['id'],
                    'url' => $image['urls']['regular'],
                    'thumb' => $image['urls']['thumb'],
                    'full' => $image['urls']['full'],
                    'author' => $image['user']['name'],
                    'alt' => $query . ' - ' . ($image['description'] ?? ''),
                    'keyword' => $query
                );
            }
        }

        wp_send_json_success(array(
            'images' => $images,
            'keyword' => $query
        ));
    }

    /**
     * AJAX: Получение настроек плагина
     */
    public function ajax_get_plugin_settings() {

        check_ajax_referer('wp_json_article_importer_nonce', 'nonce');


        if (!current_user_can('manage_options')) {
            wp_send_json_error('Недостаточно прав');
        }

        $core = WPJAI_Core::get_instance();
        $settings = $core->get_settings();

        wp_send_json_success($settings);
    }

    /**
     * AJAX: Сохранение настроек плагина
     */
    public function ajax_save_plugin_settings() {

        check_ajax_referer('wp_json_article_importer_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error('Недостаточно прав');
        }

        $json_file_url = isset($_POST['json_file_url']) ? esc_url_raw($_POST['json_file_url']) : '';
        $api_keys = isset($_POST['api_keys']) ? sanitize_textarea_field($_POST['api_keys']) : '';
        $default_post_type = isset($_POST['default_post_type']) ? sanitize_text_field($_POST['default_post_type']) : 'page';

        if (!in_array($default_post_type, array('post', 'page'))) {
            $default_post_type = 'page';
        }

        $settings = array(
            'json_file_url' => $json_file_url,
            'api_keys' => $api_keys,
            'default_post_type' => $default_post_type,
        );

        $core = WPJAI_Core::get_instance();
        $core->update_settings($settings);

        if (!empty($api_keys)) {
            $this->api_keys = array_map('trim', explode(',', $api_keys));
        } else {
            $this->api_keys = array();
        }

        wp_send_json_success('Настройки успешно сохранены');
    }
}