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
type OtpCallback = (otp: string, site: string) => void | Promise<void>;

export class ImapService {
    private config: ImapConfig;
    private connection: any;
    private otpCallback: OtpCallback | null = null;
    private isConnected: boolean = false;
    private checkInterval: NodeJS.Timeout | null = null;
    private checkIntervalMs: number = 10000; // 10 seconds
    private maxConnectRetries: number = 5;
    private initialReconnectDelayMs: number = 2000; // 2 seconds

    constructor(email:string,password:string) {
        this.config = {
            imap: {
                user: email,
                password:password, // app password
                host: process.env.IMAP_HOST || 'imap.gmail.com',
                port: Number(process.env.IMAP_PORT) || 993,
                tls: true,
                tlsOptions: { rejectUnauthorized: false }
            }
        };
    }

    /**
     * Start the IMAP service
     * @param otpCallback - Callback function to handle received OTPs
     */
    public async start(otpCallback: OtpCallback): Promise<void> {
        try {
            this.otpCallback = otpCallback;
            await this.connectWithRetry();
            await this.startMessageChecking();
            this.connection.imap.on('close', () => {
                console.warn("⚠️ IMAP connection closed");
                this.isConnected = false;
                this.reconnect();
            });
            console.log("✅ IMAP service started successfully");
        } catch (error) {
            console.error("❌ Failed to start IMAP service:", error);
            throw error;
        }
    }

    /**
     * Stop the IMAP service
     */
    public stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        
        if (this.connection && this.isConnected) {
            this.connection.end();
            this.isConnected = false;
        }
        
