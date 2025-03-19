/**
 * Основной файл JavaScript для плагина WP JSON Article Importer
 * Инициализирует все модули плагина
 */
(function($) {
    'use strict';

    window.WPJAI = window.WPJAI || {};

    WPJAI.data = {
        articles: [],
        currentArticleIndex: 0,
        editorInitialized: false,
        lastEditorContent: '',
        loadedArticles: [],
        postTypeSet: false
    };

    WPJAI.init = function() {
        $(document).ready(function() {
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

            WPJAI.initTabs();

            WPJAI.setInitialScheduleDate();
        });
    };

    WPJAI.initTabs = function() {
        $('.nav-tab').on('click', function(e) {
            e.preventDefault();

            $('.nav-tab').removeClass('nav-tab-active');
            $('.tab-pane').removeClass('active');

            $(this).addClass('nav-tab-active');

            const target = $(this).attr('href');
            $(target).addClass('active');
        });
    };

    WPJAI.setInitialScheduleDate = function() {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 5);

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