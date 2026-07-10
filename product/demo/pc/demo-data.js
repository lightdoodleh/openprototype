/**
 * Demo 产品的数据层示例：一个继承 BaseDataManager 的客户 Manager。
 * 真实产品请按 AGENTS.md §2.2 把每个实体的 Manager 放到 product/{id}/shared/data/ 下。
 */
class DemoCustomerManager extends BaseDataManager {
  constructor() {
    super('demo-customer-list');
  }

  initSampleData() {
    return [
      { id: '000001', name: '示例科技有限公司', contact: '张三', phone: '13800000001', level: 'A', status: 'active' },
      { id: '000002', name: '样板医疗器械公司', contact: '李四', phone: '13800000002', level: 'B', status: 'active' },
      { id: '000003', name: '演示健康管理集团', contact: '王五', phone: '13800000003', level: 'A', status: 'disabled' }
    ];
  }
}

const demoCustomerManager = new DemoCustomerManager();

// 状态文案集中在一处（对应红线 3：状态值常量化的思路）
const DEMO_STATUS_LABELS = { active: '启用', disabled: '停用' };
const DEMO_LEVEL_LABELS = { A: 'A 类', B: 'B 类', C: 'C 类' };
