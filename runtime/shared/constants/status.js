// 业务分类映射 — 新项目按需自定义
const CATEGORY_MAP = {};

const BudgetStatusFlow = {
    draft: ['pending', 'deprecated'],
    pending: ['approved', 'returned', 'disapproved', 'deprecated', 'draft'],
    returned: ['pending', 'deprecated'],
    approved: ['deprecated'],
    disapproved: [],
    deprecated: []
};

const STATUS_LABELS = {
    draft: '草稿',
    submitted: '已提交',
    approving: '审批中',
    pendingApproval: '待审批',
    approved: '审批通过',
    approvalPassed: '审批通过',
    approvedLabel: '已批准',
    returned: '打回',
    returnedLabel: '已打回',
    disapproved: '审批不通过',
    deprecated: '废弃',
    deprecatedLabel: '已废弃',
    inProgress: '进行中',
    effective: '已生效',
    expired: '已过期',
    completed: '已完成',
    cancelled: '已取消',
    finished: '已结束',
    endPendingApproval: '结束待审批'
};

const ENABLED_STATUS = {
    enabled: '有效',
    disabled: '无效',
    active: '启用',
    inactive: '禁用'
};

const STATUS_STYLE_MAP = {
    enabled: 'status-active',
    disabled: 'status-inactive',
    active: 'status-active',
    inactive: 'status-inactive',
    draft: 'status-draft',
    pending: 'status-pending',
    submitted: 'status-pending',
    approving: 'status-pending',
    pendingApproval: 'status-pending',
    approved: 'status-approved',
    approvalPassed: 'status-approved',
    approvedLabel: 'status-approved',
    returned: 'status-returned',
    returnedLabel: 'status-returned',
    disapproved: 'status-deprecated',
    deprecated: 'status-deprecated',
    deprecatedLabel: 'status-deprecated',
    inProgress: 'status-approved',
    effective: 'status-approved',
    expired: 'status-deprecated',
    completed: 'status-approved',
    cancelled: 'status-deprecated',
    finished: 'status-finished',
    endPendingApproval: 'status-pending'
};
