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
            this.initMetaFields();
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

        // Инициализация полей мета-информации
        initMetaFields: function() {
            // Добавляем счетчики символов для мета-полей
            $('#meta-title').after('<div class="char-count">0/60</div>');
            $('#meta-description').after('<div class="char-count">0/160</div>');

            // Обработчики для подсчета символов
            $('#meta-title').on('input', function() {
                const length = $(this).val().length;
                const $counter = $(this).next('.char-count');
                $counter.text(length + '/60');

                if (length > 60) {
                    $counter.addClass('warning');
                } else {
                    $counter.removeClass('warning');
                }
            });

            $('#meta-description').on('input', function() {
                const length = $(this).val().length;
                const $counter = $(this).next('.char-count');
                $counter.text(length + '/160');

                if (length > 160) {
                    $counter.addClass('warning');
                } else {
                    $counter.removeClass('warning');
                }
            });
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

        prevArticle: function() {
            if (WPJAI.data.currentArticleIndex > 0) {
                WPJAI.Articles.saveCurrentArticleData();

                WPJAI.data.currentArticleIndex--;
                WPJAI.Articles.loadArticle(WPJAI.data.currentArticleIndex);
            }
        },

        nextArticle: function() {
            if (WPJAI.data.currentArticleIndex < WPJAI.data.articles - 1) {
                WPJAI.Articles.saveCurrentArticleData();

                WPJAI.data.currentArticleIndex++;
                WPJAI.Articles.loadArticle(WPJAI.data.currentArticleIndex);
            }
        },

        saveCurrentArticleData: function() {
            // Получаем текущий индекс статьи
            const currentIndex = WPJAI.data.currentArticleIndex;

            // Если статьи еще не загружены, выходим
            if (!WPJAI.data.loadedArticles || !WPJAI.data.loadedArticles[currentIndex]) {
                return;
            }

            // Сохраняем контент редактора
            WPJAI.data.loadedArticles[currentIndex].content = WPJAI.Editor.getContent();

            // Сохраняем значения мета-полей
            WPJAI.data.loadedArticles[currentIndex].h1 = $('#article-title').val();

            if (!WPJAI.data.loadedArticles[currentIndex].meta) {
                WPJAI.data.loadedArticles[currentIndex].meta = {};
            }

            WPJAI.data.loadedArticles[currentIndex].meta.title = $('#meta-title').val();
            WPJAI.data.loadedArticles[currentIndex].meta.description = $('#meta-description').val();
            WPJAI.data.loadedArticles[currentIndex].meta.keywords = $('#meta-keywords').val();

            // Сохраняем данные о выбранной миниатюре
            WPJAI.data.loadedArticles[currentIndex].thumbnail = WPJAI.Images.selectedThumbnail;
        },

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
                        // Если это первая загрузка, инициализируем массив для хранения статей
                        if (!WPJAI.data.loadedArticles) {
                            WPJAI.data.loadedArticles = [];
                        }

                        // Сохраняем статью в массив
                        WPJAI.data.loadedArticles[index] = response.data.article;

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

        displayArticle: function(article) {
            if (!article) {
                $('.article-preview').html('<div class="no-article"><p>Статья не найдена</p></div>');
                return;
            }

            // Заполняем поля мета-информации и заголовка
            $('#article-title').val(article.h1 || '');

            if (article.meta) {
                $('#meta-title').val(article.meta.title || '').trigger('input');
                $('#meta-description').val(article.meta.description || '').trigger('input');

                // Обработка ключевых слов (могут быть как строкой, так и массивом)
                let keywords = '';
                if (article.meta.keywords) {
                    if (Array.isArray(article.meta.keywords)) {
                        keywords = article.meta.keywords.join(', ');
                    } else {
                        keywords = article.meta.keywords;
                    }
                }
                $('#meta-keywords').val(keywords);
            } else {
                $('#meta-title').val('').trigger('input');
                $('#meta-description').val('').trigger('input');
                $('#meta-keywords').val('');
            }

            // Подготавливаем контент для редактора (без H1)
            let content = article.content || '';

            // Удаляем любые потенциальные теги стилей или другие нежелательные теги
            content = content.replace(/<userStyle>.*?<\/userStyle>/g, '');

            setTimeout(function() {
                WPJAI.Editor.initOrUpdate(content);
            }, 100);

            // Очищаем результаты предыдущего поиска изображений
            $('#unsplash-results').empty();
            $('#keywords-tags').empty();

            // Восстанавливаем выбранную миниатюру, если она была сохранена
            if (article.thumbnail) {
                WPJAI.Images.setThumbnail(article.thumbnail);
            } else {
                WPJAI.Images.clearThumbnail();
            }

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

            // Установка типа контента по умолчанию из настроек
            if (WPJAI.data.defaultPostType && !WPJAI.data.postTypeSet) {
                $('#post-type').val(WPJAI.data.defaultPostType);
                // Вызываем событие change для правильного отображения зависимых полей
                $('#post-type').trigger('change');
                WPJAI.data.postTypeSet = true;
            }

            // Триггерим событие для оповещения других компонентов о загрузке статьи
            $(document).trigger('article_loaded', [article]);
        }
    };

})(jQuery);