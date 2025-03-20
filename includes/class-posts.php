<?php
class WPJAI_Posts {
    /**
     * Инициализация класса
     */
    public function init() {
        // Регистрация обработчика AJAX для создания записей
        add_action('wp_ajax_create_post_from_json', array($this, 'ajax_create_post_from_json'));

        // Регистрация обработчика для загрузки изображений
        add_action('wp_ajax_upload_image_to_media_library', array($this, 'ajax_upload_image_to_media_library'));
        add_action('wp_ajax_get_attachment_url', array($this, 'ajax_get_attachment_url'));

        // Регистрация обработчика для загрузки и изменения размера миниатюры
        add_action('wp_ajax_upload_and_resize_thumbnail', array($this, 'ajax_upload_and_resize_thumbnail'));
    }

    /**
     * AJAX: Создание записи из JSON
     */
    public function ajax_create_post_from_json() {
        check_ajax_referer('wp_json_article_importer_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error('Недостаточно прав');
        }

        $article_index = isset($_POST['article_index']) ? intval($_POST['article_index']) : 0;
        $post_status = isset($_POST['post_status']) ? sanitize_text_field($_POST['post_status']) : 'draft';
        $post_type = isset($_POST['post_type']) ? sanitize_text_field($_POST['post_type']) : 'page'; // По умолчанию страница
        $category_id = isset($_POST['category_id']) ? intval($_POST['category_id']) : 0;
        $schedule_date = isset($_POST['schedule_date']) ? sanitize_text_field($_POST['schedule_date']) : '';

        $post_title = isset($_POST['post_title']) ? sanitize_text_field($_POST['post_title']) : '';
        $meta_title = isset($_POST['meta_title']) ? sanitize_text_field($_POST['meta_title']) : '';
        $meta_description = isset($_POST['meta_description']) ? sanitize_text_field($_POST['meta_description']) : '';
        $meta_keywords = isset($_POST['meta_keywords']) ? sanitize_text_field($_POST['meta_keywords']) : '';

        $thumbnail_id = isset($_POST['thumbnail_id']) ? intval($_POST['thumbnail_id']) : 0;

        $seo_plugins = isset($_POST['seo_plugins']) ? $_POST['seo_plugins'] : array();
        if (!is_array($seo_plugins)) {
            $seo_plugins = array();
        }

        $content_html = isset($_POST['content_html']) ? $_POST['content_html'] : '';
        $content_html = preg_replace('/<userStyle>.*?<\/userStyle>/s', '', $content_html);

        $content_html = wp_kses_post($content_html);

        $articles = get_transient('wp_json_article_importer_articles');

        if (!$articles || !isset($articles[$article_index])) {
            wp_send_json_error('Статья не найдена или истек срок кэширования');
        }

        $article = $articles[$article_index];

        try {
            $content_with_images = $this->process_content_images($content_html);

            if ($thumbnail_id <= 0) {
                $featured_image_id = $this->extract_first_image_id($content_with_images);
            } else {
                $featured_image_id = $thumbnail_id;
            }

            $post_data = array(
                'post_title'    => !empty($post_title) ? $post_title : sanitize_text_field($article['h1']),
                'post_content'  => $content_with_images,
                'post_status'   => $post_status,
                'post_type'     => $post_type
            );

            if ($post_status === 'future' && !empty($schedule_date)) {
                $post_data['post_date'] = get_gmt_from_date($schedule_date);
                $post_data['post_date_gmt'] = get_gmt_from_date($schedule_date);
            }

            $post_id = wp_insert_post($post_data, true);

            if (is_wp_error($post_id)) {
                wp_send_json_error('Ошибка создания поста: ' . $post_id->get_error_message());
            }

            if ($featured_image_id > 0) {
                set_post_thumbnail($post_id, $featured_image_id);
            }

            if ($post_type === 'post' && $category_id > 0) {
                wp_set_post_categories($post_id, array($category_id));
            }

            $this->add_seo_meta_data($post_id, $meta_title, $meta_description, $meta_keywords, $seo_plugins);

            $this->remove_published_article($article_index);

            $next_article = $this->get_next_article($article_index);

            wp_send_json_success(array(
                'post_id' => $post_id,
                'edit_url' => admin_url('post.php?post=' . $post_id . '&action=edit'),
                'view_url' => get_permalink($post_id),
                'next_article' => $next_article,
                'has_next' => !empty($next_article)
            ));

        } catch (Exception $e) {
            wp_send_json_error('Ошибка обработки статьи: ' . $e->getMessage());
        }
    }

