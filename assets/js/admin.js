// Инициализация режима редактирования
function initEditMode() {
    $('#enable-editor').on('click', function() {
        // Сохраняем оригинальное содержимое для возможного восстановления
        const originalContent = $('.content-preview').html();
        $('.article-preview').data('original-content', originalContent);

        // Делаем контент редактируемым
        $('.content-preview').attr('contenteditable', 'true').addClass('editable-content');
        $('.article-title').attr('contenteditable', 'true').addClass('editable-content');

        // Переключаем кнопки
        $('#enable-editor').hide();
        $('#back-to-preview').show();

        // Показываем сообщение пользователю
        showNotice('info', 'Режим редактирования включен. Вы можете редактировать текст и добавлять изображения в любое место.');
    });

    $('#back-to-preview').on('click', function() {
        // Спрашиваем пользователя, хочет ли он сохранить изменения
        if (confirm('Сохранить внесенные изменения?')) {
            // Сохраняем изменения
            // Они уже находятся в DOM, поэтому дополнительные действия не требуются
        } else {
            // Восстанавливаем оригинальное содержимое
            const originalContent = $('.article-preview').data('original-content');
            $('.content-preview').html(originalContent);
        }

        // Делаем контент нередактируемым
        $('.content-preview').removeAttr('contenteditable').removeClass('editable-content');
        $('.article-title').removeAttr('contenteditable').removeClass('editable-content');

        // Переключаем кнопки
        $('#enable-editor').show();
        $('#back-to-preview').hide();

        // Показываем сообщение пользователю
        showNotice('success', 'Режим редактирования отключен.');
    });
}/**
 * Скрипт админ-панели для WP JSON Article Importer
 */
