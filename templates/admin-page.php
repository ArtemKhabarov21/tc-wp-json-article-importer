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
                        <div class="article-preview">
                            <div class="no-article">
                                <p>Нажмите "Загрузить статьи из JSON" для начала работы.</p>
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

                        <div class="sidebar-publish-options">
                            <h3>Настройки публикации</h3>

                            <div class="option">
                                <label for="post-type">Тип контента:</label>
                                <select id="post-type">
                                    <option value="post">Запись</option>
                                    <option value="page">Страница</option>
                                </select>
                            </div>

                            <div class="option post-category-option">
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
                        <label for="api-keys">API ключи Unsplash (через запятую):</label>
                        <textarea id="api-keys" rows="3" class="large-text"><?php echo esc_textarea($settings['api_keys']); ?></textarea>
                        <p class="description">Укажите один или несколько API ключей Unsplash через запятую. Ключи будут использоваться по очереди.</p>
                    </div>

                    <button type="submit" class="button button-primary">Сохранить настройки</button>
                </form>
            </div>
        </div>
    </div>
</div>

<!-- Подключаем TinyMCE для редактирования контента -->
<?php
// Подключаем редактор WordPress
wp_enqueue_editor();
?>

<script>
    jQuery(document).ready(function($) {
        // Инициализация TinyMCE после загрузки статьи
        function initTinyMCE() {
            if (typeof tinyMCE !== 'undefined') {
                // Проверяем существует ли уже экземпляр редактора
                if (tinyMCE.get('article-content-editor')) {
                    tinyMCE.remove('#article-content-editor');
                }

                // Добавляем скрытый textarea для инициализации TinyMCE
                if ($('#article-content-editor').length === 0) {
                    $('.article-preview').append('<textarea id="article-content-editor" style="width:100%; height:500px;"></textarea>');
                }

                // Инициализируем TinyMCE с нужными настройками
                wp.editor.initialize('article-content-editor', {
                    tinymce: {
                        wpautop: true,
                        plugins: 'paste,lists,link,image,media,wordpress,wplink,fullscreen',
                        toolbar1: 'formatselect,bold,italic,bullist,numlist,blockquote,alignleft,aligncenter,alignright,link,wp_adv',
                        toolbar2: 'fullscreen,pastetext,pasteword,removeformat,charmap,outdent,indent,undo,redo,wp_help',
                        setup: function(editor) {
                            // Добавляем обработчик для перетаскивания изображений
                            editor.on('drop', function(e) {
                                var dataTransfer = e.dataTransfer;
                                if (dataTransfer && dataTransfer.getData('text')) {
                                    try {
                                        var imageData = JSON.parse(dataTransfer.getData('text'));
                                        if (imageData.url) {
                                            e.preventDefault();
                                            editor.insertContent('<img src="' + imageData.url + '" alt="' + (imageData.alt || '') + '" />');
                                        }
                                    } catch (ex) {
                                        // Это не JSON данные, пропускаем
                                    }
                                }
                            });
                        }
                    },
                    quicktags: true,
                    mediaButtons: true
                });
            }
        }

        // После успешной загрузки статьи инициализируем TinyMCE
        $(document).on('article_loaded', function() {
            initTinyMCE();
        });
    });
</script>