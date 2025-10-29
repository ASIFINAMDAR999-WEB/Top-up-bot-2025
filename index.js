// index.js — Enhanced Telegraf-based Telegram Top-Up Bot
// All text uses bold Unicode styling. Inline keyboards improved with better layout.

const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

// ---------- Config ----------
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8111508881:AAElg13q08OWf8RJNsJu9G0U4eng87SDQeQ';
const ADMIN_ID = Number(process.env.ADMIN_ID || '7830539814');

const DATA_DIR = path.resolve(__dirname);
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const LOGS_FILE = path.join(DATA_DIR, 'purchase_logs.json');
const CRYPTOS_FILE = path.join(DATA_DIR, 'cryptos.json');
const PENDING_APPROVALS_FILE = path.join(DATA_DIR, 'pending_approvals.json');

const OFFICIAL_CHANNEL_LINK = 'https://t.me/+Eg-SFpyzbpM0YzM1';
const OFFICIAL_WEBSITE = 'https://www.callspoofing.shop';
const ADMIN_CONTACT = '@AF3092';

// ---------- Bot init ----------
const bot = new Telegraf(TOKEN);

// ---------- Unicode bold stylizer (enhanced for full bot styling) ----------
function toBoldUnicodeChar(ch) {
    const code = ch.codePointAt(0);
    if (code >= 0x41 && code <= 0x5A) return String.fromCodePoint(0x1D400 + (code - 0x41)); // A-Z
    if (code >= 0x61 && code <= 0x7A) return String.fromCodePoint(0x1D41A + (code - 0x61)); // a-z
    if (code >= 0x30 && code <= 0x39) return String.fromCodePoint(0x1D7CE + (code - 0x30)); // 0-9
    // Common symbols and punctuation
    if (ch === '!') return '!';
    if (ch === '?') return '?';
    if (ch === '.') return '.';
    if (ch === ',') return ',';
    if (ch === ':') return ':';
    if (ch === ';') return ';';
    if (ch === '-') return '-';
    if (ch === ' ') return ' ';
    return ch;
}

