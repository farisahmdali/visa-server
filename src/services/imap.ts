// Note: Install required packages with: npm install imap-simple mailparser
import * as imaps from 'imap-simple';
import { simpleParser, ParsedMail } from 'mailparser';

// TypeScript interfaces
interface ImapConfig {
    imap: {
        user: string;
        password: string;
        host: string;
        port: number;
        tls: boolean;
        tlsOptions: {
            rejectUnauthorized: boolean;
        };
    };
}

interface MessagePart {
    body: string;
}

interface ImapMessage {
    parts: MessagePart[];
    attributes: any;
}

// Callback function type for OTP handling
type OtpCallback = (otp: string,site:string) => void | Promise<void>;

const config: ImapConfig = {
    imap: {
        user: process.env.IMAP_USER || 'farisahmdali@gmail.com',
        password: process.env.IMAP_PASSWORD || 'lfdz ilsv vees hwhc', // app password
        host: process.env.IMAP_HOST || 'imap.gmail.com',
        port: Number(process.env.IMAP_PORT) || 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false }
    }
};

// Main IMAP service function
export const startImapService = async (otpCallback: OtpCallback): Promise<void> => {
    try {
        const connection = await imaps.connect(config);
        
        await connection.openBox('INBOX');
        console.log("✅ Connected to INBOX, listening for new messages...");
        
        // connection.on('mail', (numNewMsgs: number) => {
        //     console.log(`📧 New mail event! ${numNewMsgs} message(s) arrived.`);
            
        //     handleNewMessages(connection, otpCallback);
        // });
        setInterval(() => {
            console.log("Checking for new messages...");
            handleNewMessages(connection, otpCallback);
        }, 10000);
    } catch (error) {
        console.error("❌ IMAP connection error:", error);
        throw error;
    }
};

// Handle new messages
const handleNewMessages = async (connection: any, otpCallback: OtpCallback): Promise<void> => {
    try {
        const messages: ImapMessage[] = await connection.search(
            ['UNSEEN', ['FROM', 'donotreply@vfshelpline.com']], 
            { bodies: [''], markSeen: true }
        );
        
        console.log(`🔍 Found ${messages.length} new message(s)`);
        
        for (const [index, message] of messages.entries()) {
            await processMessage(message, index, otpCallback);
        }
        
    } catch (error) {
        console.error('❌ Error searching new messages:', error);
    }
};

// Process individual message
const processMessage = async (item: ImapMessage, index: number, otpCallback: OtpCallback): Promise<void> => {
    try {
        // Gmail's IMAP can store body in 'attributes' -> 'struct' -> 'parts', so we join all
        const allParts: string = item.parts.map((part: MessagePart) => part.body).join('');
        
        // Parse the complete raw message
        const mail: ParsedMail = await simpleParser(allParts);
        
        console.log(`\n--- New Message ${index + 1} ---`);
        console.log("From:", mail.from?.text || 'Unknown');
        console.log("Subject:", mail.subject || 'No subject');
        console.log("Date:", mail.date || 'Unknown date');
        console.log("Text Body:", mail.text || 'No plain text content');
        console.log("HTML Body:", mail.html || 'No HTML content');
        
        // Extract OTP from message
        const otp = extractOtp(mail);
        const site = extractSite(mail);
        
        if (otp) {
            console.log("🔑 OTP Found:", otp,site);
            // Call the provided callback function with the OTP
            await otpCallback(otp,site || "");
        }
        
        console.log("--- End New Message ---\n");
        
    } catch (error) {
        console.error(`❌ Error processing new message ${index + 1}:`, error);
    }
};

// Extract OTP from parsed mail
const extractOtp = (mail: ParsedMail): string | null => {
    let otpMatch: RegExpMatchArray | null = null;
    
    // Try to find OTP in text content first
    if (mail.text) {
        otpMatch = mail.text.match(/\b\d{6}\b/);
    }
    
    // Fallback to HTML content
    if (!otpMatch && mail.html) {
        otpMatch = mail.html.match(/\b\d{6}\b/);
    }
    
    return otpMatch ? otpMatch[0] : null;
};

const extractSite = (mail: ParsedMail): string | null => {
    let siteMatch: RegExpMatchArray | null = null;
    if (mail.text?.includes("/gbr/en/isl")) {
        return "iceland";
    }else if (mail.text?.includes("/gbr/en/nor")) {
        return "norway";
    }else if (mail.text?.includes("/gbr/en/mlt")) {
        return "malta";
    }else if (mail.text?.includes("/gbr/en/ltu")) {
        return "lithuania";
    }else if (mail.text?.includes("/gbr/en/lva")) {
        return "latvia";
    }else if (mail.text?.includes("/gbr/en/hun")) {
        return "hungry";
    }else if (mail.text?.includes("/gbr/en/fin")) {
        return "finland";
    }
    return siteMatch ? siteMatch[0] : null;
};

// Export the service for external initialization
// Usage: startImapService((otp) => console.log('Received OTP:', otp));
