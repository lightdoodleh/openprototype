/**
 * BaseDataManager - 数据管理基类
 * 
 * 提供统一的数据存储和 CRUD 操作,子类只需定义 STORAGE_KEY 即可继承所有基础功能。
 * 
 * 使用示例:
 * class MyDataManager extends BaseDataManager {
 *     constructor() {
 *         super('my_data_storage_key');
 *     }
 *     
 *     initSampleData() {
 *         return [{ id: '001', name: '示例数据' }];
 *     }
 * }
 */
class BaseDataManager {
    /**
     * 构造函数
     * @param {string} storageKey - localStorage 存储键名
     */
    constructor(storageKey) {
        if (!storageKey) {
            throw new Error('BaseDataManager: storageKey is required');
        }
        this.STORAGE_KEY = storageKey;
    }

    /**
     * 获取所有数据
     * @returns {Array} 数据数组
     */
    getData() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) {
                    return parsed;
                }
            } catch (e) {
                console.error(`Failed to parse ${this.STORAGE_KEY} data:`, e);
            }
        }
        return this.initSampleData();
    }

    /**
     * 保存所有数据
     * @param {Array} data - 要保存的数据数组
     */
    saveData(data) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    }

    /**
     * 根据 ID 获取单个数据项
     * @param {string|number} id - 数据项 ID
     * @returns {Object|undefined} 找到的数据项或 undefined
     */
    getItemById(id) {
        const data = this.getData();
        return data.find(item => item.id === id);
    }

    /**
     * 保存或更新单个数据项
     * @param {Object} item - 要保存的数据项(必须包含 id 字段)
     */
    saveItem(item) {
        const data = this.getData();
        const index = data.findIndex(i => i.id === item.id);
        if (index !== -1) {
            data[index] = item;
        } else {
            data.push(item);
        }
        this.saveData(data);
    }

    /**
     * 更新单个数据项
     * @param {string|number} id - 数据项 ID
     * @param {Object} newData - 要更新的数据
     */
    updateItem(id, newData) {
        const data = this.getData();
        const index = data.findIndex(i => i.id === id);
        if (index !== -1) {
            data[index] = { ...data[index], ...newData, updateTime: new Date().toISOString() };
            this.saveData(data);
        }
    }

    /**
     * 删除单个数据项
     * @param {string|number} id - 数据项 ID
     */
    deleteItem(id) {
        const data = this.getData();
        const filtered = data.filter(i => i.id !== id);
        this.saveData(filtered);
    }

    /**
     * 清空所有数据
     */
    clearAll() {
        localStorage.removeItem(this.STORAGE_KEY);
    }

    /**
     * 通用过滤方法 - 支持多条件搜索
     * @param {Object} criteria - 过滤条件对象,例如 { status: 'approved', year: '2026' }
     * @returns {Array} 符合条件的数据数组
     * 
     * 使用示例:
     * manager.filter({ status: 'approved', year: '2026' })
     * manager.filter({ channel: 'B2C', platform: '京东' })
     */
    filter(criteria) {
        const data = this.getData();
        if (!criteria || Object.keys(criteria).length === 0) {
            return data;
        }
        
        return data.filter(item => {
            return Object.keys(criteria).every(key => {
                const criteriaValue = criteria[key];
                const itemValue = item[key];
                
                if (criteriaValue === undefined || criteriaValue === null || criteriaValue === '') {
                    return true;
                }
                
                if (itemValue === undefined || itemValue === null) {
                    return false;
                }
                
                return itemValue === criteriaValue;
            });
        });
    }

    /**
     * 获取下一个 ID (默认实现,子类可重写)
     * @returns {string} 新的 ID
     */
    getNextId() {
        const data = this.getData();
        if (data.length === 0) return '000001';
        
        const validIds = data.map(i => parseInt(i.id, 10)).filter(id => !isNaN(id));
        if (validIds.length === 0) return '000001';
        
        const maxId = Math.max(...validIds);
        return String(maxId + 1).padStart(6, '0');
    }

    /**
     * 初始化示例数据 (子类必须实现)
     * @returns {Array} 示例数据数组
     */
    initSampleData() {
        console.warn(`BaseDataManager: initSampleData() should be implemented by subclass for ${this.STORAGE_KEY}`);
        return [];
    }
}