        console.log("🛑 IMAP service stopped");
    }

    /**
     * Get service status
     */
    public getStatus(): { isConnected: boolean; isChecking: boolean } {
        return {
            isConnected: this.isConnected,
            isChecking: this.checkInterval !== null
        };
    }

    /**
     * Update configuration
     * @param newConfig - New IMAP configuration
     */
    public updateConfig(newConfig: Partial<ImapConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log("⚙️ IMAP configuration updated");
    }

    /**
     * Set message check interval
     * @param intervalMs - Interval in milliseconds
     */
    public setCheckInterval(intervalMs: number): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        
        this.checkIntervalMs = intervalMs;
        
        if (this.isConnected) {
            this.startMessageChecking();
        }
        
        console.log(`⏱️ Message check interval updated to ${intervalMs}ms`);
    }

    /**
     * Connect to IMAP server
     */
    private async connect(): Promise<void> {
        try {
            this.connection = await imaps.connect(this.config);
            await this.connection.openBox('INBOX');
            this.isConnected = true;
            console.log("✅ Connected to INBOX successfully");
        } catch (error) {
            this.isConnected = false;
            console.error("❌ IMAP connection error:", error);
            throw error;
        }
    }

    /**
     * Connect to IMAP server with retry and exponential backoff
     */
    private async connectWithRetry(
        maxRetries: number = this.maxConnectRetries,
        initialDelayMs: number = this.initialReconnectDelayMs
    ): Promise<void> {
        let attempt = 0;
        let delayMs = initialDelayMs;

        while (true) {
            try {
                attempt += 1;
                console.log(`📡 Connecting to IMAP (attempt ${attempt}/${maxRetries})...`);
                await this.connect();
                return;
            } catch (error) {
                if (attempt >= maxRetries) {
                    console.error("⛔ Exhausted IMAP connection retries");
                    throw error;
                }
                const jitter = Math.floor(Math.random() * 250);
                console.warn(`⚠️ Connect attempt ${attempt} failed. Retrying in ${delayMs + jitter}ms...`);
                await this.delay(delayMs + jitter);
                delayMs = Math.min(delayMs * 2, 30000); // cap backoff at 30s
            }
        }
    }

    /**
     * Promise-based delay utility
     */
    private async delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Start periodic message checking
     */
    private async startMessageChecking(): Promise<void> {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        this.checkInterval = setInterval(async () => {
            if (this.isConnected) {
                console.log("🔍 Checking for new messages...");
                await this.handleNewMessages();
            } else {
                // Try to re-establish connection in the background
                try {
                    await this.connectWithRetry();
                } catch (e) {
                    // Keep silent here to avoid noisy logs every tick; reconnect() already logs
                }
            }
        }, this.checkIntervalMs);

        console.log(`⏰ Message checking started with ${this.checkIntervalMs}ms interval`);
    }

    /**
     * Handle new messages
     */
    private async handleNewMessages(): Promise<void> {
        try {
            if (!this.connection || !this.isConnected) {
                console.warn("⚠️ No active IMAP connection");
                return;
            }

            const messages: ImapMessage[] = await this.connection.search(
                ['UNSEEN', ['FROM', 'donotreply@vfshelpline.com']], 
                { bodies: [''], markSeen: true }
            );
            if(messages.length === 0){
                return
            }
            console.log(`🔍 Found ${messages.length} new message(s)`);
            
            for (const [index, message] of messages.entries()) {
                await this.processMessage(message, index);
            }
            
        } catch (error: any) {
            console.error('❌ Error searching new messages:', error);
            // Try to reconnect if connection is lost
            if (error.message?.includes('connection')) {
                await this.reconnect();
            }
        }
    }

    /**
     * Process individual message
     */
    private async processMessage(item: ImapMessage, index: number): Promise<void> {
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
            
            // Extract OTP and site from message
            const otp = this.extractOtp(mail);
            const site = this.extractSite(mail);
            
            if (otp && this.otpCallback) {
                console.log("🔑 OTP Found:", otp, "for site:", site);
                // Call the provided callback function with the OTP
                await this.otpCallback(otp, site || "");
            }
            
            console.log("--- End New Message ---\n");
            
        } catch (error) {
            console.error(`❌ Error processing new message ${index + 1}:`, error);
        }
    }

    /**
     * Extract OTP from parsed mail
     */
    private extractOtp(mail: ParsedMail): string | null {
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
    }

    /**
     * Extract site information from parsed mail
     */
    private extractSite(mail: ParsedMail): string | null {
        if (!mail.text) return null;

        const siteMappings: { [key: string]: string } = {
            '/gbr/en/isl': 'iceland',
            '/gbr/en/nor': 'norway',
            '/gbr/en/mlt': 'malta',
            '/gbr/en/ltu': 'lithuania',
            '/gbr/en/lva': 'latvia',
            '/gbr/en/hun': 'hungry',
            '/gbr/en/fin': 'finland',
            '/gbr/en/est': 'estonia',
            '/gbr/en/cze': 'czech',
            '/gbr/en/hrv': 'croatia',
            '/gbr/en/aut': 'austria'
        };

        for (const [pattern, site] of Object.entries(siteMappings)) {
            if (mail.text.includes(pattern)) {
                return site;
            }
        }

        return null;
    }

    /**
     * Attempt to reconnect to IMAP server
     */
    private async reconnect(): Promise<void> {
        try {
            console.log("🔄 Attempting to reconnect to IMAP server...");
            this.isConnected = false;
            
            if (this.connection) {
                this.connection.end();
            }
            
            await this.connectWithRetry();
            console.log("✅ Reconnected successfully");
        } catch (error) {
            console.error("❌ Reconnection failed:", error);
            // Schedule another reconnection attempt
            setTimeout(() => this.reconnect(), 30000); // Try again in 30 seconds
        }
    }

    /**
     * Test connection
     */
    public async testConnection(): Promise<boolean> {
        try {
            if (!this.connection || !this.isConnected) {
                await this.connect();
            }
            
            // Try to list a few messages to test connection
            await this.connection.search(['ALL'], { limit: 1 });
            return true;
        } catch (error) {
            console.error("❌ Connection test failed:", error);
            return false;
        }
    }

    /**
     * Get current configuration
     */
    public getConfig(): ImapConfig {
        return { ...this.config };
    }
}

// Create a singleton instance


// Export the singleton instance and the class
export default  ImapService