function stylizeFullText(text) {
    if (!text || typeof text !== 'string') return text;

    // Preserve URLs and code blocks
    const urlRegex = /(https?:\/\/[^\s]+|t\.me\/[^\s]+|@[^\s]+)/g;
    const codeRegex = /(`[^`]+`|```[\s\S]*?```)/g;

    const segments = [];
    let lastIndex = 0;

    // Find all preserved segments (URLs and code blocks)
    const preserved = [];
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
        preserved.push({ type: 'url', content: match[0], index: match.index });
    }

    while ((match = codeRegex.exec(text)) !== null) {
        preserved.push({ type: 'code', content: match[0], index: match.index });
    }

    // Sort preserved segments by index
    preserved.sort((a, b) => a.index - b.index);

    // Process text segment by segment
    let currentIndex = 0;

    preserved.forEach(segment => {
        if (segment.index > currentIndex) {
            // Add regular text before preserved segment
            const regularText = text.slice(currentIndex, segment.index);
            segments.push({
                type: 'regular',
                content: Array.from(regularText).map(ch => toBoldUnicodeChar(ch)).join('')
            });
        }

        // Add preserved segment as-is
        segments.push({
            type: segment.type,
            content: segment.content
        });

        currentIndex = segment.index + segment.content.length;
    });

    // Add any remaining regular text
    if (currentIndex < text.length) {
        const remainingText = text.slice(currentIndex);
        segments.push({
            type: 'regular', 
            content: Array.from(remainingText).map(ch => toBoldUnicodeChar(ch)).join('')
        });
    }

    return segments.map(s => s.content).join('');
}

// Alias for compatibility
function stylizePreservingCodeAndUrls(text) {
    return stylizeFullText(text);
}

function stylizeLabel(label) {
    return stylizeFullText(label);
}

// ---------- Persistence / in-memory ----------
const users = new Map(); // chatId -> { lang, plan, crypto, activePlan, waitingForX... }
let purchaseLogs = [];
let cryptos = [
    { name: '𝗨𝗦𝗗𝗧 (𝗧𝗥𝗖𝟮𝟬)', address: 'TYdBx5944hZZUnfoMCNEDy4pKZ17oC4N3a', qrFileId: null },
    { name: '𝗨𝗦𝗗𝗧 (𝗘𝗥𝗖𝟮𝟬)', address: '0xd30CD71Fb569D14c67f4cB9c03aA0fF1ad02f3d8', qrFileId: null },
    { name: '𝗨𝗦𝗗𝗧 (𝗕𝗘𝗣𝟮𝟬)', address: '0xd30CD71Fb569D14c67f4cB9c03aA0fF1ad02f3d8', qrFileId: null },
    { name: '𝗕𝗧𝗖', address: 'bc1qrl0c5tyr7hcpa7na8025sgt85aefazun5d4rmy', qrFileId: null },
    { name: '𝗘𝗧𝗛', address: '0x1b8Cb4565Db3d2c7ebF02839aDd1741031bC1709', qrFileId: null },
    { name: '𝗟𝗧𝗖', address: 'ltc1q0vnwl9guz7pd3dgjl5swl8gl4733mgch0mslqd', qrFileId: null },
    { name: '𝗫𝗥𝗣', address: 'rBs9Hq2srqPu8KA7gheBE257GRJg3Xa8jS', qrFileId: null },
    { name: '𝗦𝗢𝗟', address: 'BS2PW1znWhf1ypSYSuWvmLXzX1BYU6n9P7DB34VNDk6E', qrFileId: null },
    { name: '𝗧𝗥𝗫', address: 'TYdBx5944hZZUnfoMCNEDy4pKZ17oC4N3a', qrFileId: null },
    { name: '𝗧𝗢𝗡', address: 'UQCTDuH5udkgZDqvhmhmOHhG7NazA7g85-PUqj63jutnGXBI', qrFileId: null }
];
let pendingApprovals = [];

function loadJSON(file, fallback) {
    try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        console.error('Error loading', file, e);
    }
    return fallback;
}

function loadAllData() {
    const u = loadJSON(USERS_FILE, null);
    if (Array.isArray(u)) u.forEach(([k, v]) => users.set(Number(k), v));
    purchaseLogs = loadJSON(LOGS_FILE, []) || [];
    const c = loadJSON(CRYPTOS_FILE, null);
    if (Array.isArray(c) && c.length) cryptos = c;
    pendingApprovals = loadJSON(PENDING_APPROVALS_FILE, []) || [];
}

function saveUsers() { try { fs.writeFileSync(USERS_FILE, JSON.stringify(Array.from(users.entries()), null, 2)); } catch (e) { console.error(e); } }
function saveLogs() { try { fs.writeFileSync(LOGS_FILE, JSON.stringify(purchaseLogs, null, 2)); } catch (e) { console.error(e); } }
function saveCryptos() { try { fs.writeFileSync(CRYPTOS_FILE, JSON.stringify(cryptos, null, 2)); } catch (e) { console.error(e); } }
function savePendingApprovals() { try { fs.writeFileSync(PENDING_APPROVALS_FILE, JSON.stringify(pendingApprovals, null, 2)); } catch (e) { console.error(e); } }

// ---------- Translations (Enhanced with full bold styling) ----------
const translations = {
    en: {
        welcome: "🔅 𝗪𝗲𝗹𝗰𝗼𝗺𝗲 𝘁𝗼 𝗥𝗘𝗗𝗔𝗿𝗺𝗼𝗿 𝟮.𝟬 𝗧𝗢𝗣-𝗨𝗣 𝗕𝗢𝗧 🔅\n𝗖𝗵𝗼𝗼𝘀𝗲 𝘆𝗼𝘂𝗿 𝗹𝗮𝗻𝗴𝘂𝗮𝗴𝗲:",
        choose_plan: "✅ 𝗖𝗛𝗢𝗢𝗦𝗘 𝗬𝗢𝗨𝗥 𝗣𝗟𝗔𝗡 ✅\n─────────────────",
        payment: "💳 {plan}\n{description}\n\n𝗦𝗲𝗹𝗲𝗰𝘁 𝗽𝗮𝘆𝗺𝗲𝗻𝘁 𝗺𝗲𝘁𝗵𝗼𝗱:",
        payment_instruction: "✅ 𝗣𝗹𝗲𝗮𝘀𝗲 𝘀𝗲𝗻𝗱 {method} 𝘁𝗼:\n`{address}`\n\n📸 𝗔𝗳𝘁𝗲𝗿 𝘀𝗲𝗻𝗱𝗶𝗻𝗴, 𝗰𝗹𝗶𝗰𝗸 '𝗜 𝗣𝗮𝗶𝗱' 𝗯𝗲𝗹𝗼𝘄",
        payment_done: "✅ 𝗜 𝗣𝗮𝗶𝗱",
        ask_screenshot: "📸 𝗣𝗹𝗲𝗮𝘀𝗲 𝘀𝗲𝗻𝗱 𝘆𝗼𝘂𝗿 𝗽𝗮𝘆𝗺𝗲𝗻𝘁 𝘀𝗰𝗿𝗲𝗲𝗻𝘀𝗵𝗼𝘁 𝗻𝗼𝘄.",
        language_set: "🌐 𝗟𝗮𝗻𝗴𝘂𝗮𝗴𝗲 𝘀𝗲𝘁 𝘁𝗼 𝗘𝗻𝗴𝗹𝗶𝘀𝗵",
        demo_video: "🎥 𝗗𝗲𝗺𝗼 𝗩𝗶𝗱𝗲𝗼",
        admin_panel: "🛠 𝗔𝗗𝗠𝗜𝗡 𝗣𝗔𝗡𝗘𝗟",
        admin_logs: "📋 𝗟𝗮𝘀𝘁 𝟮𝟬 𝗟𝗼𝗴𝘀",
        admin_broadcast: "📢 𝗕𝗿𝗼𝗮𝗱𝗰𝗮𝘀𝘁",
        admin_users: "👤 𝗨𝘀𝗲𝗿 𝗖𝗼𝘂𝗻𝘁",
        admin_add_crypto: "➕ 𝗔𝗱𝗱 𝗖𝗿𝘆𝗽𝘁𝗼",
        admin_remove_crypto: "➖ 𝗥𝗲𝗺𝗼𝘃𝗲 𝗖𝗿𝘆𝗽𝘁𝗼",
        admin_add_qr: "📷 𝗔𝗱𝗱 𝗤𝗥 𝗖𝗼𝗱𝗲",
        admin_remove_qr: "🗑️ 𝗥𝗲𝗺𝗼𝘃𝗲 𝗤𝗥 𝗖𝗼𝗱𝗲",
        help: `📘 𝗛𝗼𝘄 𝘁𝗼 𝗣𝘂𝗿𝗰𝗵𝗮𝘀𝗲 𝗮 𝗦𝗽𝗼𝗼𝗳 𝗖𝗮𝗹𝗹 𝗣𝗹𝗮𝗻:

1. 𝗖𝗵𝗼𝗼𝘀𝗲 𝘆𝗼𝘂𝗿 𝗽𝗹𝗮𝗻 𝗳𝗿𝗼𝗺 𝘁𝗵𝗲 𝗺𝗮𝗶𝗻 𝗺𝗲𝗻𝘂
2. 𝗦𝗲𝗹𝗲𝗰𝘁 𝗮 𝗰𝗿𝘆𝗽𝘁𝗼 𝗽𝗮𝘆𝗺𝗲𝗻𝘁 𝗺𝗲𝘁𝗵𝗼𝗱 (𝗨𝗦𝗗𝗧, 𝗕𝗧𝗖, 𝗘𝗧𝗛, 𝗟𝗧𝗖, 𝗫𝗥𝗣, 𝗦𝗢𝗟, 𝗧𝗥𝗫, 𝗧𝗢𝗡)
3. 𝗦𝗲𝗻𝗱 𝘁𝗵𝗲 𝗲𝘅𝗮𝗰𝘁 𝗮𝗺𝗼𝘂𝗻𝘁 𝘁𝗼 𝘁𝗵𝗲 𝗴𝗶𝘃𝗲𝗻 𝗮𝗱𝗱𝗿𝗲𝘀𝘀
4. 𝗧𝗮𝗽 "𝗜 𝗣𝗮𝗶𝗱" 𝗮𝗻𝗱 𝘂𝗽𝗹𝗼𝗮𝗱 𝘆𝗼𝘂𝗿 𝘀𝗰𝗿𝗲𝗲𝗻𝘀𝗵𝗼𝘁
5. ⏳ 𝗬𝗼𝘂𝗿 𝗰𝗿𝗲𝗱𝗲𝗻𝘁𝗶𝗮𝗹𝘀 𝘄𝗶𝗹𝗹 𝗯𝗲 𝘀𝗲𝗻𝘁 𝘄𝗶𝘁𝗵𝗶𝗻 𝟭𝟬 𝗺𝗶𝗻𝘂𝘁𝗲𝘀

📌 𝗦𝘂𝗽𝗽𝗼𝗿𝘁: 𝗖𝗼𝗻𝘁𝗮𝗰𝘁 ${ADMIN_CONTACT}
📢 𝗨𝗽𝗱𝗮𝘁𝗲𝘀 & 𝗗𝗲𝗺𝗼 𝗖𝗵𝗮𝗻𝗻𝗲𝗹: ${OFFICIAL_CHANNEL_LINK}
🖥 𝗪𝗲𝗯𝘀𝗶𝘁𝗲: ${OFFICIAL_WEBSITE}`,
        back: "🔙 𝗕𝗮𝗰𝗸",
        main_menu: "🏠 𝗠𝗮𝗶𝗻 𝗠𝗲𝗻𝘂",
        select_lang: "🌐 𝗦𝗲𝗹𝗲𝗰𝘁 𝗟𝗮𝗻𝗴𝘂𝗮𝗴𝗲",
        contact_admin: "💬 𝗖𝗼𝗻𝘁𝗮𝗰𝘁 𝗔𝗱𝗺𝗶𝗻",
        join_channel: "📢 𝗝𝗼𝗶𝗻 𝗖𝗵𝗮𝗻𝗻𝗲𝗹",
        pending_approval: "⏳ 𝗬𝗼𝘂𝗿 𝗽𝗮𝘆𝗺𝗲𝗻𝘁 𝗶𝘀 𝗽𝗲𝗻𝗱𝗶𝗻𝗴 𝗮𝗽𝗽𝗿𝗼𝘃𝗮𝗹. 𝗬𝗼𝘂 𝘄𝗶𝗹𝗹 𝗯𝗲 𝗻𝗼𝘁𝗶𝗳𝗶𝗲𝗱 𝘄𝗵𝗲𝗻 𝗮𝗽𝗽𝗿𝗼𝘃𝗲𝗱.",
        payment_approved: "✅ 𝗬𝗼𝘂𝗿 𝗽𝗮𝘆𝗺𝗲𝗻𝘁 𝗵𝗮𝘀 𝗯𝗲𝗲𝗻 𝗮𝗽𝗽𝗿𝗼𝘃𝗲𝗱! 𝗬𝗼𝘂𝗿 𝗽𝗹𝗮𝗻 𝗶𝘀 𝗻𝗼𝘄 𝗮𝗰𝘁𝗶𝘃𝗲.",
        payment_rejected: "❌ 𝗬𝗼𝘂𝗿 𝗽𝗮𝘆𝗺𝗲𝗻𝘁 𝘄𝗮𝘀 𝗻𝗼𝘁 𝗮𝗽𝗽𝗿𝗼𝘃𝗲𝗱. 𝗣𝗹𝗲𝗮𝘀𝗲 𝗰𝗼𝗻𝘁𝗮𝗰𝘁 𝗮𝗱𝗺𝗶𝗻 𝗳𝗼𝗿 𝗺𝗼𝗿𝗲 𝗶𝗻𝗳𝗼𝗿𝗺𝗮𝘁𝗶𝗼𝗻."
    },
    fr: {
        welcome: "🔅 𝗕𝗶𝗲𝗻𝘃𝗲𝗻𝘂𝗲 𝗮𝘂𝘅 𝘀𝗲𝗿𝘃𝗶𝗰𝗲𝘀 𝗱𝗲 𝘀𝗽𝗼𝗼𝗳𝗶𝗻𝗴 𝗱'𝗮𝗽𝗽𝗲𝗹!\n𝗖𝗵𝗼𝗶𝘀𝗶𝘀𝘀𝗲𝘇 𝘃𝗼𝘁𝗿𝗲 𝗹𝗮𝗻𝗴𝘂𝗲:",
        choose_plan: "✅ 𝗖𝗛𝗢𝗜𝗦𝗜𝗦𝗘𝗭 𝗩𝗢𝗧𝗥𝗘 𝗙𝗢𝗥𝗙𝗔𝗜𝗧 ✅\n─────────────────",
        payment: "💳 {plan}\n{description}\n\n𝗦𝗲́𝗹𝗲𝗰𝘁𝗶𝗼𝗻𝗻𝗲𝘇 𝘃𝗼𝘁𝗿𝗲 𝗺𝗼𝘆𝗲𝗻 𝗱𝗲 𝗽𝗮𝗶𝗲𝗺𝗲𝗻𝘁 :",
        payment_instruction: "✅ 𝗩𝗲𝘂𝗶𝗹𝗹𝗲𝘇 𝗲𝗻𝘃𝗼𝘆𝗲𝗿 {method} 𝗮̀ :\n`{address}`\n\n📸 𝗔𝗽𝗿𝗲̀𝘀 𝗮𝘃𝗼𝗶𝗿 𝗲𝗻𝘃𝗼𝘆𝗲́, 𝗰𝗹𝗶𝗾𝘂𝗲𝘇 𝘀𝘂𝗿 '𝗝'𝗮𝗶 𝗣𝗮𝘆𝗲́' 𝗰𝗶-𝗱𝗲𝘀𝘀𝗼𝘂𝘀",
        payment_done: "✅ 𝗝'𝗮𝗶 𝗣𝗮𝘆𝗲́",
        ask_screenshot: "📸 𝗩𝗲𝘂𝗶𝗹𝗹𝗲𝘇 𝗲𝗻𝘃𝗼𝘆𝗲𝗿 𝘃𝗼𝘁𝗿𝗲 𝗰𝗮𝗽𝘁𝘂𝗿𝗲 𝗱'𝗲́𝗰𝗿𝗮𝗻 𝗺𝗮𝗶𝗻𝘁𝗲𝗻𝗮𝗻𝘁.",
        language_set: "🌐 𝗟𝗮𝗻𝗴𝘂𝗲 𝗱𝗲́𝗳𝗶𝗻𝗶𝗲 𝘀𝘂𝗿 𝗙𝗿𝗮𝗻𝗰̧𝗮𝗶𝘀",
        demo_video: "🎥 𝗩𝗶𝗱𝗲́𝗼 𝗱𝗲 𝗱𝗲́𝗺𝗼𝗻𝘀𝘁𝗿𝗮𝘁𝗶𝗼𝗻",
        admin_panel: "🛠 𝗣𝗔𝗡𝗘𝗟 𝗔𝗗𝗠𝗜𝗡",
        admin_logs: "📋 𝟮𝟬 𝗱𝗲𝗿𝗻𝗶𝗲𝗿𝘀 𝗹𝗼𝗴𝘀",
        admin_broadcast: "📢 𝗗𝗶𝗳𝗳𝘂𝘀𝗶𝗼𝗻",
        admin_users: "👤 𝗡𝗼𝗺𝗯𝗿𝗲 𝗱'𝘂𝘁𝗶𝗹𝗶𝘀𝗮𝘁𝗲𝘂𝗿𝘀",
        admin_add_crypto: "➕ 𝗔𝗷𝗼𝘂𝘁𝗲𝗿 𝗖𝗿𝘆𝗽𝘁𝗼",
        admin_remove_crypto: "➖ 𝗦𝘂𝗽𝗽𝗿𝗶𝗺𝗲𝗿 𝗖𝗿𝘆𝗽𝘁𝗼",
        admin_add_qr: "📷 𝗔𝗷𝗼𝘂𝘁𝗲𝗿 𝗤𝗥 𝗖𝗼𝗱𝗲",
        admin_remove_qr: "🗑️ 𝗦𝘂𝗽𝗽𝗿𝗶𝗺𝗲𝗿 𝗤𝗥 𝗖𝗼𝗱𝗲",
        help: `📘 𝗠𝗼𝗱𝗲 𝗱'𝗲𝗺𝗽𝗹𝗼𝗶 :

1. 𝗖𝗵𝗼𝗶𝘀𝗶𝘀𝘀𝗲𝘇 𝘃𝗼𝘁𝗿𝗲 𝗳𝗼𝗿𝗳𝗮𝗶𝘁 𝗱𝗮𝗻𝘀 𝗹𝗲 𝗺𝗲𝗻𝘂 𝗽𝗿𝗶𝗻𝗰𝗶𝗽𝗮𝗹
2. 𝗦𝗲́𝗹𝗲𝗰𝘁𝗶𝗼𝗻𝗻𝗲𝘇 𝘂𝗻 𝗺𝗼𝘆𝗲𝗻 𝗱𝗲 𝗽𝗮𝗶𝗲𝗺𝗲𝗻𝘁 𝗲𝗻 𝗰𝗿𝗶𝗽𝘁𝗼𝗺𝗼𝗻𝗻𝗮𝗶𝗲 (𝗨𝗦𝗗𝗧, 𝗕𝗧𝗖, 𝗘𝗧𝗛, 𝗟𝗧𝗖, 𝗫𝗥𝗣, 𝗦𝗢𝗟, 𝗧𝗥𝗫, 𝗧𝗢𝗡)
3. 𝗘𝗻𝘃𝗼𝘆𝗲𝘇 𝗹𝗲 𝗺𝗼𝗻𝘁𝗮𝗻𝘁 𝗲𝘅𝗮𝗰𝘁 𝗮̀ 𝗹'𝗮𝗱𝗿𝗲𝘀𝘀𝗲 𝗳𝗼𝘂𝗿𝗻𝗶𝗲
4. 𝗖𝗹𝗶𝗾𝘂𝗲𝘇 𝘀𝘂𝗿 "𝗝'𝗮𝗶 𝗣𝗮𝘆𝗲́" 𝗲𝘁 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝘇 𝘃𝗼𝘁𝗿𝗲 𝗰𝗮𝗽𝘁𝘂𝗿𝗲 𝗱'𝗲́𝗰𝗿𝗮𝗻
5. ⏳ 𝗩𝗼𝘀 𝗶𝗱𝗲𝗻𝘁𝗶𝗳𝗶𝗮𝗻𝘁𝘀 𝘀𝗲𝗿𝗼𝗻𝘁 𝗲𝗻𝘃𝗼𝘆𝗲́𝘀 𝗱𝗮𝗻𝘀 𝗹𝗲𝘀 𝟭𝟬 𝗺𝗶𝗻𝘂𝘁𝗲𝘀

📌 𝗦𝘂𝗽𝗽𝗼𝗿𝘁 : 𝗖𝗼𝗻𝘁𝗮𝗰𝘁𝗲𝘇 ${ADMIN_CONTACT}
📢 𝗠𝗶𝘀𝗲𝘀 𝗮̀ 𝗷𝗼𝘂𝗿 & 𝗖𝗵𝗮𝗶̂𝗻𝗲 𝗱𝗲 𝗱𝗲́𝗺𝗼 : ${OFFICIAL_CHANNEL_LINK}
🖥 𝗦𝗶𝘁𝗲 𝗪𝗲𝗯 : ${OFFICIAL_WEBSITE}`,
        back: "🔙 𝗥𝗲𝘁𝗼𝘂𝗿",
        main_menu: "🏠 𝗠𝗲𝗻𝘂 𝗣𝗿𝗶𝗻𝗰𝗶𝗽𝗮𝗹",
        select_lang: "🌐 𝗖𝗵𝗼𝗶𝘀𝗶𝗿 𝗹𝗮 𝗹𝗮𝗻𝗴𝘂𝗲",
        contact_admin: "💬 𝗖𝗼𝗻𝘁𝗮𝗰𝘁𝗲𝗿 𝗹'𝗔𝗱𝗺𝗶𝗻𝗶𝘀𝘁𝗿𝗮𝘁𝗲𝘂𝗿",
        join_channel: "📢 𝗥𝗲𝗷𝗼𝗶𝗻𝗱𝗿𝗲 𝗹𝗮 𝗰𝗵𝗮𝗶̂𝗻𝗲",
        pending_approval: "⏳ 𝗩𝗼𝘁𝗿𝗲 𝗽𝗮𝗶𝗲𝗺𝗲𝗻𝘁 𝗲𝘀𝘁 𝗲𝗻 𝗮𝘁𝘁𝗲𝗻𝘁𝗲 𝗱'𝗮𝗽𝗽𝗿𝗼𝗯𝗮𝘁𝗶𝗼𝗻. 𝗩𝗼𝘂𝘀 𝘀𝗲𝗿𝗲𝘇 𝗻𝗼𝘁𝗶𝗳𝗶𝗲́(𝗲) 𝗾𝘂𝗮𝗻𝗱 𝗮𝗽𝗽𝗿𝗼𝘂𝘃𝗲́.",
        payment_approved: "✅ 𝗩𝗼𝘁𝗿𝗲 𝗽𝗮𝗶𝗲𝗺𝗲𝗻𝘁 𝗮 𝗲́𝘁𝗲́ 𝗮𝗽𝗽𝗿𝗼𝘂𝘃𝗲́! 𝗩𝗼𝘁𝗿𝗲 𝗳𝗼𝗿𝗳𝗮𝗶𝘁 𝗲𝘀𝘁 𝗺𝗮𝗶𝗻𝘁𝗲𝗻𝗮𝗻𝘁 𝗮𝗰𝘁𝗶𝗳.",
        payment_rejected: "❌ 𝗩𝗼𝘁𝗿𝗲 𝗽𝗮𝗶𝗲𝗺𝗲𝗻𝘁 𝗻'𝗮 𝗽𝗮𝘀 𝗲́𝘁𝗲́ 𝗮𝗽𝗽𝗿𝗼𝘂𝘃𝗲́. 𝗩𝗲𝘂𝗶𝗹𝗹𝗲𝘇 𝗰𝗼𝗻𝘁𝗮𝗰𝘁𝗲𝗿 𝗹'𝗮𝗱𝗺𝗶𝗻 𝗽𝗼𝘂𝗿 𝗽𝗹𝘂𝘀 𝗱'𝗶𝗻𝗳𝗼𝗿𝗺𝗮𝘁𝗶𝗼𝗻𝘀."
    },
    de: {
        welcome: "🔅 𝗪𝗶𝗹𝗹𝗸𝗼𝗺𝗺𝗲𝗻 𝗯𝗲𝗶 𝗖𝗮𝗹𝗹 𝗦𝗽𝗼𝗼𝗳𝗶𝗻𝗴 𝗗𝗶𝗲𝗻𝘀𝘁𝗲𝗻!\n𝗪𝗮̈𝗵𝗹𝗲𝗻 𝗦𝗶𝗲 𝗜𝗵𝗿𝗲 𝗦𝗽𝗿𝗮𝗰𝗵𝗲:",
        choose_plan: "✅ 𝗪𝗔𝗘𝗛𝗟𝗘𝗡 𝗦𝗜𝗘 𝗜𝗛𝗥𝗘𝗡 𝗧𝗔𝗥𝗜𝗙 ✅\n─────────────────",
        payment: "💳 {plan}\n{description}\n\n𝗪𝗮̈𝗵𝗹𝗲𝗻 𝗦𝗶𝗲 𝗱𝗶𝗲 𝗭𝗮𝗵𝗹𝘂𝗻𝗴𝘀𝗺𝗲𝘁𝗵𝗼𝗱𝗲:",
        payment_instruction: "✅ 𝗕𝗶𝘁𝘁𝗲 𝘀𝗲𝗻𝗱𝗲𝗻 𝗦𝗶𝗲 {method} 𝗮𝗻:\n`{address}`\n\n📸 𝗡𝗮𝗰𝗵 𝗱𝗲𝗿 𝗨̈𝗯𝗲𝗿𝘄𝗲𝗶𝘀𝘂𝗻𝗴 𝗸𝗹𝗶𝗰𝗸𝗲𝗻 𝗦𝗶𝗲 𝗮𝘂𝗳 '𝗜𝗰𝗵 𝗵𝗮𝗯𝗲 𝗯𝗲𝘇𝗮𝗵𝗹𝘁'",
        payment_done: "✅ 𝗜𝗰𝗵 𝗵𝗮𝗯𝗲 𝗯𝗲𝘇𝗮𝗵𝗹𝘁",
        ask_screenshot: "📸 𝗕𝗶𝘁𝘁𝗲 𝘀𝗲𝗻𝗱𝗲𝗻 𝗦𝗶𝗲 𝗷𝗲𝘁𝘇𝘁 𝗜𝗵𝗿𝗲𝗻 𝗭𝗮𝗵𝗹𝘂𝗻𝗴𝘀𝘀𝗰𝗿𝗲𝗲𝗻𝘀𝗵𝗼𝘁.",
        language_set: "🌐 𝗦𝗽𝗿𝗮𝗰𝗵𝗲 𝗮𝘂𝗳 𝗗𝗲𝘂𝘁𝘀𝗰𝗵 𝗴𝗲𝘀𝘁𝗲𝗹𝗹𝘁",
        demo_video: "🎥 𝗗𝗲𝗺𝗼-𝗩𝗶𝗱𝗲𝗼",
        admin_panel: "🛠 𝗔𝗗𝗠𝗜𝗡-𝗣𝗔𝗡𝗘𝗟",
        admin_logs: "📋 𝗟𝗲𝘁𝘇𝘁𝗲 𝟮𝟬 𝗟𝗼𝗴𝘀",
        admin_broadcast: "📢 𝗥𝘂𝗻𝗱𝗿𝘂𝗳",
        admin_users: "👤 𝗕𝗲𝗻𝘂𝘁𝘇𝗲𝗿𝘇𝗮̈𝗵𝗹𝘂𝗻𝗴",
        admin_add_crypto: "➕ 𝗞𝗿𝘆𝗽𝘁𝗼 𝗵𝗶𝗻𝘇𝘂𝗳𝘂̈𝗴𝗲𝗻",
        admin_remove_crypto: "➖ 𝗞𝗿𝘆𝗽𝘁𝗼 𝗲𝗻𝘁𝗳𝗲𝗿𝗻𝗲𝗻",
        admin_add_qr: "📷 𝗤𝗥-𝗖𝗼𝗱𝗲 𝗵𝗶𝗻𝘇𝘂𝗳𝘂̈𝗴𝗲𝗻",
        admin_remove_qr: "🗑️ 𝗤𝗥-𝗖𝗼𝗱𝗲 𝗲𝗻𝘁𝗳𝗲𝗿𝗻𝗲𝗻",
        help: `📘 𝗔𝗻𝗹𝗲𝗶𝘁𝘂𝗻𝗴 𝘇𝘂𝗿 𝗕𝗲𝘀𝘁𝗲𝗹𝗹𝘂𝗻𝗴 𝗲𝗶𝗻𝗲𝘀 𝗦𝗽𝗼𝗼𝗳-𝗖𝗮𝗹𝗹-𝗧𝗮𝗿𝗶𝗳𝘀:

1. 𝗪𝗮̈𝗵𝗹𝗲𝗻 𝗦𝗶𝗲 𝗜𝗵𝗿𝗲𝗻 𝗧𝗮𝗿𝗶𝗳 𝗮𝘂𝘀 𝗱𝗲𝗺 𝗛𝗮𝘂𝗽𝘁𝗺𝗲𝗻𝘂̈
2. 𝗪𝗮̈𝗵𝗹𝗲𝗻 𝗦𝗶𝗲 𝗲𝗶𝗻𝗲 𝗞𝗿𝘆𝗽𝘁𝗼𝘇𝗮𝗵𝗹𝘂𝗻𝗴𝘀𝗺𝗲𝘁𝗵𝗼𝗱𝗲 (𝗨𝗦𝗗𝗧, 𝗕𝗧𝗖, 𝗘𝗧𝗛, 𝗟𝗧𝗖, 𝗫𝗥𝗣, 𝗦𝗢𝗟, 𝗧𝗥𝗫, 𝗧𝗢𝗡)
3. 𝗦𝗲𝗻𝗱𝗲𝗻 𝗦𝗶𝗲 𝗱𝗶𝗲 𝗲𝘅𝗮𝗸𝘁𝗲 𝗦𝘂𝗺𝗺𝗲 𝗮𝗻 𝗱𝗶𝗲 𝗮𝗻𝗴𝗲𝗴𝗲𝗯𝗲𝗻𝗲 𝗔𝗱𝗿𝗲𝘀𝘀𝗲
4. 𝗞𝗹𝗶𝗰𝗸𝗲𝗻 𝗦𝗶𝗲 𝗮𝘂𝗳 "𝗜𝗰𝗵 𝗵𝗮𝗯𝗲 𝗯𝗲𝘇𝗮𝗵𝗹𝘁" 𝗹𝗮𝗱𝗲𝗻 𝗦𝗶𝗲 𝗜𝗵𝗿𝗲𝗻 𝗦𝗰𝗿𝗲𝗲𝗻𝘀𝗵𝗼𝘁 𝗵𝗼𝗰𝗵
5. ⏳ 𝗜𝗵𝗿𝗲 𝗭𝘂𝗴𝗮𝗻𝗴𝘀𝗱𝗮𝘁𝗲𝗻 𝘄𝗲𝗿𝗱𝗲𝗻 𝗶𝗻𝗻𝗲𝗿𝗵𝗮𝗹𝗯 𝘃𝗼𝗻 𝟭𝟬 𝗠𝗶𝗻𝘂𝘁𝗲𝗻 𝗴𝗲𝘀𝗲𝗻𝗱𝗲𝘁

📌 𝗦𝘂𝗽𝗽𝗼𝗿𝘁: 𝗞𝗼𝗻𝘁𝗮𝗸𝘁 ${ADMIN_CONTACT}
📢 𝗔𝗸𝘁𝘂𝗮𝗹𝗶𝘀𝗶𝗲𝗿𝘂𝗻𝗴𝗲𝗻 & 𝗗𝗲𝗺𝗼-𝗞𝗮𝗻𝗮𝗹: ${OFFICIAL_CHANNEL_LINK}
🖥 𝗪𝗲𝗯𝘀𝗲𝗶𝘁𝗲: ${OFFICIAL_WEBSITE}`,
        back: "🔙 𝗭𝘂𝗿𝘂̈𝗰𝗸",
        main_menu: "🏠 𝗛𝗮𝘂𝗽𝘁𝗺𝗲𝗻𝘂̈",
        select_lang: "🌐 𝗦𝗽𝗿𝗮𝗰𝗵𝗲 𝗮𝘂𝘀𝘄𝗮̈𝗵𝗹𝗲𝗻",
        contact_admin: "💬 𝗔𝗱𝗺𝗶𝗻 𝗸𝗼𝗻𝘁𝗮𝗸𝘁𝗶𝗲𝗿𝗲𝗻",
        join_channel: "📢 𝗞𝗮𝗻𝗮𝗹 𝗯𝗲𝗶𝘁𝗿𝗲𝘁𝗲𝗻",
        pending_approval: "⏳ 𝗜𝗵𝗿𝗲 𝗭𝗮𝗵𝗹𝘂𝗻𝗴 𝘄𝗶𝗿𝗱 𝗴𝗲𝗽𝗿𝘂̈𝗳𝘁. 𝗦𝗶𝗲 𝘄𝗲𝗿𝗱𝗲𝗻 𝗯𝗲𝗻𝗮𝗰𝗵𝗿𝗶𝗰𝗵𝘁𝗶𝗴𝘁, 𝘄𝗲𝗻𝗻 𝘀𝗶𝗲 𝗴𝗲𝗻𝗲𝗵𝗺𝗶𝗴𝘁 𝘄𝗶𝗿𝗱.",
        payment_approved: "✅ 𝗜𝗵𝗿𝗲 𝗭𝗮𝗵𝗹𝘂𝗻𝗴 𝘄𝘂𝗿𝗱𝗲 𝗴𝗲𝗻𝗲𝗵𝗺𝗶𝗴𝘁! 𝗜𝗵𝗿 𝗧𝗮𝗿𝗶𝗳 𝗶𝘀𝘁 𝗷𝗲𝘁𝘇𝘁 𝗮𝗸𝘁𝗶𝘃.",
        payment_rejected: "❌ 𝗜𝗵𝗿𝗲 𝗭𝗮𝗵𝗹𝘂𝗻𝗴 𝘄𝘂𝗿𝗱𝗲 𝗻𝗶𝗰𝗵𝘁 𝗴𝗲𝗻𝗲𝗵𝗺𝗶𝗴𝘁. 𝗕𝗶𝘁𝘁𝗲 𝗸𝗼𝗻𝘁𝗮𝗸𝘁𝗶𝗲𝗿𝗲𝗻 𝗦𝗶𝗲 𝗱𝗲𝗻 𝗔𝗱𝗺𝗶𝗻 𝗳𝘂̈𝗿 𝘄𝗲𝗶𝘁𝗲𝗿𝗲 𝗜𝗻𝗳𝗼𝗿𝗺𝗮𝘁𝗶𝗼𝗻𝗲𝗻."
    },
    es: {
        welcome: "🔅 𝗕𝗶𝗲𝗻𝘃𝗲𝗻𝗶𝗱𝗼 𝗮 𝗹𝗼𝘀 𝘀𝗲𝗿𝘃𝗶𝗰𝗶𝗼𝘀 𝗱𝗲 𝗹𝗹𝗮𝗺𝗮𝗱𝗮𝘀 𝗳𝗮𝗹𝘀𝗶𝗳𝗶𝗰𝗮𝗱𝗮𝘀!\n𝗘𝗹𝗶𝗷𝗮 𝘀𝘂 𝗶𝗱𝗶𝗼𝗺𝗮:",
        choose_plan: "✅ 𝗘𝗟𝗜𝗝𝗔 𝗦𝗨 𝗣𝗟𝗔𝗡 ✅\n─────────────────",
        payment: "💳 {plan}\n{description}\n\n𝗦𝗲𝗹𝗲𝗰𝗰𝗶𝗼𝗻𝗲 𝗲𝗹 𝗺𝗲́𝘁𝗼𝗱𝗼 𝗱𝗲 𝗽𝗮𝗴𝗼:",
        payment_instruction: "✅ 𝗣𝗼𝗿 𝗳𝗮𝘃𝗼𝗿 𝗲𝗻𝘃𝗶́𝗲 {method} 𝗮:\n`{address}`\n\n📸 𝗗𝗲𝘀𝗽𝘂𝗲́𝘀 𝗱𝗲 𝗲𝗻𝘃𝗶𝗮𝗿, 𝗵𝗮𝗴𝗮 𝗰𝗹𝗶𝗰 𝗲𝗻 '𝗬𝗮 𝗣𝗮𝗴𝘂𝗲́'",
        payment_done: "✅ 𝗬𝗮 𝗣𝗮𝗴𝘂𝗲́",
        ask_screenshot: "📸 𝗣𝗼𝗿 𝗳𝗮𝘃𝗼𝗿 𝗲𝗻𝘃𝗶́𝗲 𝘀𝘂 𝗰𝗮𝗽𝘁𝘂𝗿𝗮 𝗱𝗲 𝗽𝗮𝗻𝘁𝗮𝗹𝗹𝗮 𝗱𝗲𝗹 𝗽𝗮𝗴𝗼 𝗮𝗵𝗼𝗿𝗮.",
        language_set: "🌐 𝗜𝗱𝗶𝗼𝗺𝗮 𝗲𝘀𝘁𝗮𝗯𝗹𝗲𝗰𝗶𝗱𝗼 𝗲𝗻 𝗘𝘀𝗽𝗮𝗻̃𝗼𝗹",
        demo_video: "🎥 𝗩𝗶́𝗱𝗲𝗼 𝗱𝗲 𝗱𝗲𝗺𝗼𝘀𝘁𝗿𝗮𝗰𝗶𝗼́𝗻",
        admin_panel: "🛠 𝗣𝗔𝗡𝗘𝗟 𝗗𝗘 𝗔𝗗𝗠𝗜𝗡",
        admin_logs: "📋 𝗨́𝗹𝘁𝗶𝗺𝗼𝘀 𝟮𝟬 𝗥𝗲𝗴𝗶𝘀𝘁𝗿𝗼𝘀",
        admin_broadcast: "📢 𝗧𝗿𝗮𝗻𝘀𝗺𝗶𝘀𝗶𝗼́𝗻",
        admin_users: "👤 𝗥𝗲𝗰𝘂𝗲𝗻𝘁𝗼 𝗱𝗲 𝗨𝘀𝘂𝗮𝗿𝗶𝗼𝘀",
        admin_add_crypto: "➕ 𝗔𝗴𝗿𝗲𝗴𝗮𝗿 𝗖𝗿𝗶𝗽𝘁𝗼",
        admin_remove_crypto: "➖ 𝗘𝗹𝗶𝗺𝗶𝗻𝗮𝗿 𝗖𝗿𝗶𝗽𝘁𝗼",
        admin_add_qr: "📷 𝗔𝗴𝗿𝗲𝗴𝗮𝗿 𝗖𝗼́𝗱𝗶𝗴𝗼 𝗤𝗥",
        admin_remove_qr: "🗑️ 𝗘𝗹𝗶𝗺𝗶𝗻𝗮𝗿 𝗖𝗼́𝗱𝗶𝗴𝗼 𝗤𝗥",
        help: `📘 𝗖𝗼́𝗺𝗼 𝗮𝗱𝗾𝘂𝗶𝗿𝗶𝗿 𝘂𝗻 𝗣𝗹𝗮𝗻 𝗱𝗲 𝗟𝗹𝗮𝗺𝗮𝗱𝗮𝘀 𝗙𝗮𝗹𝘀𝗶𝗳𝗶𝗰𝗮𝗱𝗮𝘀:

1. 𝗘𝗹𝗶𝗷𝗮 𝘀𝘂 𝗽𝗹𝗮𝗻 𝗱𝗲𝗹 𝗺𝗲𝗻𝘂́ 𝗽𝗿𝗶𝗻𝗰𝗶𝗽𝗮𝗹
2. 𝗦𝗲𝗹𝗲𝗰𝗰𝗶𝗼𝗻𝗲 𝘂𝗻 𝗺𝗲́𝘁𝗼𝗱𝗼 𝗱𝗲 𝗽𝗮𝗴𝗼 𝗰𝗿𝗶𝗽𝘁𝗼𝗴𝗿𝗮́𝗳𝗶𝗰𝗼 (𝗨𝗦𝗗𝗧, 𝗕𝗧𝗖, 𝗘𝗧𝗛, 𝗟𝗧𝗖, 𝗫𝗥𝗣, 𝗦𝗢𝗟, 𝗧𝗥𝗫, 𝗧𝗢𝗡)
3. 𝗘𝗻𝘃𝗶́𝗲 𝗲𝗹 𝗺𝗼𝗻𝘁𝗼 𝗲𝘅𝗮𝗰𝘁𝗼 𝗮 𝗹𝗮 𝗱𝗶𝗿𝗲𝗰𝗰𝗶𝗼́𝗻 𝗽𝗿𝗼𝗽𝗼𝗿𝗰𝗶𝗼𝗻𝗮𝗱𝗮
4. 𝗣𝗿𝗲𝘀𝗶𝗼𝗻𝗲 "𝗬𝗮 𝗣𝗮𝗴𝘂𝗲́" 𝘆 𝗰𝗮𝗿𝗴𝘂𝗲 𝘀𝘂 𝗰𝗮𝗽𝘁𝘂𝗿𝗮 𝗱𝗲 𝗽𝗮𝗻𝘁𝗮𝗹𝗹𝗮
5. ⏳ 𝗦𝘂𝘀 𝗰𝗿𝗲𝗱𝗲𝗻𝗰𝗶𝗮𝗹𝗲𝘀 𝘀𝗲𝗿𝗮́𝗻 𝗲𝗻𝘃𝗶𝗮𝗱𝗮𝘀 𝗲𝗻 𝗹𝗼𝘀 𝗽𝗿𝗼́𝘅𝗶𝗺𝗼𝘀 𝟭𝟬 𝗺𝗶𝗻𝘂𝘁𝗼𝘀

📌 𝗦𝗼𝗽𝗼𝗿𝘁𝗲: 𝗖𝗼𝗻𝘁𝗮𝗰𝘁𝗲 ${ADMIN_CONTACT}
📢 𝗔𝗰𝘁𝘂𝗮𝗹𝗶𝘇𝗮𝗰𝗶𝗼𝗻𝗲𝘀 & 𝗖𝗮𝗻𝗮𝗹 𝗱𝗲 𝗗𝗲𝗺𝗼𝘀: ${OFFICIAL_CHANNEL_LINK}
🖥 𝗦𝗶𝘁𝗶𝗼 𝗪𝗲𝗯: ${OFFICIAL_WEBSITE}`,
        back: "🔙 𝗔𝘁𝗿𝗮́𝘀",
        main_menu: "🏠 𝗠𝗲𝗻𝘂́ 𝗣𝗿𝗶𝗻𝗰𝗶𝗽𝗮𝗹",
        select_lang: "🌐 𝗦𝗲𝗹𝗲𝗰𝗰𝗶𝗼𝗻𝗮𝗿 𝗜𝗱𝗶𝗼𝗺𝗮",
        contact_admin: "💬 𝗖𝗼𝗻𝘁𝗮𝗰𝘁𝗮𝗿 𝗮𝗹 𝗔𝗱𝗺𝗶𝗻𝗶𝘀𝘁𝗿𝗮𝗱𝗼𝗿",
        join_channel: "📢 𝗨𝗻𝗶𝗿𝘀𝗲 𝗮𝗹 𝗖𝗮𝗻𝗮𝗹",
        pending_approval: "⏳ 𝗦𝘂 𝗽𝗮𝗴𝗼 𝗲𝘀𝘁𝗮́ 𝗽𝗲𝗻𝗱𝗶𝗲𝗻𝘁𝗲 𝗱𝗲 𝗮𝗽𝗽𝗿𝗼𝗯𝗮𝗰𝗶𝗼́𝗻. 𝗦𝗲𝗿𝗮́ 𝗻𝗼𝘁𝗶𝗳𝗶𝗰𝗮𝗱𝗼 𝗰𝘂𝗮𝗻𝗱𝗼 𝘀𝗲 𝗮𝗽𝗿𝘂𝗲𝗯𝗲.",
        payment_approved: "✅ 𝗦𝘂 𝗽𝗮𝗴𝗼 𝗵𝗮 𝘀𝗶𝗱𝗼 𝗮𝗽𝗿𝗼𝗯𝗮𝗱𝗼! 𝗦𝘂 𝗽𝗹𝗮𝗻 𝗲𝘀𝘁𝗮́ 𝗮𝗰𝘁𝗶𝘃𝗼 𝗮𝗵𝗼𝗿𝗮.",
        payment_rejected: "❌ 𝗦𝘂 𝗽𝗮𝗴𝗼 𝗻𝗼 𝗳𝘂𝗲 𝗮𝗽𝗿𝗼𝗯𝗮𝗱𝗼. 𝗣𝗼𝗿 𝗳𝗮𝘃𝗼𝗿 𝗰𝗼𝗻𝘁𝗮𝗰𝘁𝗲 𝗮𝗹 𝗮𝗱𝗺𝗶𝗻𝗶𝘀𝘁𝗿𝗮𝗱𝗼𝗿 𝗽𝗮𝗿𝗮 𝗺𝗮́𝘀 𝗶𝗻𝗳𝗼𝗿𝗺𝗮𝗰𝗶𝗼́𝗻."
    },
    ru: {
        welcome: "🔅 𝗗𝗼𝗯𝗿𝗼 𝗽𝗼𝗷𝗮𝗹𝗼𝘃𝗮𝘁𝗻 𝘃 𝗦𝗲𝗿𝘃𝗶𝘀 𝗦𝗽𝘂𝗳𝗶𝗻𝗴𝗮 𝗭𝘃𝗼𝗻𝗸𝗼𝘃!\n𝗩𝘆𝗯𝗲𝗿𝗶𝘁𝗲 𝘀𝘃𝗼𝗶̆ 𝘆𝗮𝘇𝘆𝗸:",
        choose_plan: "✅ 𝗩𝗬𝗕𝗘𝗥𝗜𝗧𝗘 𝗦𝗩𝗢𝗜̆ 𝗣𝗟𝗔𝗡 ✅\n─────────────────",
        payment: "💳 {plan}\n{description}\n\n𝗩𝘆𝗯𝗲𝗿𝗶𝘁𝗲 𝘀𝗽𝗼𝘀𝗼𝗯 𝗼𝗽𝗹𝗮𝘁𝘆:",
        payment_instruction: "✅ 𝗣𝗼𝗷𝗮𝗹𝘂𝗶̆𝘀𝘁𝗮, 𝗼𝘁𝗽𝗿𝗮𝘃𝘁𝗲 {method} 𝗻𝗮:\n`{address}`\n\n📸 𝗣𝗼𝘀𝗹𝗲 𝗼𝘁𝗽𝗿𝗮𝘃𝗸𝗶 𝗻𝗮𝗵𝗺𝗶𝘁𝗲 '𝗬𝗮 𝗢𝗽𝗹𝗮𝘁𝗶𝗹(𝗮)'",
        payment_done: "✅ 𝗬𝗮 𝗢𝗽𝗹𝗮𝘁𝗶𝗹(𝗮)",
        ask_screenshot: "📸 𝗣𝗼𝗷𝗮𝗹𝘂𝗶̆𝘀𝘁𝗮, 𝗼𝘁𝗽𝗿𝗮𝘃𝘁𝗲 𝘀𝗸𝗿𝗶𝗻𝘀𝗵𝗼𝘁 𝗽𝗹𝗮𝘁𝗲𝘇𝗵𝗮 𝘀𝗲𝗶̆𝗰𝗵𝗮𝘀.",
        language_set: "🌐 𝗬𝗮𝘇𝘆𝗸 𝗶𝘇𝗺𝗲𝗻𝗲𝗻 𝗻𝗮 𝗥𝘂𝘀𝘀𝗸𝗶𝗶̆",
        demo_video: "🎥 𝗗𝗲𝗺𝗼𝗻𝘀𝘁𝗿𝗮𝗰𝗶𝗼𝗻𝗻𝗼𝗲 𝗩𝗶𝗱𝗲𝗼",
        admin_panel: "🛠 𝗔𝗗𝗠𝗜𝗡 𝗣𝗔𝗡𝗘𝗟'",
        admin_logs: "📋 𝗣𝗼𝘀𝗹𝗲𝗱𝗻𝗶𝗲 𝟮𝟬 𝗭𝗮𝗽𝗶𝘀𝗲𝗶̆",
        admin_broadcast: "📢 𝗥𝗮𝘀𝘀𝘆𝗹𝗸𝗮",
        admin_users: "👤 𝗞𝗼𝗹𝗶𝗰𝗵𝗲𝘀𝘁𝘃𝗼 𝗣𝗼𝗹𝘇𝗼𝘃𝗮𝘁𝗲𝗹𝗲𝗶̆",
        admin_add_crypto: "➕ 𝗗𝗼𝗯𝗮𝘃𝗶𝘁𝗻 𝗞𝗿𝗶𝗽𝘁𝗼𝘃𝗮𝗹𝗶𝘂𝘁𝘂",
        admin_remove_crypto: "➖ 𝗨𝗱𝗮𝗹𝗶𝘁𝗻 𝗞𝗿𝗶𝗽𝘁𝗼𝘃𝗮𝗹𝗶𝘂𝘁𝘂",
        admin_add_qr: "📷 𝗗𝗼𝗯𝗮𝘃𝗶𝘁𝗻 𝗤𝗥-𝗸𝗼𝗱",
        admin_remove_qr: "🗑️ 𝗨𝗱𝗮𝗹𝗶𝘁𝗻 𝗤𝗥-𝗸𝗼𝗱",
        help: `📘 𝗞𝗮𝗸 𝗣𝗿𝗶𝗼𝗯𝗿𝗲𝘀𝘁𝗶 𝗣𝗹𝗮𝗻 𝗦𝗽𝘂𝗳𝗶𝗻𝗴𝗮 𝗭𝘃𝗼𝗻𝗸𝗼𝘃:

1. 𝗩𝘆𝗯𝗲𝗿𝗶𝘁𝗲 𝘀𝘃𝗼𝗶̆ 𝗽𝗹𝗮𝗻 𝗶𝘇 𝗴𝗹𝗮𝘃𝗻𝗼𝗴𝗼 𝗺𝗲𝗻𝘆𝘂
2. 𝗩𝘆𝗯𝗲𝗿𝗶𝘁𝗲 𝘀𝗽𝗼𝘀𝗼𝗯 𝗸𝗿𝗶𝗽𝘁𝗼𝗽𝗹𝗮𝘁𝗲𝘇𝗵𝗮 (𝗨𝗦𝗗𝗧, 𝗕𝗧𝗖, 𝗘𝗧𝗛, 𝗟𝗧𝗖, 𝗫𝗥𝗣, 𝗦𝗢𝗟, 𝗧𝗥𝗫, 𝗧𝗢𝗡)
3. 𝗢𝘁𝗽𝗿𝗮𝘃𝘁𝗲 𝘁𝗼𝗰𝗵𝗻𝘂𝘆𝘂 𝘀𝘂𝗺𝗺𝘂 𝗻𝗮 𝗽𝗿𝗲𝗱𝗼𝘀𝘁𝗮𝘃𝗹𝗲𝗻𝗻𝘆𝗶̆ 𝗮𝗱𝗿𝗲𝘀
4. 𝗡𝗮𝗵𝗺𝗶𝘁𝗲 '𝗬𝗮 𝗢𝗽𝗹𝗮𝘁𝗶𝗹(𝗮)' 𝗶 𝗭𝗮𝗴𝗿𝘂𝘇𝗶𝘁𝗲 𝘀𝗸𝗿𝗶𝗻𝘀𝗵𝗼𝘁
5. ⏳ 𝗩𝗮𝘀𝗵𝗶 𝗱𝗮𝗻𝗻𝘆𝗲 𝗯𝘂𝗱𝘂𝘁 𝗼𝘁𝗽𝗿𝗮𝘃𝗹𝗲𝗻𝘆 𝗶𝗻 𝗽𝗿𝗲𝗱𝗲𝗹𝗮𝘅 𝟭𝟬 𝗺𝗶𝗻𝘂𝘁

📌 𝗣𝗼𝗱𝗱𝗲𝗿𝘇𝗵𝗸𝗮: 𝗞𝗼𝗻𝘁𝗮𝗸𝘁 ${ADMIN_CONTACT}
📢 𝗢𝗯𝗻𝗼𝘃𝗹𝗲𝗻𝗶𝘆𝗮 & 𝗗𝗲𝗺𝗼-𝗞𝗮𝗻𝗮𝗹: ${OFFICIAL_CHANNEL_LINK}
🖥 𝗩𝗲𝗯-𝗦𝗮𝗶̆𝘁: ${OFFICIAL_WEBSITE}`,
        back: "🔙 𝗡𝗮𝘇𝗮𝗱",
        main_menu: "🏠 𝗚𝗹𝗮𝘃𝗻𝗼𝗲 𝗠𝗲𝗻𝘆𝘂",
        select_lang: "🌐 𝗩𝘆𝗯𝗿𝗮𝘁𝗻 𝗬𝗮𝘇𝘆𝗸",
        contact_admin: "💬 𝗦𝘃𝘆𝗮𝘇𝗮𝘁𝗻𝘀𝘆𝗮 𝗦 𝗔𝗱𝗺𝗶𝗻𝗶𝘀𝘁𝗿𝗮𝘁𝗼𝗿𝗼𝗺",
        join_channel: "📢 𝗣𝗿𝗶𝘀𝗼𝗲𝗱𝗶𝗻𝗶𝘁𝗻𝘀𝘆𝗮 𝗞 𝗞𝗮𝗻𝗮𝗹𝘂",
        pending_approval: "⏳ 𝗩𝗮𝘀𝗵 𝗽𝗹𝗮𝘁𝗲𝘇𝗵 𝗼𝗷𝗶𝗱𝗮𝗲𝘁 𝗽𝗼𝗱𝘁𝘃𝗲𝗿𝘇𝗵𝗱𝗲𝗻𝗶𝗷𝗮. 𝗩𝘆 𝗯𝘂𝗱𝗲𝘁𝗲 𝘂𝘃𝗲𝗱𝗼𝗺𝗹𝗲𝗻𝘆, 𝗸𝗼𝗴𝗱𝗮 𝗼𝗻 𝗯𝘂𝗱𝗲𝘁 𝗼𝗱𝗼𝗯𝗿𝗲𝗻.",
        payment_approved: "✅ 𝗩𝗮𝘀𝗵 𝗽𝗹𝗮𝘁𝗲𝘇𝗵 𝗼𝗱𝗼𝗯𝗿𝗲𝗻! 𝗩𝗮𝘀𝗵 𝗽𝗹𝗮𝗻 𝘁𝗲𝗽𝗲𝗿𝗻 𝗮𝗸𝘁𝗶𝘃𝗲𝗻.",
        payment_rejected: "❌ 𝗩𝗮𝘀𝗵 𝗽𝗹𝗮𝘁𝗲𝘇𝗵 𝗻𝗲 𝗯𝘆𝗹 𝗼𝗱𝗼𝗯𝗿𝗲𝗻. 𝗣𝗼𝗷𝗮𝗹𝘂𝗶̆𝘀𝘁𝗮, 𝘀𝘃𝘆𝗮𝘇𝗵𝗶𝘁𝗲𝘀𝗻 𝘀 𝗮𝗱𝗺𝗶𝗻𝗶𝘀𝘁𝗿𝗮𝘁𝗼𝗿𝗼𝗺 𝗱𝗹𝗷𝗮 𝗽𝗼𝗹𝘂𝗰𝗵𝗲𝗻𝗶𝗷𝗮 𝗱𝗼𝗽𝗼𝗹𝗻𝗶𝘁𝗲𝗹𝗻𝗼𝗶̆ 𝗶𝗻𝗳𝗼𝗿𝗺𝗮𝗰𝗶𝗶."
    }
};

// ---------- Plans (Enhanced with full bold styling) ----------
const plansData = {
    en: [
        {
            id: 'gold',
            name: '🔅 𝗚𝗢𝗟𝗗 𝗣𝗟𝗔𝗡 — $𝟭𝟮𝟬 🔅',
            description: '1 𝗠𝗼𝗻𝘁𝗵 𝗨𝗻𝗹𝗶𝗺𝗶𝘁𝗲𝗱 𝗖𝗮𝗹𝗹𝗶𝗻𝗴 — 𝗻𝗼 𝗽𝗲𝗿-𝗺𝗶𝗻𝘂𝘁𝗲 𝗰𝗵𝗮𝗿𝗴𝗲𝘀\n\n𝗜𝗻𝗰𝗹𝘂𝗱𝗲𝘀:\n• 𝗙𝘂𝗹𝗹 𝗖𝗮𝗹𝗹 𝗦𝗽𝗼𝗼𝗳𝗶𝗻𝗴 𝗔𝗰𝗰𝗲𝘀𝘀\n• 𝗦𝘁𝗮𝗻𝗱𝗮𝗿𝗱 𝗩𝗼𝗶𝗰𝗲 𝗖𝗵𝗮𝗻𝗴𝗲𝗿\n• 𝗙𝘂𝗹𝗹 𝗔𝗰𝗰𝗲𝘀𝘀 𝘁𝗼 𝗪𝗲𝗯𝘀𝗶𝘁𝗲, 𝗪𝗲𝗯 𝗔𝗽𝗽𝗹𝗶𝗰𝗮𝘁𝗶𝗼𝗻 & 𝗧𝗲𝗹𝗲𝗴𝗿𝗮𝗺 𝗕𝗼𝘁'
        },
        {
            id: 'diamond',
            name: '🔅 𝗗𝗜𝗔𝗠𝗢𝗡𝗗 𝗣𝗟𝗔𝗡 — $𝟮𝟮𝟬 🔅',
            description: '2 𝗠𝗼𝗻𝘁𝗵𝘀 𝗨𝗻𝗹𝗶𝗺𝗶𝘁𝗲𝗱 𝗖𝗮𝗹𝗹𝗶𝗻𝗴 — 𝗻𝗼 𝗽𝗲𝗿-𝗺𝗶𝗻𝘂𝘁𝗲 𝗰𝗵𝗮𝗿𝗴𝗲𝘀\n\n𝗜𝗻𝗰𝗹𝘂𝗱𝗲𝘀:\n• 𝗔𝗱𝘃𝗮𝗻𝗰𝗲𝗱 𝗖𝗮𝗹𝗹 𝗦𝗽𝗼𝗼𝗳𝗶𝗻𝗴\n• 𝗣𝗿𝗲𝗺𝗶𝘂𝗺 𝗩𝗼𝗶𝗰𝗲 𝗖𝗵𝗮𝗻𝗴𝗲𝗿\n• 𝗘𝗻𝗵𝗮𝗻𝗰𝗲𝗱 𝗖𝗮𝗹𝗹 𝗥𝗼𝘂𝘁𝗶𝗻𝗴\n• 𝗗𝗧𝗠𝗙 𝗧𝗼𝗻𝗲 𝗗𝗲𝘁𝗲𝗰𝘁𝗶𝗼𝗻 & 𝗖𝗼𝗻𝘁𝗿𝗼𝗹\n• 𝗔𝗱𝘃𝗮𝗻𝗰𝗲 𝗢𝗧𝗣 𝗯𝗼𝘁 𝗔𝗰𝗰𝗲𝘀𝘀\n• 𝗙𝘂𝗹𝗹 𝗔𝗰𝗰𝗲𝘀𝘀 𝘁𝗼 𝗪𝗲𝗯𝘀𝗶𝘁𝗲, 𝗪𝗲𝗯 𝗔𝗽𝗽𝗹𝗶𝗰𝗮𝘁𝗶𝗼𝗻 & 𝗧𝗲𝗹𝗲𝗴𝗿𝗮𝗺 𝗕𝗼𝘁\n• 𝗘𝗺𝗮𝗶𝗹 & 𝗦𝗠𝗦 𝗦𝗽𝗼𝗼𝗳𝗶𝗻𝗴 𝗔𝗰𝗰𝗲𝘀𝘀\n• 𝗜𝗩𝗥 𝗦𝘆𝘀𝘁𝗲𝗺\n• 𝗧𝗼𝗹𝗹-𝗙𝗿𝗲𝗲 𝗡𝘂𝗺𝗯𝗲𝗿 𝗦𝗽𝗼𝗼𝗳𝗶𝗻𝗴\n• 𝗦𝗜𝗣 𝗧𝗿𝘂𝗻𝗸 𝗔𝗰𝗰𝗲𝘀𝘀 (𝗶𝗻𝗯𝗼𝘂𝗻𝗱 & 𝗼𝘂𝘁𝗯𝗼𝘂𝗻𝗱)'
        },
        {
            id: 'platinum',
            name: '🔅 𝗣𝗟𝗔𝗧𝗜𝗡𝗨𝗠 𝗣𝗟𝗔𝗡 — $𝟯𝟮𝟬 🔅',
            description: '3 𝗠𝗼𝗻𝘁𝗵𝘀 𝗨𝗻𝗹𝗶𝗺𝗶𝘁𝗲𝗱 𝗖𝗮𝗹𝗹𝗶𝗻𝗴 — 𝗻𝗼 𝗽𝗲𝗿-𝗺𝗶𝗻𝘂𝘁𝗲 𝗰𝗵𝗮𝗿𝗴𝗲𝘀\n\n𝗜𝗻𝗰𝗹𝘂𝗱𝗲𝘀 𝗮𝗹𝗹 𝗽𝗿𝗲𝗺𝗶𝘂𝗺 𝗳𝗲𝗮𝘁𝘂𝗿𝗲𝘀:\n• 𝗔𝗱𝘃𝗮𝗻𝗰𝗲𝗱 𝗖𝗮𝗹𝗹 𝗦𝗽𝗼𝗼𝗳𝗶𝗻𝗴\n• 𝗣𝗿𝗲𝗺𝗶𝘂𝗺 𝗩𝗼𝗶𝗰𝗲 𝗖𝗵𝗮𝗻𝗴𝗲𝗿\n• 𝗘𝗻𝗵𝗮𝗻𝗰𝗲𝗱 𝗥𝗼𝘂𝘁𝗶𝗻𝗴\n• 𝗗𝗧𝗠𝗙 𝗧𝗼𝗻𝗲 𝗗𝗲𝘁𝗲𝗰𝘁𝗶𝗼𝗻 & 𝗖𝗼𝗻𝘁𝗿𝗼𝗹\n• 𝗣𝗿𝗶𝗼𝗿𝗶𝘁𝘆 𝗦𝘂𝗽𝗽𝗼𝗿𝘁\n• 𝗔𝗱𝘃𝗮𝗻𝗰𝗲 𝗢𝗧𝗣 𝗯𝗼𝘁 𝗔𝗰𝗰𝗲𝘀𝘀\n• 𝗙𝘂𝗹𝗹 𝗔𝗣𝗜 & 𝗖𝘂𝘀𝘁𝗼𝗺 𝗜𝗻𝘁𝗲𝗴𝗿𝗮𝘁𝗶𝗼𝗻\n• 𝗙𝘂𝗹𝗹 𝗔𝗰𝗰𝗲𝘀𝘀 𝘁𝗼 𝗪𝗲𝗯𝘀𝗶𝘁𝗲, 𝗪𝗲𝗯 𝗔𝗽𝗽𝗹𝗶𝗰𝗮𝘁𝗶𝗼𝗻 & 𝗧𝗲𝗹𝗲𝗴𝗿𝗮𝗺 𝗕𝗼𝘁\n• 𝗘𝗺𝗮𝗶𝗹 & 𝗦𝗠𝗦 𝗦𝗽𝗼𝗼𝗳𝗶𝗻𝗴 𝗔𝗰𝗰𝗲𝘀𝘀\n• 𝗜𝗩𝗥 𝗦𝘆𝘀𝘁𝗲𝗺\n• 𝗣𝗿𝗲𝗺𝗶𝘂𝗺 𝗧𝗼𝗹𝗹-𝗙𝗿𝗲𝗲 𝗡𝘂𝗺𝗯𝗲𝗿 𝗦𝗽𝗼𝗼𝗳𝗶𝗻𝗴\n• 𝗣𝗿𝗲𝗺𝗶𝘂𝗺 𝗦𝗜𝗣 𝗧𝗿𝘂𝗻𝗸 𝗔𝗰𝗰𝗲𝘀𝘀 (𝗶𝗻𝗯𝗼𝘂𝗻𝗱 & 𝗼𝘂𝘁𝗯𝗼𝘂𝗻𝗱, 𝘄𝗶𝘁𝗵 𝗱𝗲𝗱𝗶𝗰𝗮𝘁𝗲𝗱 𝗿𝗼𝘂𝘁𝗶𝗻𝗴 𝗮𝗻𝗱 𝗲𝗻𝗵𝗮𝗻𝗰𝗲𝗱 𝗾𝘂𝗮𝗹𝗶𝘁𝘆)'
        },
        {
            id: 'platinum1m',
            name: '🔅 𝗣𝗟𝗔𝗧𝗜𝗡𝗨𝗠 𝟭-𝗠𝗢𝗡𝗧𝗛 𝗣𝗟𝗔𝗡 — $𝟭𝟱𝟬 🔅',
            description: '1 𝗠𝗼𝗻𝘁𝗵 𝗨𝗻𝗹𝗶𝗺𝗶𝘁𝗲𝗱 𝗖𝗮𝗹𝗹𝗶𝗻𝗴 — 𝗻𝗼 𝗽𝗲𝗿-𝗺𝗶𝗻𝘂𝘁𝗲 𝗰𝗵𝗮𝗿𝗴𝗲𝘀\n\n𝗜𝗻𝗰𝗹𝘂𝗱𝗲𝘀 𝗮𝗹𝗹 𝗽𝗿𝗲𝗺𝗶𝘂𝗺 𝗳𝗲𝗮𝘁𝘂𝗿𝗲𝘀:\n• 𝗔𝗱𝘃𝗮𝗻𝗰𝗲𝗱 𝗖𝗮𝗹𝗹 𝗦𝗽𝗼𝗼𝗳𝗶𝗻𝗴\n• 𝗣𝗿𝗲𝗺𝗶𝘂𝗺 𝗩𝗼𝗶𝗰𝗲 𝗖𝗵𝗮𝗻𝗴𝗲𝗿\n• 𝗘𝗻𝗵𝗮𝗻𝗰𝗲𝗱 𝗥𝗼𝘂𝘁𝗶𝗻𝗴\n• 𝗗𝗧𝗠𝗙 𝗧𝗼𝗻𝗲 𝗗𝗲𝘁𝗲𝗰𝘁𝗶𝗼𝗻 & 𝗖𝗼𝗻𝘁𝗿𝗼𝗹\n• 𝗣𝗿𝗶𝗼𝗿𝗶𝘁𝘆 𝗦𝘂𝗽𝗽𝗼𝗿𝘁\n• 𝗔𝗱𝘃𝗮𝗻𝗰𝗲 𝗢𝗧𝗣 𝗯𝗼𝘁 𝗔𝗰𝗰𝗲𝘀𝘀\n• 𝗙𝘂𝗹𝗹 𝗔𝗰𝗰𝗲𝘀𝘀 𝘁𝗼 𝗪𝗲𝗯𝘀𝗶𝘁𝗲, 𝗪𝗲𝗯 𝗔𝗽𝗽𝗹𝗶𝗰𝗮𝘁𝗶𝗼𝗻 & 𝗧𝗲𝗹𝗲𝗴𝗿𝗮𝗺 𝗕𝗼𝘁\n• 𝗘𝗺𝗮𝗶𝗹 & 𝗦𝗠𝗦 𝗦𝗽𝗼𝗼𝗳𝗶𝗻𝗴 𝗔𝗰𝗰𝗲𝘀𝘀\n• 𝗜𝗩𝗥 𝗦𝘆𝘀𝘁𝗲𝗺\n• 𝗣𝗿𝗲𝗺𝗶𝘂𝗺 𝗧𝗼𝗹𝗹-𝗙𝗿𝗲𝗲 𝗡𝘂𝗺𝗯𝗲𝗿 𝗦𝗽𝗼𝗼𝗳𝗶𝗻𝗴\n• 𝗣𝗿𝗲𝗺𝗶𝘂𝗺 𝗦𝗜𝗣 𝗧𝗿𝘂𝗻𝗸 𝗔𝗰𝗰𝗲𝘀𝘀 (𝗶𝗻𝗯𝗼𝘂𝗻𝗱 & 𝗼𝘂𝘁𝗯𝗼𝘂𝗻𝗱, 𝘄𝗶𝘁𝗵 𝗱𝗲𝗱𝗶𝗰𝗮𝘁𝗲𝗱 𝗿𝗼𝘂𝘁𝗶𝗻𝗴 𝗮𝗻𝗱 𝗲𝗻𝗵𝗮𝗻𝗰𝗲𝗱 𝗾𝘂𝗮𝗹𝗶𝘁𝘆)\n\n📌 𝗔𝘀 𝗮𝗻 𝗶𝗻𝘁𝗿𝗼𝗱𝘂𝗰𝘁𝗼𝗿𝘆 𝗼𝗳𝗳𝗲𝗿, 𝘁𝗵𝗲 𝗣𝗹𝗮𝘁𝗶𝗻𝘂𝗺 𝗣𝗹𝗮𝗻 𝗶𝘀 𝗮𝘃𝗮𝗶𝗹𝗮𝗯𝗹𝗲 𝗳𝗼𝗿 𝟭 𝗠𝗼𝗻𝘁𝗵 𝗮𝘁 $𝟭𝟱𝟬 — 𝗙𝗼𝗿 𝗡𝗲𝘄 𝗖𝗹𝗶𝗲𝗻𝘁𝘀 𝗢𝗻𝗹𝘆'
        }
    ]
};

// Create plans for other languages
['fr', 'de', 'es', 'ru'].forEach(lang => {
    plansData[lang] = plansData.en.map(plan => ({
        ...plan,
        name: stylizeFullText(plan.name),
        description: stylizeFullText(plan.description)
    }));
});

// ---------- Helper: language getter & translation accessor ----------
function getUserLang(chatId) {
    const u = users.get(chatId);
    return u?.lang || 'en';
}
function t(chatId, key, replacements = {}) {
    const lang = getUserLang(chatId);
    let txt = translations[lang]?.[key] || translations.en[key] || key;
    Object.keys(replacements).forEach(k => { txt = txt.replace(new RegExp(`{${k}}`, 'g'), replacements[k]); });
    return stylizeFullText(txt);
}
function getPlans(chatId) {
    const lang = getUserLang(chatId);
    return plansData[lang] || plansData.en;
}

function getPlanName(chatId, planId) {
    const plan = getPlans(chatId).find(p => p.id === planId);
    return plan ? plan.name : 'None';
}

// ---------- Enhanced Keyboard builders ----------
function getLangKeyboard() {
    return {
        inline_keyboard: [
            [{ text: '🇺🇸 𝗘𝗻𝗴𝗹𝗶𝘀𝗵', callback_data: 'lang_en' }],
            [{ text: '🇫🇷 𝗙𝗿𝗮𝗻𝗰̧𝗮𝗶𝘀', callback_data: 'lang_fr' }],
            [{ text: '🇩🇪 𝗗𝗲𝘂𝘁𝘀𝗰𝗵', callback_data: 'lang_de' }],
            [{ text: '🇪🇸 𝗘𝘀𝗽𝗮𝗻̃𝗼𝗹', callback_data: 'lang_es' }],
            [{ text: '🇷🇺 𝗥𝘂𝘀𝘀𝗸𝗶𝗶̆', callback_data: 'lang_ru' }]
        ]
    };
}

function getMainMenuKeyboard(chatId) {
    const plans = getPlans(chatId);
    const rows = [];

    // Each plan in its own row (vertical layout)
    plans.forEach(plan => {
        rows.push([{ text: plan.name, callback_data: `plan_${plan.id}` }]);
    });

    // Additional buttons
    rows.push([{ text: t(chatId, 'demo_video'), callback_data: 'demo_video' }]);
    rows.push([
        { text: t(chatId, 'select_lang'), callback_data: 'select_lang' },
        { text: '❓ 𝗛𝗲𝗹𝗽', callback_data: 'help' }
    ]);

    return { inline_keyboard: rows };
}

function getCryptoKeyboard(chatId) {
    const rows = [];

    // Add cryptos in rows of 2 for better layout
    for (let i = 0; i < cryptos.length; i += 2) {
        const row = [];
        if (cryptos[i]) row.push({ text: cryptos[i].name, callback_data: `crypto_${cryptos[i].name}` });
        if (cryptos[i + 1]) row.push({ text: cryptos[i + 1].name, callback_data: `crypto_${cryptos[i + 1].name}` });
        rows.push(row);
    }

    rows.push([{ text: t(chatId, 'back'), callback_data: 'main_menu' }]);
    return { inline_keyboard: rows };
}

function getPaymentDoneKeyboard(chatId) {
    return {
        inline_keyboard: [
            [{ text: t(chatId, 'payment_done'), callback_data: 'payment_done' }],
            [{ text: t(chatId, 'back'), callback_data: 'main_menu' }]
        ]
    };
}

function getAdminKeyboard(chatId) {
    return {
        inline_keyboard: [
            [
                { text: t(chatId, 'admin_logs'), callback_data: 'admin_logs' },
                { text: t(chatId, 'admin_users'), callback_data: 'admin_users' }
            ],
            [
                { text: t(chatId, 'admin_broadcast'), callback_data: 'admin_broadcast' },
                { text: t(chatId, 'admin_add_crypto'), callback_data: 'admin_add_crypto' }
            ],
            [
                { text: t(chatId, 'admin_remove_crypto'), callback_data: 'admin_remove_crypto' },
                { text: t(chatId, 'admin_add_qr'), callback_data: 'admin_add_qr' }
            ],
            [
                { text: t(chatId, 'admin_remove_qr'), callback_data: 'admin_remove_qr' }
            ],
            [
                { text: t(chatId, 'main_menu'), callback_data: 'main_menu' }
            ]
        ]
    };
}

function getCryptoSelectionKeyboard(action) {
    const rows = [];

    // Add cryptos in rows of 2 for better layout
    for (let i = 0; i < cryptos.length; i += 2) {
        const row = [];
        if (cryptos[i]) row.push({ text: cryptos[i].name, callback_data: `${action}_${cryptos[i].name}` });
        if (cryptos[i + 1]) row.push({ text: cryptos[i + 1].name, callback_data: `${action}_${cryptos[i + 1].name}` });
        rows.push(row);
    }

    rows.push([{ text: '🔙 𝗕𝗮𝗰𝗸', callback_data: 'admin_panel' }]);
    return { inline_keyboard: rows };
}

function getHelpKeyboard(chatId) {
    return {
        inline_keyboard: [
            [
                { text: t(chatId, 'join_channel'), url: OFFICIAL_CHANNEL_LINK },
                { text: t(chatId, 'contact_admin'), url: `https://t.me/${ADMIN_CONTACT.replace('@','')}` }
            ],
            [
                { text: t(chatId, 'back'), callback_data: 'main_menu' }
            ]
        ]
    };
}

