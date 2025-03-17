/**
 * Модуль вспомогательных функций
 */
(function($) {
    'use strict';

    // Создаем модуль утилит в глобальном объекте WPJAI
    WPJAI.Utils = {
        // Показ уведомлений
        showNotice: function(type, message) {
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
        },

        // Форматирование даты
        formatDate: function(date) {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');

            return `${year}-${month}-${day}T${hours}:${minutes}`;
        },

        // Преобразование HTML-строки в DOM-элементы
        htmlToElement: function(html) {
            const template = document.createElement('template');
            template.innerHTML = html.trim();
            return template.content.firstChild;
        },

        // Преобразование строки в безопасное имя класса или ID
        sanitizeString: function(str) {
            return str.toLowerCase()
                .replace(/[^\w\s-]/g, '') // Удаляем все специальные символы
                .replace(/\s+/g, '-')    // Заменяем пробелы на дефисы
                .replace(/-+/g, '-');    // Заменяем множественные дефисы на один
        },

        // Получение параметра из URL
        getUrlParameter: function(name) {
            name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
            const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
            const results = regex.exec(location.search);
            return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
        },

        // Проверка является ли строка JSON
        isJson: function(str) {
            try {
                JSON.parse(str);
                return true;
            } catch (e) {
                return false;
            }
        },

        // Определение типа файла по расширению или MIME-типу
        getFileType: function(filename) {
            const extension = filename.split('.').pop().toLowerCase();
            const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];
            const documentExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];

            if (imageExtensions.includes(extension)) {
                return 'image';
            } else if (documentExtensions.includes(extension)) {
                return 'document';
            } else {
                return 'other';
            }
        }
    };

})(jQuery);