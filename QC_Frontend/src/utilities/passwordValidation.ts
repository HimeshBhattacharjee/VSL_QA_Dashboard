export const PASSWORD_REQUIREMENTS = [
    'At least 8 characters',
    'Uppercase and lowercase letters',
    'At least one digit',
    'Special character (@, #, $, &, !, _)'
];

export const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
        return 'Password must be at least 8 characters long';
    }
    if (!/(?=.*[a-z])/.test(password)) {
        return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(password)) {
        return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(password)) {
        return 'Password must contain at least one digit';
    }
    if (!/(?=.*[@#$&!_])/.test(password)) {
        return 'Password must contain at least one special character (@, #, $, &, !, _)';
    }
    return null;
};
