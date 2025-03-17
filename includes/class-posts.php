<?php
/**
 * Работа с записями для плагина WP JSON Article Importer
 */

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
        $selected_images = isset($_POST['images']) ? $_POST['images'] : array();
        $content = isset($_POST['content']) ? $_POST['content'] : '';

        // Получение кэшированных статей
        $articles = get_transient('wp_json_article_importer_articles');

        if (!$articles || !isset($articles[$article_index])) {
            wp_send_json_error('Статья не найдена или истек срок кэширования');
        }

        $article = $articles[$article_index];

        // Если контент не был передан, используем оригинальный из JSON
        if (empty($content)) {
            $content = $article['content'];
        }

        // Загрузка и прикрепление изображений
        $images_with_attachments = array();
        $featured_image_id = 0;

        if (!empty($selected_images)) {
            foreach ($selected_images as $image_data) {
                $image_id = $this->upload_image_from_url($image_data['url'], 0, $image_data['alt']);

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

        // Обработка контента с изображениями
        $processed_content = $this->process_content_with_images($content, $images_with_attachments);

        // Создание поста
        $post_data = array(
            'post_title'    => sanitize_text_field($article['h1']),
            'post_content'  => $processed_content,
            'post_status'   => $post_status,
            'post_type'     => 'post',
            'post_excerpt'  => '',
            'meta_input'    => array(
                '_meta_title' => sanitize_text_field($article['meta']['title']),
                '_meta_description' => sanitize_text_field($article['meta']['description']),
                '_meta_keywords' => is_array($article['meta']['keywords']) ?
                    sanitize_text_field(implode(', ', $article['meta']['keywords'])) :
                    sanitize_text_field($article['meta']['keywords']),
            ),
        );

        // Обработка отложенной публикации
        if ($post_status === 'future' && !empty($schedule_date)) {
            $post_data['post_date'] = get_gmt_from_date($schedule_date);
            $post_data['post_date_gmt'] = get_gmt_from_date($schedule_date);
        }

        // Вставка поста
        $post_id = wp_insert_post($post_data);

        if (is_wp_error($post_id)) {
            wp_send_json_error('Ошибка создания поста: ' . $post_id->get_error_message());
        }

        // Установка миниатюры
        if ($featured_image_id > 0) {
            set_post_thumbnail($post_id, $featured_image_id);
        }

        wp_send_json_success(array(
            'post_id' => $post_id,
            'edit_url' => get_edit_post_link($post_id, 'raw'),
            'view_url' => get_permalink($post_id),
        ));
    }

    /**
     * Обработка контента с добавлением изображений
     */
    private function process_content_with_images($content, $images) {
        if (empty($images)) {
            return $content;
        }

        // Ищем все теги изображений с классом inserted-image
        preg_match_all('/<img[^>]+class="inserted-image"[^>]*>/i', $content, $matches);

        if (!empty($matches[0])) {
            // Для каждого найденного тега изображения
            foreach ($matches[0] as $img_tag) {
                // Извлекаем URL изображения
                preg_match('/src="([^"]+)"/i', $img_tag, $src_matches);

                if (!empty($src_matches[1])) {
                    $img_url = $src_matches[1];

                    // Ищем соответствующее изображение в массиве выбранных
                    foreach ($images as $image) {
                        if ($image['url'] === $img_url) {
                            // Получаем ID загруженного медиа-файла
                            $attachment_id = isset($image['attachment_id']) ? $image['attachment_id'] : 0;

                            if ($attachment_id > 0) {
                                // Получаем URL загруженного изображения
                                $uploaded_img_url = wp_get_attachment_url($attachment_id);

                                // Создаем новый тег с URL загруженного изображения
                                $new_img_tag = str_replace($img_url, $uploaded_img_url, $img_tag);

                                // Заменяем в контенте старый тег на новый
                                $content = str_replace($img_tag, $new_img_tag, $content);
                            }

                            break;
                        }
                    }
                }
            }
        }

        return $content;
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