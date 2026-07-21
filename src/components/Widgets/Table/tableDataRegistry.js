export const tableDataRegistry = new Map();
let tableRegistryCounter = 0;

export function allocateRegistryId() {
	return ++tableRegistryCounter;
}
