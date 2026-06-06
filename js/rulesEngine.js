const RulesEngine = {
    rules: [
        {
            id: 'TRAINING_EXPIRED_ADVANCED',
            name: '培训过期会员禁止预约先锋攀岩',
            description: '安全培训证书已过期的会员不能预约高风险的先锋攀岩区域',
            severity: 'error',
            check: (context) => {
                const { memberId, zoneId } = context;
                const zone = DataStore.getZoneById(zoneId);
                if (!zone || zone.requiredLevel !== 'advanced') return { passed: true };
                
                const isExpired = DataStore.isCertificateExpired(memberId);
                if (isExpired) {
                    return {
                        passed: false,
                        message: '您的高级培训证书已过期，无法预约先锋攀岩区',
                        suggestion: '请联系教练进行培训续期后再预约'
                    };
                }
                return { passed: true };
            }
        },
        {
            id: 'MINOR_WITHOUT_GUARDIAN',
            name: '未成年人监护确认规则',
            description: '未成年人缺少监护人确认时只能预约体验区',
            severity: 'error',
            check: (context) => {
                const { memberId, zoneId } = context;
                const member = DataStore.getMemberById(memberId);
                if (!member || !member.isMinor) return { passed: true };
                
                const zone = DataStore.getZoneById(zoneId);
                if (!zone) return { passed: true };
                
                const isConfirmed = DataStore.isGuardianConfirmed(memberId);
                
                if (!isConfirmed && zone.id !== 'zone1') {
                    return {
                        passed: false,
                        message: '未成年人未获得监护人确认，仅可预约体验区',
                        suggestion: '请联系前台完成监护人确认手续'
                    };
                }
                return { passed: true };
            }
        },
        {
            id: 'EQUIPMENT_STOCK_INSUFFICIENT',
            name: '装备库存不足提示',
            description: '装备尺码库存不足时提示换码或候补',
            severity: 'warning',
            check: (context) => {
                const { equipmentId } = context;
                if (!equipmentId) return { passed: true };
                
                const equip = DataStore.getEquipmentById(equipmentId);
                if (!equip) return { passed: true };
                
                if (equip.stock <= 0) {
                    return {
                        passed: false,
                        warning: true,
                        message: `${equip.name} ${equip.size}码当前库存不足`,
                        suggestion: '建议更换其他尺码或加入候补名单'
                    };
                }
                if (equip.stock === 1) {
                    return {
                        passed: true,
                        warning: true,
                        message: `${equip.name} ${equip.size}码仅剩1件，请尽快确认`,
                        suggestion: ''
                    };
                }
                return { passed: true };
            }
        },
        {
            id: 'CHECKIN_RECORD_DELETE',
            name: '入场记录删除权限',
            description: '已入场记录不能被普通前台直接删除',
            severity: 'error',
            check: (context) => {
                const { checkinId, isAdmin } = context;
                if (isAdmin) return { passed: true };
                
                const checkin = DataStore.getCheckinById(checkinId);
                if (!checkin) return { passed: true };
                
                if (!checkin.canDelete) {
                    return {
                        passed: false,
                        message: '已入场记录禁止普通前台删除',
                        suggestion: '如需删除请联系管理员'
                    };
                }
                return { passed: true };
            }
        },
        {
            id: 'TRAINING_LEVEL_MISMATCH',
            name: '培训等级与分区匹配',
            description: '会员培训等级需达到分区要求',
            severity: 'error',
            check: (context) => {
                const { memberId, zoneId } = context;
                const zone = DataStore.getZoneById(zoneId);
                const memberLevel = DataStore.getMemberTrainingLevel(memberId);
                
                if (!zone || !memberLevel) return { passed: true };
                
                const levelOrder = { 'beginner': 1, 'intermediate': 2, 'advanced': 3 };
                const memberLevelNum = levelOrder[memberLevel] || 0;
                const requiredLevelNum = levelOrder[zone.requiredLevel] || 0;
                
                if (memberLevelNum < requiredLevelNum) {
                    const levelNames = { 'beginner': '初级', 'intermediate': '中级', 'advanced': '高级' };
                    return {
                        passed: false,
                        message: `您的培训等级（${levelNames[memberLevel]}）未达到该分区要求（${levelNames[zone.requiredLevel]}）`,
                        suggestion: '请预约适合您培训等级的分区'
                    };
                }
                return { passed: true };
            }
        },
        {
            id: 'SLOT_CAPACITY_FULL',
            name: '时段容量已满',
            description: '时段预约人数达到上限时提示候补',
            severity: 'warning',
            check: (context) => {
                const { zoneId, date, slotId } = context;
                if (DataStore.isSlotFull(zoneId, date, slotId)) {
                    return {
                        passed: false,
                        warning: true,
                        message: '该时段已约满',
                        suggestion: '可选择其他时段或加入候补名单'
                    };
                }
                return { passed: true };
            }
        }
    ],

    validateBooking(bookingContext) {
        const results = [];
        
        const relevantRules = this.rules.filter(r => 
            ['TRAINING_EXPIRED_ADVANCED', 'MINOR_WITHOUT_GUARDIAN', 
             'EQUIPMENT_STOCK_INSUFFICIENT', 'TRAINING_LEVEL_MISMATCH',
             'SLOT_CAPACITY_FULL'].includes(r.id)
        );
        
        for (const rule of relevantRules) {
            try {
                const result = rule.check(bookingContext);
                if (!result.passed || result.warning) {
                    results.push({
                        ruleId: rule.id,
                        ruleName: rule.name,
                        severity: rule.severity,
                        ...result
                    });
                }
            } catch (e) {
                console.error('Rule check error:', rule.id, e);
            }
        }
        
        return {
            passed: !results.some(r => r.severity === 'error' && !r.passed),
            hasWarnings: results.some(r => r.warning),
            results
        };
    },

    validateCheckinDelete(deleteContext) {
        const rule = this.rules.find(r => r.id === 'CHECKIN_RECORD_DELETE');
        if (!rule) return { passed: true, results: [] };
        
        const result = rule.check(deleteContext);
        return {
            passed: result.passed,
            results: [{
                ruleId: rule.id,
                ruleName: rule.name,
                severity: rule.severity,
                ...result
            }]
        };
    },

    getAllRules() {
        return this.rules.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            severity: r.severity
        }));
    },

    showRuleModal(results, callback) {
        const modal = document.getElementById('ruleModal');
        const content = document.getElementById('ruleContent');
        const title = document.getElementById('ruleTitle');
        const actionBtn = document.getElementById('ruleActionBtn');
        
        let html = '';
        let hasError = results.some(r => r.severity === 'error');
        
        title.textContent = hasError ? '❌ 预约风险校验未通过' : '⚠️ 预约提示';
        
        for (const result of results) {
            const severityClass = result.severity === 'error' ? 'error' : 'warning';
            html += `
                <div class="rule-item ${severityClass}">
                    <div class="rule-title">${result.ruleName}</div>
                    <div class="rule-desc">${result.message}</div>
                    ${result.suggestion ? `<div class="rule-desc" style="margin-top:5px;font-style:italic;">建议：${result.suggestion}</div>` : ''}
                </div>
            `;
        }
        
        content.innerHTML = html;
        
        if (hasError) {
            actionBtn.textContent = '知道了';
            actionBtn.onclick = () => {
                closeRuleModal();
                if (callback) callback(false);
            };
        } else {
            actionBtn.textContent = '继续预约';
            actionBtn.onclick = () => {
                closeRuleModal();
                if (callback) callback(true);
            };
        }
        
        modal.style.display = 'flex';
    }
};

function closeRuleModal() {
    document.getElementById('ruleModal').style.display = 'none';
}
