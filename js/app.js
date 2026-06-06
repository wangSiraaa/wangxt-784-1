const App = {
    currentWeekOffset: 0,
    selectedDate: null,
    selectedZoneId: null,
    selectedSlotId: null,
    drawerZoneId: null,
    drawerDate: null,
    drawerSlotId: null,
    previousScrollPosition: 0,

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
        this.bindDrawerEvents();
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
                this.openZoneDrawer(slot.dataset.zone, slot.dataset.date, slot.dataset.slot);
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
            if (e.stock <= 0) {
                option.textContent = `${e.name} ${e.size}码 - ❌ 库存不足 (0件)`;
                option.disabled = true;
                option.style.color = '#999';
                option.style.background = '#f5f5f5';
            } else if (e.stock === 1) {
                option.textContent = `${e.name} ${e.size}码 - ⚠️ 仅剩1件`;
                option.style.color = '#f39c12';
            } else {
                option.textContent = `${e.name} ${e.size}码 (库存: ${e.stock}件)`;
            }
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
        this.showSuccessModal();
        this.showResult('bookingResult', '✅ 预约成功！祝您攀岩愉快！', 'success');
    },
    
    showSuccessModal() {
        const modal = document.createElement('div');
        modal.className = 'booking-success-overlay';
        modal.id = 'successModal';
        modal.innerHTML = `
            <div class="booking-success-card">
                <div class="success-icon">✓</div>
                <h3>预约成功！</h3>
                <p>您的攀岩预约已确认，请按时到场核验</p>
                <button class="btn-primary" onclick="document.getElementById('successModal').remove()">知道了</button>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => {
            if (document.getElementById('successModal')) {
                document.getElementById('successModal').style.opacity = '0';
                setTimeout(() => {
                    if (document.getElementById('successModal')) {
                        document.getElementById('successModal').remove();
                    }
                }, 300);
            }
        }, 3000);
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
    },

    bindDrawerEvents() {
        document.querySelectorAll('.drawer-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchDrawerTab(tab.dataset.tab);
            });
        });

        document.getElementById('drawerTimeSlot').addEventListener('change', () => {
            this.drawerSlotId = document.getElementById('drawerTimeSlot').value;
        });

        document.getElementById('drawerWaitlistSlot').addEventListener('change', () => {
            this.renderDrawerWaitlist();
        });

        document.getElementById('drawerSubmitBooking').addEventListener('click', () => {
            this.submitDrawerBooking();
        });

        document.getElementById('drawerAddWaitlist').addEventListener('click', () => {
            this.addDrawerWaitlist();
        });

        document.getElementById('drawerDoCheckin').addEventListener('click', () => {
            this.doDrawerCheckin();
        });

        document.getElementById('zoneDrawerOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'zoneDrawerOverlay') {
                closeZoneDrawer();
            }
        });
    },

    openZoneDrawer(zoneId, date, slotId) {
        const memberId = document.getElementById('currentMember').value;
        if (!memberId) {
            this.showResult('bookingResult', '请先选择会员', 'error');
            return;
        }

        this.previousScrollPosition = window.scrollY;
        this.drawerZoneId = zoneId;
        this.drawerDate = date;
        this.drawerSlotId = slotId;

        const zone = DataStore.getZoneById(zoneId);
        document.getElementById('drawerZoneName').textContent = zone.name;

        this.renderZoneInfo();
        this.renderDrawerBookingForm();
        this.renderDrawerWaitlistOptions();
        this.renderDrawerCheckinOptions();

        if (slotId) {
            this.switchDrawerTab('booking');
            document.getElementById('drawerTimeSlot').value = slotId;
        } else {
            this.switchDrawerTab('info');
        }

        document.getElementById('zoneDrawerOverlay').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },

    switchDrawerTab(tabName) {
        document.querySelectorAll('.drawer-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        document.querySelectorAll('.drawer-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === 'drawerTab-' + tabName);
        });

        if (tabName === 'waitlist') {
            this.renderDrawerWaitlist();
        }
        if (tabName === 'checkin') {
            this.renderDrawerCheckinOptions();
        }
    },

    renderZoneInfo() {
        const zone = DataStore.getZoneById(this.drawerZoneId);
        const memberId = document.getElementById('currentMember').value;
        const member = DataStore.getMemberById(memberId);
        const cert = DataStore.getTrainingCertificate(memberId);
        const consent = DataStore.getGuardianConsent(memberId);

        const riskNames = { 'low': '低风险', 'medium': '中风险', 'high': '高风险' };
        const levelNames = { 'beginner': '初级', 'intermediate': '中级', 'advanced': '高级' };
        const levelOrder = { 'beginner': 1, 'intermediate': 2, 'advanced': 3 };

        const memberLevel = cert ? cert.level : null;
        const memberLevelNum = memberLevel ? levelOrder[memberLevel] : 0;
        const requiredLevelNum = levelOrder[zone.requiredLevel];
        const isLevelSufficient = memberLevelNum >= requiredLevelNum;
        const isCertExpired = DataStore.isCertificateExpired(memberId);

        const isGuardianConfirmed = member.isMinor ? DataStore.isGuardianConfirmed(memberId) : true;
        const canAccessZone = isLevelSufficient && !isCertExpired && (member.isMinor ? isGuardianConfirmed : true);

        let html = `
            <div class="zone-info-card">
                <h4>📋 分区基本信息</h4>
                <div class="zone-info-row">
                    <span class="zone-info-label">分区名称</span>
                    <span class="zone-info-value">${zone.name}</span>
                </div>
                <div class="zone-info-row">
                    <span class="zone-info-label">风险等级</span>
                    <span class="zone-info-value ${zone.riskLevel}">${riskNames[zone.riskLevel]}</span>
                </div>
                <div class="zone-info-row">
                    <span class="zone-info-label">分区描述</span>
                    <span class="zone-info-value" style="text-align:right;">${zone.description}</span>
                </div>
                <div class="zone-info-row">
                    <span class="zone-info-label">容量</span>
                    <span class="zone-info-value">${zone.capacity}人/时段</span>
                </div>
            </div>

            <div class="drawer-section">
                <h4 class="drawer-section-title">🎓 培训等级要求</h4>
                <div class="zone-info-card" style="margin-bottom:0;">
                    <div class="zone-info-row">
                        <span class="zone-info-label">要求等级</span>
                        <span class="zone-info-value">${levelNames[zone.requiredLevel]}</span>
                    </div>
                    <div class="zone-info-row">
                        <span class="zone-info-label">您的等级</span>
                        <span class="zone-info-value ${isLevelSufficient && !isCertExpired ? 'valid' : 'expired'}">
                            ${memberLevel ? levelNames[memberLevel] : '无'}
                            ${isCertExpired ? ' (已过期)' : ''}
                        </span>
                    </div>
                    <div class="zone-info-row">
                        <span class="zone-info-label">状态</span>
                        <span class="zone-info-value ${canAccessZone ? 'valid' : 'expired'}">
                            ${canAccessZone ? '✅ 符合要求' : '❌ 不符合要求'}
                        </span>
                    </div>
                    ${!canAccessZone ? `
                    <div class="zone-info-row" style="padding-top:10px;">
                        <span class="zone-info-label" style="color:#e74c3c;">提示</span>
                        <span class="zone-info-value" style="color:#e74c3c;font-weight:normal;">
                            ${isCertExpired ? '您的培训证书已过期，请联系教练续期' : 
                              !isLevelSufficient ? '您的培训等级未达到该分区要求' : 
                              !isGuardianConfirmed ? '未成年人需监护人确认后方可预约' : ''}
                        </span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;

        if (member.isMinor) {
            html += `
            <div class="drawer-section">
                <h4 class="drawer-section-title">👨‍👩‍👧 未成年人监护状态</h4>
                <div class="zone-info-card" style="margin-bottom:0;">
                    <div class="zone-info-row">
                        <span class="zone-info-label">会员身份</span>
                        <span class="zone-info-value warning">未成年人</span>
                    </div>
                    <div class="zone-info-row">
                        <span class="zone-info-label">监护确认</span>
                        <span class="zone-info-value ${isGuardianConfirmed ? 'valid' : 'expired'}">
                            ${isGuardianConfirmed ? '✅ 已确认' : '❌ 未确认'}
                        </span>
                    </div>
                    ${consent && consent.confirmed ? `
                    <div class="zone-info-row">
                        <span class="zone-info-label">监护人</span>
                        <span class="zone-info-value">${consent.guardianName}</span>
                    </div>
                    <div class="zone-info-row">
                        <span class="zone-info-label">确认日期</span>
                        <span class="zone-info-value">${consent.confirmDate}</span>
                    </div>
                    ` : ''}
                    ${!isGuardianConfirmed ? `
                    <div class="zone-info-row" style="padding-top:10px;">
                        <span class="zone-info-label" style="color:#e74c3c;">限制</span>
                        <span class="zone-info-value" style="color:#e74c3c;font-weight:normal;">
                            未确认监护人仅可预约体验区
                        </span>
                    </div>
                    ` : ''}
                </div>
            </div>
            `;
        }

        html += `
            <div class="drawer-section">
                <h4 class="drawer-section-title">👟 装备尺码库存</h4>
                <div class="equipment-stock-grid">
        `;

        DataStore.getEquipment().forEach(e => {
            let stockClass = 'in-stock';
            if (e.stock <= 0) stockClass = 'out-stock';
            else if (e.stock === 1) stockClass = 'low-stock';

            html += `
                <div class="equipment-stock-item">
                    <div class="equip-name">${e.name}</div>
                    <div class="equip-size">${e.size}码</div>
                    <div class="equip-stock ${stockClass}">
                        ${e.stock > 0 ? e.stock + '件' : '无货'}
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>

            <div class="drawer-section">
                <h4 class="drawer-section-title">🕐 今日可预约时段 (${this.drawerDate})</h4>
                <div class="time-slots-list">
        `;

        const slots = DataStore.getTimeSlots();
        slots.forEach(slot => {
            const remaining = DataStore.getSlotCapacity(this.drawerZoneId, this.drawerDate, slot.id);
            const isFull = remaining <= 0;
            const zone = DataStore.getZoneById(this.drawerZoneId);

            html += `
                <div class="time-slot-item" onclick="App.selectDrawerSlot('${slot.id}')">
                    <span class="slot-time">${slot.time} (${slot.name})</span>
                    <span class="slot-capacity ${isFull ? 'full' : ''}">
                        ${isFull ? '已满' : `剩余 ${remaining}/${zone.capacity}`}
                    </span>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        document.getElementById('zoneInfoSection').innerHTML = html;
    },

    selectDrawerSlot(slotId) {
        this.drawerSlotId = slotId;
        document.getElementById('drawerTimeSlot').value = slotId;
        document.getElementById('drawerWaitlistSlot').value = slotId;
        this.switchDrawerTab('booking');
    },

    renderDrawerBookingForm() {
        const zone = DataStore.getZoneById(this.drawerZoneId);
        const memberId = document.getElementById('currentMember').value;
        const member = DataStore.getMemberById(memberId);

        document.getElementById('drawerBookingZone').textContent = zone.name;

        const slotSelect = document.getElementById('drawerTimeSlot');
        slotSelect.innerHTML = '<option value="">请选择时段</option>';
        DataStore.getTimeSlots().forEach(slot => {
            const remaining = DataStore.getSlotCapacity(this.drawerZoneId, this.drawerDate, slot.id);
            const option = document.createElement('option');
            option.value = slot.id;
            option.textContent = `${slot.time} (${slot.name}) - 剩余${remaining}人`;
            if (remaining <= 0) {
                option.disabled = true;
                option.style.color = '#999';
            }
            if (this.drawerSlotId === slot.id) {
                option.selected = true;
            }
            slotSelect.appendChild(option);
        });

        const equipSelect = document.getElementById('drawerEquipmentSize');
        equipSelect.innerHTML = '<option value="">请选择</option>';
        DataStore.getEquipment().forEach(e => {
            const option = document.createElement('option');
            option.value = e.id;
            if (e.stock <= 0) {
                option.textContent = `${e.name} ${e.size}码 - ❌ 库存不足 (0件)`;
                option.disabled = true;
                option.style.color = '#999';
                option.style.background = '#f5f5f5';
            } else if (e.stock === 1) {
                option.textContent = `${e.name} ${e.size}码 - ⚠️ 仅剩1件`;
                option.style.color = '#f39c12';
            } else {
                option.textContent = `${e.name} ${e.size}码 (库存: ${e.stock}件)`;
            }
            equipSelect.appendChild(option);
        });

        const guardianRow = document.getElementById('drawerGuardianRow');
        if (member && member.isMinor) {
            guardianRow.style.display = 'flex';
            const consent = DataStore.getGuardianConsent(memberId);
            document.getElementById('drawerGuardianConfirm').value = consent && consent.confirmed ? 'true' : 'false';
        } else {
            guardianRow.style.display = 'none';
        }

        document.getElementById('drawerBookingResult').style.display = 'none';
    },

    renderDrawerWaitlistOptions() {
        const slotSelect = document.getElementById('drawerWaitlistSlot');
        slotSelect.innerHTML = '<option value="">请选择时段</option>';
        DataStore.getTimeSlots().forEach(slot => {
            const option = document.createElement('option');
            option.value = slot.id;
            option.textContent = `${slot.time} (${slot.name})`;
            if (this.drawerSlotId === slot.id) {
                option.selected = true;
            }
            slotSelect.appendChild(option);
        });
    },

    renderDrawerWaitlist() {
        const slotId = document.getElementById('drawerWaitlistSlot').value;
        const listContainer = document.getElementById('drawerWaitlistList');

        if (!slotId) {
            listContainer.innerHTML = '<p style="color:#999;">请选择时段查看候补名单</p>';
            return;
        }

        const waitlist = DataStore.getWaitlistByZoneAndDate(this.drawerZoneId, this.drawerDate, slotId);

        if (waitlist.length === 0) {
            listContainer.innerHTML = '<p style="color:#999;">该时段暂无候补</p>';
            return;
        }

        let html = '';
        waitlist.forEach((item, idx) => {
            const member = DataStore.getMemberById(item.memberId);
            html += `
                <div class="waitlist-item-drawer">
                    <span class="member-name">${member ? member.name : '未知会员'}</span>
                    <span class="position">第${idx + 1}位</span>
                </div>
            `;
        });

        listContainer.innerHTML = html;
    },

    renderDrawerCheckinOptions() {
        const bookingSelect = document.getElementById('drawerCheckinBooking');
        bookingSelect.innerHTML = '<option value="">请选择预约记录</option>';
        
        const bookings = DataStore.getBookings()
            .filter(b => b.status === 'confirmed' && b.zoneId === this.drawerZoneId);
        
        bookings.forEach(b => {
            const member = DataStore.getMemberById(b.memberId);
            const slot = DataStore.getTimeSlotById(b.slotId);
            const currentMemberId = document.getElementById('currentMember').value;
            if (b.memberId === currentMemberId) {
                const option = document.createElement('option');
                option.value = b.id;
                option.textContent = `${b.date} ${slot ? slot.time : ''}`;
                bookingSelect.appendChild(option);
            }
        });

        document.getElementById('drawerCheckinResult').style.display = 'none';
    },

    submitDrawerBooking() {
        const memberId = document.getElementById('currentMember').value;
        const equipmentId = document.getElementById('drawerEquipmentSize').value;
        const trainingLevel = document.getElementById('drawerTrainingLevel').value;
        const guardianConfirm = document.getElementById('drawerGuardianConfirm').value === 'true';
        const slotId = document.getElementById('drawerTimeSlot').value;

        if (!memberId || !slotId || !trainingLevel) {
            this.showDrawerResult('drawerBookingResult', '请完善预约信息（时段、培训等级）', 'error');
            return;
        }

        this.selectedZoneId = this.drawerZoneId;
        this.selectedDate = this.drawerDate;
        this.selectedSlotId = slotId;

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
            zoneId: this.drawerZoneId,
            date: this.drawerDate,
            slotId,
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
                    this.doCreateDrawerBooking(memberId, equipmentId, trainingLevel);
                }
            });
        } else {
            this.doCreateDrawerBooking(memberId, equipmentId, trainingLevel);
        }
    },

    doCreateDrawerBooking(memberId, equipmentId, trainingLevel) {
        if (equipmentId) {
            DataStore.updateEquipmentStock(equipmentId, -1);
        }

        const booking = DataStore.createBooking({
            memberId,
            zoneId: this.drawerZoneId,
            date: this.drawerDate,
            slotId: this.drawerSlotId,
            equipmentId,
            trainingLevel
        });

        this.renderCalendar();
        this.renderZoneInfo();
        this.renderDrawerBookingForm();
        this.showDrawerResult('drawerBookingResult', '✅ 预约成功！祝您攀岩愉快！', 'success');
    },

    addDrawerWaitlist() {
        const memberId = document.getElementById('currentMember').value;
        const slotId = document.getElementById('drawerWaitlistSlot').value;

        if (!memberId || !slotId) {
            this.showDrawerResult('drawerWaitlistResult', '请先选择时段', 'error');
            return;
        }

        const item = DataStore.addToWaitlist({
            memberId,
            zoneId: this.drawerZoneId,
            date: this.drawerDate,
            slotId
        });

        this.renderDrawerWaitlist();
        this.renderCalendar();
        this.showDrawerResult('drawerWaitlistResult', `已加入候补名单，当前排位第${item.position}位`, 'success');
    },

    doDrawerCheckin() {
        const bookingId = document.getElementById('drawerCheckinBooking').value;
        if (!bookingId) {
            this.showDrawerResult('drawerCheckinResult', '请选择预约记录', 'error');
            return;
        }

        const booking = DataStore.getBookingById(bookingId);
        if (!booking) {
            this.showDrawerResult('drawerCheckinResult', '预约记录不存在', 'error');
            return;
        }

        DataStore.updateBookingStatus(bookingId, 'checkedin');

        const checkin = DataStore.createCheckin({
            memberId: booking.memberId,
            bookingId,
            zoneId: booking.zoneId,
            slotId: booking.slotId
        });

        this.renderDrawerCheckinOptions();
        this.showDrawerResult('drawerCheckinResult', '入场核验成功！', 'success');
    },

    showDrawerResult(elementId, message, type) {
        const el = document.getElementById(elementId);
        el.textContent = message;
        el.className = `result-message ${type}`;
    }
};

