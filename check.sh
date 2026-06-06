#!/bin/bash

set -e

echo "========================================"
echo "  攀岩馆系统 - 功能验证检查脚本"
echo "========================================"
echo ""

echo "📋 测试计划："
echo "  1. 验证培训过期会员不能预约先锋攀岩（高风险分区）"
echo "  2. 验证未成年人缺少监护确认只能预约体验区"
echo "  3. 补充监护确认后验证体验区预约成功"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔍 检查服务是否运行..."
if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 | grep -q "200"; then
    echo "⚠️  服务未运行，正在启动..."
    ./start.sh
    sleep 3
fi

echo "✅ 服务运行正常"
echo ""

echo "========================================"
echo "  开始规则引擎验证测试"
echo "========================================"
echo ""

cat > /tmp/test_rules.js << 'EOF'
const fs = require('fs');
const vm = require('vm');

const dataStoreCode = fs.readFileSync('./js/dataStore.js', 'utf8');
const rulesEngineCode = fs.readFileSync('./js/rulesEngine.js', 'utf8');

const context = {
    localStorage: {
        data: {},
        getItem(key) { return this.data[key] || null; },
        setItem(key, value) { this.data[key] = value; },
        removeItem(key) { delete this.data[key]; }
    },
    console: console,
    document: {
        getElementById: () => ({ style: { display: '' }, textContent: '', innerHTML: '' })
    }
};

vm.createContext(context);
vm.runInContext(dataStoreCode, context);
vm.runInContext(rulesEngineCode, context);

const DataStore = context.DataStore;
const RulesEngine = context.RulesEngine;

DataStore.init();

let allPassed = true;

function test(name, fn) {
    console.log(`\n🧪 ${name}`);
    try {
        fn();
        console.log(`   ✅ 通过`);
    } catch (e) {
        console.log(`   ❌ 失败: ${e.message}`);
        allPassed = false;
    }
}

console.log('\n' + '='.repeat(50));
console.log('测试1: 培训过期会员预约先锋攀岩（高风险分区）');
console.log('='.repeat(50));

test('培训过期会员(m5)预约先锋区(zone3)应该被拒绝', () => {
    const context = {
        memberId: 'm5',
        zoneId: 'zone3',
        date: '2026-06-08',
        slotId: 'slot1'
    };
    const result = RulesEngine.validateBooking(context);
    if (result.passed) {
        throw new Error('应该被拒绝但通过了');
    }
    const hasExpiredRule = result.results.some(r => r.ruleId === 'TRAINING_EXPIRED_ADVANCED');
    if (!hasExpiredRule) {
        throw new Error('应该触发培训过期规则');
    }
    console.log('   📝 触发规则:', result.results.map(r => r.ruleName).join(', '));
});

test('培训有效会员(m1)预约先锋区(zone3)应该通过', () => {
    const context = {
        memberId: 'm1',
        zoneId: 'zone3',
        date: '2026-06-08',
        slotId: 'slot1'
    };
    const result = RulesEngine.validateBooking(context);
    if (!result.passed) {
        throw new Error('应该通过但被拒绝了: ' + result.results.map(r => r.message).join(', '));
    }
});

console.log('\n' + '='.repeat(50));
console.log('测试2: 未成年人缺少监护确认只能预约体验区');
console.log('='.repeat(50));

test('未成年人(m4)未确认监护预约难度区(zone2)应该被拒绝', () => {
    const context = {
        memberId: 'm4',
        zoneId: 'zone2',
        date: '2026-06-08',
        slotId: 'slot1'
    };
    const result = RulesEngine.validateBooking(context);
    if (result.passed) {
        throw new Error('应该被拒绝但通过了');
    }
    const hasGuardianRule = result.results.some(r => r.ruleId === 'MINOR_WITHOUT_GUARDIAN');
    if (!hasGuardianRule) {
        throw new Error('应该触发未成年人监护规则');
    }
    console.log('   📝 触发规则:', result.results.map(r => r.ruleName).join(', '));
});

test('未成年人(m4)未确认监护预约体验区(zone1)应该通过', () => {
    const context = {
        memberId: 'm4',
        zoneId: 'zone1',
        date: '2026-06-08',
        slotId: 'slot1'
    };
    const result = RulesEngine.validateBooking(context);
    if (!result.passed) {
        throw new Error('应该通过但被拒绝了: ' + result.results.map(r => r.message).join(', '));
    }
});

console.log('\n' + '='.repeat(50));
console.log('测试3: 补充监护确认后验证体验区预约成功');
console.log('='.repeat(50));

test('补充监护确认后，未成年人(m4)预约难度区(zone2)应该通过', () => {
    DataStore.saveGuardianConsent({
        memberId: 'm4',
        guardianName: '赵妈妈',
        guardianPhone: '13900139004',
        confirmed: true,
        confirmDate: '2026-06-06'
    });
    
    const context = {
        memberId: 'm4',
        zoneId: 'zone2',
        date: '2026-06-08',
        slotId: 'slot1'
    };
    const result = RulesEngine.validateBooking(context);
    if (!result.passed) {
        throw new Error('应该通过但被拒绝了: ' + result.results.map(r => r.message).join(', '));
    }
    console.log('   📝 监护确认状态:', DataStore.isGuardianConfirmed('m4') ? '已确认' : '未确认');
});

console.log('\n' + '='.repeat(50));
console.log('测试4: 装备库存不足验证');
console.log('='.repeat(50));

