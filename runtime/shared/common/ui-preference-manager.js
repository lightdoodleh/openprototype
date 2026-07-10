var UIPreferenceManager = {
    getViewConfig: function(pageKey) {
        try {
            var data = localStorage.getItem('ui_pref_views_' + pageKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },

    saveViewConfig: function(pageKey, config) {
        localStorage.setItem('ui_pref_views_' + pageKey, JSON.stringify(config));
    },

    getExportViews: function(exportKey) {
        try {
            var data = localStorage.getItem('ui_pref_export_views_' + exportKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },

    saveExportViews: function(exportKey, views) {
        localStorage.setItem('ui_pref_export_views_' + exportKey, JSON.stringify(views));
    },

    getColumnWidths: function(pageKey) {
        try {
            var data = localStorage.getItem('ui_pref_colwidths_' + pageKey);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            return {};
        }
    },

    saveColumnWidths: function(pageKey, widths) {
        localStorage.setItem('ui_pref_colwidths_' + pageKey, JSON.stringify(widths));
    },

    getColumnDisplayConfig: function(pageKey) {
        try {
            var data = localStorage.getItem('ui_pref_columns_' + pageKey);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    },

    saveColumnDisplayConfig: function(pageKey, config) {
        localStorage.setItem('ui_pref_columns_' + pageKey, JSON.stringify(config));
    },

    getFilterFieldsConfig: function(pageKey) {
        try {
            var data = localStorage.getItem('ui_pref_filterfields_' + pageKey);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    },

    saveFilterFieldsConfig: function(pageKey, config) {
        localStorage.setItem('ui_pref_filterfields_' + pageKey, JSON.stringify(config));
    },

    removeViewConfig: function(pageKey) {
        localStorage.removeItem('ui_pref_views_' + pageKey);
    },

    removeExportViews: function(exportKey) {
        localStorage.removeItem('ui_pref_export_views_' + exportKey);
    }
};
