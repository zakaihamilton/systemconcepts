export const tableDataRegistry = new Map<any, any>();
let tableRegistryCounter = 0;

export function allocateRegistryId() {
	return ++tableRegistryCounter;
}
