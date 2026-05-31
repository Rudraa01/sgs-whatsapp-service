const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

let qrCodeData = null;
let clientStatus = 'disconnected'; // 'disconnected', 'connecting', 'qr_ready', 'connected'
let clientInstance = null;

let lastError = null;

// Initialize WhatsApp client
function createClient() {
    const c = new Client({
        authStrategy: new LocalAuth({
            dataPath: path.join(__dirname, 'session')
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process'
            ]
        }
    });

    // QR Code Event
    c.on('qr', (qr) => {
        clientStatus = 'qr_ready';
        lastError = null;
        
        // Print QR in logs for console scanning
        console.log('\n--- SCAN THIS QR CODE TO CONNECT ---');
        qrcodeTerminal.generate(qr, { small: true });
        console.log('------------------------------------\n');

        // Generate base64 Data URL for web dashboard
        qrcode.toDataURL(qr, (err, url) => {
            if (!err) {
                qrCodeData = url;
                console.log('[WhatsApp] QR Code generated successfully.');
            } else {
                console.error('[WhatsApp] Failed to convert QR to Data URL:', err);
                lastError = 'QR conversion error: ' + err.message;
            }
        });
    });

    // Client Ready Event
    c.on('ready', () => {
        clientStatus = 'connected';
        qrCodeData = null;
        lastError = null;
        console.log('[WhatsApp] Client is ready and connected!');
    });

    // Authentication Success Event
    c.on('authenticated', () => {
        console.log('[WhatsApp] Authenticated successfully.');
    });

    // Authentication Failure Event
    c.on('auth_failure', (msg) => {
        clientStatus = 'disconnected';
        qrCodeData = null;
        lastError = 'Auth failure: ' + msg;
        console.error('[WhatsApp] Authentication failed:', msg);
    });

    // Disconnected Event
    c.on('disconnected', (reason) => {
        clientStatus = 'disconnected';
        qrCodeData = null;
        lastError = 'Client disconnected: ' + reason;
        console.log('[WhatsApp] Client disconnected:', reason);
    });

    return c;
}

// Start Client
function startClient() {
    if (clientStatus === 'connected' || clientStatus === 'connecting') {
        console.log(`[WhatsApp] Skipping start: client is already ${clientStatus}`);
        return;
    }
    clientStatus = 'connecting';
    lastError = null;
    console.log('[WhatsApp] Initializing WhatsApp Client...');

    try {
        clientInstance = createClient();
        clientInstance.initialize().catch(err => {
            console.error('[WhatsApp] Error during initialization promise:', err);
            clientStatus = 'disconnected';
            lastError = err.message || String(err);
            qrCodeData = null;
        });
    } catch (err) {
        console.error('[WhatsApp] Synchronous error initializing client:', err);
        clientStatus = 'disconnected';
        lastError = err.message || String(err);
        qrCodeData = null;
    }
}

// Force Restart & Clear Session
async function forceRestart() {
    console.log('[WhatsApp] Initiating force restart...');
    clientStatus = 'disconnected';
    qrCodeData = null;

    if (clientInstance) {
        try {
            await clientInstance.destroy();
        } catch (e) {
            console.warn('[WhatsApp] Error destroying client instance:', e.message);
        }
        clientInstance = null;
    }

    // Delete session files to force fresh QR scan
    const sessionPath = path.join(__dirname, 'session');
    if (fs.existsSync(sessionPath)) {
        try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log('[WhatsApp] Cleared session folder.');
        } catch (e) {
            console.warn('[WhatsApp] Error deleting session folder:', e.message);
        }
    }

    // Wait and start client fresh
    await new Promise(r => setTimeout(r, 2000));
    startClient();
}

// Start client on boot
startClient();

// ==========================================
// API ROUTES
// ==========================================

// 1. GET /status — Get current service state
app.get('/status', (req, res) => {
    res.json({
        status: clientStatus,
        qr: qrCodeData,
        error: lastError
    });
});

