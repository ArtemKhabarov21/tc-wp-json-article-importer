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
        // Инициализация или обновление TinyMCE
        initOrUpdate: function(content) {
            if (typeof tinyMCE === 'undefined' || typeof wp === 'undefined' || !wp.editor) {
                console.error('TinyMCE или wp.editor не доступны');
                return;
            }

            // Сначала проверяем, инициализирован ли уже редактор
            var isTinyMCEActive = typeof tinyMCE !== 'undefined' && tinyMCE.activeEditor &&
                tinyMCE.activeEditor.id === 'article-content-editor';

            var isQuickTagsActive = typeof QTags !== 'undefined' &&
                QTags.instances['article-content-editor'];

            // Если редактор уже существует, сохраняем его содержимое и удаляем
            if (isTinyMCEActive || isQuickTagsActive) {
                if (isTinyMCEActive) {
                    WPJAI.data.lastEditorContent = tinyMCE.get('article-content-editor').getContent();
                    tinyMCE.execCommand('mceRemoveEditor', false, 'article-content-editor');
                }

                if (isQuickTagsActive) {
                    // Удаляем экземпляр QTags
                    for (var i = 0; i < QTags.instances.length; i++) {
                        if (QTags.instances[i].id === 'article-content-editor') {
                            QTags.instances.splice(i, 1);
                            break;
                        }
                    }
                }

                // Удаляем поле ввода, чтобы избежать дублирования кнопок медиа
                $('#article-content-editor').parents('.wp-editor-wrap').remove();
            }

            // Если контент не передан, используем сохраненное содержимое
            content = content || WPJAI.data.lastEditorContent;

            // Создаем новый textarea для редактора
            $('.article-preview').html('<textarea id="article-content-editor" style="width:100%; height:500px;"></textarea>');

            // Устанавливаем содержимое в текстовое поле
            $('#article-content-editor').val(content);

            // Инициализируем TinyMCE с минимальной конфигурацией
            wp.editor.initialize('article-content-editor', {
                tinymce: {
                    wpautop: true,
                    plugins: 'paste,lists,link,image,media,wordpress,wplink,fullscreen,textcolor,hr,charmap',
                    toolbar1: 'formatselect,bold,italic,underline,strikethrough,bullist,numlist,blockquote,alignleft,aligncenter,alignright,link,unlink,wp_adv',
                    toolbar2: 'fullscreen,pastetext,forecolor,backcolor,hr,removeformat,charmap,outdent,indent,undo,redo,wp_help',
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