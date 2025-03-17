<?php
class WPJAI_Posts {
    /**
     * Инициализация класса
     */
    public function init() {
        // Регистрация обработчика AJAX для создания записей
        add_action('wp_ajax_create_post_from_json', array($this, 'ajax_create_post_from_json'));
    }

    /**
     * AJAX: Создание записи из JSON
     */
    public function ajax_create_post_from_json() {
        // Проверка nonce
        check_ajax_referer('wp_json_article_importer_nonce', 'nonce');

        // Проверка прав доступа
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Недостаточно прав');
        }

        // Получение данных
        $article_index = isset($_POST['article_index']) ? intval($_POST['article_index']) : 0;
        $post_status = isset($_POST['post_status']) ? sanitize_text_field($_POST['post_status']) : 'draft';
        $post_type = isset($_POST['post_type']) ? sanitize_text_field($_POST['post_type']) : 'post';
        $category_id = isset($_POST['category_id']) ? intval($_POST['category_id']) : 0;
        $schedule_date = isset($_POST['schedule_date']) ? sanitize_text_field($_POST['schedule_date']) : '';
        $content_html = isset($_POST['content_html']) ? wp_kses_post($_POST['content_html']) : '';

        // Получение кэшированных статей
        $articles = get_transient('wp_json_article_importer_articles');

        if (!$articles || !isset($articles[$article_index])) {
            wp_send_json_error('Статья не найдена или истек срок кэширования');
        }

        $article = $articles[$article_index];

        // Обработка контента с изображениями через прокси-функцию
        $content_with_images = $this->process_content_images($content_html);

        // Устанавливаем миниатюру поста из первого изображения (если есть)
        $featured_image_id = $this->extract_first_image_id($content_with_images);

        // Создаем пост
        $post_data = array(
            'post_title'    => sanitize_text_field($article['h1']),
            'post_content'  => $content_with_images,
            'post_status'   => $post_status,
            'post_type'     => $post_type
        );

        // Обработка отложенной публикации
        if ($post_status === 'future' && !empty($schedule_date)) {
            $post_data['post_date'] = get_gmt_from_date($schedule_date);
            $post_data['post_date_gmt'] = get_gmt_from_date($schedule_date);
        }

        // Вставка поста
        $post_id = wp_insert_post($post_data, true);

        // Проверяем на наличие ошибок при создании поста
        if (is_wp_error($post_id)) {
            wp_send_json_error('Ошибка создания поста: ' . $post_id->get_error_message());
        }

        // Установка миниатюры
        if ($featured_image_id > 0) {
            set_post_thumbnail($post_id, $featured_image_id);
        }

        // Привязка к категории для типа 'post'
        if ($post_type === 'post' && $category_id > 0) {
            wp_set_post_categories($post_id, array($category_id));
        }

        // Добавляем мета-информацию
        update_post_meta($post_id, '_meta_title',
            !empty($article['meta']['title']) ? sanitize_text_field($article['meta']['title']) : '');
        update_post_meta($post_id, '_meta_description',
            !empty($article['meta']['description']) ? sanitize_text_field($article['meta']['description']) : '');

        // Обработка ключевых слов с проверкой типа
        $keywords = !empty($article['meta']['keywords']) ? $article['meta']['keywords'] : '';
        if (is_array($keywords)) {
            $keywords = implode(', ', array_filter($keywords));
        }
        update_post_meta($post_id, '_meta_keywords', sanitize_text_field($keywords));

        // Удаляем обработанную статью из кеша
        $this->remove_published_article($article_index);

        // Возвращаем URL редактирования и информацию о следующей статье
        $next_article = $this->get_next_article($article_index);

