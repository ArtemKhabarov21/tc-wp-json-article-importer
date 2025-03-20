/**
 * Модуль для работы с редактором TinyMCE
 */
(function($) {
    'use strict';

    WPJAI.Editor = {
        init: function() {
        },

        initOrUpdate: function(content) {
            if (typeof tinyMCE === 'undefined' || typeof wp === 'undefined' || !wp.editor) {
                console.error('TinyMCE или wp.editor не доступны');
                return;
            }

            var isTinyMCEActive = typeof tinyMCE !== 'undefined' && tinyMCE.activeEditor &&
                tinyMCE.activeEditor.id === 'article-content-editor';

            var isQuickTagsActive = typeof QTags !== 'undefined' &&
                QTags.instances['article-content-editor'];

            if (isTinyMCEActive || isQuickTagsActive) {
                if (isTinyMCEActive) {
                    WPJAI.data.lastEditorContent = tinyMCE.get('article-content-editor').getContent();
                    tinyMCE.execCommand('mceRemoveEditor', false, 'article-content-editor');
                }

                if (isQuickTagsActive) {
                    for (var i = 0; i < QTags.instances.length; i++) {
                        if (QTags.instances[i].id === 'article-content-editor') {
                            QTags.instances.splice(i, 1);
                            break;
                        }
                    }
                }

                $('#article-content-editor').parents('.wp-editor-wrap').remove();
            }

            content = content || WPJAI.data.lastEditorContent;

            $('.article-preview').html('<textarea id="article-content-editor" style="width:100%; height:500px;"></textarea>');

            $('#article-content-editor').val(content);

            wp.editor.initialize('article-content-editor', {
                tinymce: {
                    wpautop: true,
                    plugins: 'paste,lists,link,image,media,wordpress,wplink,fullscreen,textcolor,hr,charmap',
                    toolbar1: 'formatselect,bold,italic,underline,strikethrough,bullist,numlist,blockquote,alignleft,aligncenter,alignright,link,unlink,wp_adv',
                    toolbar2: 'fullscreen,pastetext,forecolor,backcolor,hr,removeformat,charmap,outdent,indent,undo,redo,wp_help',
                    relative_urls: false,
                    convert_urls: false,
                    height: 800,
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

        getContent: function() {
            let content = '';

            if (WPJAI.data.editorInitialized && tinyMCE.get('article-content-editor')) {
                content = tinyMCE.get('article-content-editor').getContent();
            } else if ($('#article-content-editor').length) {
                content = $('#article-content-editor').val();
            }

            return content;
        },

        setContent: function(content) {
            if (WPJAI.data.editorInitialized && tinyMCE.get('article-content-editor')) {
                tinyMCE.get('article-content-editor').setContent(content);
            } else if ($('#article-content-editor').length) {
                $('#article-content-editor').val(content);
            }
        },

        destroy: function() {
            if (WPJAI.data.editorInitialized && tinyMCE.get('article-content-editor')) {
                tinyMCE.remove('#article-content-editor');
                WPJAI.data.editorInitialized = false;
            }
        }
    };

})(jQuery);