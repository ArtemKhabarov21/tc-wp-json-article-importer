/**
 * Модуль для работы со статьями
 */
(function($) {
    'use strict';

    // Создаем модуль статей в глобальном объекте WPJAI
    WPJAI.Articles = {
        // Инициализация модуля
        init: function() {
            // Инициализация обработчиков событий
            this.initEventHandlers();
        },

        // Инициализация обработчиков событий
        initEventHandlers: function() {
            // Загрузка статей из JSON по URL
            $('#fetch-json').on('click', this.fetchJsonFromUrl);

            // Обработка выбора локального файла
            $('#select-local-json').on('click', function() {
                $('#local-json-file').click();
            });

            $('#local-json-file').on('change', this.handleLocalJsonFile);

            // Переключение между статьями
            $('#prev-article').on('click', this.prevArticle);
            $('#next-article').on('click', this.nextArticle);
        },

        // Загрузка статей из JSON по URL
        fetchJsonFromUrl: function() {
            const jsonFileUrl = $('#json-file-url').val();

            $.ajax({
                url: wp_json_importer.ajax_url,
                type: 'POST',
                data: {
                    action: 'fetch_json_articles',
                    nonce: wp_json_importer.nonce,
                    source_type: 'url',
                    json_url: jsonFileUrl
                },
                beforeSend: function() {
                    // Показываем индикатор загрузки
                    $('#fetch-json').prop('disabled', true).text('Загрузка...');
                    WPJAI.Utils.showNotice('info', 'Загрузка статей из JSON...');
                },
                success: function(response) {
                    $('#fetch-json').prop('disabled', false).text('Загрузить статьи из JSON по URL');

                    if (response.success) {
                        WPJAI.data.articles = response.data.count;
                        WPJAI.data.currentArticleIndex = 0;

                        // Показываем навигацию и первую статью
                        $('.article-navigation').show();
                        $('#article-counter').text(`Статья 1 из ${WPJAI.data.articles}`);

                        // Отображаем первую статью
                        WPJAI.Articles.displayArticle(response.data.first_article);

                        // Показываем блоки с изображениями и настройками публикации
                        $('.preview-container').show();

                        WPJAI.Utils.showNotice('success', `Загружено ${WPJAI.data.articles} статей из JSON файла.`);
                    } else {
                        WPJAI.Utils.showNotice('error', `Ошибка: ${response.data}`);
                    }
                },
                error: function() {
                    $('#fetch-json').prop('disabled', false).text('Загрузить статьи из JSON по URL');
                    WPJAI.Utils.showNotice('error', 'Произошла ошибка при загрузке JSON файла.');
                }
            });
        },

        // Обработка выбора локального файла
        handleLocalJsonFile: function() {
            if (this.files.length > 0) {
                const fileName = this.files[0].name;
                $('#selected-filename').text(fileName);

                // Создаем объект FormData для отправки файла
                const formData = new FormData();
                formData.append('action', 'fetch_json_articles');
                formData.append('nonce', wp_json_importer.nonce);
                formData.append('source_type', 'local');
                formData.append('local_json_file', this.files[0]);

                $.ajax({
                    url: wp_json_importer.ajax_url,
                    type: 'POST',
                    data: formData,
                    processData: false,
                    contentType: false,
                    beforeSend: function() {
                        $('#select-local-json').prop('disabled', true).text('Загрузка...');
                        WPJAI.Utils.showNotice('info', 'Загрузка и обработка локального JSON файла...');
                    },
                    success: function(response) {
                        $('#select-local-json').prop('disabled', false).text('Выбрать локальный JSON файл');

                        if (response.success) {
                            WPJAI.data.articles = response.data.count;
                            WPJAI.data.currentArticleIndex = 0;

                            // Показываем навигацию и первую статью
                            $('.article-navigation').show();
                            $('#article-counter').text(`Статья 1 из ${WPJAI.data.articles}`);

                            // Отображаем первую статью
                            WPJAI.Articles.displayArticle(response.data.first_article);

                            // Показываем блок с изображениями
                            $('.preview-container').show();

                            WPJAI.Utils.showNotice('success', `Загружено ${WPJAI.data.articles} статей из локального JSON файла.`);
                        } else {
                            WPJAI.Utils.showNotice('error', `Ошибка: ${response.data}`);
                        }
                    },
                    error: function() {
                        $('#select-local-json').prop('disabled', false).text('Выбрать локальный JSON файл');
                        WPJAI.Utils.showNotice('error', 'Произошла ошибка при обработке локального JSON файла.');
                    }
                });
            }
        },

        // Переключение на предыдущую статью
        prevArticle: function() {
            if (WPJAI.data.currentArticleIndex > 0) {
                // Сохраняем текущее содержимое редактора
                WPJAI.data.lastEditorContent = WPJAI.Editor.getContent();

                WPJAI.data.currentArticleIndex--;
                WPJAI.Articles.loadArticle(WPJAI.data.currentArticleIndex);
            }
        },

        // Переключение на следующую статью
        nextArticle: function() {
            if (WPJAI.data.currentArticleIndex < WPJAI.data.articles - 1) {
                // Сохраняем текущее содержимое редактора
                WPJAI.data.lastEditorContent = WPJAI.Editor.getContent();

                WPJAI.data.currentArticleIndex++;
                WPJAI.Articles.loadArticle(WPJAI.data.currentArticleIndex);
            }
        },

        // Загрузка статьи по индексу
        loadArticle: function(index) {
            $.ajax({
                url: wp_json_importer.ajax_url,
                type: 'POST',
                data: {
                    action: 'get_article_by_index',
                    nonce: wp_json_importer.nonce,
                    index: index
                },
                beforeSend: function() {
                    // Не удаляем контент редактора, просто показываем индикатор загрузки
                    if (!WPJAI.data.editorInitialized) {
                        $('.article-preview').html('<div class="no-article"><p>Загрузка статьи...</p></div>');
                    }
                },
                success: function(response) {
                    if (response.success) {
                        WPJAI.Articles.displayArticle(response.data.article);
                        $('#article-counter').text(`Статья ${index + 1} из ${WPJAI.data.articles}`);

                        // Очищаем поисковый запрос
                        $('#unsplash-search').val('');
                    } else {
                        WPJAI.Utils.showNotice('error', `Ошибка: ${response.data}`);
                    }
                },
                error: function() {
                    WPJAI.Utils.showNotice('error', 'Произошла ошибка при загрузке статьи.');
                }
            });
        },

        // Отображение статьи в превью
        displayArticle: function(article) {
            if (!article) {
                $('.article-preview').html('<div class="no-article"><p>Статья не найдена</p></div>');
                return;
            }

            // Подготавливаем контент для редактора
            let content = article.content || '';

            // Добавляем мета-информацию в начало
            if (article.meta) {
                const metaInfo = `
                    <div class="meta-info">
                        <p><strong>META Title:</strong> ${article.meta.title || ''}</p>
                        <p><strong>META Description:</strong> ${article.meta.description || ''}</p>
                    </div>
                `;
                content = `<h1>${article.h1 || 'Без заголовка'}</h1>${metaInfo}${content}`;
            } else {
                content = `<h1>${article.h1 || 'Без заголовка'}</h1>${content}`;
            }

            // Инициализируем или обновляем редактор TinyMCE
            WPJAI.Editor.initOrUpdate(content);

            // Очищаем результаты предыдущего поиска изображений
            $('#unsplash-results').empty();
            $('#keywords-tags').empty();

            // Получаем ключевые слова для поиска изображений
            if (article.meta && article.meta.keywords) {
                const keywords = Array.isArray(article.meta.keywords)
                    ? article.meta.keywords
                    : article.meta.keywords.split(',');

                if (keywords.length > 0) {
                    // Отображаем ключевые слова в виде тегов
                    let keywordsHtml = '<div class="keywords-title">Ключевые слова для поиска:</div>';
                    keywordsHtml += '<div class="keywords-list">';

                    keywords.forEach(function(keyword) {
                        const cleanKeyword = keyword.trim().replace(/,\s*$/, '');
                        if (cleanKeyword) {
                            keywordsHtml += `<span class="keyword-tag" data-keyword="${cleanKeyword}">${cleanKeyword}</span>`;
                        }
                    });

                    keywordsHtml += '</div>';
                    $('#keywords-tags').html(keywordsHtml);

                    // Автоматический поиск изображений по первому ключевому слову
                    const firstKeyword = keywords[0].trim().replace(/,\s*$/, '');
                    if (firstKeyword) {
                        $('#unsplash-search').val(firstKeyword);
                        WPJAI.Images.searchUnsplash(firstKeyword);
                    }

                    // Обработчик клика по тегу для поиска
                    $('.keyword-tag').on('click', function() {
                        const keyword = $(this).data('keyword');
                        $('#unsplash-search').val(keyword);
                        WPJAI.Images.searchUnsplash(keyword);
                    });
                }
            }

            // Показываем контейнер с превью статьи
            $('.preview-container').show();

            // Триггерим событие для оповещения других компонентов о загрузке статьи
            $(document).trigger('article_loaded', [article]);
        }
    };

})(jQuery);