function getBackToMainKeyboard(chatId) {
    return { inline_keyboard: [[{ text: t(chatId, 'main_menu'), callback_data: 'main_menu' }]] };
}

function getApprovalKeyboard(pendingIndex) {
    return {
        inline_keyboard: [
            [
                { text: '✅ 𝗔𝗽𝗽𝗿𝗼𝘃𝗲', callback_data: `approve_${pendingIndex}` },
                { text: '❌ 𝗥𝗲𝗷𝗲𝗰𝘁', callback_data: `reject_${pendingIndex}` }
            ]
        ]
    };
}

// ---------- UX helpers ----------
function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

async function sendAnimatedWelcome(chatId) {
    try {
        await bot.telegram.sendChatAction(chatId, 'typing');
        const msg = await bot.telegram.sendMessage(chatId, '🔄 𝗕𝗼𝗼𝘁𝗶𝗻𝗴 𝘀𝘆𝘀𝘁𝗲𝗺...');
        await delay(600);
        await bot.telegram.editMessageText(chatId, msg.message_id, undefined, '⚡ 𝗣𝗿𝗲𝗽𝗮𝗿𝗶𝗻𝗴 𝘀𝗲𝗰𝘂𝗿𝗲 𝗰𝗼𝗻𝗻𝗲𝗰𝘁𝗶𝗼𝗻...');
        await delay(500);
        await bot.telegram.editMessageText(chatId, msg.message_id, undefined, '✨ 𝗟𝗼𝗮𝗱𝗶𝗻𝗴 𝗳𝗲𝗮𝘁𝘂𝗿𝗲𝘀 • • •');
        await delay(450);
        await bot.telegram.editMessageText(chatId, msg.message_id, undefined, '🌟 𝗥𝗲𝗮𝗱𝘆!');
        await delay(300);
        
        const user = users.get(chatId) || {};
        const activePlan = user.activePlan ? getPlanName(chatId, user.activePlan) : 'None';
        const welcomeText = `${t(chatId, 'welcome')}\n\n🔢 𝗜𝗗: ${chatId}\n📋 𝗔𝗰𝘁𝗶𝘃𝗲 𝗣𝗹𝗮𝗻: ${activePlan}`;
        
        await bot.telegram.editMessageText(chatId, msg.message_id, undefined, welcomeText, { 
            reply_markup: getLangKeyboard(),
            parse_mode: 'Markdown'
        });
    } catch (e) {
        // ignore edit failures
    }
}