function closeZoneDrawer() {
    document.getElementById('zoneDrawerOverlay').style.display = 'none';
    document.body.style.overflow = '';
    window.scrollTo(0, App.previousScrollPosition);
    App.drawerZoneId = null;
    App.drawerDate = null;
    App.drawerSlotId = null;
}

function runSelfCheck() {
    const modal = document.getElementById('selfCheckModal');
    const content = document.getElementById('selfCheckContent');
    
    const checks = [
        {
            name: '培训过期会员禁止先锋攀岩',
            desc: '验证钱七(证书过期)预约先锋区是否被拦截',
            test: () => {
                const result = RulesEngine.validateBooking({
                    memberId: 'm5', zoneId: 'zone3', date: '2026-06-08', slotId: 'slot1'
                });
                return !result.passed && result.results.some(r => r.ruleId === 'TRAINING_EXPIRED_ADVANCED');
            }
        },
        {
            name: '未成年人监护确认规则',
            desc: '验证赵六(未成年未确认)预约难度区是否被拦截',
            test: () => {
                const result = RulesEngine.validateBooking({
                    memberId: 'm4', zoneId: 'zone2', date: '2026-06-08', slotId: 'slot1'
                });
                return !result.passed && result.results.some(r => r.ruleId === 'MINOR_WITHOUT_GUARDIAN');
            }
        },
        {
            name: '装备库存不足提示',
            desc: '验证42码(库存0)是否触发库存警告',
            test: () => {
                const result = RulesEngine.validateBooking({
                    memberId: 'm1', zoneId: 'zone1', date: '2026-06-08', slotId: 'slot1', equipmentId: 'shoe_42'
                });
                return result.results.some(r => r.ruleId === 'EQUIPMENT_STOCK_INSUFFICIENT');
            }
        },
        {
            name: '入场记录删除权限',
            desc: '验证普通前台删除已入场记录被拦截',
            test: () => {
                const checkin = DataStore.createCheckin({
                    memberId: 'm1', bookingId: 'test_check', zoneId: 'zone1', slotId: 'slot1'
                });
                const result = RulesEngine.validateCheckinDelete({ checkinId: checkin.id, isAdmin: false });
                return !result.passed;
            }
        },
        {
            name: '所有页面导航可访问',
            desc: '验证6个页面导航按钮都存在且可点击',
            test: () => {
                const pages = ['calendar', 'zones', 'qualification', 'waitlist', 'checkin', 'datarestore'];
                return pages.every(p => document.querySelector(`[data-page="${p}"]`) !== null);
            }
        },
        {
            name: '本地数据存储正常',
            desc: '验证岩壁分区、会员、装备等数据已加载',
            test: () => {
                return DataStore.getZones().length > 0 && 
                       DataStore.getMembers().length > 0 && 
                       DataStore.getEquipment().length > 0;
            }
        }
    ];
    
    let html = '<div style="margin-bottom:15px;font-weight:500;color:#2c3e50;">正在运行交付自检...</div>';
    let passed = 0;
    let failed = 0;
    
    checks.forEach(check => {
        try {
            const result = check.test();
            if (result) {
                passed++;
                html += `<div class="self-check-item pass">
                    <div class="check-title">✅ ${check.name}</div>
                    <div class="check-desc">${check.desc}</div>
                </div>`;
            } else {
                failed++;
                html += `<div class="self-check-item fail">
                    <div class="check-title">❌ ${check.name}</div>
                    <div class="check-desc">${check.desc} - 测试未通过</div>
                </div>`;
            }
        } catch (e) {
            failed++;
            html += `<div class="self-check-item fail">
                <div class="check-title">❌ ${check.name}</div>
                <div class="check-desc">错误: ${e.message}</div>
            </div>`;
        }
    });
    
    html += `<div style="margin-top:20px;padding:15px;background:${failed === 0 ? '#d4edda' : '#f8d7da'};border-radius:8px;text-align:center;">
        <strong>${failed === 0 ? '🎉 所有自检通过！' : `⚠️  ${failed}项检查未通过`}</strong>
        <div style="margin-top:5px;font-size:13px;">通过: ${passed} / 失败: ${failed} / 总计: ${checks.length}</div>
    </div>`;
    
    content.innerHTML = html;
    modal.style.display = 'flex';
}

function closeSelfCheckModal() {
    document.getElementById('selfCheckModal').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
