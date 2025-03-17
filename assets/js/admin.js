/**
 * Основной файл JavaScript для плагина WP JSON Article Importer
 * Инициализирует все модули плагина
 */
(function($) {
    'use strict';

    // Создаем объект плагина
    const WPJAI = {
        // Переменные для хранения данных
        data: {
            articles: [],
            currentArticleIndex: 0,
            editorInitialized: false,
            lastEditorContent: ''
        },

        // Инициализация плагина
        init: function() {
            // Инициализируем модули только на странице плагина
            $(document).ready(function() {
                // Инициализация модулей
                WPJAI.Editor.init();
                WPJAI.Articles.init();
                WPJAI.Images.init();
                WPJAI.Publish.init();
                WPJAI.Settings.init();

                // Инициализация вкладок
                WPJAI.initTabs();

                // Установка начального значения даты публикации
                WPJAI.setInitialScheduleDate();
            });
        },

        // Инициализация вкладок
        initTabs: function() {
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
        },

        // Установка начальной даты публикации
        setInitialScheduleDate: function() {
            const now = new Date();
            now.setMinutes(now.getMinutes() + 5); // Добавляем 5 минут к текущему времени

            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');

            $('#schedule-date').val(`${year}-${month}-${day}T${hours}:${minutes}`);
        }
    };

    // Инициализация плагина
    WPJAI.init();

    // Экспортируем объект плагина в глобальную область видимости
    window.WPJAI = WPJAI;

})(jQuery);