async function sendAnimatedAdminPanel(chatId) {
    try {
        await bot.telegram.sendChatAction(chatId, 'typing');
        const msg = await bot.telegram.sendMessage(chatId, '🔐 𝗩𝗲𝗿𝗶𝗳𝘆𝗶𝗻𝗴 𝗮𝗱𝗺𝗶𝗻 𝗰𝗿𝗲𝗱𝗲𝗻𝘁𝗶𝗮𝗹𝘀...');
        await delay(600);
        await bot.telegram.editMessageText(chatId, msg.message_id, undefined, '🧭 𝗟𝗼𝗮𝗱𝗶𝗻𝗴 𝗮𝗱𝗺𝗶𝗻 𝘁𝗼𝗼𝗹𝘀...');
        await delay(400);
        await bot.telegram.editMessageText(chatId, msg.message_id, undefined, t(chatId, 'admin_panel'), { 
            reply_markup: getAdminKeyboard(chatId),
            parse_mode: 'Markdown'
        });
    } catch (e) {}
}

async function sendMainMenu(chatId) {
    const user = users.get(chatId) || {};
    const activePlan = user.activePlan ? getPlanName(chatId, user.activePlan) : 'None';
    const menuText = `${t(chatId, 'choose_plan')}\n\n🔢 𝗜𝗗: ${chatId}\n📋 𝗔𝗰𝘁𝗶𝘃𝗲 𝗣𝗹𝗮𝗻: ${activePlan}`;
    
    try {
        await bot.telegram.sendMessage(chatId, menuText, {
            reply_markup: getMainMenuKeyboard(chatId),
            parse_mode: 'Markdown'
        });
    } catch (e) {
        console.error('Error sending main menu:', e);
    }
}

