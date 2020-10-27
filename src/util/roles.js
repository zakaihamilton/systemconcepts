import roles from "@data/roles";

export function roleAuth(roleId, compareId) {
    const role = roles.find(role => role.id === roleId);
    const compare = roles.find(role => role.id === compareId);
    if (!role || !compare) {
        return false;
    }
    return role.level >= compare.level;
}
