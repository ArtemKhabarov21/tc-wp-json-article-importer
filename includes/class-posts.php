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
        $schedule_date = isset($_POST['schedule_date']) ? sanitize_text_field($_POST['schedule_date']) : '';
        $selected_images = isset($_POST['images']) ? (array)$_POST['images'] : array();

        // Получение кэшированных статей
        $articles = get_transient('wp_json_article_importer_articles');

        if (!$articles || !isset($articles[$article_index])) {
            wp_send_json_error('Статья не найдена или истек срок кэширования');
        }

        $article = $articles[$article_index];

        // Загрузка и прикрепление изображений
        $images_with_attachments = array();
        $featured_image_id = 0;

        if (!empty($selected_images)) {
            foreach ($selected_images as $image_data) {
                // Проверяем, что урл изображения не пустой
                if (empty($image_data['url'])) continue;

                $image_id = $this->upload_image_from_url($image_data['url'], 0,
                    !empty($image_data['alt']) ? $image_data['alt'] : '');

                if (!is_wp_error($image_id) && $image_id > 0) {
                    // Первое изображение станет миниатюрой
                    if ($featured_image_id === 0) {
                        $featured_image_id = $image_id;
                    }

                    // Добавляем ID вложения к данным изображения
                    $image_data['attachment_id'] = $image_id;
                    $images_with_attachments[] = $image_data;
                }
            }
        }

        // Создаем пост
        $post_data = array(
            'post_title'    => sanitize_text_field($article['h1']),
            'post_content'  => $this->create_gutenberg_content($article, $images_with_attachments, $selected_images),
            'post_status'   => $post_status,
            'post_type'     => 'post'
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

        // Возвращаем URL редактирования для прямого перехода в Gutenberg
        wp_send_json_success(array(
            'post_id' => $post_id,
            'edit_url' => admin_url('post.php?post=' . $post_id . '&action=edit'),
            'view_url' => get_permalink($post_id)
        ));
    }

    /**
     * Создание контента для Gutenberg с безопасной обработкой
     */
    private function create_gutenberg_content($article, $images, $selected_images) {
        $blocks = [];

        // Защита от пустых данных
        if (empty($article)) {
            return '';
        }

        // Добавляем мета-информацию как первый блок
        if (!empty($article['meta'])) {
            $metaBlock = [
                'blockName' => 'core/paragraph',
                'attrs' => [],
                'innerContent' => [
                    sprintf(
                        '<small><strong>META Title:</strong> %s<br><strong>META Description:</strong> %s</small>',
                        !empty($article['meta']['title']) ? esc_html($article['meta']['title']) : '',
                        !empty($article['meta']['description']) ? esc_html($article['meta']['description']) : ''
                    )
                ]
            ];
            $blocks[] = $metaBlock;
        }

        // Безопасная обработка контента
        $content = !empty($article['content']) ? $article['content'] : '';

        // Если контент пустой, возвращаем пустой массив блоков
        if (empty($content)) {
            return serialize_blocks($blocks);
        }

        // Создаем DOM для парсинга
        $dom = new DOMDocument();
        libxml_use_internal_errors(true); // Подавляем предупреждения
        $dom->loadHTML(mb_convert_encoding($content, 'HTML-ENTITIES', 'UTF-8'), LIBXML_HTML_NOCLEAN);
        libxml_clear_errors();

        $xpath = new DOMXPath($dom);
        $elements = $xpath->query('//body/*');

        // Обработка элементов
        foreach ($elements as $element) {
            $elementHtml = $dom->saveHTML($element);

            // Создаем текстовый блок
            if ($element->nodeName === 'p') {
                $blocks[] = [
                    'blockName' => 'core/paragraph',
                    'attrs' => [],
                    'innerContent' => [wp_kses_post($elementHtml)]
                ];
            }
            // Обработка изображений в тексте
            elseif ($element->nodeName === 'img') {
                $imageUrl = $element->getAttribute('src');
                $imageAlt = $element->getAttribute('alt');
                $imageClass = $element->getAttribute('class');

                // Находим соответствующее изображение
                $matchedImage = null;
                foreach ($selected_images as $image) {
                    if ($image['url'] === $imageUrl) {
                        $matchedImage = $image;
                        break;
                    }
                }

                if ($matchedImage) {
                    $blocks[] = [
                        'blockName' => 'core/image',
                        'attrs' => [
                            'id' => !empty($matchedImage['attachment_id']) ? $matchedImage['attachment_id'] : 0,
                            'url' => $imageUrl,
                            'alt' => $imageAlt,
                            'className' => $imageClass,
                            'sizeSlug' => 'large'
                        ],
                        'innerContent' => []
                    ];
                }
            }
        }

        // Добавляем оставшиеся изображения, которые не были вставлены в текст
        foreach ($images as $image) {
            if (empty($image['url'])) continue;

            $blocks[] = [
                'blockName' => 'core/image',
                'attrs' => [
                    'id' => !empty($image['attachment_id']) ? $image['attachment_id'] : 0,
                    'url' => $image['url'],
                    'alt' => !empty($image['alt']) ? $image['alt'] : '',
                    'sizeSlug' => 'large'
                ],
                'innerContent' => []
            ];
        }

        // Преобразуем блоки в строку для Gutenberg
        return serialize_blocks($blocks);
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


}