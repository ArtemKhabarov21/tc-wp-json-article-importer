<div class="wrap">
    <h1><?php echo esc_html(get_admin_page_title()); ?></h1>

    <div class="nav-tab-wrapper">
        <a href="#tab-articles" class="nav-tab nav-tab-active">Импорт статей</a>
        <a href="#tab-settings" class="nav-tab">Настройки</a>
    </div>

    <div class="tab-content">
        <div id="tab-articles" class="tab-pane active">
            <div class="card">
                <h2>Предварительный просмотр статей</h2>
                <p>Выберите статью из JSON для предварительного просмотра и импорта.</p>

                <div class="action-buttons">
                    <button id="fetch-json" class="button button-primary">Загрузить статьи из JSON по URL</button>

                    <form id="local-json-form" method="post" enctype="multipart/form-data" style="display: inline-block; margin-left: 10px;">
                        <input type="file" name="local_json_file" id="local-json-file" accept=".json" style="display: none;">
                        <button type="button" id="select-local-json" class="button">Выбрать локальный JSON файл</button>
                        <span id="selected-filename"></span>
                    </form>
                </div>

                <div class="article-navigation" style="display:none;">
                    <button id="prev-article" class="button">← Предыдущая</button>
                    <span id="article-counter">Статья 0 из 0</span>
                    <button id="next-article" class="button">Следующая →</button>
                </div>

                <div class="preview-container" style="display:none;">
                    <div class="preview-panel">
                        <div class="article-metadata">
                        <div class="form-group">
                            <label for="article-title"><strong>H1:</strong></label>
                            <input type="text" id="article-title" class="regular-text" style="width: 100%;">
                        </div>
                        </div>
                        <div class="article-preview">
                            <div class="no-article">
                                <p>Нажмите "Загрузить статьи из JSON" для начала работы.</p>
                            </div>
                        </div>
                        <div class="article-metadata">
                            <div class="form-group meta-fields">
                                <label for="meta-title"><strong>Meta title:</strong></label>
                                <input type="text" id="meta-title" class="regular-text" style="width: 100%;">
                            </div>
                            <div class="form-group meta-fields">
                                <label for="meta-description"><strong>Meta depiction:</strong></label>
                                <textarea id="meta-description" rows="3" style="width: 100%;"></textarea>
                            </div>
                        </div>
                    </div>

                    <div class="images-panel">
                        <h3>Изображения Unsplash</h3>

                        <div class="image-search">
                            <input type="text" id="unsplash-search" placeholder="Поиск изображений...">
                            <button id="search-unsplash" class="button button-secondary">Поиск</button>
                        </div>

                        <div class="drag-instruction">
                            Вы можете перетащить изображение в текст статьи
                        </div>

                        <div id="keywords-tags" class="keywords-tags"></div>

                        <div id="unsplash-results" class="image-results"></div>
                        <div class="selected-thumbnail">
                            <h4>Миниатюра записи</h4>
                            <div id="thumbnail-preview">
                                <p class="no-thumbnail">Миниатюра не выбрана</p>
                            </div>
                            <div id="thumbnail-settings" style="margin-top: 10px;">
                                <div class="thumbnail-dimensions">
                                    <label>
                                        <span>Ширина:</span>
                                        <input type="number" id="thumbnail-width" value="1300" min="100" max="3000" step="10">
                                    </label>
                                    <span>×</span>
                                    <label>
                                        <span>Высота:</span>
                                        <input type="number" id="thumbnail-height" value="800" min="100" max="3000" step="10">
                                    </label>
                                    <p class="description">Укажите желаемые размеры миниатюры. Изображение будет изменено при публикации.</p>
                                </div>
                            </div>
                            <button id="remove-thumbnail" class="button button-secondary" style="display:none;">Удалить миниатюру</button>
                        </div>

                        <div class="sidebar-publish-options">
                            <h3>Настройки публикации</h3>

                            <div class="option">
                                <label for="post-type">Тип контента:</label>
                                <select id="post-type">
                                    <option value="page">Page</option>
                                    <option value="post">Post</option>
                                </select>
                            </div>

                            <div class="option post-category-option" style="display:none;">
                                <label for="post-category">Категория:</label>
                                <select id="post-category">
                                    <option value="0">-- Выберите категорию --</option>
                                    <?php
                                    $categories = get_categories(array('hide_empty' => false));
                                    foreach ($categories as $category) {
                                        echo '<option value="' . esc_attr($category->term_id) . '">' . esc_html($category->name) . '</option>';
                                    }
                                    ?>
                                </select>
                            </div>

                            <div class="option">
                                <label for="post-status">Статус:</label>
                                <select id="post-status">
                                    <option value="publish">Опубликовать</option>
                                    <option value="draft">Черновик</option>
                                    <option value="future">Отложить</option>
                                </select>
                            </div>

                            <div class="option schedule-option" style="display:none;">
                                <label for="schedule-date">Дата публикации:</label>
                                <input type="datetime-local" id="schedule-date">
                            </div>

                            <button id="publish-article" class="button button-primary">Опубликовать</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div id="tab-settings" class="tab-pane">
            <div class="card">
                <h2>Настройки плагина</h2>

                <form id="settings-form">
                    <div class="form-group">
                        <label for="json-file-url">URL JSON файла:</label>
                        <input type="text" id="json-file-url" value="<?php echo esc_attr($settings['json_file_url']); ?>" class="regular-text">
                        <p class="description">Укажите URL файла JSON с данными статей.</p>
                    </div>


                    <div class="form-group">
                        <h3>Информация о API-ключах Unsplash</h3>
                        <div id="api-keys-info" class="api-keys-info">
                            <p>Загрузка информации о ключах...</p>
                        </div>
                        <p class="description">
                            Здесь отображается информация о текущем состоянии ротации API-ключей Unsplash.
                            Для каждого запроса используется следующий ключ из списка.
                        </p>
                    </div>

                    <div class="form-group">
                        <label for="default-post-type">Тип контента по умолчанию:</label>
                        <select id="default-post-type">
                            <option value="page" <?php selected( isset($settings['default_post_type']) ? $settings['default_post_type'] : 'page', 'page' ); ?>>Page</option>
                            <option value="post" <?php selected( isset($settings['default_post_type']) ? $settings['default_post_type'] : 'page', 'post' ); ?>>Post</option>
                        </select>
                        <p class="description">Выберите тип контента, который будет использоваться по умолчанию при импорте.</p>
                    </div>

                    <button type="submit" class="button button-primary">Сохранить настройки</button>
                </form>
            </div>
        </div>
    </div>
