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
    /**
     * AJAX: Создание записи из JSON
     */
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

        // Очистка контента от специальных тегов, которые могут вызывать проблемы
        $content_html = isset($_POST['content_html']) ? $_POST['content_html'] : '';
        $content_html = preg_replace('/<userStyle>.*?<\/userStyle>/s', '', $content_html);

        // Используем wp_kses_post для безопасной фильтрации контента
        $content_html = wp_kses_post($content_html);

        // Получение кэшированных статей
        $articles = get_transient('wp_json_article_importer_articles');

        if (!$articles || !isset($articles[$article_index])) {
            wp_send_json_error('Статья не найдена или истек срок кэширования');
        }

        $article = $articles[$article_index];

        try {
            // Обработка контента с изображениями
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
            if (isset($article['meta']) && is_array($article['meta'])) {
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
            }

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

        } catch (Exception $e) {
            wp_send_json_error('Ошибка обработки статьи: ' . $e->getMessage());
        }
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
            // Включаем логирование
            error_log('Начало обработки изображений в контенте');

            // Создаем DOM для парсинга
            $dom = new DOMDocument();
            libxml_use_internal_errors(true); // Подавляем предупреждения XML

            // Удаляем проблемные теги
            $content = preg_replace('/<userStyle>.*?<\/userStyle>/s', '', $content);

            // Загружаем HTML
            $dom->loadHTML(mb_convert_encoding($content, 'HTML-ENTITIES', 'UTF-8'));
            libxml_clear_errors();

            $changed = false;
            $xpath = new DOMXPath($dom);
            $images = $xpath->query('//img');

            error_log('Найдено изображений для обработки: ' . $images->length);

            // Обрабатываем каждое изображение
            foreach ($images as $img) {
                $src = $img->getAttribute('src');

                // Пропускаем пустые src
                if (empty($src)) {
                    continue;
                }

                // Проверяем, является ли URL внешним
                if (preg_match('/^https?:\/\//i', $src) && !preg_match('/^https?:\/\/(' . preg_quote($_SERVER['HTTP_HOST'], '/') . ')/i', $src)) {
                    error_log('Обработка внешнего изображения: ' . $src);

                    $alt = $img->getAttribute('alt') ?: 'Imported image';

                    // Загружаем изображение и получаем ID вложения
                    $attachment_id = $this->upload_image_from_url($src, 0, $alt);

                    if (!is_wp_error($attachment_id) && $attachment_id > 0) {
                        // Получаем URL загруженного изображения
                        $attachment_url = wp_get_attachment_url($attachment_id);

                        if ($attachment_url) {
                            // Обновляем атрибуты изображения
                            $img->setAttribute('src', $attachment_url);
                            $img->setAttribute('data-attachment-id', $attachment_id);

                            // Добавляем класс WordPress
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

            // Если изменений не было, возвращаем исходный контент
            if (!$changed) {
                error_log('Изображения не были изменены, возвращаем исходный контент');
                return $content;
            }

            // Получаем обновленный HTML
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
            // В случае ошибки возвращаем исходный контент
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

        // Загружаем HTML без проблемного флага
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
    /**
     * Загрузка изображения по URL и прикрепление к посту
     */
    private function upload_image_from_url($url, $post_id = 0, $alt_text = '') {
        // Проверка URL
        if (empty($url)) {
            return new WP_Error('invalid_url', 'Пустой URL изображения');
        }

        // Добавляем проверку протокола
        if (!preg_match('/^https?:\/\//i', $url)) {
            return new WP_Error('invalid_url', 'Неверный формат URL');
        }

        // Логируем для отладки
        error_log('Загрузка изображения из URL: ' . $url);

        // Попытка скачать файл
        $temp_file = download_url($url);

        // Проверка на ошибки
        if (is_wp_error($temp_file)) {
            error_log('Ошибка при скачивании изображения: ' . $temp_file->get_error_message());
            return $temp_file;
        }

        // Получаем имя файла из URL
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
                    $ext = '.jpg'; // По умолчанию
            }

            $filename = 'image-' . time() . $ext;
        }

        // Подготовка массива для загрузки
        $file_array = array(
            'name'     => sanitize_file_name($filename),
            'tmp_name' => $temp_file,
            'error'    => 0,
            'size'     => filesize($temp_file),
        );

        // Выключаем фильтры, которые могут мешать загрузке
        remove_all_filters('upload_dir');
        remove_all_filters('upload_mimes');

        // Загрузка файла в медиабиблиотеку
        $attachment_id = media_handle_sideload($file_array, $post_id);

        // Удаляем временный файл в случае ошибки
        @unlink($temp_file);

        // Проверка ошибок после загрузки
        if (is_wp_error($attachment_id)) {
            error_log('Ошибка при загрузке изображения в медиабиблиотеку: ' . $attachment_id->get_error_message());
            return $attachment_id;
        }

        // Обновление метаданных изображения
        if (!empty($alt_text)) {
            update_post_meta($attachment_id, '_wp_attachment_image_alt', sanitize_text_field($alt_text));
        }

        error_log('Изображение успешно загружено в медиабиблиотеку. Attachment ID: ' . $attachment_id);

        return $attachment_id;
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