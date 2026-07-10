var DataBridge = {
    setData: function(key, value) {
        localStorage.setItem('databridge_' + key, JSON.stringify(value));
    },

    getData: function(key, removeAfterRead) {
        try {
            var data = localStorage.getItem('databridge_' + key);
            if (data === null) return null;
            var parsed = JSON.parse(data);
            if (removeAfterRead) {
                localStorage.removeItem('databridge_' + key);
            }
            return parsed;
        } catch (e) {
            return null;
        }
    },

    removeData: function(key) {
        localStorage.removeItem('databridge_' + key);
    },

    setSessionData: function(key, value) {
        sessionStorage.setItem(key, JSON.stringify(value));
    },

    getSessionData: function(key, removeAfterRead) {
        try {
            var data = sessionStorage.getItem(key);
            if (data === null) return null;
            var parsed = JSON.parse(data);
            if (removeAfterRead) {
                sessionStorage.removeItem(key);
            }
            return parsed;
        } catch (e) {
            return null;
        }
    },

    removeSessionData: function(key) {
        sessionStorage.removeItem('databridge_session_' + key);
    }
};
