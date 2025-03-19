/**
 * Модуль для работы с настройками плагина
 */
(function($) {
    'use strict';

    WPJAI.Settings = {
        init: function() {
            this.initEventHandlers();
        },

        initEventHandlers: function() {
            $('#settings-form').on('submit', this.saveSettings);
        },

        saveSettings: function(e) {
            e.preventDefault();

            const jsonFileUrl = $('#json-file-url').val();
            const apiKeys = $('#api-keys').val();
            const defaultPostType = $('#default-post-type').val();

            $.ajax({
                url: wp_json_importer.ajax_url,
                type: 'POST',
                data: {
                    action: 'save_plugin_settings',
                    nonce: wp_json_importer.nonce,
                    json_file_url: jsonFileUrl,
                    api_keys: apiKeys,
                    default_post_type: defaultPostType
                },
                beforeSend: function() {
                    $('#settings-form button[type="submit"]').prop('disabled', true).text('Сохранение...');
                    WPJAI.Utils.showNotice('info', 'Сохранение настроек...');
                },
                success: function(response) {
                    $('#settings-form button[type="submit"]').prop('disabled', false).text('Сохранить настройки');

                    if (response.success) {
                        WPJAI.Utils.showNotice('success', 'Настройки успешно сохранены.');

                        // Обновляем настройки в глобальных данных
                        WPJAI.data.defaultPostType = defaultPostType;
                    } else {
                        WPJAI.Utils.showNotice('error', `Ошибка: ${response.data}`);
                    }
                },
                error: function() {
                    $('#settings-form button[type="submit"]').prop('disabled', false).text('Сохранить настройки');
                    WPJAI.Utils.showNotice('error', 'Произошла ошибка при сохранении настроек.');
                }
            });
        },

        getSettings: function(callback) {
            $.ajax({
                url: wp_json_importer.ajax_url,
                type: 'POST',
                data: {
                    action: 'get_plugin_settings',
                    nonce: wp_json_importer.nonce
                },
                success: function(response) {
                    if (response.success && typeof callback === 'function') {
                        callback(response.data);
                    } else if (!response.success) {
                        WPJAI.Utils.showNotice('error', `Ошибка: ${response.data}`);
                    }
                },
                error: function() {
                    WPJAI.Utils.showNotice('error', 'Произошла ошибка при получении настроек.');
                }
            });
        },
        populateSettingsForm: function(settings) {
            if (settings) {
                $('#json-file-url').val(settings.json_file_url || '');
                $('#api-keys').val(settings.api_keys || '');

                if (settings.default_post_type) {
                    $('#default-post-type').val(settings.default_post_type);
                }
            }
        }
    };

})(jQuery);