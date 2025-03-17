/**
 * Модуль для работы с настройками плагина
 */
(function($) {
    'use strict';

    // Создаем модуль настроек в глобальном объекте WPJAI
    WPJAI.Settings = {
        // Инициализация модуля
        init: function() {
            // Инициализация обработчиков событий
            this.initEventHandlers();
        },

        // Инициализация обработчиков событий
        initEventHandlers: function() {
            // Обработчик сохранения настроек
            $('#settings-form').on('submit', this.saveSettings);
        },

        // Функция сохранения настроек
        saveSettings: function(e) {
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
                    $('#settings-form button[type="submit"]').prop('disabled', true).text('Сохранение...');
                    WPJAI.Utils.showNotice('info', 'Сохранение настроек...');
                },
                success: function(response) {
                    $('#settings-form button[type="submit"]').prop('disabled', false).text('Сохранить настройки');

                    if (response.success) {
                        WPJAI.Utils.showNotice('success', 'Настройки успешно сохранены.');
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

        // Получение текущих настроек
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

        // Установка значений в форму настроек
        populateSettingsForm: function(settings) {
            if (settings) {
                $('#json-file-url').val(settings.json_file_url || '');
                $('#api-keys').val(settings.api_keys || '');
            }
        },

        // Проверка валидности API ключа Unsplash
        validateUnsplashApiKey: function(apiKey, callback) {
            $.ajax({
                url: wp_json_importer.ajax_url,
                type: 'POST',
                data: {
                    action: 'validate_unsplash_api_key',
                    nonce: wp_json_importer.nonce,
                    api_key: apiKey
                },
                success: function(response) {
                    if (typeof callback === 'function') {
                        callback(response.success, response.data);
                    }
                },
                error: function() {
                    if (typeof callback === 'function') {
                        callback(false, 'Произошла ошибка при проверке API ключа.');
                    }
                }
            });
        }
    };

})(jQuery);