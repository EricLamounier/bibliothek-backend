type CodeEntry = {
    code: string;
    expiresAt: Date;
    timeout: NodeJS.Timeout;
};

export const pwdCodes = new Map<string, CodeEntry>();