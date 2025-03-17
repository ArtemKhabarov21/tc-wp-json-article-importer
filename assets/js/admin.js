/**
 * Основной файл JavaScript для плагина WP JSON Article Importer
 * Инициализирует все модули плагина
 */
(function($) {
    'use strict';

    // Создаем глобальный объект плагина, если он еще не существует
    window.WPJAI = window.WPJAI || {};

    // Создаем объект для хранения данных плагина
    WPJAI.data = {
        articles: [],
        currentArticleIndex: 0,
        editorInitialized: false,
        lastEditorContent: '',
        loadedArticles: [],
        postTypeSet: false
    };

    // Инициализация плагина
    WPJAI.init = function() {
        // Инициализируем модули только на странице плагина
        $(document).ready(function() {
            // Инициализация модулей
            if (typeof WPJAI.Editor !== 'undefined' && WPJAI.Editor.init) {
                WPJAI.Editor.init();
            }

            if (typeof WPJAI.Articles !== 'undefined' && WPJAI.Articles.init) {
                WPJAI.Articles.init();
            }

            if (typeof WPJAI.Images !== 'undefined' && WPJAI.Images.init) {
                WPJAI.Images.init();
            }

            if (typeof WPJAI.Publish !== 'undefined' && WPJAI.Publish.init) {
                WPJAI.Publish.init();
            }

            if (typeof WPJAI.Settings !== 'undefined' && WPJAI.Settings.init) {
                WPJAI.Settings.init();
            }

            // Инициализация вкладок
            WPJAI.initTabs();

            // Установка начального значения даты публикации
            WPJAI.setInitialScheduleDate();
        });
    };

    // Инициализация вкладок
    WPJAI.initTabs = function() {
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
    };

    // Установка начальной даты публикации
    WPJAI.setInitialScheduleDate = function() {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 5); // Добавляем 5 минут к текущему времени

        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');

        $('#schedule-date').val(`${year}-${month}-${day}T${hours}:${minutes}`);
    };

    // Инициализация плагина
    WPJAI.init();

})(jQuery);