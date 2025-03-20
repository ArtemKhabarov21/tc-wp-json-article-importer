/**
 * Publication module
 */
(function($) {
    'use strict';

    WPJAI.Publish = {
        init: function() {
            this.initEventHandlers();

            this.detectSeoPlugins();
        },

        initEventHandlers: function() {
            $('#post-type').on('change', function() {
                if ($(this).val() === 'post') {
                    $('.post-category-option').show();
                } else {
                    $('.post-category-option').hide();
                }
            });

            $('#post-status').on('change', function() {
                const status = $(this).val();

                if (status === 'future') {
                    $('.schedule-option').show();
                } else {
                    $('.schedule-option').hide();
                }
            });

            $('#publish-article').on('click', this.publishArticle);
        },

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

                        console.log('Detected SEO plugins:', WPJAI.data.seoPlugins);
                        console.log('Default content type:', WPJAI.data.defaultPostType);

                        // Set default content type
                        if (WPJAI.data.defaultPostType) {
                            $('#post-type').val(WPJAI.data.defaultPostType);
                            $('#post-type').trigger('change');
                        }
                    } else {
                        console.error('Error detecting SEO plugins:', response.data);
                    }
                },
                error: function() {
                    console.error('AJAX error while detecting SEO plugins');
                }
            });
        },

        publishArticle: function() {
            WPJAI.Articles.saveCurrentArticleData();

            const postStatus = $('#post-status').val();
            const postType = $('#post-type').val();
            const categoryId = $('#post-category').val();
            let scheduleDate = '';

            if (postStatus === 'future') {
                scheduleDate = $('#schedule-date').val();
                if (!scheduleDate) {
                    WPJAI.Utils.showNotice('error', 'Please select a date for scheduled publication.');
                    return;
                }
            }

            const title = $('#article-title').val();
            if (!title) {
                WPJAI.Utils.showNotice('error', 'Article title cannot be empty.');
                return;
            }

            let contentHtml = WPJAI.Editor.getContent();
            if (!contentHtml) {
                WPJAI.Utils.showNotice('error', 'Article content cannot be empty.');
                return;
            }

            const metaTitle = $('#meta-title').val();
            const metaDescription = $('#meta-description').val();
            const metaKeywords = $('#meta-keywords').val();

            // Get thumbnail data and dimensions
            const thumbnailData = WPJAI.Images.selectedThumbnail;
            const thumbnailWidth = $('#thumbnail-width').val();
            const thumbnailHeight = $('#thumbnail-height').val();

            contentHtml = contentHtml.replace(/<userStyle>.*?<\/userStyle>/g, '');

            // Add thumbnail processing on publication
            let uploadThumbnailPromise = Promise.resolve(0); // Default thumbnail_id = 0
            if (thumbnailData && !thumbnailData.attachment_id) {
                uploadThumbnailPromise = WPJAI.Publish.uploadAndResizeThumbnail(thumbnailData, thumbnailWidth, thumbnailHeight);
            } else if (thumbnailData && thumbnailData.attachment_id) {
                uploadThumbnailPromise = Promise.resolve(thumbnailData.attachment_id);
            }

            $('#publish-article').prop('disabled', true).text('Publishing...');
            WPJAI.Utils.showNotice('info', 'Creating publication...');

            WPJAI.Images.processContentImages(contentHtml)
                .then(function(processedContent) {
                    return uploadThumbnailPromise.then(function(thumbnailId) {
                        return { processedContent, thumbnailId };
                    });
                })
                .then(function(result) {
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
                            content_html: result.processedContent,
                            meta_title: metaTitle,
                            meta_description: metaDescription,
                            meta_keywords: metaKeywords,
                            thumbnail_id: result.thumbnailId,
                            seo_plugins: WPJAI.data.seoPlugins || []
                        },
                        success: function(response) {
                            $('#publish-article').prop('disabled', false).text('Publish');

                            if (response.success) {
                                WPJAI.Utils.showNotice('success', `Publication successfully created! <a href="${response.data.edit_url}" target="_blank">Edit</a> | <a href="${response.data.view_url}" target="_blank">View</a>`);

                                if (response.data.has_next) {
                                    WPJAI.data.articles--;
                                    $('#article-counter').text(`Article 1 of ${WPJAI.data.articles}`);

                                    WPJAI.data.lastEditorContent = '';

                                    WPJAI.Articles.displayArticle(response.data.next_article);
                                } else {
                                    $('.preview-container').hide();
                                    $('.article-navigation').hide();

                                    WPJAI.Editor.destroy();

                                    WPJAI.Utils.showNotice('success', 'All articles have been published.');
                                }
                            } else {
                                WPJAI.Utils.showNotice('error', `Error: ${response.data}`);
                            }
                        },
                        error: function(jqXHR, textStatus, errorThrown) {
                            $('#publish-article').prop('disabled', false).text('Publish');
                            console.error('AJAX error:', textStatus, errorThrown, jqXHR.responseText);
                            WPJAI.Utils.showNotice('error', 'An error occurred while creating the publication: ' + errorThrown);
                        }
                    });
                })
                .catch(function(error) {
                    $('#publish-article').prop('disabled', false).text('Publish');
                    WPJAI.Utils.showNotice('error', 'Error processing images: ' + error.message);
                });
        },

        /**
         * Upload and resize thumbnail
         *
         * @param {Object} thumbnailData - thumbnail data
         * @param {number} width - desired width
         * @param {number} height - desired height
         * @return {Promise<number>} - promise with the uploaded image ID
         */
        uploadAndResizeThumbnail: function(thumbnailData, width, height) {
            return new Promise((resolve, reject) => {
                if (!thumbnailData || !thumbnailData.url) {
                    resolve(0);
                    return;
                }

                // Проверяем наличие мета-ключевых слов перед загрузкой
                const metaKeywords = $('#meta-keywords').val();
                let altText = thumbnailData.alt || '';

                if (metaKeywords) {
                    const firstKeyword = metaKeywords.split(',')[0].trim();
                    if (firstKeyword) {
                        altText = firstKeyword;
                        // Обновляем alt-текст в объекте миниатюры
                        thumbnailData.alt = altText;
                    }
                }

                $.ajax({
                    url: wp_json_importer.ajax_url,
                    type: 'POST',
                    data: {
                        action: 'upload_and_resize_thumbnail',
                        nonce: wp_json_importer.nonce,
                        image_url: thumbnailData.url,
                        alt_text: altText,
                        width: width,
                        height: height
                    },
                    success: function(response) {
                        if (response.success) {
                            thumbnailData.attachment_id = response.data.attachment_id;
                            thumbnailData.url = response.data.url;
                            WPJAI.Images.selectedThumbnail = thumbnailData;

                            resolve(response.data.attachment_id);
                        } else {
                            reject(new Error(response.data || 'Ошибка загрузки миниатюры'));
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