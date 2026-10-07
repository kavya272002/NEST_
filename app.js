/* ═══════════════════════════════════════════════════
   NEST — Sovereign Family Document Locker
   "Studio Graphite Integrated System"
   ═══════════════════════════════════════════════════ */

(function() {
    'use strict';

    // ── APP STATE ──
    let currentLang = 'en';
    let userName = '';
    let currentMemberFilter = 'all';
    let currentCategoryFilter = 'all';
    let householdKey = '';
    let householdId = '';

    // Minimal Vector Icons
    const SVG_ICONS = {
        education: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
        identity: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 8h2M15 12h2M7 16h10"/></svg>`,
        insurance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
        finance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
        property: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
        other: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`
    };

    // ── SPLASH SCREEN ──
    function initSplash() {
        const splash = document.getElementById('splash-screen');

        setTimeout(async () => {
            splash.classList.add('fade-out');
            setTimeout(async () => {
                splash.style.display = 'none';
                
                const hasProfile = await ProfileDB.exists();
                if (hasProfile) {
                    const profile = await ProfileDB.get();
                    userName = profile.name;
                    currentLang = profile.language || 'en';
                    showMainApp();
                } else {
                    showLandingPage();
                }
            }, 300);
        }, 1000);
    }

    // ═══════════════════════════════════════
    //  LANDING & ONBOARDING
    // ═══════════════════════════════════════
    function showLandingPage() {
        const landing = document.getElementById('landing-screen');
        if (!landing) return;
        
        landing.classList.remove('hidden');

        const startBtn = document.getElementById('btn-landing-start');
        if (startBtn) {
            startBtn.onclick = () => {
                landing.classList.add('hidden');
                showOnboarding();
            };
        }
    }

    function showOnboarding() {
        document.getElementById('onboarding-screen').classList.remove('hidden');

        document.getElementById('form-onboarding').addEventListener('submit', async (e) => {
            e.preventDefault();
            userName = document.getElementById('onboard-name').value.trim();
            currentLang = document.getElementById('onboard-lang').value || 'en';
            if (!userName) return;

            await ProfileDB.save({ name: userName, language: currentLang });

            // Create default family members
            await MemberDB.add({ name: 'Self (' + userName + ')', relation: 'Self' });
            await MemberDB.add({ name: 'Father', relation: 'Father' });
            await MemberDB.add({ name: 'Mother', relation: 'Mother' });

            document.getElementById('onboarding-screen').classList.add('hidden');
            showMainApp();
        });
    }

    // ═══════════════════════════════════════
    //  MAIN SYSTEM APP INIT
    // ═══════════════════════════════════════
    async function showMainApp() {
        const app = document.getElementById('app');
        app.classList.remove('hidden');

        if (window.i18n && window.i18n.applyLanguage) {
            window.i18n.applyLanguage(currentLang);
        }

        setupModals();
        setupForms();
        setupExportImport();
        setupSettings();
        setupLanguageToggle();
        setupDocumentSearch();
        setupFilePreview();

        await checkJoinInvite();

        // Ensure default family members exist
        const members = await MemberDB.getAll();
        if (members.length === 0) {
            await MemberDB.add({ name: userName ? 'Self (' + userName + ')' : 'Self', relation: 'Self' });
            await MemberDB.add({ name: 'Father', relation: 'Father' });
            await MemberDB.add({ name: 'Mother', relation: 'Mother' });
        }

        await refreshFamilyFolders();
        await refreshDocuments();
        await initHousehold();
        registerServiceWorker();
    }

    // ═══════════════════════════════════════
    //  FAMILY MEMBER FOLDERS SYSTEM
    // ═══════════════════════════════════════
    async function refreshFamilyFolders() {
        const members = await MemberDB.getAll();
        const bar = document.getElementById('family-folders-bar');
        const holderSelect = document.getElementById('doc-holder');

        if (!bar) return;

        let barHtml = `
            <button class="member-folder-pill ${currentMemberFilter === 'all' ? 'active' : ''}" data-member="all">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span>All Documents</span>
            </button>
        `;

        let selectHtml = '';

        for (const m of members) {
            let displayName = m.name;
            if (m.relation === 'Self' || m.name.toLowerCase().startsWith('self')) {
                displayName = userName ? `Self (${userName})` : 'Self';
            }
            const isActive = currentMemberFilter === m.name || (currentMemberFilter === displayName);
            barHtml += `
                <button class="member-folder-pill ${isActive ? 'active' : ''}" data-member="${escapeHtml(m.name)}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span>${escapeHtml(displayName)}</span>
                </button>
            `;

            selectHtml += `<option value="${escapeHtml(m.name)}">${escapeHtml(displayName)}</option>`;
        }

        barHtml += `
            <button id="btn-open-add-member" class="member-folder-pill add-folder-btn">
                <span>+ Add Member</span>
            </button>
        `;

        bar.innerHTML = barHtml;
        if (holderSelect) holderSelect.innerHTML = selectHtml;

        // Bind member folder pill clicks
        bar.querySelectorAll('.member-folder-pill[data-member]').forEach(pill => {
            pill.addEventListener('click', async () => {
                currentMemberFilter = pill.dataset.member;
                await refreshFamilyFolders();
                await refreshDocuments();
            });
        });

        const btnAddMember = document.getElementById('btn-open-add-member');
        if (btnAddMember) {
            btnAddMember.addEventListener('click', () => openModal('modal-add-member'));
        }
    }

    // ═══════════════════════════════════════
    //  DOCUMENT WORKSPACE RENDERING
    // ═══════════════════════════════════════
    async function refreshDocuments() {
        const query = document.getElementById('doc-search-input') ? document.getElementById('doc-search-input').value.trim().toLowerCase() : '';
        await renderDocuments(currentMemberFilter, currentCategoryFilter, query);
    }

    async function renderDocuments(memberFilter = 'all', categoryFilter = 'all', query = '') {
        let docs = await DocumentDB.getAll();

        // Filter by Family Member Folder
        if (memberFilter !== 'all') {
            docs = docs.filter(d => d.holder && d.holder.toLowerCase() === memberFilter.toLowerCase());
        }

        // Filter by Category
        if (categoryFilter !== 'all') {
            docs = docs.filter(d => d.category === categoryFilter);
        }

        // Search Filter
        if (query) {
            docs = docs.filter(d => 
                (d.name && d.name.toLowerCase().includes(query)) ||
                (d.holder && d.holder.toLowerCase().includes(query)) ||
                (d.number && d.number.toLowerCase().includes(query)) ||
                (d.notes && d.notes.toLowerCase().includes(query))
            );
        }

        const grid = document.getElementById('documents-grid');
        if (!grid) return;

        if (docs.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div class="empty-title">No documents in this folder</div>
                    <div class="empty-desc">Tap '+ Add Document' to save marksheets, identity cards, or property papers.</div>
                </div>`;
            return;
        }

        let html = '';
        for (const doc of docs) {
            const iconSvg = SVG_ICONS[doc.category] || SVG_ICONS.other;
            const hasImage = doc.image ? `<span class="badge-has-file"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> File Attached</span>` : '';

            html += `
            <div class="doc-tile" onclick="NestApp.viewDocument(${doc.id})">
                <div class="doc-tile-top">
                    <div class="doc-icon-box">${iconSvg}</div>
                    <div style="display:flex; align-items:center; gap:0.35rem;">
                        ${doc.holder ? `<span class="doc-member-tag">${escapeHtml(doc.holder)}</span>` : ''}
                        <button class="icon-btn-tile-share" title="Share Document" onclick="event.stopPropagation(); NestApp.shareDocument(${doc.id})">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                        </button>
                    </div>
                </div>
                <div>
                    <div class="doc-tile-title">${escapeHtml(doc.name)}</div>
                    ${doc.number ? `<div class="doc-tile-meta">ID: ${escapeHtml(doc.number)}</div>` : ''}
                </div>
                <div class="doc-tile-bottom">
                    <span>${doc.issuedDate ? formatDate(doc.issuedDate) : 'Saved'}</span>
                    ${hasImage}
                </div>
            </div>`;
        }
        grid.innerHTML = html;
    }

    // ═══════════════════════════════════════
    //  DOCUMENT DETAIL VIEW
    // ═══════════════════════════════════════
    async function viewDocument(id) {
        const doc = await DocumentDB.get(id);
        if (!doc) return;

        document.getElementById('detail-doc-name').textContent = doc.name;
        document.getElementById('detail-doc-cat').textContent = doc.category || 'General';
        document.getElementById('detail-doc-holder').textContent = doc.holder || 'Not specified';
        document.getElementById('detail-doc-num').textContent = doc.number || 'None';
        document.getElementById('detail-doc-expiry').textContent = formatDate(doc.expiryDate);
        document.getElementById('detail-doc-notes').textContent = doc.notes || 'No notes added.';

        const previewDiv = document.getElementById('detail-doc-preview');
        const downloadBtn = document.getElementById('detail-doc-download');
        const shareBtn = document.getElementById('btn-share-doc-modal');

        if (doc.image) {
            previewDiv.innerHTML = `<img src="${doc.image}" alt="${escapeHtml(doc.name)}" style="max-width:100%; max-height:280px; object-fit:contain;">`;
            downloadBtn.href = doc.image;
            downloadBtn.download = `${doc.name.replace(/\s+/g, '_')}`;
            downloadBtn.style.display = 'inline-flex';
        } else {
            previewDiv.innerHTML = `<div style="padding:2rem; color:var(--text-muted); text-align:center;">No File Attachment</div>`;
            downloadBtn.style.display = 'none';
        }

        if (shareBtn) {
            shareBtn.style.display = 'inline-flex';
            shareBtn.onclick = () => {
                shareDocument(doc.id);
            };
        }

        const deleteBtn = document.getElementById('btn-delete-doc-modal');
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                closeModal('modal-doc-detail');
                deleteDocument(doc.id, doc.name);
            };
        }

        openModal('modal-doc-detail');
    }

    function dataURLtoBlob(dataurl) {
        try {
            const arr = dataurl.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            return new Blob([u8arr], { type: mime });
        } catch (e) {
            return null;
        }
    }

    async function shareDocument(id) {
        const doc = await DocumentDB.get(id);
        if (!doc) return;

        showToast('Preparing document...');

        const shareTitle = doc.name;
        const shareText = `📌 *NEST Vault Document*\n📄 *Name:* ${doc.name}\n👤 *Member:* ${doc.holder || 'Self'}${doc.number ? `\n🔢 *Number:* ${doc.number}` : ''}`;

        if (doc.image) {
            try {
                const blob = dataURLtoBlob(doc.image);
                if (blob) {
                    let ext = 'png';
                    if (blob.type.includes('pdf')) ext = 'pdf';
                    else if (blob.type.includes('jpeg') || blob.type.includes('jpg')) ext = 'jpg';
                    else if (blob.type.includes('webp')) ext = 'webp';

                    const fileName = `${doc.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;
                    const file = new File([blob], fileName, { type: blob.type || 'image/png' });

                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: shareTitle,
                            text: shareText
                        });
                        showToast('Shared successfully');
                        return;
                    } else if (navigator.share) {
                        await navigator.share({
                            title: shareTitle,
                            text: shareText
                        });
                        return;
                    }
                }
            } catch (err) {
                console.warn('File share fallback:', err);
            }
        }

        if (navigator.share) {
            try {
                await navigator.share({ title: shareTitle, text: shareText });
                return;
            } catch (e) {}
        }

        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
    }

    async function deleteDocument(id, name) {
        showConfirm(`Delete "${name}" from your vault? This cannot be undone.`, async () => {
            await DocumentDB.remove(id);
            await refreshDocuments();
            showToast('Document deleted');
        });
    }

    // ═══════════════════════════════════════
    //  MODAL HANDLERS
    // ═══════════════════════════════════════
    function setupModals() {
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalId = btn.dataset.modal;
                closeModal(modalId);
            });
        });

        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeModal(overlay.id);
            });
        });

        const btnAddDoc = document.getElementById('btn-add-doc');
        if (btnAddDoc) btnAddDoc.addEventListener('click', () => openModal('modal-document'));
    }

    function openModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('show');
            setTimeout(() => {
                const input = modal.querySelector('input:not([type="hidden"]), select, textarea');
                if (input) input.focus();
            }, 150);
        }
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('show');
            const form = modal.querySelector('form');
            if (form) form.reset();

            const previewDiv = document.getElementById('doc-file-preview');
            if (previewDiv) {
                previewDiv.classList.add('hidden');
                previewDiv.innerHTML = '';
            }
        }
    }

    // ═══════════════════════════════════════
    //  FORM SUBMISSIONS
    // ═══════════════════════════════════════
    function setupForms() {
        // Document Form Submit
        document.getElementById('form-document').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('doc-file');
            const file = fileInput.files[0];
            let imageData = null;
            if (file) imageData = await fileToBase64(file);

            const doc = {
                name: document.getElementById('doc-name').value.trim(),
                category: document.getElementById('doc-category').value,
                holder: document.getElementById('doc-holder').value,
                number: document.getElementById('doc-number').value.trim(),
                issuedDate: document.getElementById('doc-issued').value || null,
                expiryDate: document.getElementById('doc-expiry').value || null,
                notes: document.getElementById('doc-notes').value.trim(),
                image: imageData
            };

            await DocumentDB.add(doc);
            closeModal('modal-document');
            await refreshDocuments();
            showToast('Document saved successfully');
        });

        // Add Family Member Form Submit
        document.getElementById('form-add-member').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('member-name').value.trim();
            const relation = document.getElementById('member-relation').value;

            if (!name) return;

            await MemberDB.add({ name, relation });
            closeModal('modal-add-member');
            await refreshFamilyFolders();
            showToast(`Family folder "${name}" created`);
        });

        // Category Sub-Pill Clicks
        document.querySelectorAll('.cat-pill').forEach(pill => {
            pill.addEventListener('click', async () => {
                document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                currentCategoryFilter = pill.dataset.cat;
                await refreshDocuments();
            });
        });
    }

    // ═══════════════════════════════════════
    //  SEARCH & FILE PREVIEW
    // ═══════════════════════════════════════
    function setupDocumentSearch() {
        const searchInput = document.getElementById('doc-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                refreshDocuments();
            });
        }
    }

    function setupFilePreview() {
        const fileInput = document.getElementById('doc-file');
        const previewDiv = document.getElementById('doc-file-preview');

        if (fileInput && previewDiv) {
            fileInput.addEventListener('change', async () => {
                const file = fileInput.files[0];
                if (file) {
                    if (file.type.startsWith('image/')) {
                        const base64 = await fileToBase64(file);
                        previewDiv.innerHTML = `<img src="${base64}" alt="Preview" style="max-height:120px; border-radius:6px;">`;
                        previewDiv.classList.remove('hidden');
                    } else {
                        previewDiv.innerHTML = `<div style="padding:0.5rem; font-size:0.8rem; color:var(--text-secondary);">Attached: ${escapeHtml(file.name)}</div>`;
                        previewDiv.classList.remove('hidden');
                    }
                } else {
                    previewDiv.classList.add('hidden');
                    previewDiv.innerHTML = '';
                }
            });
        }
    }

    // ═══════════════════════════════════════
    //  FAMILY SYNC & IMPORT/EXPORT
    // ═══════════════════════════════════════
    async function checkJoinInvite() {
        const urlParams = new URLSearchParams(window.location.search);
        const joinData = urlParams.get('join');
        
        if (joinData) {
            try {
                const payload = JSON.parse(atob(joinData));
                if (payload.key) {
                    const profile = await ProfileDB.get();
                    profile.householdKey = payload.key;
                    profile.householdId = payload.id;
                    await ProfileDB.save(profile);
                    
                    householdKey = payload.key;
                    householdId = payload.id;
                    
                    window.history.replaceState({}, document.title, window.location.pathname);
                    showToast('Family Sync linked');
                }
            } catch (err) {
                console.error('Failed to join:', err);
            }
        }
    }

    async function initHousehold() {
        const profile = await ProfileDB.get();
        if (!profile.householdKey) {
            householdKey = await NestSync.generateHouseholdKey();
            householdId = NestSync.generateHouseholdId();
            profile.householdKey = householdKey;
            profile.householdId = householdId;
            await ProfileDB.save(profile);
        } else {
            householdKey = profile.householdKey;
            householdId = profile.householdId;
        }
        
        const displayEl = document.getElementById('txt-household-id');
        if (displayEl) displayEl.textContent = householdId;
    }

    async function handleInviteGeneration() {
        const payload = NestSync.generateInvitePayload(householdId, householdKey);
        const baseUrl = NestSync.generateShareLink();
        const fullUrl = `${baseUrl}?join=${btoa(JSON.stringify(payload))}`;
        
        const qrDisplay = document.getElementById('qr-display');
        if (qrDisplay) qrDisplay.innerHTML = NestSync.generateQRCodeSVG(fullUrl, 200);
        
        const copyBtn = document.getElementById('btn-copy-link');
        if (copyBtn) copyBtn.dataset.url = fullUrl;
        
        openModal('modal-qr');
    }

    function copyInviteLink(e) {
        const btn = e.target.closest('button');
        const url = btn ? btn.dataset.url : '';
        if (url) {
            navigator.clipboard.writeText(url);
            showToast('Sync link copied');
        }
    }

    function setupExportImport() {
        document.getElementById('btn-export').addEventListener('click', async () => {
            try {
                const json = await DataIO.exportAll();
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `nest-backup-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                showToast('Backup exported');
            } catch (err) {
                showToast('Export failed: ' + err.message);
            }
        });

        const fileInput = document.getElementById('import-file-input');
        document.getElementById('btn-import').addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                await DataIO.importAll(text);
                showToast('Backup restored successfully');
                await refreshFamilyFolders();
                await refreshDocuments();
            } catch (err) {
                showToast('Import failed: ' + err.message);
            }
            fileInput.value = '';
        });
    }

    function setupLanguageToggle() {
        const btn = document.getElementById('btn-lang-toggle');
        if (btn) {
            btn.addEventListener('click', async () => {
                currentLang = currentLang === 'en' ? 'hi' : 'en';
                const profile = await ProfileDB.get();
                if (profile) {
                    profile.language = currentLang;
                    await ProfileDB.save(profile);
                }
                if (window.i18n && window.i18n.applyLanguage) {
                    window.i18n.applyLanguage(currentLang);
                }
                await refreshDocuments();
                showToast(currentLang === 'hi' ? 'भाषा हिन्दी में बदली गई' : 'Language set to English');
            });
        }
    }

    function setupSettings() {
        document.getElementById('btn-settings').addEventListener('click', async () => {
            const profile = await ProfileDB.get();
            if (profile) {
                document.getElementById('settings-name').value = profile.name;
                document.getElementById('settings-lang').value = profile.language || 'en';
            }
            openModal('modal-settings');
        });

        document.getElementById('form-settings').addEventListener('submit', async (e) => {
            e.preventDefault();
            userName = document.getElementById('settings-name').value.trim();
            currentLang = document.getElementById('settings-lang').value;
            await ProfileDB.save({ name: userName, language: currentLang });

            // Sync Self member record
            const members = await MemberDB.getAll();
            const selfMember = members.find(m => m.relation === 'Self' || m.name.toLowerCase().startsWith('self'));
            if (selfMember) {
                await MemberDB.remove(selfMember.id);
                await MemberDB.add({ name: 'Self (' + userName + ')', relation: 'Self' });
            }

            if (window.i18n && window.i18n.applyLanguage) {
                window.i18n.applyLanguage(currentLang);
            }

            closeModal('modal-settings');
            await refreshFamilyFolders();
            await refreshDocuments();
            showToast('Settings saved');
        });
    }

    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js').catch(() => {});
            });
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function showToast(message) {
        const toast = document.getElementById('toast');
        const msgEl = document.getElementById('toast-message');
        if (toast && msgEl) {
            msgEl.textContent = message;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2500);
        }
    }

    function showConfirm(message, onConfirm) {
        const msgEl = document.getElementById('confirm-message');
        const btnYes = document.getElementById('btn-confirm-yes');
        if (msgEl) msgEl.textContent = message;
        
        if (btnYes) {
            btnYes.onclick = async () => {
                closeModal('modal-confirm');
                if (onConfirm) await onConfirm();
            };
        }
        openModal('modal-confirm');
    }

    window.NestApp = window.KoshApp = {
        viewDocument,
        deleteDocument,
        shareDocument
    };

    document.addEventListener('DOMContentLoaded', initSplash);
})();
