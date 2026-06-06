const App = {
    currentWeekOffset: 0,
    selectedDate: null,
    selectedZoneId: null,
    selectedSlotId: null,

    init() {
        DataStore.init();
        this.bindNavEvents();
        this.initMemberSelectors();
        this.renderCalendar();
        this.renderZones();
        this.renderWaitlist();
        this.renderCheckinSelects();
        this.renderDataOverview();
        this.bindEvents();
    },

    bindNavEvents() {
        const navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const page = btn.dataset.page;
                document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                document.getElementById('page-' + page).classList.add('active');
                
                if (page === 'waitlist') this.renderWaitlist();
                if (page === 'checkin') this.renderCheckinSelects();
                if (page === 'zones') this.renderZones();
                if (page === 'datarestore') this.renderDataOverview();
            });
        });
    },

    initMemberSelectors() {
        const members = DataStore.getMembers();
        const selects = ['currentMember', 'qualMember', 'trainMember', 'checkinBooking'];
        
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;
            if (selectId !== 'checkinBooking') {
                members.forEach(m => {
                    const option = document.createElement('option');
                    option.value = m.id;
                    option.textContent = `${m.name}${m.isMinor ? ' (未成年)' : ''}`;
                    select.appendChild(option);
                });
            }
        });

        document.getElementById('qualMember').addEventListener('change', (e) => {
            this.renderQualificationCard(e.target.value);
        });

        document.getElementById('currentMember').addEventListener('change', (e) => {
            const member = DataStore.getMemberById(e.target.value);
            const guardianRow = document.getElementById('guardianRow');
            if (member && member.isMinor) {
                guardianRow.style.display = 'flex';
            } else {
                guardianRow.style.display = 'none';
            }
        });
    },

    renderCalendar() {
        const grid = document.getElementById('calendarGrid');
        const weekRange = document.getElementById('currentWeekRange');
        
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay() + 1 + (this.currentWeekOffset * 7));
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        weekRange.textContent = `${this.formatDate(startOfWeek)} - ${this.formatDate(endOfWeek)}`;
        
        const zones = DataStore.getZones();
        const slots = DataStore.getTimeSlots();
        
        let html = '';
        const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
        
        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(startOfWeek);
            currentDate.setDate(startOfWeek.getDate() + i);
            const dateStr = this.formatDateISO(currentDate);
            const isToday = this.formatDateISO(today) === dateStr;
            
            html += `<div class="calendar-day ${isToday ? 'today' : ''}">
                <div class="calendar-day-header">
                    ${dayNames[i]}<br>
                    <small>${this.formatDateShort(currentDate)}</small>
                </div>`;
            
            zones.forEach(zone => {
                slots.forEach(slot => {
                    const remaining = DataStore.getSlotCapacity(zone.id, dateStr, slot.id);
                    const isFull = remaining <= 0;
                    html += `<div class="time-slot ${isFull ? 'full' : ''}" 
                        data-zone="${zone.id}" 
                        data-date="${dateStr}" 
                        data-slot="${slot.id}">
                        <div class="zone-name">${zone.name}</div>
                        <div>${slot.time}</div>
                        <div class="capacity">剩余: ${remaining}/${zone.capacity}</div>
                    </div>`;
                });
            });
            
            html += '</div>';
        }
        
        grid.innerHTML = html;
        
        grid.querySelectorAll('.time-slot').forEach(slot => {
            slot.addEventListener('click', () => {
                if (slot.classList.contains('full')) {
                    this.showWaitlistOption(slot.dataset.zone, slot.dataset.date, slot.dataset.slot);
                } else {
                    this.showBookingForm(slot.dataset.zone, slot.dataset.date, slot.dataset.slot);
                }
            });
        });
    },

    showBookingForm(zoneId, date, slotId) {
        const memberId = document.getElementById('currentMember').value;
        if (!memberId) {
            this.showResult('bookingResult', '请先选择会员', 'error');
            return;
        }
        
        this.selectedZoneId = zoneId;
        this.selectedDate = date;
        this.selectedSlotId = slotId;
        
        const zone = DataStore.getZoneById(zoneId);
        const slot = DataStore.getTimeSlotById(slotId);
        
        document.getElementById('bookingZone').textContent = zone.name;
        document.getElementById('bookingTime').textContent = `${date} ${slot.time}`;
        
        const equipSelect = document.getElementById('equipmentSize');
        equipSelect.innerHTML = '<option value="">请选择</option>';
        DataStore.getEquipment().forEach(e => {
            const option = document.createElement('option');
            option.value = e.id;
            option.textContent = `${e.name} ${e.size}码 (库存: ${e.stock})`;
            if (e.stock <= 0) option.disabled = true;
            equipSelect.appendChild(option);
        });
        
        document.getElementById('bookingForm').style.display = 'block';
        document.getElementById('bookingResult').style.display = 'none';
    },

    showWaitlistOption(zoneId, date, slotId) {
        const memberId = document.getElementById('currentMember').value;
        if (!memberId) {
            this.showResult('bookingResult', '请先选择会员', 'error');
            return;
        }
        
        if (confirm('该时段已满，是否加入候补名单？')) {
            const item = DataStore.addToWaitlist({
                memberId,
                zoneId,
                date,
                slotId
            });
            this.renderCalendar();
            this.showResult('bookingResult', `已加入候补名单，当前排位第${item.position}位`, 'success');
        }
    },

    renderZones() {
        const list = document.getElementById('zonesList');
        const zones = DataStore.getZones();
        
        let html = '';
        zones.forEach(zone => {
            const riskNames = { 'low': '低风险', 'medium': '中风险', 'high': '高风险' };
            const levelNames = { 'beginner': '初级', 'intermediate': '中级', 'advanced': '高级' };
            
            html += `<div class="zone-card">
                <h3>${zone.name}</h3>
                <span class="zone-risk ${zone.riskLevel}">${riskNames[zone.riskLevel]}</span>
                <p>${zone.description}</p>
                <p>要求培训等级：<strong>${levelNames[zone.requiredLevel]}</strong></p>
                <p>容量：<strong>${zone.capacity}人/时段</strong></p>
                <div class="equipment-list">
                    <p style="font-weight:500;margin-bottom:8px;">装备库存：</p>`;
            
            DataStore.getEquipment().forEach(e => {
                html += `<div class="equipment-item">
                    <span>${e.name} ${e.size}码</span>
                    <span style="color:${e.stock > 0 ? '#27ae60' : '#e74c3c'}">${e.stock}件</span>
                </div>`;
            });
            
            html += '</div></div>';
        });
        
        list.innerHTML = html;
    },

    renderQualificationCard(memberId) {
        const card = document.getElementById('qualificationCard');
        if (!memberId) {
            card.innerHTML = '<p style="color:white;">请选择会员查看资格卡</p>';
            return;
        }
        
        const member = DataStore.getMemberById(memberId);
        const cert = DataStore.getTrainingCertificate(memberId);
        const consent = DataStore.getGuardianConsent(memberId);
        
        const levelNames = { 'beginner': '初级', 'intermediate': '中级', 'advanced': '高级' };
        const isExpired = DataStore.isCertificateExpired(memberId);
        
        let html = `<div class="member-info">
            <h3>${member.name}</h3>
            <div class="info-row">
                <span class="info-label">电话：</span>
                <span class="info-value">${member.phone}</span>
            </div>
            <div class="info-row">
                <span class="info-label">年龄：</span>
                <span class="info-value">${member.age}岁 ${member.isMinor ? '(未成年)' : ''}</span>
            </div>`;
        
        if (cert) {
            html += `<div class="info-row">
                <span class="info-label">培训等级：</span>
                <span class="info-value">${levelNames[cert.level] || cert.level}</span>
            </div>
            <div class="info-row">
                <span class="info-label">有效期至：</span>
                <span class="info-value ${isExpired ? 'expired' : 'valid'}">
                    ${cert.expireDate} ${isExpired ? '(已过期)' : '(有效)'}
                </span>
            </div>
            <div class="info-row">
                <span class="info-label">培训教练：</span>
                <span class="info-value">${cert.trainer}</span>
            </div>`;
        } else {
            html += `<div class="info-row">
                <span class="info-label">培训状态：</span>
                <span class="info-value expired">暂无培训记录</span>
            </div>`;
        }
        
        if (member.isMinor) {
            html += `<div class="info-row">
                <span class="info-label">监护确认：</span>
                <span class="info-value ${consent && consent.confirmed ? 'valid' : 'expired'}">
                    ${consent && consent.confirmed ? '已确认' : '未确认'}
                </span>
            </div>`;
            if (consent && consent.confirmed) {
                html += `<div class="info-row">
                    <span class="info-label">监护人：</span>
                    <span class="info-value">${consent.guardianName}</span>
                </div>`;
            }
        }
        
        html += '</div>';
        card.innerHTML = html;
    },

    renderWaitlist() {
        const container = document.getElementById('waitlistContainer');
        const waitlist = DataStore.getWaitlist();
        
        if (waitlist.length === 0) {
            container.innerHTML = '<p style="color:#666;">暂无候补记录</p>';
            return;
        }
        
        const grouped = {};
        waitlist.forEach(item => {
            const key = `${item.date}-${item.zoneId}-${item.slotId}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
        });
        
        let html = '';
        Object.keys(grouped).forEach(key => {
            const items = grouped[key];
            const zone = DataStore.getZoneById(items[0].zoneId);
            const slot = DataStore.getTimeSlotById(items[0].slotId);
            
            html += `<div class="waitlist-group">
                <h4>${items[0].date} ${zone.name} ${slot.time}</h4>`;
            
            items.forEach((item, idx) => {
                const member = DataStore.getMemberById(item.memberId);
                html += `<div class="waitlist-item">
                    <span class="member-name">${member ? member.name : '未知会员'}</span>
                    <span class="wait-position">第${idx + 1}位</span>
                </div>`;
            });
            
            html += '</div>';
        });
        
        container.innerHTML = html;
    },

    renderCheckinSelects() {
        const bookingSelect = document.getElementById('checkinBooking');
        const checkinSelect = document.getElementById('changeCheckin');
        const zoneSelect = document.getElementById('newZone');
        
        bookingSelect.innerHTML = '<option value="">请选择预约记录</option>';
        DataStore.getBookings().filter(b => b.status === 'confirmed').forEach(b => {
            const member = DataStore.getMemberById(b.memberId);
            const zone = DataStore.getZoneById(b.zoneId);
            const slot = DataStore.getTimeSlotById(b.slotId);
            const option = document.createElement('option');
            option.value = b.id;
            option.textContent = `${member ? member.name : ''} - ${zone.name} - ${b.date} ${slot.time}`;
            bookingSelect.appendChild(option);
        });
        
        checkinSelect.innerHTML = '<option value="">请选择入场记录</option>';
        DataStore.getCheckinRecords().forEach(c => {
            const member = DataStore.getMemberById(c.memberId);
            const zone = DataStore.getZoneById(c.zoneId);
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = `${member ? member.name : ''} - ${zone.name} - ${c.checkinTime.substring(0, 10)}`;
            checkinSelect.appendChild(option);
        });
        
        zoneSelect.innerHTML = '<option value="">请选择</option>';
        DataStore.getZones().forEach(z => {
            const option = document.createElement('option');
            option.value = z.id;
            option.textContent = z.name;
            zoneSelect.appendChild(option);
        });
        
        this.renderCheckinRecords();
    },

    renderCheckinRecords() {
        const container = document.getElementById('checkinRecords');
        const records = DataStore.getCheckinRecords();
        const isAdmin = document.getElementById('currentRole').value === 'admin';
        
        if (records.length === 0) {
            container.innerHTML = '<p style="color:#666;">暂无入场记录</p>';
            return;
        }
        
        let html = '';
        records.forEach(r => {
            const member = DataStore.getMemberById(r.memberId);
            const zone = DataStore.getZoneById(r.zoneId);
            
            html += `<div class="record-item">
                <div class="record-info">
                    <div class="member">${member ? member.name : '未知'}</div>
                    <div class="details">
                        ${zone.name} | ${new Date(r.checkinTime).toLocaleString()}
                        ${r.tempChanged ? ' | <span style="color:#f39c12;">(已换线)</span>' : ''}
                    </div>
                </div>
                <div class="record-actions">
                    <button class="delete-btn" data-id="${r.id}" 
                        ${!isAdmin && !r.canDelete ? 'disabled' : ''}
                        title="${!isAdmin && !r.canDelete ? '普通前台不可删除' : ''}">
                        删除
                    </button>
                </div>
            </div>`;
        });
        
        container.innerHTML = html;
        
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.deleteCheckin(e.target.dataset.id);
            });
        });
    },

    renderDataOverview() {
        const overview = DataStore.getDataOverview();
        const container = document.getElementById('dataOverview');
        
        const labels = {
            zones: '岩壁分区',
            members: '会员数量',
            certificates: '培训证书',
            equipment: '装备条目',
            bookings: '预约记录',
            waitlist: '候补记录',
            checkins: '入场记录'
        };
        
        let html = '';
        Object.keys(overview).forEach(key => {
            html += `<div class="data-item">
                <span class="data-label">${labels[key]}</span>
                <span class="data-count">${overview[key]}</span>
            </div>`;
        });
        
        container.innerHTML = html;
    },

    bindEvents() {
        document.getElementById('prevWeek').addEventListener('click', () => {
            this.currentWeekOffset--;
            this.renderCalendar();
        });
        
        document.getElementById('nextWeek').addEventListener('click', () => {
            this.currentWeekOffset++;
            this.renderCalendar();
        });
        
        document.getElementById('cancelBooking').addEventListener('click', () => {
            document.getElementById('bookingForm').style.display = 'none';
        });
        
        document.getElementById('submitBooking').addEventListener('click', () => {
            this.submitBooking();
        });
        
        document.getElementById('saveTraining').addEventListener('click', () => {
            this.saveTraining();
        });
        
        document.getElementById('doCheckin').addEventListener('click', () => {
            this.doCheckin();
        });
        
        document.getElementById('doTempChange').addEventListener('click', () => {
            this.doTempChange();
        });
        
        document.getElementById('currentRole').addEventListener('change', () => {
            this.renderCheckinRecords();
        });
        
        document.getElementById('exportData').addEventListener('click', () => {
            this.exportData();
        });
        
        document.getElementById('importDataBtn').addEventListener('click', () => {
            document.getElementById('importData').click();
        });
        
        document.getElementById('importData').addEventListener('change', (e) => {
            this.importData(e.target.files[0]);
        });
        
        document.getElementById('resetData').addEventListener('click', () => {
            if (confirm('确定要重置为示例数据吗？所有当前数据将丢失！')) {
                DataStore.resetToDefault();
                this.renderDataOverview();
                this.renderCalendar();
                this.renderZones();
                this.renderWaitlist();
                this.renderCheckinSelects();
                this.showResult('restoreResult', '数据已重置为示例数据', 'success');
            }
        });
    },

    submitBooking() {
        const memberId = document.getElementById('currentMember').value;
        const equipmentId = document.getElementById('equipmentSize').value;
        const trainingLevel = document.getElementById('trainingLevel').value;
        const guardianConfirm = document.getElementById('guardianConfirm').value === 'true';
        
        if (!memberId || !trainingLevel) {
            this.showResult('bookingResult', '请完善预约信息', 'error');
            return;
        }
        
        const member = DataStore.getMemberById(memberId);
        if (member.isMinor && guardianConfirm) {
            const existing = DataStore.getGuardianConsent(memberId);
            if (!existing || !existing.confirmed) {
                DataStore.saveGuardianConsent({
                    memberId,
                    guardianName: '系统默认监护人',
                    guardianPhone: member.phone,
                    confirmed: true,
                    confirmDate: this.formatDateISO(new Date())
                });
            }
        }
        
        const context = {
            memberId,
            zoneId: this.selectedZoneId,
            date: this.selectedDate,
            slotId: this.selectedSlotId,
            equipmentId
        };
        
        const validation = RulesEngine.validateBooking(context);
        
        if (!validation.passed) {
            RulesEngine.showRuleModal(validation.results, () => {});
            return;
        }
        
        if (validation.hasWarnings) {
            RulesEngine.showRuleModal(validation.results, (confirmed) => {
                if (confirmed) {
                    this.doCreateBooking(memberId, equipmentId, trainingLevel);
                }
            });
        } else {
            this.doCreateBooking(memberId, equipmentId, trainingLevel);
        }
    },

    doCreateBooking(memberId, equipmentId, trainingLevel) {
        if (equipmentId) {
            DataStore.updateEquipmentStock(equipmentId, -1);
        }
        
        const booking = DataStore.createBooking({
            memberId,
            zoneId: this.selectedZoneId,
            date: this.selectedDate,
            slotId: this.selectedSlotId,
            equipmentId,
            trainingLevel
        });
        
        document.getElementById('bookingForm').style.display = 'none';
        this.renderCalendar();
        this.renderCheckinSelects();
        this.showResult('bookingResult', '预约成功！', 'success');
    },

    saveTraining() {
        const memberId = document.getElementById('trainMember').value;
        const level = document.getElementById('trainLevel').value;
        const expireDate = document.getElementById('trainExpire').value;
        
        if (!memberId || !expireDate) {
            this.showResult('trainResult', '请完善培训信息', 'error');
            return;
        }
        
        DataStore.saveTrainingCertificate({
            memberId,
            level,
            expireDate,
            trainer: '系统教练'
        });
        
        this.renderQualificationCard(memberId);
        this.showResult('trainResult', '培训记录已保存', 'success');
    },

    doCheckin() {
        const bookingId = document.getElementById('checkinBooking').value;
        if (!bookingId) {
            this.showResult('checkinResult', '请选择预约记录', 'error');
            return;
        }
        
        const booking = DataStore.getBookingById(bookingId);
        if (!booking) {
            this.showResult('checkinResult', '预约记录不存在', 'error');
            return;
        }
        
        DataStore.updateBookingStatus(bookingId, 'checkedin');
        
        const checkin = DataStore.createCheckin({
            memberId: booking.memberId,
            bookingId,
            zoneId: booking.zoneId,
            slotId: booking.slotId
        });
        
        this.renderCheckinSelects();
        this.showResult('checkinResult', '入场核验成功！', 'success');
    },

    doTempChange() {
        const checkinId = document.getElementById('changeCheckin').value;
        const newZoneId = document.getElementById('newZone').value;
        
        if (!checkinId || !newZoneId) {
            this.showResult('changeResult', '请选择入场记录和新分区', 'error');
            return;
        }
        
        DataStore.updateCheckinZone(checkinId, newZoneId);
        this.renderCheckinSelects();
        this.showResult('changeResult', '临时换线成功', 'success');
    },

    deleteCheckin(checkinId) {
        const isAdmin = document.getElementById('currentRole').value === 'admin';
        
        const validation = RulesEngine.validateCheckinDelete({ checkinId, isAdmin });
        if (!validation.passed) {
            RulesEngine.showRuleModal(validation.results, () => {});
            return;
        }
        
        if (confirm('确定要删除该入场记录吗？')) {
            const success = DataStore.deleteCheckin(checkinId, isAdmin);
            if (success) {
                this.renderCheckinSelects();
                this.showResult('checkinResult', '记录已删除', 'success');
            }
        }
    },

    exportData() {
        const data = DataStore.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `climbing_gym_data_${this.formatDateISO(new Date())}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showResult('restoreResult', '数据已导出', 'success');
    },

    importData(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const success = DataStore.importData(e.target.result);
            if (success) {
                this.renderDataOverview();
                this.renderCalendar();
                this.renderZones();
                this.renderWaitlist();
                this.renderCheckinSelects();
                this.showResult('restoreResult', '数据导入成功', 'success');
            } else {
                this.showResult('restoreResult', '数据格式错误，导入失败', 'error');
            }
        };
        reader.readAsText(file);
    },

    showResult(elementId, message, type) {
        const el = document.getElementById(elementId);
        el.textContent = message;
        el.className = `result-message ${type}`;
    },

    formatDate(date) {
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    },

    formatDateShort(date) {
        return `${date.getMonth() + 1}/${date.getDate()}`;
    },

    formatDateISO(date) {
        return date.toISOString().split('T')[0];
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
