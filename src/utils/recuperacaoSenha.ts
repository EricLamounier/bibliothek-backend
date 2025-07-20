type CodeEntry = {
    otp: string;
    expiresAt: Date;
    timeout: NodeJS.Timeout;
};

export const pwdCodes = new Map<string, CodeEntry>();