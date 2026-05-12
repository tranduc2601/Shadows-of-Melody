
export const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};


export const validatePassword = (password) => {

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return passwordRegex.test(password);
};


export const validateUsername = (username) => {

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
};


export const sanitizeSearchQuery = (query) => {
    return query.trim().replace(/[%_]/g, '\\$&').slice(0, 100);
};
