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

        // Функция публикации статьи
        // Функция публикации статьи
        publishArticle: function() {
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

            // Получаем HTML-контент из редактора TinyMCE
            let contentHtml = WPJAI.Editor.getContent();

            if (!contentHtml) {
                WPJAI.Utils.showNotice('error', 'Контент статьи не может быть пустым.');
                return;
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
                            post_status: postStatus,
                            post_type: postType,
                            category_id: categoryId,
                            schedule_date: scheduleDate,
                            content_html: processedContent
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