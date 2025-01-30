export default function parseCookie(cookieHeader) {
    if (!cookieHeader) return {};

    const cookies = {};
    cookieHeader.split(';').forEach(cookieStr => {
        const [name, value] = cookieStr.trim().split('=');
        if (name && value) {
            cookies[name] = value;
        }
    });
    return cookies;
}