// ---------- Handlers: /start ----------
bot.start(async (ctx) => {
    const chatId = ctx.chat.id;
    if (!users.has(chatId)) {
        users.set(chatId, { lang: 'en' });
        saveUsers();
    }
    if (chatId === ADMIN_ID) {
        await sendAnimatedAdminPanel(chatId);
    } else {
        await sendAnimatedWelcome(chatId);
    }
});

// ---------- Enhanced Callback queries handler ----------
bot.on('callback_query', async (ctx) => {
    const chatId = ctx.update.callback_query.message.chat.id;
    const data = ctx.update.callback_query.data;

    try {
        // Language change
        if (data.startsWith('lang_')) {
            const lang = data.split('_')[1];
            const u = users.get(chatId) || {};
            u.lang = lang; 
            users.set(chatId, u); 
            saveUsers();
            await ctx.answerCbQuery();

            try {
                await ctx.telegram.sendChatAction(chatId, 'typing');
                await ctx.editMessageText('🔄 𝗖𝗵𝗮𝗻𝗴𝗶𝗻𝗴 𝗹𝗮𝗻𝗴𝘂𝗮𝗴𝗲...');
                await delay(500);
                await ctx.editMessageText('✅ 𝗟𝗮𝗻𝗴𝘂𝗮𝗴𝗲 𝘂𝗽𝗱𝗮𝘁𝗲𝗱!');
                await delay(350);
                
                const user = users.get(chatId) || {};
                const activePlan = user.activePlan ? getPlanName(chatId, user.activePlan) : 'None';
                const welcomeText = `${t(chatId, 'language_set')}\n\n🔢 𝗜𝗗: ${chatId}\n📋 𝗔𝗰𝘁𝗶𝘃𝗲 𝗣𝗹𝗮𝗻: ${activePlan}`;
                
                await ctx.editMessageText(welcomeText, { 
                    reply_markup: getMainMenuKeyboard(chatId), 
                    parse_mode: 'Markdown' 
                });
            } catch(e) {}
            return;
        }

        // Main menu
        if (data === 'main_menu') { 
            await ctx.answerCbQuery(); 
            if (chatId === ADMIN_ID) { 
                await sendAnimatedAdminPanel(chatId); 
            } else { 
                try { 
                    const user = users.get(chatId) || {};
                    const activePlan = user.activePlan ? getPlanName(chatId, user.activePlan) : 'None';
                    const menuText = `${t(chatId, 'choose_plan')}\n\n🔢 𝗜𝗗: ${chatId}\n📋 𝗔𝗰𝘁𝗶𝘃𝗲 𝗣𝗹𝗮𝗻: ${activePlan}`;
                    
                    await ctx.editMessageText(menuText, { 
                        reply_markup: getMainMenuKeyboard(chatId), 
                        parse_mode: 'Markdown' 
                    }); 
                } catch(e) {
                    // If editing fails, send a new message
                    const user = users.get(chatId) || {};
                    const activePlan = user.activePlan ? getPlanName(chatId, user.activePlan) : 'None';
                    const menuText = `${t(chatId, 'choose_plan')}\n\n🔢 𝗜𝗗: ${chatId}\n📋 𝗔𝗰𝘁𝗶𝘃𝗲 𝗣𝗹𝗮𝗻: ${activePlan}`;
                    
                    await ctx.telegram.sendMessage(chatId, menuText, {
                        reply_markup: getMainMenuKeyboard(chatId),
                        parse_mode: 'Markdown'
                    });
                } 
            } 
            return; 
        }

        // Admin panel
        if (data === 'admin_panel') {
            await ctx.answerCbQuery();
            if (chatId === ADMIN_ID) {
                await sendAnimatedAdminPanel(chatId);
            }
            return;
        }

        // Plan selection
        if (data.startsWith('plan_')) {
            const planId = data.split('_')[1];
            const plan = getPlans(chatId).find(p => p.id === planId);
            if (plan) {
                const u = users.get(chatId) || {};
                u.plan = planId;
                users.set(chatId, u);
                saveUsers();
                await ctx.answerCbQuery();

                try {
                    await ctx.editMessageText('📋 𝗟𝗼𝗮𝗱𝗶𝗻𝗴 𝗽𝗹𝗮𝗻 𝗱𝗲𝘁𝗮𝗶𝗹𝘀...');
                    await delay(450);
                    await ctx.editMessageText('💎 𝗣𝗿𝗲𝗽𝗮𝗿𝗶𝗻𝗴 𝗽𝗮𝘆𝗺𝗲𝗻𝘁 𝗼𝗽𝘁𝗶𝗼𝗻𝘀...');
                    await delay(380);
                    const msg = t(chatId, 'payment', { 
                        plan: plan.name, 
                        description: plan.description 
                    });
                    await ctx.editMessageText(msg, { 
                        reply_markup: getCryptoKeyboard(chatId), 
                        parse_mode: 'Markdown' 
                    });
                } catch (e) {}
            } else {
                await ctx.answerCbQuery('❌ 𝗣𝗹𝗮𝗻 𝗻𝗼𝘁 𝗳𝗼𝘂𝗻𝗱');
            }
            return;
        }

        // Crypto selection
        if (data.startsWith('crypto_')) {
            const cryptoName = data.replace('crypto_', '');
            const crypto = cryptos.find(c => c.name === cryptoName);
            if (crypto) {
                const u = users.get(chatId) || {};
                u.crypto = cryptoName;
                users.set(chatId, u);
                saveUsers();
                await ctx.answerCbQuery();

                try {
                    await ctx.editMessageText('🔐 𝗚𝗲𝗻𝗲𝗿𝗮𝘁𝗶𝗻𝗴 𝗽𝗮𝘆𝗺𝗲𝗻𝘁 𝗮𝗱𝗱𝗿𝗲𝘀𝘀...');
                    await delay(520);
                    await ctx.editMessageText('💳 𝗣𝗿𝗲𝗽𝗮𝗿𝗶𝗻𝗴 𝗽𝗮𝘆𝗺𝗲𝗻𝘁 𝗶𝗻𝘀𝘁𝗿𝘂𝗰𝘁𝗶𝗼𝗻𝘀...');
                    await delay(400);

                    let instr = t(chatId, 'payment_instruction', {
                        method: crypto.name,
                        address: crypto.address
                    });

                    // If QR code exists, send it with the payment instructions
                    if (crypto.qrFileId) {
                        try {
                            // Send QR code as a separate message first
                            await ctx.telegram.sendPhoto(chatId, crypto.qrFileId, {
                                caption: `📊 𝗤𝗥 𝗖𝗼𝗱𝗲 𝗳𝗼𝗿 ${crypto.name}`,
                                parse_mode: 'Markdown'
                            });

                            // Then send payment instructions with buttons
                            await ctx.telegram.sendMessage(chatId, instr, {
                                parse_mode: 'Markdown',
                                reply_markup: getPaymentDoneKeyboard(chatId)
                            });
                        } catch (e) {
                            // If sending photo fails, fall back to text message
                            console.error('Error sending QR code:', e);
                            await ctx.editMessageText(instr, { 
                                reply_markup: getPaymentDoneKeyboard(chatId), 
                                parse_mode: 'Markdown' 
                            });
                        }
                    } else {
                        await ctx.editMessageText(instr, { 
                            reply_markup: getPaymentDoneKeyboard(chatId), 
                            parse_mode: 'Markdown' 
                        });
                    }
                } catch (e) {
                    console.error('Error in crypto selection:', e);
                }
            } else {
                await ctx.answerCbQuery('❌ 𝗖𝗿𝘆𝗽𝘁𝗼 𝗻𝗼𝘁 𝗮𝘃𝗮𝗶𝗹𝗮𝗯𝗹𝗲');
            }
            return;
        }

        // Payment done
        if (data === 'payment_done') {
            await ctx.answerCbQuery();
            try {
                // Try to edit the message, if it fails send a new one
                try {
                    await ctx.editMessageText(t(chatId, 'ask_screenshot'), { 
                        reply_markup: getBackToMainKeyboard(chatId),
                        parse_mode: 'Markdown'
                    });
                } catch (editError) {
                    // If editing fails (message might be too old), send a new message
                    await ctx.telegram.sendMessage(chatId, t(chatId, 'ask_screenshot'), { 
                        reply_markup: getBackToMainKeyboard(chatId),
                        parse_mode: 'Markdown'
                    });
                }
            } catch (e) {
                console.error('Error in payment_done:', e);
            }
            return;
        }

        // Help
        if (data === 'help') {
            await ctx.answerCbQuery();
            try {
                await ctx.editMessageText(t(chatId, 'help'), { 
                    parse_mode: 'Markdown', 
                    reply_markup: getHelpKeyboard(chatId) 
                });
            } catch(e) {
                console.error('Error in help:', e);
            }
            return;
        }

        // Select language menu
        if (data === 'select_lang') {
            await ctx.answerCbQuery();
            try {
                await ctx.editMessageText(t(chatId, 'welcome'), { 
                    reply_markup: getLangKeyboard(), 
                    parse_mode: 'Markdown' 
                });
            } catch (e) {
                console.error('Error in select_lang:', e);
            }
            return;
        }

        // Demo video
        if (data === 'demo_video') {
            await ctx.answerCbQuery();
            try {
                await ctx.telegram.sendMessage(chatId, '🎥 𝗪𝗮𝘁𝗰𝗵 𝗼𝘂𝗿 𝗼𝗳𝗳𝗶𝗰𝗶𝗮𝗹 𝗱𝗲𝗺𝗼 & 𝘂𝗽𝗱𝗮𝘁𝗲𝘀:', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔗 𝗩𝗶𝘀𝗶𝘁 𝗖𝗵𝗮𝗻𝗻𝗲𝗹', url: OFFICIAL_CHANNEL_LINK }],
                            [{ text: t(chatId, 'back'), callback_data: 'main_menu' }]
                        ]
                    }
                });
            } catch (e) {
                console.error('Error in demo_video:', e);
            }
            return;
        }

        // Admin-only functions
        if (chatId === ADMIN_ID) {
            if (data === 'admin_logs') {
                await ctx.answerCbQuery();
                try {
                    await ctx.editMessageText('📊 𝗙𝗲𝘁𝗰𝗵𝗶𝗻𝗴 𝗽𝘂𝗿𝗰𝗵𝗮𝘀𝗲 𝗹𝗼𝗴𝘀...');
                    await delay(500);
                    const logs = purchaseLogs.slice(-20).map((l, i) => 
                        `${i+1}. 𝗨𝘀𝗲𝗿:${l.user} 𝗣𝗹𝗮𝗻:${l.plan} 𝗖𝗿𝘆𝗽𝘁𝗼:${l.crypto} 𝗧𝗶𝗺𝗲:${l.time}`
                    ).join('\n');
                    await ctx.editMessageText(`📋 𝗟𝗮𝘀𝘁 𝟮𝟬 𝗣𝘂𝗿𝗰𝗵𝗮𝘀𝗲 𝗟𝗼𝗴𝘀:\n\n${logs || '❌ 𝗡𝗼 𝗹𝗼𝗴𝘀 𝘆𝗲𝘁'}`, { 
                        reply_markup: getAdminKeyboard(chatId),
                        parse_mode: 'Markdown'
                    });
                } catch (e) {
                    console.error('Error in admin_logs:', e);
                }
            } else if (data === 'admin_users') {
                await ctx.answerCbQuery();
                try {
                    await ctx.editMessageText(`👤 𝗧𝗼𝘁𝗮𝗹 𝗨𝘀𝗲𝗿𝘀: ${users.size}`, { 
                        reply_markup: getAdminKeyboard(chatId),
                        parse_mode: 'Markdown'
                    });
                } catch (e) {
                    console.error('Error in admin_users:', e);
                }
            } else if (data === 'admin_broadcast') {
                await ctx.answerCbQuery();
                const u = users.get(chatId) || {};
                u.waitingForBroadcast = true;
                users.set(chatId, u);
                saveUsers();
                try {
                    await ctx.editMessageText('📢 𝗦𝗲𝗻𝗱 𝘆𝗼𝘂𝗿 𝗯𝗿𝗼𝗮𝗱𝗰𝗮𝘀𝘁 𝗺𝗲𝘀𝘀𝗮𝗴𝗲 (𝘁𝗲𝘅𝘁 𝗼𝗻𝗹𝘆):');
                } catch(e){
                    console.error('Error in admin_broadcast:', e);
                }
            } else if (data === 'admin_add_crypto') {
                await ctx.answerCbQuery();
                const u = users.get(chatId) || {};
                u.waitingForCrypto = true;
                users.set(chatId, u);
                saveUsers();
                try {
                    await ctx.editMessageText('➕ 𝗦𝗲𝗻𝗱 𝗰𝗿𝗲𝗱𝗲𝗻𝘁𝗶𝗮𝗹𝘀 𝗶𝗻 𝗳𝗼𝗿𝗺𝗮𝘁:\n𝗡𝗮𝗺𝗲|𝗔𝗱𝗱𝗿𝗲𝘀𝘀\n𝗘𝘅𝗮𝗺𝗽𝗹𝗲: 𝗟𝗧𝗖|𝗹𝘁𝗰𝟭𝗾𝘅𝘆𝟮𝘅𝟯𝗮𝗯𝗰...');
                } catch(e){
                    console.error('Error in admin_add_crypto:', e);
                }
            } else if (data === 'admin_remove_crypto') {
                await ctx.answerCbQuery();
                const u = users.get(chatId) || {};
                u.waitingForRemoveCrypto = true;
                users.set(chatId, u);
                saveUsers();
                const list = cryptos.map((c,i) => `${i+1}. ${c.name}`).join('\n');
                try {
                    await ctx.editMessageText(`➖ 𝗖𝘂𝗿𝗿𝗲𝗻𝘁 𝗰𝗿𝘆𝗽𝘁𝗼𝘀:\n${list}\n\n𝗦𝗲𝗻𝗱 𝘁𝗵𝗲 𝗻𝘂𝗺𝗯𝗲𝗿 𝘁𝗼 𝗿𝗲𝗺𝗼𝘃𝗲:`, {
                        parse_mode: 'Markdown'
                    });
                } catch(e){
                    console.error('Error in admin_remove_crypto:', e);
                }
            } else if (data === 'admin_add_qr') {
                await ctx.answerCbQuery();
                try {
                    await ctx.editMessageText('📷 𝗦𝗲𝗹𝗲𝗰𝘁 𝗮 𝗰𝗿𝘆𝗽𝘁𝗼 𝘁𝗼 𝗮𝗱𝗱 𝗤𝗥 𝗰𝗼𝗱𝗲:', {
                        reply_markup: getCryptoSelectionKeyboard('add_qr')
                    });
                } catch(e){
                    console.error('Error in admin_add_qr:', e);
                }
            } else if (data === 'admin_remove_qr') {
                await ctx.answerCbQuery();
                try {
                    await ctx.editMessageText('🗑️ 𝗦𝗲𝗹𝗲𝗰𝘁 𝗮 𝗰𝗿𝘆𝗽𝘁𝗼 𝘁𝗼 𝗿𝗲𝗺𝗼𝘃𝗲 𝗤𝗥 𝗰𝗼𝗱𝗲:', {
                        reply_markup: getCryptoSelectionKeyboard('remove_qr')
                    });
                } catch(e){
                    console.error('Error in admin_remove_qr:', e);
                }
            } else if (data.startsWith('add_qr_')) {
                const cryptoName = data.replace('add_qr_', '');
                const crypto = cryptos.find(c => c.name === cryptoName);
                if (crypto) {
                    const u = users.get(chatId) || {};
                    u.waitingForQrCode = cryptoName;
                    users.set(chatId, u);
                    saveUsers();
                    await ctx.answerCbQuery();
                    try {
                        await ctx.editMessageText(`📷 𝗦𝗲𝗻𝗱 𝗤𝗥 𝗰𝗼𝗱𝗲 𝗶𝗺𝗮𝗴𝗲 𝗳𝗼𝗿: ${cryptoName}`);
                    } catch(e){
                        console.error('Error in add_qr selection:', e);
                    }
                }
            } else if (data.startsWith('remove_qr_')) {
                const cryptoName = data.replace('remove_qr_', '');
                const crypto = cryptos.find(c => c.name === cryptoName);
                if (crypto) {
                    crypto.qrFileId = null;
                    saveCryptos();
                    await ctx.answerCbQuery('✅ 𝗤𝗥 𝗰𝗼𝗱𝗲 𝗿𝗲𝗺𝗼𝘃𝗲𝗱');
                    try {
                        await ctx.editMessageText(`✅ 𝗤𝗥 𝗰𝗼𝗱𝗲 𝗿𝗲𝗺𝗼𝘃𝗲𝗱 𝗳𝗼𝗿: ${cryptoName}`, {
                            reply_markup: getAdminKeyboard(chatId)
                        });
                    } catch(e){
                        console.error('Error in remove_qr:', e);
                    }
                }
            } else if (data.startsWith('approve_')) {
                const index = parseInt(data.replace('approve_', ''));
                const approval = pendingApprovals[index];
                if (approval) {
                    await ctx.answerCbQuery('✅ 𝗔𝗽𝗽𝗿𝗼𝘃𝗶𝗻𝗴...');
                    
                    // Remove from pending approvals
                    pendingApprovals.splice(index, 1);
                    savePendingApprovals();
                    
                    // Activate plan for user
                    const user = users.get(approval.userId);
                    if (user) {
                        user.activePlan = approval.plan;
                        users.set(approval.userId, user);
                        saveUsers();
                    }
                    
                    // Notify user
                    try {
                        await bot.telegram.sendMessage(approval.userId, t(approval.userId, 'payment_approved'), {
                            parse_mode: 'Markdown'
                        });
                        
                        // Send updated main menu to user
                        const userUpdated = users.get(approval.userId) || {};
                        const activePlan = userUpdated.activePlan ? getPlanName(approval.userId, userUpdated.activePlan) : 'None';
                        const menuText = `${t(approval.userId, 'choose_plan')}\n\n🔢 𝗜𝗗: ${approval.userId}\n📋 𝗔𝗰𝘁𝗶𝘃𝗲 𝗣𝗹𝗮𝗻: ${activePlan}`;
                        
                        await bot.telegram.sendMessage(approval.userId, menuText, {
                            reply_markup: getMainMenuKeyboard(approval.userId),
                            parse_mode: 'Markdown'
                        });
                    } catch (e) {
                        console.error('Error notifying user:', e);
                    }
                    
                    try {
                        // Edit the admin message to show approved
                        await ctx.editMessageCaption({
                            caption: `✅ 𝗣𝗮𝘆𝗺𝗲𝗻𝘁 𝗔𝗽𝗽𝗿𝗼𝘃𝗲𝗱\n\n👤 𝗨𝘀𝗲𝗿: ${approval.userId}\n📦 𝗣𝗹𝗮𝗻: ${getPlanName(approval.userId, approval.plan)}\n💰 𝗖𝗿𝘆𝗽𝘁𝗼: ${approval.crypto}\n⏰ 𝗧𝗶𝗺𝗲: ${new Date(approval.time).toLocaleString()}`,
                            parse_mode: 'Markdown'
                        });
                        // Remove the buttons
                        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
                    } catch(e) {
                        console.error('Error editing admin message:', e);
                    }
                }
            } else if (data.startsWith('reject_')) {
                const index = parseInt(data.replace('reject_', ''));
                const approval = pendingApprovals[index];
                if (approval) {
                    await ctx.answerCbQuery('❌ 𝗥𝗲𝗷𝗲𝗰𝘁𝗶𝗻𝗴...');
                    
                    // Remove from pending approvals
                    pendingApprovals.splice(index, 1);
                    savePendingApprovals();
                    
                    // Notify user
                    try {
                        await bot.telegram.sendMessage(approval.userId, t(approval.userId, 'payment_rejected'), {
                            parse_mode: 'Markdown'
                        });
                    } catch (e) {
                        console.error('Error notifying user:', e);
                    }
                    
                    try {
                        // Edit the admin message to show rejected
                        await ctx.editMessageCaption({
                            caption: `❌ 𝗣𝗮𝘆𝗺𝗲𝗻𝘁 𝗥𝗲𝗷𝗲𝗰𝘁𝗲𝗱\n\n👤 𝗨𝘀𝗲𝗿: ${approval.userId}\n📦 𝗣𝗹𝗮𝗻: ${getPlanName(approval.userId, approval.plan)}\n💰 𝗖𝗿𝘆𝗽𝘁𝗼: ${approval.crypto}\n⏰ 𝗧𝗶𝗺𝗲: ${new Date(approval.time).toLocaleString()}`,
                            parse_mode: 'Markdown'
                        });
                        // Remove the buttons
                        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
                    } catch(e) {
                        console.error('Error editing admin message:', e);
                    }
                }
            }
        }

        await ctx.answerCbQuery();
    } catch (err) {
        console.error('❌ Callback query handler error', err);
        try { await ctx.answerCbQuery('❌ Error'); } catch(e){}
    }
});

