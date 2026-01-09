declare const __SIGREA_DEV__: boolean | undefined;

export const __DEV__ =
	typeof __SIGREA_DEV__ !== "undefined"
		? __SIGREA_DEV__
		: typeof process !== "undefined" &&
			typeof process.env !== "undefined" &&
			process.env.NODE_ENV !== "production";
