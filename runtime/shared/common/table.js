/**
 * CommonTable 模块
 * 通用表格管理器，处理表格渲染和分页
 */

var CommonTable = {
    config: null,
    currentPage: 1,
    pageSize: 10,
    filteredData: [],
    
    init: function(config) {
        this.config = config;
        this.currentPage = 1;
        this.pageSize = config.pageSize || 10;
        this.filteredData = [];
        this._bindPaginationEvents();
        this.renderList();
    },
    
    renderList: function() {
        var data = this.config.getData ? this.config.getData() : [];
        this.filteredData = data;
        this.currentPage = 1;
        this._renderPage();
    },
    
    _renderPage: function() {
        var tableBody = document.getElementById(this.config.tbodyId || 'tableBody');
        var paginationEl = document.getElementById(this.config.paginationId || 'pagination');
        
        if (!tableBody) return;
        
        var startIndex = (this.currentPage - 1) * this.pageSize;
        var endIndex = startIndex + this.pageSize;
        var pageData = this.filteredData.slice(startIndex, endIndex);
        
        tableBody.innerHTML = '';
        
        var colCount = this.config.columns ? this.config.columns.length : 1;
        
        if (pageData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="' + colCount + '" style="text-align: center; padding: 40px; color: var(--text-disabled);">暂无数据</td></tr>';
            if (paginationEl) paginationEl.innerHTML = '<span class="pagination-info">共 0 条</span>';
            return;
        }
        
        var self = this;
        pageData.forEach(function(item) {
            var row = document.createElement('tr');
            row.innerHTML = self._renderRowByColumns(item);
            tableBody.appendChild(row);
        });
        
        var totalPages = Math.ceil(this.filteredData.length / this.pageSize);
        if (paginationEl) {
            paginationEl.innerHTML = this._renderPagination(this.filteredData.length, totalPages);
        }
    },
    
    _renderRowByColumns: function(item) {
        var html = '';
        var self = this;
        
        if (this.config.columns) {
            this.config.columns.forEach(function(column) {
                var value = item[column.field];
                
                if (column.render) {
                    html += '<td>' + column.render(value, item) + '</td>';
                } else {
                    html += '<td>' + (value !== undefined && value !== null && value !== '' ? value : '-') + '</td>';
                }
            });
        }
        
        return html;
    },
    
    _renderPagination: function(totalCount, totalPages) {
        var html = '<span class="pagination-info">共 ' + totalCount + ' 条</span>';
        html += '<select class="pagination-select" data-action="common-table-page-size">' +
            '<option value="10"' + (this.pageSize === 10 ? ' selected' : '') + '>10条/页</option>' +
            '<option value="20"' + (this.pageSize === 20 ? ' selected' : '') + '>20条/页</option>' +
            '<option value="50"' + (this.pageSize === 50 ? ' selected' : '') + '>50条/页</option></select>';
        html += '<div class="pagination-btns">';
        html += '<button class="pagination-btn" data-action="common-table-page" data-page="' + (this.currentPage - 1) + '"' + (this.currentPage === 1 ? ' disabled' : '') + '>&lt;</button>';
        
        if (totalPages > 0) {
            if (totalPages <= 7) {
                for (var i = 1; i <= totalPages; i++) {
                    html += '<button class="pagination-btn' + (i === this.currentPage ? ' active' : '') + '" data-action="common-table-page" data-page="' + i + '">' + i + '</button>';
                }
            } else if (this.currentPage <= 4) {
                for (var i = 1; i <= 5; i++) {
                    html += '<button class="pagination-btn' + (i === this.currentPage ? ' active' : '') + '" data-action="common-table-page" data-page="' + i + '">' + i + '</button>';
                }
                html += '<span class="pagination-ellipsis">...</span>';
                html += '<button class="pagination-btn" data-action="common-table-page" data-page="' + totalPages + '">' + totalPages + '</button>';
            } else if (this.currentPage >= totalPages - 3) {
                html += '<button class="pagination-btn" data-action="common-table-page" data-page="1">1</button><span class="pagination-ellipsis">...</span>';
                for (var i = totalPages - 4; i <= totalPages; i++) {
                    html += '<button class="pagination-btn' + (i === this.currentPage ? ' active' : '') + '" data-action="common-table-page" data-page="' + i + '">' + i + '</button>';
                }
            } else {
                html += '<button class="pagination-btn" data-action="common-table-page" data-page="1">1</button><span class="pagination-ellipsis">...</span>';
                for (var i = this.currentPage - 1; i <= this.currentPage + 1; i++) {
                    html += '<button class="pagination-btn' + (i === this.currentPage ? ' active' : '') + '" data-action="common-table-page" data-page="' + i + '">' + i + '</button>';
                }
                html += '<span class="pagination-ellipsis">...</span><button class="pagination-btn" data-action="common-table-page" data-page="' + totalPages + '">' + totalPages + '</button>';
            }
        }
        
        html += '<button class="pagination-btn" data-action="common-table-page" data-page="' + (this.currentPage + 1) + '"' + (this.currentPage === totalPages || totalPages === 0 ? ' disabled' : '') + '>&gt;</button></div>';
        html += '<div class="pagination-jump"><span>跳至</span><input type="number" class="form-input" min="1" data-action="common-table-jump"><span>页</span></div>';
        
        return html;
    },
    
    setPage: function(page) {
        var totalPages = Math.ceil(this.filteredData.length / this.pageSize);
        if (page < 1 || page > totalPages) return;
        this.currentPage = page;
        this._renderPage();
    },
    
    setPageSize: function(size) {
        this.pageSize = parseInt(size);
        this.currentPage = 1;
        this._renderPage();
    },
    
    renderTable: function() {
        this._renderPage();
    },

    _bindPaginationEvents: function() {
        if (this._paginationEventsBound) return;
        this._paginationEventsBound = true;

        document.addEventListener('click', function(event) {
            var btn = event.target.closest('[data-action="common-table-page"]');
            if (!btn) return;
            CommonTable.setPage(parseInt(btn.getAttribute('data-page'), 10));
        });

        document.addEventListener('change', function(event) {
            var select = event.target.closest('[data-action="common-table-page-size"]');
            if (!select) return;
            CommonTable.setPageSize(select.value);
        });

        document.addEventListener('keydown', function(event) {
            var input = event.target.closest('[data-action="common-table-jump"]');
            if (!input || event.key !== 'Enter') return;
            CommonTable.setPage(parseInt(input.value, 10));
            input.value = '';
        });
    }
};
