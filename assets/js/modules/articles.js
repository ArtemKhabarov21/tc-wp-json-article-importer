/**
 * Модуль для работы со статьями
 */
(function($) {
    'use strict';

    WPJAI.Articles = {
        init: function() {
            this.initEventHandlers();
            this.initMetaFields();
        },

        initEventHandlers: function() {
            $('#fetch-json').on('click', this.fetchJsonFromUrl);

            $('#select-local-json').on('click', function() {
                $('#local-json-file').click();
            });

            $('#local-json-file').on('change', this.handleLocalJsonFile);

            $('#prev-article').on('click', this.prevArticle);
            $('#next-article').on('click', this.nextArticle);
        },

        initMetaFields: function() {
            $('#meta-title').after('<div class="char-count">0/60</div>');
            $('#meta-description').after('<div class="char-count">0/160</div>');

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

                        $('.article-navigation').show();
                        $('#article-counter').text(`Статья 1 из ${WPJAI.data.articles}`);

                        WPJAI.Articles.displayArticle(response.data.first_article);

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

        handleLocalJsonFile: function() {
            if (this.files.length > 0) {
                const fileName = this.files[0].name;
                $('#selected-filename').text(fileName);

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

                            WPJAI.Articles.displayArticle(response.data.first_article);

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

            const currentIndex = WPJAI.data.currentArticleIndex;

            if (!WPJAI.data.loadedArticles || !WPJAI.data.loadedArticles[currentIndex]) {
                return;
            }

            WPJAI.data.loadedArticles[currentIndex].content = WPJAI.Editor.getContent();

            WPJAI.data.loadedArticles[currentIndex].h1 = $('#article-title').val();

            if (!WPJAI.data.loadedArticles[currentIndex].meta) {
                WPJAI.data.loadedArticles[currentIndex].meta = {};
            }

            WPJAI.data.loadedArticles[currentIndex].meta.title = $('#meta-title').val();
            WPJAI.data.loadedArticles[currentIndex].meta.description = $('#meta-description').val();
            WPJAI.data.loadedArticles[currentIndex].meta.keywords = $('#meta-keywords').val();

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
                    if (!WPJAI.data.editorInitialized) {
                        $('.article-preview').html('<div class="no-article"><p>Загрузка статьи...</p></div>');
                    }
                },
                success: function(response) {
                    if (response.success) {
                        if (!WPJAI.data.loadedArticles) {
                            WPJAI.data.loadedArticles = [];
                        }

                        WPJAI.data.loadedArticles[index] = response.data.article;

                        WPJAI.Articles.displayArticle(response.data.article);
                        $('#article-counter').text(`Статья ${index + 1} из ${WPJAI.data.articles}`);

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

            $('#article-title').val(article.h1 || '');

            if (article.meta) {
                $('#meta-title').val(article.meta.title || '').trigger('input');
                $('#meta-description').val(article.meta.description || '').trigger('input');

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

            let content = article.content || '';

            content = content.replace(/<userStyle>.*?<\/userStyle>/g, '');

            setTimeout(function() {
                WPJAI.Editor.initOrUpdate(content);
            }, 100);

            $('#unsplash-results').empty();
            $('#keywords-tags').empty();

            if (article.thumbnail) {
                WPJAI.Images.setThumbnail(article.thumbnail);
            } else {
                WPJAI.Images.clearThumbnail();
            }

            if (article.meta && article.meta.keywords) {
                const keywords = Array.isArray(article.meta.keywords)
                    ? article.meta.keywords
                    : article.meta.keywords.split(',');

                if (keywords.length > 0) {
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

                    const firstKeyword = keywords[0].trim().replace(/,\s*$/, '');
                    if (firstKeyword) {
                        $('#unsplash-search').val(firstKeyword);
                        WPJAI.Images.searchUnsplash(firstKeyword);
                    }

                    $('.keyword-tag').on('click', function() {
                        const keyword = $(this).data('keyword');
                        $('#unsplash-search').val(keyword);
                        WPJAI.Images.searchUnsplash(keyword);
                    });
                }
            }

            $('.preview-container').show();

            if (WPJAI.data.defaultPostType && !WPJAI.data.postTypeSet) {
                $('#post-type').val(WPJAI.data.defaultPostType);
                $('#post-type').trigger('change');
                WPJAI.data.postTypeSet = true;
            }

            $(document).trigger('article_loaded', [article]);
        }
    };

})(jQuery);