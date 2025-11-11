export function createReactiveObject<T extends object>(
	target: T,
	proxyMap: WeakMap<object, object>,
	handlers: ProxyHandler<object>,
): T {
	const existingProxy = proxyMap.get(target);
	if (existingProxy !== undefined) {
		return existingProxy as T;
	}
	const proxy = new Proxy(target, handlers);
	proxyMap.set(target, proxy);
	return proxy as T;
}
