export const PLAN_CONFIG = {
    free: {
        label: 'Free',
        price: 0,
        durationDays: 0,
        features: ['Free listening', 'Ads included', 'Basic playlists'],
    },
    premium: {
        label: 'Premium',
        price: 59000,
        durationDays: 30,
        features: ['No ads', 'Offline listening', 'High quality audio'],
    },
    vip: {
        label: 'VIP',
        price: 99000,
        durationDays: 30,
        features: ['All Premium features', 'Priority support', 'Exclusive content'],
    },
};

export function calcEndDate(startDate, durationDays) {
    if (!durationDays) return null;
    const d = new Date(startDate);
    d.setDate(d.getDate() + durationDays);
    return d;
}

export function planFromPaymentDescription(description = '') {
    const normalized = String(description).toLowerCase();
    return Object.keys(PLAN_CONFIG).find((plan) => normalized.includes(plan)) || null;
}