test('预约库存为0的装备(shoe_42)应该警告', () => {
    const context = {
        memberId: 'm1',
        zoneId: 'zone1',
        date: '2026-06-08',
        slotId: 'slot1',
        equipmentId: 'shoe_42'
    };
    const result = RulesEngine.validateBooking(context);
    const hasStockWarning = result.results.some(r => r.ruleId === 'EQUIPMENT_STOCK_INSUFFICIENT');
    if (!hasStockWarning) {
        throw new Error('应该触发库存不足警告');
    }
    console.log('   📝 触发规则:', result.results.map(r => r.ruleName).join(', '));
});

console.log('\n' + '='.repeat(50));
console.log('测试5: 入场记录删除权限验证');
console.log('='.repeat(50));

test('普通前台删除已入场记录应该被拒绝', () => {
    const checkin = DataStore.createCheckin({
        memberId: 'm1',
        bookingId: 'test_booking',
        zoneId: 'zone1',
        slotId: 'slot1'
    });
    
    const validation = RulesEngine.validateCheckinDelete({
        checkinId: checkin.id,
        isAdmin: false
    });
    
    if (validation.passed) {
        throw new Error('应该被拒绝但通过了');
    }
    const hasDeleteRule = validation.results.some(r => r.ruleId === 'CHECKIN_RECORD_DELETE');
    if (!hasDeleteRule) {
        throw new Error('应该触发删除权限规则');
    }
    console.log('   📝 触发规则:', validation.results.map(r => r.ruleName).join(', '));
});

test('管理员删除已入场记录应该通过', () => {
    const checkins = DataStore.getCheckinRecords();
    const lastCheckin = checkins[checkins.length - 1];
    
    const validation = RulesEngine.validateCheckinDelete({
        checkinId: lastCheckin.id,
        isAdmin: true
    });
    
    if (!validation.passed) {
        throw new Error('应该通过但被拒绝了');
    }
});

console.log('\n' + '='.repeat(50));
console.log('测试6: 培训等级与分区匹配验证');
console.log('='.repeat(50));

test('初级会员(m2)预约先锋区(zone3)应该被拒绝', () => {
    const context = {
        memberId: 'm2',
        zoneId: 'zone3',
        date: '2026-06-08',
        slotId: 'slot1'
    };
    const result = RulesEngine.validateBooking(context);
    if (result.passed) {
        throw new Error('应该被拒绝但通过了');
    }
    const hasLevelRule = result.results.some(r => r.ruleId === 'TRAINING_LEVEL_MISMATCH');
    if (!hasLevelRule) {
        throw new Error('应该触发等级不匹配规则');
    }
    console.log('   📝 触发规则:', result.results.map(r => r.ruleName).join(', '));
});

console.log('\n' + '='.repeat(50));
console.log('📊 测试结果汇总');
console.log('='.repeat(50));

if (allPassed) {
    console.log('\n🎉 所有测试通过！系统规则引擎工作正常。');
    process.exit(0);
} else {
    console.log('\n❌ 部分测试失败，请检查系统配置。');
    process.exit(1);
}
EOF

if command -v node &> /dev/null; then
    echo "🔧 使用Node.js运行规则引擎测试..."
    node /tmp/test_rules.js
else
    echo "⚠️  Node.js未安装，跳过规则引擎自动化测试"
    echo ""
    echo "📋 手动验证步骤："
    echo ""
    echo "1. 访问 http://localhost:8080"
    echo ""
    echo "2. 【测试1：培训过期会员预约高风险分区】"
    echo "   - 在预约日历页面，选择会员「钱七 (高级证书已过期)」"
    echo "   - 点击先锋区的任意时段"
    echo "   - 选择培训等级「高级」"
    echo "   - 点击「提交预约」"
    echo "   - ✅ 预期：弹出风险校验提示，显示「培训过期会员禁止预约先锋攀岩」"
    echo ""
    echo "3. 【测试2：未成年人缺少监护确认】"
    echo "   - 选择会员「赵六 (未成年)」"
    echo "   - 点击难度区的任意时段"
    echo "   - 选择培训等级「初级」"
    echo "   - 监护人确认选择「未确认」"
    echo "   - 点击「提交预约」"
    echo "   - ✅ 预期：弹出风险校验提示，显示「未成年人缺少监护确认只能预约体验区」"
    echo ""
    echo "4. 【测试3：补充监护确认后预约体验区成功】"
    echo "   - 仍选择会员「赵六 (未成年)」"
    echo "   - 点击体验区的任意时段"
    echo "   - 选择装备尺码和培训等级"
    echo "   - 监护人确认选择「已确认」"
    echo "   - 点击「提交预约」"
    echo "   - ✅ 预期：预约成功，显示「预约成功！」"
    echo ""
    echo "5. 【测试4：装备库存不足提示】"
    echo "   - 选择任意会员"
    echo "   - 选择分区和时段"
    echo "   - 装备尺码选择「攀岩鞋 42码 (库存: 0)」"
    echo "   - 点击「提交预约」"
    echo "   - ✅ 预期：弹出库存不足警告，提示换码或候补"
    echo ""
    echo "6. 【测试5：入场记录删除权限】"
    echo "   - 先在预约日历预约并在「入场核验」页面完成入场"
    echo "   - 在入场核验页面，当前角色选择「前台」"
    echo "   - 尝试删除入场记录"
    echo "   - ✅ 预期：删除按钮禁用或弹出权限提示"
    echo "   - 当前角色选择「管理员」"
    echo "   - ✅ 预期：可以删除入场记录"
    echo ""
fi

echo ""
echo "========================================"
echo "  验证脚本执行完成"
echo "========================================"