</div>

<?php
wp_enqueue_editor();
?>

<script>
    jQuery(document).ready(function($) {
        $(document).on('article_loaded', function() {
            console.log('Статья загружена и редактор инициализирован');
        });
    });
</script>

<script>
    jQuery(document).ready(function($) {
        function getApiKeysInfo() {
            $.ajax({
                url: wp_json_importer.ajax_url,
                type: 'POST',
                data: {
                    action: 'get_api_keys_info',
                    nonce: wp_json_importer.nonce
                },
                success: function(response) {
                    if (response.success) {
                        const info = response.data;
                        let html = '<div class="api-keys-status">';
                        html += '<p><strong>Всего ключей:</strong> ' + info.total_keys + '</p>';
                        html += '<p><strong>Текущий индекс:</strong> ' + info.current_index + '</p>';
                        html += '<p><strong>Следующий индекс:</strong> ' + info.next_index + '</p>';
                        html += '<p><strong>Текущий ключ:</strong> ' + info.current_key + '</p>';
                        html += '</div>';

                        $('#api-keys-info').html(html);
                    } else {
                        $('#api-keys-info').html('<p class="error">Ошибка: ' + response.data + '</p>');
                    }
                },
                error: function() {
                    $('#api-keys-info').html('<p class="error">Произошла ошибка при получении информации о ключах API.</p>');
                }
            });
        }

        $('a[href="#tab-settings"]').on('click', function() {
            getApiKeysInfo();
        });

        if ($('#tab-settings').hasClass('active')) {
            getApiKeysInfo();
        }

        $('#settings-form').on('submit', function() {
            setTimeout(function() {
                getApiKeysInfo();
            }, 1000);
        });
    });
</script>