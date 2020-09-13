export function makePath(...components) {
    components = components.filter(Boolean).map(component => {
        if (component.startsWith("/")) {
            component = component.slice(1);
        }
        else if (component.endsWith("/")) {
            component = component.slice(0, -1);
        }
        return component;
    });
    return "/" + components.join("/");
}