    /**
     * Добавление мета-данных SEO в зависимости от активных плагинов
     */
    private function add_seo_meta_data($post_id, $meta_title, $meta_description, $meta_keywords, $seo_plugins) {

        update_post_meta($post_id, '_wpjai_meta_title', $meta_title);
        update_post_meta($post_id, '_wpjai_meta_description', $meta_description);
        update_post_meta($post_id, '_wpjai_meta_keywords', $meta_keywords);

        if (in_array('yoast', $seo_plugins)) {
            update_post_meta($post_id, '_yoast_wpseo_title', $meta_title);
            update_post_meta($post_id, '_yoast_wpseo_metadesc', $meta_description);
            update_post_meta($post_id, '_yoast_wpseo_focuskw', $meta_keywords);
        }

        if (in_array('seo_framework', $seo_plugins)) {
            update_post_meta($post_id, '_genesis_title', $meta_title);
            update_post_meta($post_id, '_genesis_description', $meta_description);
            update_post_meta($post_id, '_genesis_keywords', $meta_keywords);
        }

        if (in_array('cds_simple_seo', $seo_plugins)) {
            update_post_meta($post_id, '_cds_title', $meta_title);
            update_post_meta($post_id, '_cds_description', $meta_description);
            update_post_meta($post_id, '_cds_keywords', $meta_keywords);
        }

        if (in_array('seopress', $seo_plugins)) {
            update_post_meta($post_id, '_seopress_titles_title', $meta_title);
            update_post_meta($post_id, '_seopress_titles_desc', $meta_description);
            update_post_meta($post_id, '_seopress_analysis_target_kw', $meta_keywords);
        }
    }

    /**
     * AJAX: Загрузка изображения в медиабиблиотеку из URL
     */
    public function ajax_upload_image_to_media_library() {

        check_ajax_referer('wp_json_article_importer_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error('Недостаточно прав');
        }

        $image_url = isset($_POST['image_url']) ? esc_url_raw($_POST['image_url']) : '';
        $alt_text = isset($_POST['alt_text']) ? sanitize_text_field($_POST['alt_text']) : '';

        if (empty($image_url)) {
            wp_send_json_error('URL изображения не указан');
        }

        $attachment_id = $this->upload_image_from_url($image_url, 0, $alt_text);

        if (is_wp_error($attachment_id)) {
            wp_send_json_error($attachment_id->get_error_message());
        }

        wp_send_json_success(array(
            'attachment_id' => $attachment_id,
            'url' => wp_get_attachment_url($attachment_id)
        ));
    }

    /**
     * AJAX: Получение URL вложения по ID
     */
    public function ajax_get_attachment_url() {

        check_ajax_referer('wp_json_article_importer_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error('Недостаточно прав');
        }

        $attachment_id = isset($_POST['attachment_id']) ? intval($_POST['attachment_id']) : 0;

        if ($attachment_id <= 0) {
            wp_send_json_error('Неверный ID вложения');
        }

        $url = wp_get_attachment_url($attachment_id);

        if (!$url) {
            wp_send_json_error('URL вложения не найден');
        }

        wp_send_json_success(array(
            'url' => $url
        ));
    }

