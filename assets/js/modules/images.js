/**
 * Модуль для работы с изображениями Unsplash
 */
(function($) {
    'use strict';

    // Создаем модуль изображений в глобальном объекте WPJAI
    WPJAI.Images = {
        // Инициализация модуля
        init: function() {
            // Инициализация обработчиков событий
            this.initEventHandlers();
        },

        // Инициализация обработчиков событий
        initEventHandlers: function() {
            // Поиск изображений в Unsplash
            $('#search-unsplash').on('click', function() {
                const query = $('#unsplash-search').val();

                if (!query) {
                    WPJAI.Utils.showNotice('error', 'Введите поисковый запрос для изображений.');
                    return;
                }

                WPJAI.Images.searchUnsplash(query);
            });

            // Обработка нажатия Enter в поле поиска изображений
            $('#unsplash-search').on('keypress', function(e) {
                if (e.which === 13) {
                    e.preventDefault();
                    $('#search-unsplash').click();
                }
            });
        },

        // Поиск изображений на Unsplash по ключевым словам
        searchUnsplash: function(query) {
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
                        WPJAI.Images.displayResults(response.data.images, query);
                    } else {
                        $('#unsplash-results').html(`<p class="error">Ошибка: ${response.data}</p>`);
                    }
                },
                error: function() {
                    $('#search-unsplash').prop('disabled', false).text('Поиск');
                    $('#unsplash-results').html('<p class="error">Произошла ошибка при поиске изображений.</p>');
                }
            });
        },

        // Отображение результатов поиска изображений
        displayResults: function(images, query) {
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

            // Инициализируем функционал перетаскивания
            WPJAI.Images.initDraggable();
        },

        // Инициализация перетаскиваемых изображений
        initDraggable: function() {
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
        },

        // Функция для отображения контекстного меню с выбором изображений
        showContextMenu: function(x, y, editor) {
            // Удаляем предыдущее меню, если оно существует
            $('#image-context-menu').remove();

            // Получаем все доступные изображения из галереи Unsplash
            let images = [];
            $('#unsplash-results .image-item img').each(function() {
                images.push({
                    id: $(this).data('id'),
                    url: $(this).data('url'),
                    thumb: $(this).attr('src'),
                    alt: $(this).data('alt'),
                    keyword: $(this).data('keyword')
                });
            });

            // Если изображений нет, показываем сообщение
            if (images.length === 0) {
                alert('Нет доступных изображений. Выполните поиск изображений.');
                return;
            }

            // Создаем меню
            let menuHtml = '<div id="image-context-menu" style="position:fixed; z-index:1000; background:#fff; border:1px solid #ccc; box-shadow:0 2px 5px rgba(0,0,0,0.2); padding:10px; width:300px; max-height:400px; overflow-y:auto;">';
            menuHtml += '<h3>Вставить изображение</h3>';
            menuHtml += '<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:5px;">';

            // Добавляем все доступные изображения
            $.each(images, function(index, image) {
                menuHtml += `
                    <div style="cursor:pointer; border:1px solid #ddd;" class="context-menu-image" 
                        data-url="${image.url}" data-alt="${image.alt}">
                        <img src="${image.thumb}" style="width:100%; height:70px; object-fit:cover;" alt="${image.alt}">
                    </div>
                `;
            });

            menuHtml += '</div>';
            menuHtml += '<div style="margin-top:10px; text-align:right;"><button class="button button-secondary close-context-menu">Отмена</button></div>';
            menuHtml += '</div>';

            // Добавляем меню в DOM
            $('body').append(menuHtml);

            // Позиционируем меню
            $('#image-context-menu').css({
                left: x + 'px',
                top: y + 'px'
            });

            // Обработчик клика по изображению
            $('.context-menu-image').on('click', function() {
                const url = $(this).data('url');
                const alt = $(this).data('alt');

                // Вставляем изображение в редактор
                if (editor) {
                    editor.insertContent(`<img src="${url}" alt="${alt}" />`);
                }

                // Закрываем меню
                $('#image-context-menu').remove();
            });

            // Обработчик закрытия меню
            $('.close-context-menu').on('click', function() {
                $('#image-context-menu').remove();
            });

            // Закрываем меню при клике вне его
            $(document).on('click', function(e) {
                if (!$(e.target).closest('#image-context-menu').length) {
                    $('#image-context-menu').remove();
                }
            });
        },

        // Предварительная обработка изображений в контенте перед публикацией
        processContentImages: async function(content) {
            // Создаем временный DOM для обработки изображений
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;

            // Находим все изображения в контенте
            const images = tempDiv.querySelectorAll('img');

            // Обрабатываем каждое изображение
            for(let i = 0; i < images.length; i++) {
                const img = images[i];
                const src = img.getAttribute('src');

                // Проверяем, является ли это внешним URL (например, из Unsplash)
                if(src && src.startsWith('http') && !src.includes(window.location.hostname)) {
                    try {
                        // Загружаем изображение в медиабиблиотеку WordPress
                        const uploadedId = await WPJAI.Images.uploadToMediaLibrary(src, img.getAttribute('alt') || '');

                        if(uploadedId && uploadedId > 0) {
                            // Получаем URL загруженного изображения
                            const newSrc = await WPJAI.Images.getAttachmentUrl(uploadedId);

                            // Обновляем атрибуты изображения
                            img.setAttribute('src', newSrc);
                            img.setAttribute('data-id', uploadedId);
                            img.classList.add('wp-image-' + uploadedId);
                        }
                    } catch(error) {
                        console.error('Ошибка загрузки изображения:', error);
                    }
                }
            }

            // Возвращаем обновленный HTML
            return tempDiv.innerHTML;
        },

        // Загрузка изображения в медиабиблиотеку
        uploadToMediaLibrary: function(url, alt_text) {
            return new Promise((resolve, reject) => {
                $.ajax({
                    url: wp_json_importer.ajax_url,
                    type: 'POST',
                    data: {
                        action: 'upload_image_to_media_library',
                        nonce: wp_json_importer.nonce,
                        image_url: url,
                        alt_text: alt_text || ''
                    },
                    success: function(response) {
                        if(response.success) {
                            resolve(response.data.attachment_id);
                        } else {
                            reject(new Error(response.data || 'Ошибка загрузки изображения'));
                        }
                    },
                    error: function(xhr, status, error) {
                        reject(new Error(error));
                    }
                });
            });
        },

        // Получение URL вложения по ID
        getAttachmentUrl: function(attachmentId) {
            return new Promise((resolve, reject) => {
                $.ajax({
                    url: wp_json_importer.ajax_url,
                    type: 'POST',
                    data: {
                        action: 'get_attachment_url',
                        nonce: wp_json_importer.nonce,
                        attachment_id: attachmentId
                    },
                    success: function(response) {
                        if(response.success) {
                            resolve(response.data.url);
                        } else {
                            reject(new Error(response.data || 'Ошибка получения URL изображения'));
                        }
                    },
                    error: function(xhr, status, error) {
                        reject(new Error(error));
                    }
                });
            });
        }
    };

})(jQuery);