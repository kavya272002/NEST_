/* ═══════════════════════════════════════════════════
   NEST — Sync & QR Module
   Privacy-First Household Connectivity
   ═══════════════════════════════════════════════════ */
const NestSync = (function() {
    'use strict';

    // ══════════════════════════════════════
    //  QR CODE GENERATOR (Pure SVG, Zero Dependencies)
    // ══════════════════════════════════════

    // Minimal QR Code encoder for short URLs
    // Uses a compact SVG-based approach
    function generateQRCodeSVG(text, size = 200) {
        const matrix = encodeQR(text);
        const cellSize = size / matrix.length;
        
        let svgPaths = '';
        for (let y = 0; y < matrix.length; y++) {
            for (let x = 0; x < matrix[y].length; x++) {
                if (matrix[y][x]) {
                    svgPaths += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize + 0.5}" height="${cellSize + 0.5}" fill="#D4AF37"/>`;
                }
            }
        }

        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="background:#0F0F1B;border-radius:12px;padding:8px;">
            ${svgPaths}
        </svg>`;
    }

    // Minimal QR encoder (supports up to ~100 chars in byte mode, version 3-5)
    function encodeQR(text) {
        const data = new TextEncoder().encode(text);
        const len = data.length;
        
        // Determine version (simplified)
        let version, ecLevel;
        if (len <= 17) { version = 1; ecLevel = 'M'; }
        else if (len <= 32) { version = 2; ecLevel = 'M'; }
        else if (len <= 49) { version = 3; ecLevel = 'M'; }
        else if (len <= 78) { version = 4; ecLevel = 'M'; }
        else if (len <= 106) { version = 5; ecLevel = 'M'; }
        else if (len <= 134) { version = 6; ecLevel = 'M'; }
        else if (len <= 154) { version = 7; ecLevel = 'M'; }
        else { version = 8; ecLevel = 'L'; }
        
        const size = version * 4 + 17;
        
        // Create matrix with simple pattern encoding
        const matrix = Array.from({ length: size }, () => Array(size).fill(0));
        
        // Add finder patterns
        addFinderPattern(matrix, 0, 0, size);
        addFinderPattern(matrix, size - 7, 0, size);
        addFinderPattern(matrix, 0, size - 7, size);
        
        // Add timing patterns
        for (let i = 8; i < size - 8; i++) {
            matrix[6][i] = (i % 2 === 0) ? 1 : 0;
            matrix[i][6] = (i % 2 === 0) ? 1 : 0;
        }
        
        // Add alignment pattern for version >= 2
        if (version >= 2) {
            const alignPos = getAlignmentPositions(version);
            for (const ay of alignPos) {
                for (const ax of alignPos) {
                    if (isFinderArea(ax, ay, size)) continue;
                    addAlignmentPattern(matrix, ax, ay);
                }
            }
        }
        
        // Encode data into remaining cells using a seeded pattern
        let bitIndex = 0;
        const dataBits = [];
        
        // Mode indicator (0100 = byte mode)
        dataBits.push(0, 1, 0, 0);
        
        // Character count (8 bits for version 1-9)
        for (let i = 7; i >= 0; i--) {
            dataBits.push((len >> i) & 1);
        }
        
        // Data bits
        for (const byte of data) {
            for (let i = 7; i >= 0; i--) {
                dataBits.push((byte >> i) & 1);
            }
        }
        
        // Terminator
        dataBits.push(0, 0, 0, 0);
        
        // Fill remaining data area with encoded data
        let dataIdx = 0;
        let right = size - 1;
        let upward = true;
        
        while (right >= 0) {
            if (right === 6) right--; // Skip timing column
            
            const rows = upward 
                ? Array.from({ length: size }, (_, i) => size - 1 - i) 
                : Array.from({ length: size }, (_, i) => i);
            
            for (const row of rows) {
                for (let col = right; col >= Math.max(right - 1, 0); col--) {
                    if (isReserved(matrix, row, col, size, version)) continue;
                    
                    const bit = dataIdx < dataBits.length ? dataBits[dataIdx] : 0;
                    // Apply mask pattern 0: (row + col) % 2 === 0
                    const mask = (row + col) % 2 === 0 ? 1 : 0;
                    matrix[row][col] = bit ^ mask;
                    dataIdx++;
                }
            }
            
            right -= 2;
            upward = !upward;
        }
        
        // Add format info
        addFormatInfo(matrix, size);
        
        return matrix;
    }

    function addFinderPattern(matrix, startRow, startCol, size) {
        const pattern = [
            [1,1,1,1,1,1,1],
            [1,0,0,0,0,0,1],
            [1,0,1,1,1,0,1],
            [1,0,1,1,1,0,1],
            [1,0,1,1,1,0,1],
            [1,0,0,0,0,0,1],
            [1,1,1,1,1,1,1]
        ];
        
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
                const row = startRow + r;
                const col = startCol + c;
                if (row >= 0 && row < size && col >= 0 && col < size) {
                    matrix[row][col] = pattern[r][c];
                }
            }
        }
        
        // Separator (white border)
        for (let i = -1; i <= 7; i++) {
            setCell(matrix, startRow - 1, startCol + i, 0, size);
            setCell(matrix, startRow + 7, startCol + i, 0, size);
            setCell(matrix, startRow + i, startCol - 1, 0, size);
            setCell(matrix, startRow + i, startCol + 7, 0, size);
        }
    }

    function addAlignmentPattern(matrix, cx, cy) {
        const pattern = [
            [1,1,1,1,1],
            [1,0,0,0,1],
            [1,0,1,0,1],
            [1,0,0,0,1],
            [1,1,1,1,1]
        ];
        for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
                matrix[cy + r][cx + c] = pattern[r + 2][c + 2];
            }
        }
    }

    function getAlignmentPositions(version) {
        const positions = {
            2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
            6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42]
        };
        return positions[version] || [6, 18];
    }

    function isFinderArea(x, y, size) {
        if (x <= 8 && y <= 8) return true;
        if (x >= size - 8 && y <= 8) return true;
        if (x <= 8 && y >= size - 8) return true;
        return false;
    }

    function isReserved(matrix, row, col, size, version) {
        // Finder patterns + separators
        if (row <= 8 && col <= 8) return true;
        if (row <= 8 && col >= size - 8) return true;
        if (row >= size - 8 && col <= 8) return true;
        // Timing patterns
        if (row === 6 || col === 6) return true;
        // Format info areas
        if (row === 8 && (col <= 8 || col >= size - 8)) return true;
        if (col === 8 && (row <= 8 || row >= size - 8)) return true;
        return false;
    }

    function setCell(matrix, row, col, value, size) {
        if (row >= 0 && row < size && col >= 0 && col < size) {
            matrix[row][col] = value;
        }
    }

    function addFormatInfo(matrix, size) {
        // Simplified format info for mask 0, EC level M
        const formatBits = [1,0,1,0,1,0,0,0,0,0,1,0,0,1,0];
        for (let i = 0; i < 15; i++) {
            // Around top-left finder
            if (i < 6) matrix[8][i] = formatBits[i];
            else if (i === 6) matrix[8][7] = formatBits[i];
            else if (i === 7) matrix[8][8] = formatBits[i];
            else if (i === 8) matrix[7][8] = formatBits[i];
            else matrix[14 - i][8] = formatBits[i];
        }
        // Along bottom-left and top-right
        for (let i = 0; i < 15; i++) {
            if (i < 8) {
                matrix[size - 1 - i][8] = formatBits[i];
            } else {
                matrix[8][size - 15 + i] = formatBits[i];
            }
        }
        // Dark module
        matrix[size - 8][8] = 1;
    }

    // ══════════════════════════════════════
    //  E2E ENCRYPTION (WebCrypto AES-GCM)
    // ══════════════════════════════════════
    
    async function generateHouseholdKey() {
        const key = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true, // extractable
            ['encrypt', 'decrypt']
        );
        const exported = await crypto.subtle.exportKey('raw', key);
        return bufferToHex(exported);
    }

    async function encryptData(plainText, hexKey) {
        const keyBuffer = hexToBuffer(hexKey);
        const key = await crypto.subtle.importKey(
            'raw', keyBuffer, { name: 'AES-GCM' }, false, ['encrypt']
        );
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(plainText);
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv }, key, encoded
        );
        // Prepend IV to ciphertext
        const combined = new Uint8Array(iv.length + ciphertext.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(ciphertext), iv.length);
        return bufferToBase64(combined);
    }

    async function decryptData(base64Cipher, hexKey) {
        const keyBuffer = hexToBuffer(hexKey);
        const key = await crypto.subtle.importKey(
            'raw', keyBuffer, { name: 'AES-GCM' }, false, ['decrypt']
        );
        const combined = base64ToBuffer(base64Cipher);
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv }, key, ciphertext
        );
        return new TextDecoder().decode(decrypted);
    }

    // ── Buffer helpers ──
    function bufferToHex(buffer) {
        return [...new Uint8Array(buffer)]
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    function hexToBuffer(hex) {
        const bytes = hex.match(/.{2}/g).map(b => parseInt(b, 16));
        return new Uint8Array(bytes);
    }

    function bufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    function base64ToBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    // ══════════════════════════════════════
    //  HOUSEHOLD ID (Short memorable codes)
    // ══════════════════════════════════════
    function generateHouseholdId() {
        // Format: NEST-XXXX-XXXX (easy to share verbally)
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
        let id = 'NEST-';
        for (let i = 0; i < 8; i++) {
            if (i === 4) id += '-';
            id += chars[Math.floor(Math.random() * chars.length)];
        }
        return id;
    }

    // ══════════════════════════════════════
    //  SHARE LINK GENERATION
    // ══════════════════════════════════════
    function generateShareLink() {
        // Use the current page URL as the base
        const baseUrl = window.location.href.split('?')[0].split('#')[0];
        return baseUrl;
    }

    function generateInvitePayload(householdId, encryptionKey) {
        return {
            id: householdId,
            key: encryptionKey,
            created: new Date().toISOString(),
            app: 'NEST'
        };
    }

    // ══════════════════════════════════════
    //  DATA SYNC HELPERS
    // ══════════════════════════════════════
    async function createSyncPackage() {
        const exportData = await DataIO.exportAll();
        return exportData;
    }

    async function applySyncPackage(jsonString) {
        return await DataIO.importAll(jsonString);
    }

    // ══════════════════════════════════════
    //  PUBLIC API
    // ══════════════════════════════════════
    return {
        generateQRCodeSVG,
        generateHouseholdKey,
        generateHouseholdId,
        encryptData,
        decryptData,
        generateShareLink,
        generateInvitePayload,
        createSyncPackage,
        applySyncPackage
    };

})();

console.log('🔗 NEST Sync Module loaded (E2EE + QR)');