    /**
     * AJAX: Загрузка и изменение размера миниатюры
     */
    public function ajax_upload_and_resize_thumbnail() {
        check_ajax_referer('wp_json_article_importer_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error('Недостаточно прав');
        }

        $image_url = isset($_POST['image_url']) ? esc_url_raw($_POST['image_url']) : '';
        $alt_text = isset($_POST['alt_text']) ? sanitize_text_field($_POST['alt_text']) : '';
        $width = isset($_POST['width']) ? intval($_POST['width']) : 1300;
        $height = isset($_POST['height']) ? intval($_POST['height']) : 800;

        if (empty($image_url)) {
            wp_send_json_error('URL изображения не указан');
        }

        // Ограничение размеров миниатюры
        if ($width < 100 || $width > 3000) {
            $width = 1300;
        }

        if ($height < 100 || $height > 3000) {
            $height = 800;
        }

        try {
            // Загружаем изображение - передаем alt-текст для установки во время загрузки
            $attachment_id = $this->upload_image_from_url($image_url, 0, $alt_text);

            if (is_wp_error($attachment_id)) {
                wp_send_json_error($attachment_id->get_error_message());
            }

            // Изменяем размер изображения
            $resized = $this->resize_attachment_image($attachment_id, $width, $height);

            if (is_wp_error($resized)) {
                wp_send_json_error('Ошибка при изменении размера: ' . $resized->get_error_message());
            }

            // Получаем URL загруженного и измененного изображения
            $url = wp_get_attachment_url($attachment_id);
        } catch (Exception $e) {
            wp_send_json_error('Ошибка: ' . $e->getMessage());
        }

        wp_send_json_success(array(
            'attachment_id' => $attachment_id,
            'url' => $url
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

        try {

            $dom = new DOMDocument();
            libxml_use_internal_errors(true);

            $content = preg_replace('/<userStyle>.*?<\/userStyle>/s', '', $content);

            $dom->loadHTML(mb_convert_encoding($content, 'HTML-ENTITIES', 'UTF-8'));
            libxml_clear_errors();

            $changed = false;
            $xpath = new DOMXPath($dom);
            $images = $xpath->query('//img');

            error_log('Найдено изображений для обработки: ' . $images->length);

            foreach ($images as $img) {
                $src = $img->getAttribute('src');

                if (empty($src)) {
                    continue;
                }

                if (preg_match('/^https?:\/\//i', $src) && !preg_match('/^https?:\/\/(' . preg_quote($_SERVER['HTTP_HOST'], '/') . ')/i', $src)) {
                    error_log('Обработка внешнего изображения: ' . $src);

                    $alt = $img->getAttribute('alt') ?: 'Imported image';

                    $attachment_id = $this->upload_image_from_url($src, 0, $alt);

                    if (!is_wp_error($attachment_id) && $attachment_id > 0) {
                        $attachment_url = wp_get_attachment_url($attachment_id);

                        if ($attachment_url) {
                            $img->setAttribute('src', $attachment_url);
                            $img->setAttribute('data-attachment-id', $attachment_id);

                            $class = $img->getAttribute('class');
                            if (empty($class)) {
                                $img->setAttribute('class', 'wp-image-' . $attachment_id);
                            } else if (strpos($class, 'wp-image-') === false) {
                                $img->setAttribute('class', $class . ' wp-image-' . $attachment_id);
                            }

                            $changed = true;
                            error_log('Изображение успешно заменено на локальное: ' . $attachment_url);
                        } else {
                            error_log('Не удалось получить URL для attachment ID: ' . $attachment_id);
                        }
                    } else {
                        $error_message = is_wp_error($attachment_id) ? $attachment_id->get_error_message() : 'Unknown error';
                        error_log('Ошибка при загрузке изображения: ' . $error_message);
                    }
                }
            }

            if (!$changed) {
                error_log('Изображения не были изменены, возвращаем исходный контент');
                return $content;
            }

            $body = $dom->getElementsByTagName('body')->item(0);

            if (!$body) {
                error_log('Тег body не найден в DOM');
                return $content;
            }

            $innerHtml = '';
            foreach ($body->childNodes as $child) {
                $innerHtml .= $dom->saveHTML($child);
            }

            error_log('Обработка изображений завершена успешно');
            return $innerHtml;

        } catch (Exception $e) {
            error_log('Ошибка при обработке изображений: ' . $e->getMessage());
            return $content;
        }
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
    private function upload_image_from_url($url, $post_id = 0, $alt_text = '') {
        if (empty($url)) {
            return new WP_Error('invalid_url', 'Пустой URL изображения');
        }

        if (!preg_match('/^https?:\/\//i', $url)) {
            return new WP_Error('invalid_url', 'Неверный формат URL');
        }

        error_log('Загрузка изображения из URL: ' . $url);

        $temp_file = download_url($url);

        if (is_wp_error($temp_file)) {
            error_log('Ошибка при скачивании изображения: ' . $temp_file->get_error_message());
            return $temp_file;
        }

        $filename = basename(parse_url($url, PHP_URL_PATH));

        // Если имя пустое или не содержит расширения, генерируем его
        if (empty($filename) || !preg_match('/\.(jpe?g|png|gif|webp)$/i', $filename)) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime_type = finfo_file($finfo, $temp_file);
            finfo_close($finfo);

            switch ($mime_type) {
                case 'image/jpeg':
                    $ext = '.jpg';
                    break;
                case 'image/png':
                    $ext = '.png';
                    break;
                case 'image/gif':
                    $ext = '.gif';
                    break;
                case 'image/webp':
                    $ext = '.webp';
                    break;
                default:
                    $ext = '.jpg';
            }

            $filename = 'image-' . time() . $ext;
        }

        $file_array = array(
            'name'     => sanitize_file_name($filename),
            'tmp_name' => $temp_file,
            'error'    => 0,
            'size'     => filesize($temp_file),
        );

        remove_all_filters('upload_dir');
        remove_all_filters('upload_mimes');

        if (!empty($alt_text)) {
            add_filter('wp_insert_attachment_data', function($data) use ($alt_text) {
                $data['post_title'] = $alt_text;
                return $data;
            });
        }

        $attachment_id = media_handle_sideload($file_array, $post_id);

        @unlink($temp_file);

        if (is_wp_error($attachment_id)) {
            error_log('Ошибка при загрузке изображения в медиабиблиотеку: ' . $attachment_id->get_error_message());
            return $attachment_id;
        }

        if (!empty($alt_text)) {
            $alt_text = preg_replace('/\s+-\s+.*$/', '', $alt_text);

            $alt_text = preg_replace('/<userStyle>.*?<\/userStyle>/s', '', $alt_text);

            $alt_text = strip_tags($alt_text);

            $alt_text = trim(preg_replace('/\s+/', ' ', $alt_text));

            update_post_meta($attachment_id, '_wp_attachment_image_alt', sanitize_text_field($alt_text));

            wp_update_post(array(
                'ID' => $attachment_id,
                'post_title' => sanitize_text_field($alt_text)
            ));
        }

        error_log('Изображение успешно загружено в медиабиблиотеку. Attachment ID: ' . $attachment_id);

        return $attachment_id;
    }

    /**
     * Изменение размера вложения
     *
     * @param int $attachment_id ID вложения
     * @param int $width Желаемая ширина
     * @param int $height Желаемая высота
     * @return bool|WP_Error Результат операции
     */
    private function resize_attachment_image($attachment_id, $width, $height) {
        if ($attachment_id <= 0) {
            return new WP_Error('invalid_attachment', 'Неверный ID вложения');
        }

        // Получаем путь к файлу
        $file_path = get_attached_file($attachment_id);
        if (!$file_path || !file_exists($file_path)) {
            return new WP_Error('invalid_file', 'Файл не найден');
        }

        // Получаем информацию об исходном изображении
        $image_size = @getimagesize($file_path);
        if (!$image_size) {
            return new WP_Error('invalid_image', 'Не удалось получить размеры изображения');
        }

        $orig_width = $image_size[0];
        $orig_height = $image_size[1];
        $type = $image_size[2];

        // Проверяем, что размеры имеют смысл
        if ($width <= 0 || $height <= 0) {
            return new WP_Error('invalid_dimensions', 'Неверные размеры изображения');
        }

        // Загружаем исходное изображение в зависимости от типа
        switch ($type) {
            case IMAGETYPE_JPEG:
                $source = imagecreatefromjpeg($file_path);
                break;
            case IMAGETYPE_PNG:
                $source = imagecreatefrompng($file_path);
                break;
            case IMAGETYPE_GIF:
                $source = imagecreatefromgif($file_path);
                break;
            default:
                return new WP_Error('unsupported_type', 'Неподдерживаемый тип изображения');
        }

        if (!$source) {
            return new WP_Error('create_error', 'Не удалось создать изображение из файла');
        }

        // Создаем новое изображение
        $new_image = imagecreatetruecolor($width, $height);

        // Для PNG сохраняем прозрачность
        if ($type == IMAGETYPE_PNG) {
            imagealphablending($new_image, false);
            imagesavealpha($new_image, true);
            $transparent = imagecolorallocatealpha($new_image, 255, 255, 255, 127);
            imagefilledrectangle($new_image, 0, 0, $width, $height, $transparent);
        }

        // Изменяем размер изображения
        imagecopyresampled(
            $new_image, $source,
            0, 0, 0, 0,
            $width, $height, $orig_width, $orig_height
        );

        // Сохраняем изображение
        $result = false;
        switch ($type) {
            case IMAGETYPE_JPEG:
                $result = imagejpeg($new_image, $file_path, 90);
                break;
            case IMAGETYPE_PNG:
                $result = imagepng($new_image, $file_path, 9);
                break;
            case IMAGETYPE_GIF:
                $result = imagegif($new_image, $file_path);
                break;
        }

        // Освобождаем память
        imagedestroy($source);
        imagedestroy($new_image);

        if (!$result) {
            return new WP_Error('save_error', 'Не удалось сохранить изображение');
        }

        // Очищаем кэш изображения
        clearstatcache(true, $file_path);

        // Обновляем метаданные
        $metadata = wp_get_attachment_metadata($attachment_id);
        if (is_array($metadata)) {
            $metadata['width'] = $width;
            $metadata['height'] = $height;
            wp_update_attachment_metadata($attachment_id, $metadata);
        }

        return true;
    }

    /**
     * Удаление опубликованной статьи из кеша
     */
    private function remove_published_article($article_index) {
        $articles = get_transient('wp_json_article_importer_articles');

        if ($articles && isset($articles[$article_index])) {
            unset($articles[$article_index]);

            $articles = array_values($articles);

            set_transient('wp_json_article_importer_articles', $articles, 12 * HOUR_IN_SECONDS);
        }
    }

    /**
     * Получение следующей статьи после публикации
     */
    private function get_next_article($current_index) {
        $articles = get_transient('wp_json_article_importer_articles');

        if ($articles) {
            $articles = array_values($articles);

            if (isset($articles[0])) {
                return $articles[0];
            }
        }

        return null;
    }
}