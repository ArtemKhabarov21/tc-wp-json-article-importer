/**
 * Модуль для работы с редактором TinyMCE
 */
(function($) {
    'use strict';

    // Создаем модуль редактора в глобальном объекте WPJAI
    WPJAI.Editor = {
        // Инициализация модуля
        init: function() {
            // Не требуется дополнительная инициализация,
            // редактор инициализируется по требованию
        },

        // Инициализация или обновление TinyMCE
        initOrUpdate: function(content) {
            if (typeof tinyMCE === 'undefined' || typeof wp === 'undefined' || !wp.editor) {
                console.error('TinyMCE или wp.editor не доступны');
                return;
            }

            // Сохраняем содержимое редактора, если он уже был инициализирован
            if (WPJAI.data.editorInitialized && tinyMCE.get('article-content-editor')) {
                WPJAI.data.lastEditorContent = tinyMCE.get('article-content-editor').getContent();
                tinyMCE.remove('#article-content-editor');
            }

            // Если контент не передан, используем сохраненное содержимое
            content = content || WPJAI.data.lastEditorContent;

            // Проверяем наличие текстового поля
            if ($('#article-content-editor').length === 0) {
                $('.article-preview').html('<textarea id="article-content-editor" style="width:100%; height:500px;"></textarea>');
            }

            // Устанавливаем содержимое в текстовое поле
            $('#article-content-editor').val(content);

            // Инициализируем TinyMCE
            wp.editor.initialize('article-content-editor', {
                tinymce: {
                    wpautop: true,
                    plugins: 'paste,lists,link,image,media,wordpress,wplink,fullscreen,textcolor,table,hr,charmap',
                    toolbar1: 'formatselect,bold,italic,underline,strikethrough,bullist,numlist,blockquote,alignleft,aligncenter,alignright,link,unlink,wp_adv',
                    toolbar2: 'fullscreen,pastetext,forecolor,backcolor,table,hr,removeformat,charmap,outdent,indent,undo,redo,wp_help',
                    contextmenu: 'link image inserttable | cell row column deletetable',
                    relative_urls: false,
                    convert_urls: false,
                    setup: function(editor) {
                        // Обработчик для перетаскивания изображений
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

                        // Добавляем контекстное меню для быстрого доступа к изображениям
                        editor.on('contextmenu', function(e) {
                            // Предотвращаем стандартное контекстное меню
                            if (e.target.nodeName === 'IMG') {
                                return; // Позволяем стандартное меню для существующих изображений
                            }

                            e.preventDefault();
                            // Показываем нашу панель выбора изображений
                            WPJAI.Images.showContextMenu(e.clientX, e.clientY, editor);
                            return false;
                        });
                    }
                },
                quicktags: true,
                mediaButtons: true
            });

            WPJAI.data.editorInitialized = true;
        },

        // Получение содержимого редактора
        getContent: function() {
            let content = '';

            if (WPJAI.data.editorInitialized && tinyMCE.get('article-content-editor')) {
                content = tinyMCE.get('article-content-editor').getContent();
            } else if ($('#article-content-editor').length) {
                content = $('#article-content-editor').val();
            }

            return content;
        },

        // Установка содержимого редактора
        setContent: function(content) {
            if (WPJAI.data.editorInitialized && tinyMCE.get('article-content-editor')) {
                tinyMCE.get('article-content-editor').setContent(content);
            } else if ($('#article-content-editor').length) {
                $('#article-content-editor').val(content);
            }
        },

        // Уничтожение редактора
        destroy: function() {
            if (WPJAI.data.editorInitialized && tinyMCE.get('article-content-editor')) {
                tinyMCE.remove('#article-content-editor');
                WPJAI.data.editorInitialized = false;
            }
        }
    };

})(jQuery);