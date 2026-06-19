import crypto from 'crypto';

export function sortObject(input = {}) {
    return Object.keys(input)
        .filter((key) => input[key] !== undefined && input[key] !== null && input[key] !== '')
        .sort()
        .reduce((sorted, key) => {
            sorted[key] = input[key];
            return sorted;
        }, {});
}

function encodePart(value) {
    return encodeURIComponent(String(value)).replace(/%20/g, '+');
}

export function toVnpayQueryString(params = {}) {
    const sorted = sortObject(params);
    return Object.keys(sorted)
        .map((key) => `${encodePart(key)}=${encodePart(sorted[key])}`)
        .join('&');
}

export function createSecureHash(params = {}, secret) {
    const signingParams = { ...params };
    delete signingParams.vnp_SecureHash;
    delete signingParams.vnp_SecureHashType;

    return crypto
        .createHmac('sha512', secret)
        .update(Buffer.from(toVnpayQueryString(signingParams), 'utf-8'))
        .digest('hex');
}

export function verifySecureHash(params = {}, secret) {
    const receivedHash = params.vnp_SecureHash;
    if (!receivedHash || !secret) return false;

    const expectedHash = createSecureHash(params, secret);
    const received = Buffer.from(String(receivedHash).toLowerCase(), 'hex');
    const expected = Buffer.from(expectedHash.toLowerCase(), 'hex');

    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export function appendSecureHash(params = {}, secret) {
    const signedParams = sortObject(params);
    signedParams.vnp_SecureHash = createSecureHash(signedParams, secret);
    return signedParams;
}

export function formatVnpayDate(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date).reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
    }, {});

    return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}

