const DataStore = {
    STORAGE_KEY: 'climbing_gym_data',

    defaultData: {
        zones: [
            { id: 'zone1', name: '体验区', riskLevel: 'low', requiredLevel: 'beginner', description: '适合初学者和儿童，高度5米以下', capacity: 10 },
            { id: 'zone2', name: '难度区', riskLevel: 'medium', requiredLevel: 'intermediate', description: '中等难度岩壁，需要一定技巧', capacity: 8 },
            { id: 'zone3', name: '先锋区', riskLevel: 'high', requiredLevel: 'advanced', description: '高难度先锋攀岩，需要专业培训', capacity: 6 }
        ],
        timeSlots: [
            { id: 'slot1', time: '09:00-11:00', name: '上午场' },
            { id: 'slot2', time: '14:00-16:00', name: '下午场' },
            { id: 'slot3', time: '18:00-20:00', name: '晚间场' }
        ],
        equipment: [
            { id: 'shoe_36', name: '攀岩鞋', size: '36', stock: 3 },
            { id: 'shoe_37', name: '攀岩鞋', size: '37', stock: 2 },
            { id: 'shoe_38', name: '攀岩鞋', size: '38', stock: 5 },
            { id: 'shoe_39', name: '攀岩鞋', size: '39', stock: 4 },
            { id: 'shoe_40', name: '攀岩鞋', size: '40', stock: 3 },
            { id: 'shoe_41', name: '攀岩鞋', size: '41', stock: 2 },
            { id: 'shoe_42', name: '攀岩鞋', size: '42', stock: 0 },
            { id: 'shoe_43', name: '攀岩鞋', size: '43', stock: 1 },
            { id: 'harness_s', name: '安全带', size: 'S', stock: 4 },
            { id: 'harness_m', name: '安全带', size: 'M', stock: 6 },
            { id: 'harness_l', name: '安全带', size: 'L', stock: 3 },
            { id: 'harness_xl', name: '安全带', size: 'XL', stock: 2 }
        ],
        members: [
            { id: 'm1', name: '张三', phone: '13800138001', age: 28, isMinor: false },
            { id: 'm2', name: '李四', phone: '13800138002', age: 16, isMinor: true },
            { id: 'm3', name: '王五', phone: '13800138003', age: 35, isMinor: false },
            { id: 'm4', name: '赵六', phone: '13800138004', age: 15, isMinor: true },
            { id: 'm5', name: '钱七', phone: '13800138005', age: 22, isMinor: false }
        ],
        trainingCertificates: [
            { memberId: 'm1', level: 'advanced', expireDate: '2025-06-01', trainer: '李教练' },
            { memberId: 'm2', level: 'beginner', expireDate: '2026-12-31', trainer: '王教练' },
            { memberId: 'm3', level: 'intermediate', expireDate: '2026-08-15', trainer: '李教练' },
            { memberId: 'm4', level: 'beginner', expireDate: '2026-10-20', trainer: '张教练' },
            { memberId: 'm5', level: 'advanced', expireDate: '2026-05-01', trainer: '李教练' }
        ],
        guardianConsents: [
            { memberId: 'm2', guardianName: '李爸爸', guardianPhone: '13900139002', confirmed: true, confirmDate: '2026-01-15' },
            { memberId: 'm4', guardianName: '赵妈妈', guardianPhone: '13900139004', confirmed: false, confirmDate: null }
        ],
        bookings: [],
        waitlist: [],
        checkinRecords: []
    },

    data: null,

    init() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            try {
                this.data = JSON.parse(stored);
            } catch (e) {
                this.resetToDefault();
            }
        } else {
            this.resetToDefault();
        }
    },

    save() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    },

    resetToDefault() {
        this.data = JSON.parse(JSON.stringify(this.defaultData));
        this.save();
    },

    exportData() {
        return JSON.stringify(this.data, null, 2);
    },

    importData(jsonString) {
        try {
            const newData = JSON.parse(jsonString);
            this.data = newData;
            this.save();
            return true;
        } catch (e) {
            return false;
        }
    },

    getZones() {
        return this.data.zones;
    },

    getZoneById(zoneId) {
        return this.data.zones.find(z => z.id === zoneId);
    },

    getTimeSlots() {
        return this.data.timeSlots;
    },

    getTimeSlotById(slotId) {
        return this.data.timeSlots.find(s => s.id === slotId);
    },

    getEquipment() {
        return this.data.equipment;
    },

    getEquipmentById(equipId) {
        return this.data.equipment.find(e => e.id === equipId);
    },

    getEquipmentByNameAndSize(name, size) {
        return this.data.equipment.find(e => e.name === name && e.size === size);
    },

    updateEquipmentStock(equipId, change) {
        const equip = this.getEquipmentById(equipId);
        if (equip) {
            equip.stock += change;
            this.save();
        }
    },

    getMembers() {
        return this.data.members;
    },

    getMemberById(memberId) {
        return this.data.members.find(m => m.id === memberId);
    },

    getTrainingCertificate(memberId) {
        return this.data.trainingCertificates.find(c => c.memberId === memberId);
    },

    saveTrainingCertificate(cert) {
        const existing = this.data.trainingCertificates.find(c => c.memberId === cert.memberId);
        if (existing) {
            Object.assign(existing, cert);
        } else {
            this.data.trainingCertificates.push(cert);
        }
        this.save();
    },

    isCertificateExpired(memberId) {
        const cert = this.getTrainingCertificate(memberId);
        if (!cert) return true;
        const today = new Date();
        const expire = new Date(cert.expireDate);
        return expire < today;
    },

    getMemberTrainingLevel(memberId) {
        const cert = this.getTrainingCertificate(memberId);
        return cert ? cert.level : null;
    },

    getGuardianConsent(memberId) {
        return this.data.guardianConsents.find(g => g.memberId === memberId);
    },

    saveGuardianConsent(consent) {
        const existing = this.data.guardianConsents.find(g => g.memberId === consent.memberId);
        if (existing) {
            Object.assign(existing, consent);
        } else {
            this.data.guardianConsents.push(consent);
        }
        this.save();
    },

    isGuardianConfirmed(memberId) {
        const consent = this.getGuardianConsent(memberId);
        return consent ? consent.confirmed : false;
    },

    getBookings() {
        return this.data.bookings;
    },

    getBookingById(bookingId) {
        return this.data.bookings.find(b => b.id === bookingId);
    },

    getBookingsByDateAndZone(date, zoneId) {
        return this.data.bookings.filter(b => b.date === date && b.zoneId === zoneId && b.status === 'confirmed');
    },

    getBookingsByMember(memberId) {
        return this.data.bookings.filter(b => b.memberId === memberId);
    },

    createBooking(bookingData) {
        const booking = {
            id: 'b' + Date.now(),
            ...bookingData,
            status: 'confirmed',
            createdAt: new Date().toISOString()
        };
        this.data.bookings.push(booking);
        this.save();
        return booking;
    },

    updateBookingStatus(bookingId, status) {
        const booking = this.getBookingById(bookingId);
        if (booking) {
            booking.status = status;
            this.save();
        }
    },

    getWaitlist() {
        return this.data.waitlist;
    },

    getWaitlistByZoneAndDate(zoneId, date, slotId) {
        return this.data.waitlist
            .filter(w => w.zoneId === zoneId && w.date === date && w.slotId === slotId)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    addToWaitlist(waitData) {
        const position = this.getWaitlistByZoneAndDate(waitData.zoneId, waitData.date, waitData.slotId).length + 1;
        const item = {
            id: 'w' + Date.now(),
            ...waitData,
            position,
            createdAt: new Date().toISOString()
        };
        this.data.waitlist.push(item);
        this.save();
        return item;
    },

    removeFromWaitlist(waitId) {
        const idx = this.data.waitlist.findIndex(w => w.id === waitId);
        if (idx > -1) {
            this.data.waitlist.splice(idx, 1);
            this.save();
        }
    },

    getCheckinRecords() {
        return this.data.checkinRecords;
    },

    getCheckinById(checkinId) {
        return this.data.checkinRecords.find(c => c.id === checkinId);
    },

    createCheckin(checkinData) {
        const checkin = {
            id: 'c' + Date.now(),
            ...checkinData,
            checkinTime: new Date().toISOString(),
            canDelete: false
        };
        this.data.checkinRecords.push(checkin);
        this.save();
        return checkin;
    },

    updateCheckinZone(checkinId, newZoneId) {
        const checkin = this.getCheckinById(checkinId);
        if (checkin) {
            checkin.zoneId = newZoneId;
            checkin.tempChanged = true;
            checkin.changeTime = new Date().toISOString();
            this.save();
        }
    },

    deleteCheckin(checkinId, isAdmin = false) {
        const checkin = this.getCheckinById(checkinId);
        if (!checkin) return false;
        if (!isAdmin && !checkin.canDelete) return false;
        const idx = this.data.checkinRecords.findIndex(c => c.id === checkinId);
        if (idx > -1) {
            this.data.checkinRecords.splice(idx, 1);
            this.save();
            return true;
        }
        return false;
    },

    getSlotCapacity(zoneId, date, slotId) {
        const zone = this.getZoneById(zoneId);
        if (!zone) return 0;
        const used = this.getBookingsByDateAndZone(date, zoneId)
            .filter(b => b.slotId === slotId).length;
        return zone.capacity - used;
    },

    isSlotFull(zoneId, date, slotId) {
        return this.getSlotCapacity(zoneId, date, slotId) <= 0;
    },

    getDataOverview() {
        return {
            zones: this.data.zones.length,
            members: this.data.members.length,
            certificates: this.data.trainingCertificates.length,
            equipment: this.data.equipment.length,
            bookings: this.data.bookings.length,
            waitlist: this.data.waitlist.length,
            checkins: this.data.checkinRecords.length
        };
    }
};
