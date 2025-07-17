const crypto = require('crypto');

class OTPService {
    constructor() {
        this.otpStore = new Map();
        this.OTP_EXPIRY = 5 * 60 * 1000; // 5 minutes
        this.OTP_LENGTH = 6;
        this.maxAttempts = 3;
        this.blockDuration = 15 * 60 * 1000; // 15 minutes
    }

    // Generate OTP
    generateOTP() {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        return otp;
    }

    // Store OTP with expiry
    storeOTP(identifier, otp) {
        const expiryTime = Date.now() + this.OTP_EXPIRY;
        
        this.otpStore.set(identifier, {
            otp,
            expiryTime,
            attempts: 0,
            isBlocked: false,
            blockUntil: null
        });

        // Clean up expired OTPs
        this.cleanupExpiredOTPs();
        
        return expiryTime;
    }

    // Verify OTP
    verifyOTP(identifier, inputOTP) {
        const otpData = this.otpStore.get(identifier);
        
        if (!otpData) {
            return { success: false, error: 'OTP not found or expired' };
        }

        // Check if blocked
        if (otpData.isBlocked && otpData.blockUntil > Date.now()) {
            const remainingTime = Math.ceil((otpData.blockUntil - Date.now()) / 1000 / 60);
            return { success: false, error: `Too many failed attempts. Try again in ${remainingTime} minutes.` };
        }

        // Check if expired
        if (Date.now() > otpData.expiryTime) {
            this.otpStore.delete(identifier);
            return { success: false, error: 'OTP has expired' };
        }

        // Check OTP
        if (otpData.otp !== inputOTP) {
            otpData.attempts++;
            
            if (otpData.attempts >= this.maxAttempts) {
                otpData.isBlocked = true;
                otpData.blockUntil = Date.now() + this.blockDuration;
                return { success: false, error: 'Too many failed attempts. Account blocked for 15 minutes.' };
            }
            
            return { success: false, error: `Invalid OTP. ${this.maxAttempts - otpData.attempts} attempts remaining.` };
        }

        // OTP is valid
        this.otpStore.delete(identifier);
        return { success: true };
    }

    // Clean up expired OTPs
    cleanupExpiredOTPs() {
        const now = Date.now();
        for (const [key, data] of this.otpStore.entries()) {
            if (now > data.expiryTime && (!data.isBlocked || now > data.blockUntil)) {
                this.otpStore.delete(key);
            }
        }
    }

    // Get OTP status
    getOTPStatus(identifier) {
        const otpData = this.otpStore.get(identifier);
        
        if (!otpData) {
            return { exists: false };
        }

        return {
            exists: true,
            isBlocked: otpData.isBlocked,
            blockUntil: otpData.blockUntil,
            attempts: otpData.attempts,
            maxAttempts: this.maxAttempts,
            expiryTime: otpData.expiryTime
        };
    }

    // Send OTP to admin via WhatsApp
    async sendOTPToAdmin(adminId, otp, sock) {
        try {
            const message = `🔐 **GOAT Bot Dashboard Login**\n\n` +
                          `🔑 Your OTP Code: **${otp}**\n` +
                          `⏰ Valid for: 5 minutes\n` +
                          `🌐 Dashboard: http://localhost:3000\n\n` +
                          `⚠️ If you didn't request this, please ignore this message.`;

            await sock.sendMessage(adminId, { text: message });
            return true;
        } catch (error) {
            console.error('Error sending OTP to admin:', error);
            return false;
        }
    }

    // Send OTP to all admins
    async sendOTPToAllAdmins(otp, sock, config) {
        const results = [];
        
        for (const adminId of config.admins) {
            try {
                const success = await this.sendOTPToAdmin(adminId, otp, sock);
                results.push({ adminId, success });
            } catch (error) {
                console.error(`Error sending OTP to admin ${adminId}:`, error);
                results.push({ adminId, success: false, error: error.message });
            }
        }

        return results;
    }

    // Generate and send OTP for dashboard login
    async generateAndSendOTP(sock, config) {
        const otp = this.generateOTP();
        const identifier = 'dashboard_login';
        const expiryTime = this.storeOTP(identifier, otp);
        
        const sendResults = await this.sendOTPToAllAdmins(otp, sock, config);
        
        return {
            success: true,
            otp, // Remove this in production
            expiryTime,
            sendResults
        };
    }

    // Clear all OTPs
    clearAllOTPs() {
        this.otpStore.clear();
    }
}

module.exports = new OTPService();