jQuery(document).ready(function($) {
    // Переменные для хранения данных
    let articles = [];
    let currentArticleIndex = 0;
    let selectedImages = {};

    // Обработчики вкладок
    $('.nav-tab').on('click', function(e) {
        e.preventDefault();

        // Удаляем активный класс со всех вкладок
        $('.nav-tab').removeClass('nav-tab-active');
        $('.tab-pane').removeClass('active');

        // Добавляем активный класс текущей вкладке
        $(this).addClass('nav-tab-active');

        // Показываем соответствующую панель
        const target = $(this).attr('href');
        $(target).addClass('active');
    });

    // Обработчик формы настроек
    $('#settings-form').on('submit', function(e) {
        e.preventDefault();

        const jsonFileUrl = $('#json-file-url').val();
        const apiKeys = $('#api-keys').val();

        $.ajax({
            url: wp_json_importer.ajax_url,
            type: 'POST',
            data: {
                action: 'save_plugin_settings',
                nonce: wp_json_importer.nonce,
                json_file_url: jsonFileUrl,
                api_keys: apiKeys
            },
            beforeSend: function() {
                // Показываем индикатор загрузки
                showNotice('info', 'Сохранение настроек...');
            },
            success: function(response) {
                if (response.success) {
                    showNotice('success', 'Настройки успешно сохранены.');
                } else {
                    showNotice('error', `Ошибка: ${response.data}`);
                }
            },
            error: function() {
                showNotice('error', 'Произошла ошибка при сохранении настроек.');
            }
        });
    });

    // Загрузка статей из JSON по URL
    $('#fetch-json').on('click', function() {
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
                showNotice('info', 'Загрузка статей из JSON...');
            },
            success: function(response) {
                $('#fetch-json').prop('disabled', false).text('Загрузить статьи из JSON по URL');

                if (response.success) {
                    articles = response.data.count;
                    currentArticleIndex = 0;

                    // Показываем навигацию и первую статью
                    $('.article-navigation').show();
                    $('#article-counter').text(`Статья 1 из ${articles}`);

                    // Отображаем первую статью
                    displayArticle(response.data.first_article);

                    // Показываем блоки с изображениями и настройками публикации
                    $('.unsplash-images, .publish-options').show();

                    showNotice('success', `Загружено ${articles} статей из JSON файла.`);
                } else {
                    showNotice('error', `Ошибка: ${response.data}`);
                }
            },
            error: function() {
                $('#fetch-json').prop('disabled', false).text('Загрузить статьи из JSON по URL');
                showNotice('error', 'Произошла ошибка при загрузке JSON файла.');
            }
        });
    });

    // Кнопка выбора локального JSON файла
    $('#select-local-json').on('click', function() {
        $('#local-json-file').click();
    });

    // Обработка выбора локального файла
    $('#local-json-file').on('change', function() {
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
                    showNotice('info', 'Загрузка и обработка локального JSON файла...');
                },
                success: function(response) {
                    $('#select-local-json').prop('disabled', false).text('Выбрать локальный JSON файл');

                    if (response.success) {
                        articles = response.data.count;
                        currentArticleIndex = 0;

                        // Показываем навигацию и первую статью
                        $('.article-navigation').show();
                        $('#article-counter').text(`Статья 1 из ${articles}`);

                        // Отображаем первую статью
                        displayArticle(response.data.first_article);

                        // Показываем блоки с изображениями и настройками публикации
                        $('.unsplash-images, .publish-options').show();

                        showNotice('success', `Загружено ${articles} статей из локального JSON файла.`);
                    } else {
                        showNotice('error', `Ошибка: ${response.data}`);
                    }
                },
                error: function() {
                    $('#select-local-json').prop('disabled', false).text('Выбрать локальный JSON файл');
                    showNotice('error', 'Произошла ошибка при обработке локального JSON файла.');
                }
            });
        }
    });

    // Переключение между статьями
    $('#prev-article').on('click', function() {
        if (currentArticleIndex > 0) {
            currentArticleIndex--;
            loadArticle(currentArticleIndex);
        }
    });

    $('#next-article').on('click', function() {
        if (currentArticleIndex < articles - 1) {
            currentArticleIndex++;
            loadArticle(currentArticleIndex);
        }
    });

    // Поиск изображений в Unsplash
    $('#search-unsplash').on('click', function() {
        const query = $('#unsplash-search').val();

        if (!query) {
            showNotice('error', 'Введите поисковый запрос для изображений.');
            return;
        }

        searchUnsplashImages(query);
    });

    // Обработка нажатия Enter в поле поиска изображений
    $('#unsplash-search').on('keypress', function(e) {
        if (e.which === 13) {
            e.preventDefault();
            $('#search-unsplash').click();
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
    $('#publish-article').on('click', function() {
        const postStatus = $('#post-status').val();
        let scheduleDate = '';

        if (postStatus === 'future') {
            scheduleDate = $('#schedule-date').val();

            if (!scheduleDate) {
                showNotice('error', 'Выберите дату для отложенной публикации.');
                return;
            }
        }

        // Получаем выбранные изображения
        const imagesToPublish = [];
        $.each(selectedImages, function(index, imageData) {
            imagesToPublish.push({
                id: imageData.id,
                url: imageData.url,
                full: imageData.full,
                alt: imageData.alt || 'Изображение'
            });
        });

        // Получаем HTML-содержимое статьи с вставленными изображениями
        const contentHtml = $('.article-preview').html();

        $.ajax({
            url: wp_json_importer.ajax_url,
            type: 'POST',
            data: {
                action: 'create_post_from_json',
                nonce: wp_json_importer.nonce,
                article_index: currentArticleIndex,
                post_status: postStatus,
                schedule_date: scheduleDate,
                images: imagesToPublish,
                content: contentHtml
            },
            beforeSend: function() {
                $('#publish-article').prop('disabled', true).text('Публикация...');
                showNotice('info', 'Создание поста...');
            },
            success: function(response) {
                $('#publish-article').prop('disabled', false).text('Опубликовать');

                if (response.success) {
                    showNotice('success', `Пост успешно создан! <a href="${response.data.edit_url}" target="_blank">Редактировать</a> | <a href="${response.data.view_url}" target="_blank">Просмотреть</a>`);

                    // Если есть еще статьи, переходим к следующей
                    if (currentArticleIndex < articles - 1) {
                        currentArticleIndex++;
                        loadArticle(currentArticleIndex);
                    }
                } else {
                    showNotice('error', `Ошибка: ${response.data}`);
                }
            },
            error: function() {
                $('#publish-article').prop('disabled', false).text('Опубликовать');
                showNotice('error', 'Произошла ошибка при создании поста.');
            }
        });
    });

    // Загрузка статьи по индексу
    function loadArticle(index) {
        $.ajax({
            url: wp_json_importer.ajax_url,
            type: 'POST',
            data: {
                action: 'get_article_by_index',
                nonce: wp_json_importer.nonce,
                index: index
            },
            beforeSend: function() {
                $('.article-preview').html('<div class="no-article"><p>Загрузка статьи...</p></div>');
            },
            success: function(response) {
                if (response.success) {
                    displayArticle(response.data.article);
                    $('#article-counter').text(`Статья ${index + 1} из ${articles}`);

                    // Сбрасываем выбранные изображения
                    selectedImages = {};
                    $('#unsplash-results').empty();
                    $('#unsplash-search').val('');
                } else {
                    showNotice('error', `Ошибка: ${response.data}`);
                }
            },
            error: function() {
                showNotice('error', 'Произошла ошибка при загрузке статьи.');
            }
        });
    }

    // Отображение статьи в превью
    function displayArticle(article) {
        if (!article) {
            $('.article-preview').html('<div class="no-article"><p>Статья не найдена</p></div>');
            return;
        }

        let metaInfo = '';
        if (article.meta) {
            metaInfo = `
                <div class="meta-info">
                    <p><strong>META Title:</strong> ${article.meta.title}</p>
                    <p><strong>META Description:</strong> ${article.meta.description}</p>
                </div>
            `;
        }

        const html = `
            <h1 class="article-title">${article.h1}</h1>
            ${metaInfo}
            <div class="content-preview">
                ${article.content}
            </div>
        `;

        $('.article-preview').html(html);

        // Очищаем результаты предыдущего поиска изображений
        $('#unsplash-results').empty();
        $('#keywords-tags').empty();

        // Получаем ключевые слова для поиска изображений
        if (article.meta && article.meta.keywords && article.meta.keywords.length > 0) {
            // Отображаем ключевые слова в виде тегов
            let keywordsHtml = '<div class="keywords-title">Ключевые слова для поиска:</div>';
            keywordsHtml += '<div class="keywords-list">';

            article.meta.keywords.forEach(function(keyword) {
                const cleanKeyword = keyword.trim().replace(/,\s*$/, '');
                if (cleanKeyword) {
                    keywordsHtml += `<span class="keyword-tag" data-keyword="${cleanKeyword}">${cleanKeyword}</span>`;
                }
            });

            keywordsHtml += '</div>';
            $('#keywords-tags').html(keywordsHtml);

            // Автоматический поиск изображений по первому ключевому слову
            if (article.meta.keywords.length > 0) {
                const firstKeyword = article.meta.keywords[0].trim().replace(/,\s*$/, '');
                if (firstKeyword) {
                    $('#unsplash-search').val(firstKeyword);
                    searchUnsplashImages(firstKeyword);
                }
            }

            // Обработчик клика по тегу для поиска
            $('.keyword-tag').on('click', function() {
                const keyword = $(this).data('keyword');
                $('#unsplash-search').val(keyword);
                searchUnsplashImages(keyword);
            });
        }

        // Инициализация drag and drop
        initDropArea();

        // Показываем контейнер с превью статьи и опции публикации
        $('.preview-container, .publish-options').show();

        // Инициализируем режим редактирования
        initEditMode();
    }

    // Поиск изображений на Unsplash по ключевым словам
    function searchUnsplashImages(query) {
        $.ajax({
            url: wp_json_importer.ajax_url,
            type: 'POST',
            data: {
                action: 'fetch_unsplash_images',
                nonce: wp_json_importer.nonce,
                query: query
            },
            beforeSend: function() {
                $('#search-unsplash').prop('disabled', true).text('Поиск...');
                $('#unsplash-results').html('<p class="loading-msg">Загрузка изображений по запросу "' + query + '"...</p>');
            },
            success: function(response) {
                $('#search-unsplash').prop('disabled', false).text('Поиск');

                if (response.success) {
                    displayUnsplashResults(response.data.images, query);
                } else {
                    $('#unsplash-results').html(`<p class="error">Ошибка: ${response.data}</p>`);
                }
            },
            error: function() {
                $('#search-unsplash').prop('disabled', false).text('Поиск');
                $('#unsplash-results').html('<p class="error">Произошла ошибка при поиске изображений.</p>');
            }
        });
    }

    // Отображение результатов поиска изображений
    function displayUnsplashResults(images, query) {
        $('#unsplash-results').empty();

        if (!images || images.length === 0) {
            $('#unsplash-results').html('<p>Изображения не найдены по запросу "' + query + '"</p>');
            return;
        }

        let html = '';

        // Добавляем заголовок для группы изображений
        html += `<div class="images-group-title">Изображения по запросу "${query}":</div>`;

        $.each(images, function(index, image) {
            html += `
                <div class="image-item">
                    <img src="${image.thumb}" alt="${image.alt || query}" class="draggable-image" 
                        draggable="true" 
                        data-id="${image.id}" 
                        data-url="${image.url}" 
                        data-full="${image.full}"
                        data-alt="${image.alt || query}"
                        data-keyword="${query}">
                </div>
            `;
        });

        $('#unsplash-results').html(html);

        // Инициализируем draggable для изображений
        initDraggableImages();
    }

    // Инициализация перетаскиваемых изображений
    function initDraggableImages() {
        $('.draggable-image').on('dragstart', function(e) {
            const imageData = {
                id: $(this).data('id'),
                url: $(this).data('url'),
                full: $(this).data('full'),
                alt: $(this).data('alt'),
                keyword: $(this).data('keyword')
            };
            e.originalEvent.dataTransfer.setData('text/plain', JSON.stringify(imageData));
        });
    }

    // Инициализация области перетаскивания
    function initDropArea() {
        // Делаем область предпросмотра статьи dropzone
        const articlePreview = $('.article-preview');

        articlePreview.on('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).addClass('drag-over');
        });

        articlePreview.on('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).removeClass('drag-over');
        });

        articlePreview.on('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).removeClass('drag-over');

            const imageDataStr = e.originalEvent.dataTransfer.getData('text/plain');

            try {
                const imageData = JSON.parse(imageDataStr);

                // Получаем позицию курсора для вставки картинки
                const selection = window.getSelection();

                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const container = range.commonAncestorContainer;

                    // Если у нас есть текущее положение курсора
                    if ($.contains(articlePreview[0], container) || articlePreview[0] === container) {
                        // Создаем элемент изображения для вставки
                        const imgHtml = `<img src="${imageData.url}" alt="${imageData.alt}" class="inserted-image" data-id="${imageData.id}">`;

                        // Вставляем изображение
                        range.deleteContents();

                        // Создаем фрагмент с изображением
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = imgHtml;
                        const fragment = document.createDocumentFragment();

                        // Добавляем все дочерние узлы из tempDiv в fragment
                        while (tempDiv.firstChild) {
                            fragment.appendChild(tempDiv.firstChild);
                        }

                        range.insertNode(fragment);

                        // Добавляем изображение в выбранные
                        selectedImages[imageData.id] = {
                            id: imageData.id,
                            url: imageData.url,
                            full: imageData.full,
                            alt: imageData.alt || imageData.keyword
                        };

                        // Показываем сообщение о успешной вставке
                        showNotice('success', 'Изображение добавлено в статью');
                    } else {
                        showNotice('error', 'Установите курсор в нужное место в статье перед перетаскиванием изображения');
                    }
                } else {
                    // Если позиция курсора не найдена, добавляем в конец
                    const imgHtml = `<img src="${imageData.url}" alt="${imageData.alt || imageData.keyword}" class="inserted-image" data-id="${imageData.id}">`;
                    articlePreview.find('.content-preview').append(imgHtml);

                    // Добавляем изображение в выбранные
                    selectedImages[imageData.id] = {
                        id: imageData.id,
                        url: imageData.url,
                        full: imageData.full,
                        alt: imageData.alt || imageData.keyword
                    };

                    showNotice('success', 'Изображение добавлено в конец статьи');
                }
            } catch (error) {
                showNotice('error', 'Ошибка при обработке перетаскиваемого изображения');
                console.error('Error parsing image data:', error);
            }
        });
    }

    // Показ уведомлений
    function showNotice(type, message) {
        const noticeId = 'importer-notice-' + Math.floor(Math.random() * 1000);
        const html = `
            <div id="${noticeId}" class="notice notice-${type} is-dismissible">
                <p>${message}</p>
            </div>
        `;

        // Удаляем предыдущие уведомления
        $('.wrap > .notice').remove();

        // Добавляем новое уведомление в начало страницы
        $('.wrap').prepend(html);

        // Инициализируем возможность закрытия уведомления
        if (wp.updates && wp.updates.addDismissClick) {
            wp.updates.addDismissClick(`#${noticeId}`);
        }

        // Автоматическое скрытие уведомления через 5 секунд
        if (type !== 'error') {
            setTimeout(function() {
                $(`#${noticeId}`).fadeOut(300, function() {
                    $(this).remove();
                });
            }, 5000);
        }
    }

    // Устанавливаем текущую дату и время для поля выбора даты публикации
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5); // Добавляем 5 минут к текущему времени

    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');

    $('#schedule-date').val(`${year}-${month}-${day}T${hours}:${minutes}`);
});