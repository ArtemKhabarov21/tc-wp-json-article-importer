/**
 * Модуль для публикации статей
 */
(function($) {
    'use strict';

    // Создаем модуль публикации в глобальном объекте WPJAI
    WPJAI.Publish = {
        // Инициализация модуля
        init: function() {
            // Инициализация обработчиков событий
            this.initEventHandlers();

            // Получение информации о доступных SEO плагинах
            this.detectSeoPlugins();
        },

        // Инициализация обработчиков событий
        initEventHandlers: function() {
            // Обработчик для выбора типа поста (пост/страница)
            $('#post-type').on('change', function() {
                if ($(this).val() === 'post') {
                    $('.post-category-option').show();
                } else {
                    $('.post-category-option').hide();
                }
            });

            // Обработка изменения статуса публикации
            $('#post-status').on('change', function() {
                const status = $(this).val();

                if (status === 'future') {
                    $('.schedule-option').show();
                } else {
                    $('.schedule-option').hide();
                }
            });

            // Публикация статьи
            $('#publish-article').on('click', this.publishArticle);
        },

        // Обнаружение установленных SEO плагинов
        detectSeoPlugins: function() {
            $.ajax({
                url: wp_json_importer.ajax_url,
                type: 'POST',
                data: {
                    action: 'detect_seo_plugins',
                    nonce: wp_json_importer.nonce
                },
                success: function(response) {
                    if (response.success) {
                        WPJAI.data.seoPlugins = response.data.plugins;
                        WPJAI.data.defaultPostType = response.data.default_post_type || 'page';

                        console.log('Обнаружены SEO плагины:', WPJAI.data.seoPlugins);
                        console.log('Тип контента по умолчанию:', WPJAI.data.defaultPostType);

                        // Устанавливаем тип контента по умолчанию
                        if (WPJAI.data.defaultPostType) {
                            $('#post-type').val(WPJAI.data.defaultPostType);
                            $('#post-type').trigger('change');
                        }
                    } else {
                        console.error('Ошибка при определении SEO плагинов:', response.data);
                    }
                },
                error: function() {
                    console.error('Ошибка AJAX при определении SEO плагинов');
                }
            });
        },

        // Функция публикации статьи
        // Добавляем ID миниатюры в AJAX-запрос в модуле publish.js
// Замените функцию publishArticle в файле assets/js/modules/publish.js

// Функция публикации статьи
        publishArticle: function() {
            // Сохраняем текущие данные статьи перед публикацией
            WPJAI.Articles.saveCurrentArticleData();

            const postStatus = $('#post-status').val();
            const postType = $('#post-type').val();
            const categoryId = $('#post-category').val();
            let scheduleDate = '';

            if (postStatus === 'future') {
                scheduleDate = $('#schedule-date').val();
                if (!scheduleDate) {
                    WPJAI.Utils.showNotice('error', 'Выберите дату для отложенной публикации.');
                    return;
                }
            }

            // Получаем заголовок статьи
            const title = $('#article-title').val();
            if (!title) {
                WPJAI.Utils.showNotice('error', 'Заголовок статьи не может быть пустым.');
                return;
            }

            // Получаем HTML-контент из редактора TinyMCE
            let contentHtml = WPJAI.Editor.getContent();
            if (!contentHtml) {
                WPJAI.Utils.showNotice('error', 'Контент статьи не может быть пустым.');
                return;
            }

            // Получаем мета-данные
            const metaTitle = $('#meta-title').val();
            const metaDescription = $('#meta-description').val();
            const metaKeywords = $('#meta-keywords').val();

            // Получаем ID миниатюры из выбранной миниатюры
            let thumbnailId = 0;
            if (WPJAI.Images.selectedThumbnail && WPJAI.Images.selectedThumbnail.attachment_id) {
                thumbnailId = WPJAI.Images.selectedThumbnail.attachment_id;
            }

            // Удаляем любые проблемные теги из контента
            contentHtml = contentHtml.replace(/<userStyle>.*?<\/userStyle>/g, '');

            $('#publish-article').prop('disabled', true).text('Публикация...');
            WPJAI.Utils.showNotice('info', 'Создание публикации...');

            // Сначала обрабатываем и загружаем все изображения
            WPJAI.Images.processContentImages(contentHtml)
                .then(function(processedContent) {
                    // После обработки изображений отправляем данные на сервер
                    $.ajax({
                        url: wp_json_importer.ajax_url,
                        type: 'POST',
                        data: {
                            action: 'create_post_from_json',
                            nonce: wp_json_importer.nonce,
                            article_index: WPJAI.data.currentArticleIndex,
                            post_title: title,
                            post_status: postStatus,
                            post_type: postType,
                            category_id: categoryId,
                            schedule_date: scheduleDate,
                            content_html: processedContent,
                            meta_title: metaTitle,
                            meta_description: metaDescription,
                            meta_keywords: metaKeywords,
                            thumbnail_id: thumbnailId, // Добавляем ID миниатюры
                            seo_plugins: WPJAI.data.seoPlugins || []
                        },
                        success: function(response) {
                            $('#publish-article').prop('disabled', false).text('Опубликовать');

                            if (response.success) {
                                WPJAI.Utils.showNotice('success', `Публикация успешно создана! <a href="${response.data.edit_url}" target="_blank">Редактировать</a> | <a href="${response.data.view_url}" target="_blank">Просмотреть</a>`);

                                // Если есть еще статьи, переходим к следующей
                                if (response.data.has_next) {
                                    // Обновляем счетчик статей
                                    WPJAI.data.articles--;
                                    $('#article-counter').text(`Статья 1 из ${WPJAI.data.articles}`);

                                    // Сбрасываем сохраненное содержимое редактора
                                    WPJAI.data.lastEditorContent = '';

                                    // Отображаем следующую статью
                                    WPJAI.Articles.displayArticle(response.data.next_article);
                                } else {
                                    // Все статьи опубликованы
                                    $('.preview-container').hide();
                                    $('.article-navigation').hide();

                                    // Удаляем редактор
                                    WPJAI.Editor.destroy();

                                    WPJAI.Utils.showNotice('success', 'Все статьи опубликованы.');
                                }
                            } else {
                                WPJAI.Utils.showNotice('error', `Ошибка: ${response.data}`);
                            }
                        },
                        error: function(jqXHR, textStatus, errorThrown) {
                            $('#publish-article').prop('disabled', false).text('Опубликовать');
                            console.error('AJAX error:', textStatus, errorThrown, jqXHR.responseText);
                            WPJAI.Utils.showNotice('error', 'Произошла ошибка при создании публикации: ' + errorThrown);
                        }
                    });
                })
                .catch(function(error) {
                    $('#publish-article').prop('disabled', false).text('Опубликовать');
                    WPJAI.Utils.showNotice('error', 'Ошибка обработки изображений: ' + error.message);
                });
        }
    };

})(jQuery);