// ---------- Enhanced Message handler ----------
bot.on('message', async (ctx) => {
    const chatId = ctx.chat.id;
    const user = users.get(chatId) || {};

    // Ignore slash commands
    if (ctx.message.text && ctx.message.text.startsWith('/')) return;

    // Admin: broadcast
    if (chatId === ADMIN_ID && user.waitingForBroadcast && ctx.message.text) {
        await bot.telegram.sendChatAction(chatId, 'typing');
        const status = await bot.telegram.sendMessage(chatId, '📡 𝗣𝗿𝗲𝗽𝗮𝗿𝗶𝗻𝗴 𝗯𝗿𝗼𝗮𝗱𝗰𝗮𝘀𝘁...');
        await delay(500);
        await bot.telegram.editMessageText(chatId, status.message_id, undefined, '📤 𝗦𝗲𝗻𝗱𝗶𝗻𝗴 𝘁𝗼 𝘂𝘀𝗲𝗿𝘀...').catch(()=>{});

        const broadcastMessage = ctx.message.text;
        user.waitingForBroadcast = false; 
        users.set(chatId, user); 
        saveUsers();

        let sent = 0;
        let failed = 0;

        // Send to all users
        for (const [uid, userData] of users.entries()) {
            if (uid !== ADMIN_ID) {
                try {
                    await bot.telegram.sendMessage(uid, `📢 ${stylizeFullText(broadcastMessage)}`, { parse_mode: 'Markdown' });
                    sent++;
                    await delay(100); // Rate limiting
                } catch (error) {
                    failed++;
                }
            }
        }

        setTimeout(async () => {
            await bot.telegram.editMessageText(chatId, status.message_id, undefined, 
                `✅ 𝗕𝗿𝗼𝗮𝗱𝗰𝗮𝘀𝘁 𝗰𝗼𝗺𝗽𝗹𝗲𝘁𝗲𝗱!\n📊 𝗦𝗲𝗻𝘁 𝘁𝗼 ${sent} 𝘂𝘀𝗲𝗿𝘀\n❌ 𝗙𝗮𝗶𝗹𝗲𝗱: ${failed}`).catch(()=>{});
            setTimeout(() => {
                bot.telegram.sendMessage(chatId, t(chatId, 'admin_panel'), { 
                    reply_markup: getAdminKeyboard(chatId),
                    parse_mode: 'Markdown'
                });
            }, 900);
        }, 1600);
        return;
    }

    // Admin: add crypto
    if (chatId === ADMIN_ID && user.waitingForCrypto && ctx.message.text) {
        const processing = await bot.telegram.sendMessage(chatId, '🔄 𝗣𝗿𝗼𝗰𝗲𝘀𝘀𝗶𝗻𝗴 𝗰𝗿𝘆𝗽𝘁𝗼 𝗮𝗱𝗱𝗶𝘁𝗶𝗼𝗻...');
        const parts = ctx.message.text.split('|').map(s => s.trim());
        if (parts.length === 2) {
            cryptos.push({ name: stylizeFullText(parts[0]), address: parts[1], qrFileId: null }); 
            saveCryptos();
            user.waitingForCrypto = false; 
            users.set(chatId, user); 
            saveUsers();
            await bot.telegram.editMessageText(chatId, processing.message_id, undefined, 
                `✅ 𝗦𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹𝗹𝘆 𝗮𝗱𝗱𝗲𝗱 𝗰𝗿𝘆𝗽𝘁𝗼: ${stylizeFullText(parts[0])}`).catch(()=>{});
            setTimeout(() => bot.telegram.sendMessage(chatId, t(chatId, 'admin_panel'), { 
                reply_markup: getAdminKeyboard(chatId),
                parse_mode: 'Markdown'
            }), 900);
        } else {
            user.waitingForCrypto = false; 
            users.set(chatId, user); 
            saveUsers();
            await bot.telegram.editMessageText(chatId, processing.message_id, undefined, 
                '❌ 𝗜𝗻𝘃𝗮𝗹𝗶𝗱 𝗳𝗼𝗿𝗺𝗮𝘁. 𝗨𝘀𝗲: 𝗡𝗮𝗺𝗲|𝗔𝗱𝗱𝗿𝗲𝘀𝘀').catch(()=>{});
            setTimeout(() => bot.telegram.sendMessage(chatId, t(chatId, 'admin_panel'), { 
                reply_markup: getAdminKeyboard(chatId),
                parse_mode: 'Markdown'
            }), 900);
        }
        return;
    }

    // Admin: remove crypto
    if (chatId === ADMIN_ID && user.waitingForRemoveCrypto && ctx.message.text) {
        const proc = await bot.telegram.sendMessage(chatId, '🗑️ 𝗣𝗿𝗼𝗰𝗲𝘀𝘀𝗶𝗻𝗴 𝗰𝗿𝘆𝗽𝘁𝗼 𝗿𝗲𝗺𝗼𝘃𝗮𝗹...');
        const index = parseInt(ctx.message.text.trim(), 10) - 1;
        if (isNaN(index) || index < 0 || index >= cryptos.length) {
            user.waitingForRemoveCrypto = false; 
            users.set(chatId, user); 
            saveUsers();
            await bot.telegram.editMessageText(chatId, proc.message_id, undefined, 
                `❌ 𝗜𝗻𝘃𝗮𝗹𝗶𝗱 𝗻𝘂𝗺𝗯𝗲𝗿. 𝗣𝗹𝗲𝗮𝘀𝗲 𝗲𝗻𝘁𝗲𝗿 𝗮 𝗻𝘂𝗺𝗯𝗲𝗿 𝗯𝗲𝘁𝘄𝗲𝗲𝗻 𝟭 𝗮𝗻𝗱 ${cryptos.length}\n\n${cryptos.map((c,i) => `${i+1}. ${c.name}`).join('\n')}`, {
                parse_mode: 'Markdown'
            }).catch(()=>{});
            setTimeout(() => bot.telegram.sendMessage(chatId, t(chatId, 'admin_panel'), { 
                reply_markup: getAdminKeyboard(chatId),
                parse_mode: 'Markdown'
            }), 1800);
        } else {
            const removed = cryptos.splice(index, 1)[0]; 
            saveCryptos();
            user.waitingForRemoveCrypto = false; 
            users.set(chatId, user); 
            saveUsers();
            await bot.telegram.editMessageText(chatId, proc.message_id, undefined, 
                `✅ 𝗦𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹𝗹𝘆 𝗿𝗲𝗺𝗼𝘃𝗲𝗱: ${removed.name}\n\n𝗨𝗽𝗱𝗮𝘁𝗲𝗱 𝗹𝗶𝘀𝘁:\n${cryptos.map((c,i) => `${i+1}. ${c.name}`).join('\n') || '❌ 𝗡𝗼 𝗰𝗿𝘆𝗽𝘁𝗼𝘀 𝗿𝗲𝗺𝗮𝗶𝗻𝗶𝗻𝗴'}`, {
                parse_mode: 'Markdown'
            }).catch(()=>{});
            setTimeout(() => bot.telegram.sendMessage(chatId, t(chatId, 'admin_panel'), { 
                reply_markup: getAdminKeyboard(chatId),
                parse_mode: 'Markdown'
            }), 1200);
        }
        return;
    }

    // Admin: add QR code
    if (chatId === ADMIN_ID && user.waitingForQrCode && ctx.message.photo) {
        const cryptoName = user.waitingForQrCode;
        const crypto = cryptos.find(c => c.name === cryptoName);
        if (crypto) {
            const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            crypto.qrFileId = fileId;
            saveCryptos();
            user.waitingForQrCode = false;
            users.set(chatId, user);
            saveUsers();

            await ctx.reply(`✅ 𝗤𝗥 𝗰𝗼𝗱𝗲 𝘀𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹𝗹𝘆 𝗮𝗱𝗱𝗲𝗱 𝗳𝗼𝗿: ${cryptoName}`, {
                reply_markup: getAdminKeyboard(chatId)
            });
        }
        return;
    }

    // User: payment screenshot (photo)
    if (ctx.message.photo && user.plan && user.crypto) {
        const proc = await bot.telegram.sendMessage(chatId, '📸 𝗣𝗿𝗼𝗰𝗲𝘀𝘀𝗶𝗻𝗴 𝗽𝗮𝘆𝗺𝗲𝗻𝘁 𝘀𝗰𝗿𝗲𝗲𝗻𝘀𝗵𝗼𝘁...');
        await delay(600);
        await bot.telegram.editMessageText(chatId, proc.message_id, undefined, '🔍 𝗩𝗲𝗿𝗶𝗳𝘆𝗶𝗻𝗴 𝗽𝗮𝘆𝗺𝗲𝗻𝘁 𝗱𝗲𝘁𝗮𝗶𝗹𝘀...').catch(()=>{});
        await delay(450);
        await bot.telegram.editMessageText(chatId, proc.message_id, undefined, '📋 𝗟𝗼𝗴𝗴𝗶𝗻𝗴 𝗽𝘂𝗿𝗰𝗵𝗮𝘀𝗲 𝗶𝗻𝗳𝗼𝗿𝗺𝗮𝘁𝗶𝗼𝗻...').catch(()=>{});

        const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        
        // Add to pending approvals instead of directly activating
        const pendingIndex = pendingApprovals.length;
        pendingApprovals.push({ 
            userId: chatId, 
            plan: user.plan, 
            crypto: user.crypto, 
            time: new Date().toISOString(), 
            photo: fileId 
        }); 
        savePendingApprovals();

        purchaseLogs.push({ 
            user: chatId, 
            plan: user.plan, 
            crypto: user.crypto, 
            time: new Date().toISOString(), 
            photo: fileId,
            status: 'pending'
        }); 
        saveLogs();

        // Notify admin with approve/reject buttons
        try {
            const planObj = getPlans(chatId).find(p => p.id === user.plan);
            const planName = planObj ? planObj.name : user.plan;
            const caption = `⏳ 𝗡𝗲𝘄 𝗣𝗮𝘆𝗺𝗲𝗻𝘁 𝗣𝗲𝗻𝗱𝗶𝗻𝗴 𝗔𝗽𝗽𝗿𝗼𝘃𝗮𝗹!\n\n👤 𝗨𝘀𝗲𝗿: ${chatId}\n📦 𝗣𝗹𝗮𝗻: ${planName}\n💰 𝗖𝗿𝘆𝗽𝘁𝗼: ${user.crypto}\n⏰ 𝗧𝗶𝗺𝗲: ${new Date().toLocaleString()}`;

            await bot.telegram.sendPhoto(ADMIN_ID, fileId, { 
                caption: caption,
                parse_mode: 'Markdown',
                reply_markup: getApprovalKeyboard(pendingIndex)
            });
        } catch (e) {
            console.error('Error sending approval notification to admin:', e);
        }

        await bot.telegram.editMessageText(chatId, proc.message_id, undefined, '✅ 𝗣𝗮𝘆𝗺𝗲𝗻𝘁 𝘀𝗰𝗿𝗲𝗲𝗻𝘀𝗵𝗼𝘁 𝗿𝗲𝗰𝗲𝗶𝘃𝗲𝗱 𝘀𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹𝗹𝘆!').catch(()=>{});
        await delay(600);

        await bot.telegram.sendMessage(chatId, t(chatId, 'pending_approval'), { 
            reply_markup: getBackToMainKeyboard(chatId),
            parse_mode: 'Markdown'
        });

        // Cleanup plan & crypto selection (but don't set active plan yet)
        const u = users.get(chatId) || {};
        delete u.plan;
        delete u.crypto;
        users.set(chatId, u);
        saveUsers();
        return;
    }

    // Ignore other messages to keep chat tidy
});

// ---------- Start-up ----------
loadAllData();

(async function start() {
    try {
        const me = await bot.telegram.getMe();
        console.log(`✅ Authenticated as @${me.username} (id: ${me.id}) — starting bot...`);
        await bot.launch();
        console.log('🚀 Bot launched (Telegraf).');
    } catch (err) {
        console.error('❌ Failed to start bot.');
        if (err && err.description) console.error('Telegram error:', err.description);
        if (err && err.response && err.response.body) console.error('Telegram response:', err.response.body);
        if (err && err.code === 'ETELEGRAM') console.error('🔒 Unauthorized or network issue. Check TELEGRAM_BOT_TOKEN.');
        process.exit(1);
    }
})();

// Graceful stop
process.once('SIGINT', () => { bot.stop('SIGINT'); process.exit(0); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0); });

// Error handlers
bot.catch((err) => {
    console.error('❌ Bot error:', err);
});

console.log('✅ Enhanced bot loaded — ready to authenticate and run.');
