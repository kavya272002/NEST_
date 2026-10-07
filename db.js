/* ═══════════════════════════════════════════════════
   NEST — Database Layer (Dexie.js / IndexedDB)
   All data stays local. Zero cloud dependency.
   ═══════════════════════════════════════════════════ */

const db = new Dexie('KoshDatabase');

// Define schema — Version 2 adds profile store
db.version(1).stores({
    vendors:     '++id, name, category, rate, phone, notes, createdAt',
    transactions:'++id, vendorId, amount, type, date, note, createdAt',
    documents:   '++id, name, category, holder, number, issuedDate, expiryDate, notes, image, createdAt',
    heritage:    '++id, title, type, origin, content, image, createdAt'
});

db.version(2).stores({
    vendors:     '++id, name, category, rate, phone, notes, createdAt',
    transactions:'++id, vendorId, amount, type, date, note, createdAt',
    documents:   '++id, name, category, holder, number, issuedDate, expiryDate, notes, image, createdAt',
    heritage:    '++id, title, type, origin, content, image, createdAt',
    profile:     'key'
});

db.version(3).stores({
    vendors:     '++id, name, category, rate, phone, notes, createdAt',
    transactions:'++id, vendorId, amount, type, date, note, createdAt',
    documents:   '++id, name, category, holder, number, issuedDate, expiryDate, notes, image, createdAt',
    heritage:    '++id, title, type, origin, content, image, createdAt',
    profile:     'key',
    members:     '++id, name, relation, avatar, createdAt'
});

// ── MEMBER OPERATIONS ──
const MemberDB = {
    async getAll() {
        return await db.members.toArray();
    },
    async add(member) {
        member.createdAt = new Date().toISOString();
        return await db.members.add(member);
    },
    async remove(id) {
        return await db.members.delete(id);
    }
};

// ── PROFILE OPERATIONS ──
const ProfileDB = {
    async get() {
        const profile = await db.profile.get('user');
        return profile || null;
    },
    async save(data) {
        data.key = 'user';
        data.updatedAt = new Date().toISOString();
        return await db.profile.put(data);
    },
    async exists() {
        const p = await db.profile.get('user');
        return !!p;
    }
};

// ── VENDOR OPERATIONS ──
const VendorDB = {
    async getAll() {
        return await db.vendors.toArray();
    },
    async add(vendor) {
        vendor.createdAt = new Date().toISOString();
        return await db.vendors.add(vendor);
    },
    async get(id) {
        return await db.vendors.get(id);
    },
    async update(id, changes) {
        return await db.vendors.update(id, changes);
    },
    async remove(id) {
        // Also remove all transactions for this vendor
        await db.transactions.where('vendorId').equals(id).delete();
        return await db.vendors.delete(id);
    }
};

// ── TRANSACTION OPERATIONS ──
const TransactionDB = {
    async getAll() {
        return await db.transactions.orderBy('createdAt').reverse().toArray();
    },
    async getByVendor(vendorId) {
        return await db.transactions.where('vendorId').equals(vendorId).toArray();
    },
    async getThisMonth() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        return await db.transactions
            .where('date')
            .aboveOrEqual(startOfMonth.split('T')[0])
            .toArray();
    },
    async add(txn) {
        txn.createdAt = new Date().toISOString();
        return await db.transactions.add(txn);
    },
    async remove(id) {
        return await db.transactions.delete(id);
    }
};

// ── DOCUMENT OPERATIONS ──
const DocumentDB = {
    async getAll() {
        return await db.documents.toArray();
    },
    async getByCategory(cat) {
        if (cat === 'all') return this.getAll();
        return await db.documents.where('category').equals(cat).toArray();
    },
    async add(doc) {
        doc.createdAt = new Date().toISOString();
        return await db.documents.add(doc);
    },
    async get(id) {
        return await db.documents.get(id);
    },
    async update(id, changes) {
        return await db.documents.update(id, changes);
    },
    async remove(id) {
        return await db.documents.delete(id);
    },
    async getExpiring(daysAhead = 30) {
        const allDocs = await this.getAll();
        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);

        return allDocs.filter(doc => {
            if (!doc.expiryDate) return false;
            const expiry = new Date(doc.expiryDate);
            return expiry >= now && expiry <= futureDate;
        });
    },
    async getExpired() {
        const allDocs = await this.getAll();
        const now = new Date();
        return allDocs.filter(doc => {
            if (!doc.expiryDate) return false;
            return new Date(doc.expiryDate) < now;
        });
    }
};

// ── HERITAGE OPERATIONS ──
const HeritageDB = {
    async getAll() {
        return await db.heritage.toArray();
    },
    async getByType(type) {
        if (type === 'all') return this.getAll();
        return await db.heritage.where('type').equals(type).toArray();
    },
    async add(item) {
        item.createdAt = new Date().toISOString();
        return await db.heritage.add(item);
    },
    async get(id) {
        return await db.heritage.get(id);
    },
    async update(id, changes) {
        return await db.heritage.update(id, changes);
    },
    async remove(id) {
        return await db.heritage.delete(id);
    }
};

// ── EXPORT / IMPORT ──
const DataIO = {
    async exportAll() {
        const data = {
            version: 2,
            exportedAt: new Date().toISOString(),
            profile: await db.profile.toArray(),
            vendors: await db.vendors.toArray(),
            transactions: await db.transactions.toArray(),
            documents: await db.documents.toArray(),
            heritage: await db.heritage.toArray()
        };
        return JSON.stringify(data, null, 2);
    },
    async importAll(jsonString) {
        const data = JSON.parse(jsonString);
        if (!data.version) throw new Error('Invalid NEST backup file.');
        
        // Clear existing data
        await db.vendors.clear();
        await db.transactions.clear();
        await db.documents.clear();
        await db.heritage.clear();

        // Bulk import
        if (data.profile?.length) {
            await db.profile.clear();
            await db.profile.bulkAdd(data.profile);
        }
        if (data.vendors?.length) await db.vendors.bulkAdd(data.vendors);
        if (data.transactions?.length) await db.transactions.bulkAdd(data.transactions);
        if (data.documents?.length) await db.documents.bulkAdd(data.documents);
        if (data.heritage?.length) await db.heritage.bulkAdd(data.heritage);

        return {
            vendors: data.vendors?.length || 0,
            transactions: data.transactions?.length || 0,
            documents: data.documents?.length || 0,
            heritage: data.heritage?.length || 0
        };
    }
};

console.log('🔐 NEST Database initialized (Local-First, Zero-Cloud)');