// 2. GET /qr — Visual page to scan QR code directly
app.get('/qr', (req, res) => {
    if (clientStatus === 'connected') {
        return res.send(`
            <div style="font-family:sans-serif; text-align:center; margin-top:50px;">
                <h2 style="color:green;">✔ WhatsApp Client is Connected!</h2>
                <p>No scanning needed. Ready to send messages.</p>
            </div>
        `);
    }

    if (clientStatus === 'connecting') {
        return res.send(`
            <div style="font-family:sans-serif; text-align:center; margin-top:50px;">
                <h2>Initializing WhatsApp Web...</h2>
                <p>Generating session. Page will auto-refresh in 5 seconds.</p>
                <script>setTimeout(() => window.location.reload(), 5000);</script>
            </div>
        `);
    }

    if (clientStatus === 'qr_ready' && qrCodeData) {
        return res.send(`
            <div style="font-family:sans-serif; text-align:center; margin-top:50px;">
                <h2>Scan QR Code</h2>
                <p>Open WhatsApp on your phone -> Linked Devices -> Link a Device</p>
                <div style="margin:20px 0;"><img src="${qrCodeData}" style="border: 2px solid #ccc; padding: 10px; border-radius: 8px;" /></div>
                <p style="color:#666;">Page will auto-refresh every 5 seconds to check connection.</p>
                <script>
                    setInterval(async () => {
                        try {
                            const res = await fetch('/status');
                            const data = await res.json();
                            if (data.status === 'connected') {
                                window.location.reload();
                            }
                        } catch(e) {}
                    }, 5000);
                </script>
            </div>
        `);
    }

    return res.send(`
        <div style="font-family:sans-serif; text-align:center; margin-top:50px;">
            <h2 style="color:red;">❌ Client is Offline</h2>
            <p>Click below to initialize the server session:</p>
            <form action="/connect" method="POST" target="_blank" onsubmit="setTimeout(()=>window.location.reload(), 2000)">
                <button type="submit" style="padding:10px 20px; font-size:16px; background:#007bff; color:#white; border:none; cursor:pointer; border-radius:5px;">Link Device</button>
            </form>
        </div>
    `);
});

// 3. POST /send-otp — Send WhatsApp OTP
app.post('/send-otp', async (req, res) => {
    const phoneInput = req.body.phone || req.body.to;
    const messageInput = req.body.message;

    if (!phoneInput || !messageInput) {
        return res.status(400).json({ error: 'Parameters "phone" and "message" are required.' });
    }

    if (clientStatus !== 'connected' || !clientInstance) {
        return res.status(400).json({ error: 'WhatsApp service is offline.' });
    }

    try {
        // Normalize phone number (strip non-digits)
        let formattedNumber = phoneInput.replace(/\D/g, '');
        if (formattedNumber.length === 10) {
            formattedNumber = '91' + formattedNumber; // Default to Indian (+91)
        }

        const chatId = formattedNumber + '@c.us';
        console.log(`[WhatsApp] Sending message to ${chatId}...`);
        await clientInstance.sendMessage(chatId, messageInput);
        
        res.json({ success: true });
    } catch (err) {
        console.error('[WhatsApp] Failed to send message:', err);
        
        // Handle session detached state
        if (err.message && err.message.includes('detached')) {
            console.warn('[WhatsApp] Detached frame error detected. Marking offline.');
            clientStatus = 'disconnected';
        }
        res.status(500).json({ error: err.message });
    }
});

// 4. POST /send-message (Alias for send-otp for compatibility)
app.post('/send-message', async (req, res) => {
    // Forward directly to /send-otp handler logic
    const phoneInput = req.body.to || req.body.phone;
    const messageInput = req.body.message;

    if (!phoneInput || !messageInput) {
        return res.status(400).json({ error: 'Parameters "to" and "message" are required.' });
    }

    if (clientStatus !== 'connected' || !clientInstance) {
        return res.status(400).json({ error: 'WhatsApp service is offline.' });
    }

    try {
        let formattedNumber = phoneInput.replace(/\D/g, '');
        if (formattedNumber.length === 10) {
            formattedNumber = '91' + formattedNumber;
        }

        const chatId = formattedNumber + '@c.us';
        console.log(`[WhatsApp] Sending message (alias) to ${chatId}...`);
        await clientInstance.sendMessage(chatId, messageInput);
        res.json({ success: true });
    } catch (err) {
        console.error('[WhatsApp] Failed to send message (alias):', err);
        if (err.message && err.message.includes('detached')) {
            clientStatus = 'disconnected';
        }
        res.status(500).json({ error: err.message });
    }
});

// 5. POST /connect — Initialize WhatsApp Web connection
app.post('/connect', (req, res) => {
    if (clientStatus === 'disconnected') {
        startClient();
    }
    res.json({ status: clientStatus });
});

// 6. POST /disconnect — Logout & disconnect session
app.post('/disconnect', async (req, res) => {
    try {
        if (clientInstance && (clientStatus === 'connected' || clientStatus === 'qr_ready')) {
            await clientInstance.logout();
            clientStatus = 'disconnected';
            qrCodeData = null;
            console.log('[WhatsApp] Client logged out successfully.');
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[WhatsApp] Error during logout:', err);
        res.status(500).json({ error: err.message });
    }
});

// 7. POST /restart — Clear old session files and start a fresh pairing instance
app.post('/restart', async (req, res) => {
    try {
        await forceRestart();
        res.json({ success: true, message: 'WhatsApp service restarting. Scan new QR code.' });
    } catch (err) {
        console.error('[WhatsApp] Error during restart:', err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 4500;
app.listen(PORT, () => {
    console.log(`[WhatsApp API] Service listening on port ${PORT}`);
});