        wp_send_json_success(array(
            'post_id' => $post_id,
            'edit_url' => admin_url('post.php?post=' . $post_id . '&action=edit'),
            'view_url' => get_permalink($post_id),
            'next_article' => $next_article,
            'has_next' => !empty($next_article)
        ));
    }

    /**
     * Обработка изображений в HTML контенте
     * Загружает изображения с внешних URL и заменяет их на локальные
     */
    private function process_content_images($content) {
        if (empty($content)) {
            return '';
        }

        // Создаем DOM для парсинга
        $dom = new DOMDocument();
        libxml_use_internal_errors(true); // Подавляем предупреждения
        $dom->loadHTML(mb_convert_encoding($content, 'HTML-ENTITIES', 'UTF-8'), LIBXML_HTML_NOCLEAN);
        libxml_clear_errors();

        $xpath = new DOMXPath($dom);
        $images = $xpath->query('//img');

        // Обрабатываем каждое изображение
        foreach ($images as $img) {
            $src = $img->getAttribute('src');

            // Проверяем, является ли URL внешним
            if (strpos($src, 'http') === 0) {
                $alt = $img->getAttribute('alt') ?: 'Imported image';

                // Загружаем изображение и получаем ID вложения
                $attachment_id = $this->upload_image_from_url($src, 0, $alt);

                if (!is_wp_error($attachment_id) && $attachment_id > 0) {
                    // Получаем URL загруженного изображения
                    $attachment_url = wp_get_attachment_url($attachment_id);

                    // Обновляем атрибуты изображения
                    $img->setAttribute('src', $attachment_url);
                    $img->setAttribute('data-attachment-id', $attachment_id);

                    // Добавляем класс, если его нет
                    $class = $img->getAttribute('class');
                    if (empty($class)) {
                        $img->setAttribute('class', 'wp-image-' . $attachment_id);
                    } else {
                        $img->setAttribute('class', $class . ' wp-image-' . $attachment_id);
                    }
                }
            }
        }

        // Получаем обновленный HTML
        $body = $xpath->query('//body')->item(0);
        $innerHtml = '';

        foreach ($body->childNodes as $child) {
            $innerHtml .= $dom->saveHTML($child);
        }

        return $innerHtml;
    }

    /**
     * Извлечение ID первого изображения из контента для установки миниатюры
     */
    private function extract_first_image_id($content) {
        if (empty($content)) {
            return 0;
        }

        $dom = new DOMDocument();
        libxml_use_internal_errors(true);
        $dom->loadHTML(mb_convert_encoding($content, 'HTML-ENTITIES', 'UTF-8'));
        libxml_clear_errors();

        $xpath = new DOMXPath($dom);
        $images = $xpath->query('//img');

        if ($images->length > 0) {
            $first_img = $images->item(0);
            $attachment_id = $first_img->getAttribute('data-attachment-id');

            if (!empty($attachment_id) && is_numeric($attachment_id)) {
                return intval($attachment_id);
            }
        }

        return 0;
    }

    /**
     * Загрузка изображения по URL и прикрепление к посту
     */
    private function upload_image_from_url($url, $post_id, $alt_text = '') {
        // Скачивание файла
        $tmp = download_url($url);

        if (is_wp_error($tmp)) {
            return $tmp;
        }

        // Получение информации о файле
        $file_array = array(
            'name' => basename($url),
            'tmp_name' => $tmp,
        );

        // Проверка типа файла
        if (!preg_match('/\.(jpg|jpeg|png|gif)$/i', $file_array['name'])) {
            @unlink($tmp);
            return new WP_Error('invalid_file_type', 'Неверный тип файла');
        }

        // Загрузка файла в медиабиблиотеку
        $id = media_handle_sideload($file_array, $post_id);

        // Очистка временного файла
        @unlink($tmp);

        // В случае ошибки возвращаем ее
        if (is_wp_error($id)) {
            return $id;
        }

        // Обновление метаданных изображения
        if (!empty($alt_text)) {
            update_post_meta($id, '_wp_attachment_image_alt', $alt_text);
        }

        return $id;
    }

    /**
     * Удаление опубликованной статьи из кеша
     */
    private function remove_published_article($article_index) {
        $articles = get_transient('wp_json_article_importer_articles');

        if ($articles && isset($articles[$article_index])) {
            // Удаляем статью из массива
            unset($articles[$article_index]);

            // Переиндексируем массив
            $articles = array_values($articles);

            // Обновляем кеш
            set_transient('wp_json_article_importer_articles', $articles, 12 * HOUR_IN_SECONDS);
        }
    }

    /**
     * Получение следующей статьи после публикации
     */
    private function get_next_article($current_index) {
        $articles = get_transient('wp_json_article_importer_articles');

        if ($articles) {
            // Переиндексируем массив после удаления
            $articles = array_values($articles);

            // Проверяем наличие следующей статьи в новом массиве
            if (isset($articles[0])) {
                return $articles[0];
            }
        }

        return null;
    }
}