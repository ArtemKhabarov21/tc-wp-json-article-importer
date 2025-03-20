/**
 * Модуль для работы с изображениями Unsplash
 * Полная версия с исправлениями
 */
(function($) {
    'use strict';

    window.WPJAI = window.WPJAI || {};

    WPJAI.Images = {
        selectedThumbnail: null,

        init: function() {
            this.initEventHandlers();

            $('#meta-keywords').on('change', function() {
                if (WPJAI.Images.selectedThumbnail) {
                    const metaKeywords = $(this).val();
                    if (metaKeywords) {
                        const keywords = metaKeywords.split(',');
                        if (keywords.length > 0) {
                            const firstKeyword = keywords[0].trim();
                            if (firstKeyword) {
                                WPJAI.Images.selectedThumbnail.alt = firstKeyword;

                                const previewHtml = `<img src="${WPJAI.Images.selectedThumbnail.url}" alt="${firstKeyword}" />`;
                                $('#thumbnail-preview').html(previewHtml);
                            }
                        }
                    }
                }
            });
        },
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

            // Обработка клика для удаления миниатюры
            $(document).on('click', '#remove-thumbnail', function() {
                WPJAI.Images.clearThumbnail();
            });
        },

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

            $.each(images, function(index, image) {
                const isThumbnail = WPJAI.Images.selectedThumbnail &&
                    WPJAI.Images.selectedThumbnail.id === image.id;
                const thumbnailClass = isThumbnail ? 'is-thumbnail' : '';

                html += `
                    <div class="image-item ${thumbnailClass}" data-id="${image.id}">
                        <img src="${image.thumb}" alt="${image.alt || query}" class="draggable-image" 
                            draggable="true" 
                            data-id="${image.id}" 
                            data-url="${image.url}" 
                            data-full="${image.full}"
                            data-alt="${image.alt || query}"
                            data-keyword="${query}">
                        <div class="image-actions">
                            <button type="button" class="insert-image" title="Вставить в текст">
                                <span class="dashicons dashicons-editor-paste-text"></span>
                            </button>
                            <button type="button" class="set-thumbnail" title="Установить как миниатюру">
                                <span class="dashicons dashicons-format-image"></span>
                            </button>
                        </div>
                    </div>
                `;
            });

            $('#unsplash-results').html(html);

            // Инициализируем функционал перетаскивания
            WPJAI.Images.initDraggable();

            // Добавляем обработчики для действий с изображениями
            WPJAI.Images.initImageActions();
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

        // ГЛАВНОЕ ИСПРАВЛЕНИЕ: функция setThumbnail сохраняет только ссылку без загрузки
        setThumbnail: function(imageData) {

            let firstKeyword = '';
            const metaKeywords = $('#meta-keywords').val();

            if (metaKeywords) {
                const keywords = metaKeywords.split(',');
                if (keywords.length > 0) {
                    firstKeyword = keywords[0].trim();
                }
            }

            if (firstKeyword) {
                imageData.alt = firstKeyword;
            }

            WPJAI.Images.selectedThumbnail = imageData;

            // Обновляем предпросмотр миниатюры
            const previewHtml = `<img src="${imageData.url}" alt="${imageData.alt}" />`;
            $('#thumbnail-preview').html(previewHtml);

            // Показываем настройки миниатюры и кнопку удаления
            $('#thumbnail-settings').show();
            $('#remove-thumbnail').show();

            WPJAI.Utils.showNotice('success', 'Миниатюра выбрана. Она будет загружена при публикации.');
        },

        initImageActions: function() {
            $('.image-actions .insert-image').on('click', function() {
                const $img = $(this).closest('.image-item').find('img');
                const imageUrl = $img.data('url');
                const imageAlt = $img.data('alt');

                if (tinyMCE.activeEditor) {
                    tinyMCE.activeEditor.execCommand('mceInsertContent', false, `<img src="${imageUrl}" alt="${imageAlt}" />`);
                    WPJAI.Utils.showNotice('success', 'Изображение добавлено в текст');
                }
            });

            $('.image-actions .set-thumbnail').on('click', function() {
                const $item = $(this).closest('.image-item');
                const $img = $item.find('img');

                // Здесь просто создаем объект с данными без загрузки
                const imageData = {
                    id: $img.data('id'),
                    url: $img.data('url'),
                    full: $img.data('full'),
                    thumb: $img.attr('src'),
                    alt: $img.data('alt'),
                    keyword: $img.data('keyword')
                };

                WPJAI.Images.setThumbnail(imageData);

                $('.image-item').removeClass('is-thumbnail');
                $item.addClass('is-thumbnail');
            });
        },

        clearThumbnail: function() {
            WPJAI.Images.selectedThumbnail = null;

            $('#thumbnail-preview').html('<p class="no-thumbnail">Миниатюра не выбрана</p>');

            $('#remove-thumbnail').hide();
            $('#thumbnail-settings').hide();

            $('.image-item').removeClass('is-thumbnail');
        },

        showContextMenu: function(x, y, editor) {
            $('#image-context-menu').remove();

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

            if (images.length === 0) {
                alert('Нет доступных изображений. Выполните поиск изображений.');
                return;
            }

            let menuHtml = '<div id="image-context-menu" style="position:fixed; z-index:1000; background:#fff; border:1px solid #ccc; box-shadow:0 2px 5px rgba(0,0,0,0.2); padding:10px; width:300px; max-height:400px; overflow-y:auto;">';
            menuHtml += '<h3>Вставить изображение</h3>';
            menuHtml += '<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:5px;">';

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

            $('body').append(menuHtml);

            $('#image-context-menu').css({
                left: x + 'px',
                top: y + 'px'
            });

            $('.context-menu-image').on('click', function() {
                const url = $(this).data('url');
                const alt = $(this).data('alt');

                if (editor) {
                    editor.insertContent(`<img src="${url}" alt="${alt}" />`);
                }

                $('#image-context-menu').remove();
            });

            $('.close-context-menu').on('click', function() {
                $('#image-context-menu').remove();
            });

            $(document).on('click', function(e) {
                if (!$(e.target).closest('#image-context-menu').length) {
                    $('#image-context-menu').remove();
                }
            });
        },

        // В этой функции обработку нужно модифицировать для процесса публикации
        processContentImages: async function(content) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;

            const images = tempDiv.querySelectorAll('img');

            for(let i = 0; i < images.length; i++) {
                const img = images[i];
                const src = img.getAttribute('src');

                if(src && src.startsWith('http') && !src.includes(window.location.hostname)) {
                    try {
                        const uploadedId = await WPJAI.Images.uploadToMediaLibrary(src, img.getAttribute('alt') || '');

                        if(uploadedId && uploadedId > 0) {
                            const newSrc = await WPJAI.Images.getAttachmentUrl(uploadedId);

                            img.setAttribute('src', newSrc);
                            img.setAttribute('data-attachment-id', uploadedId);
                            img.classList.add('wp-image-' + uploadedId);
                        }
                    } catch(error) {
                        console.error('Ошибка загрузки изображения:', error);
                    }
                }
            }

            return tempDiv.innerHTML;
        },

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