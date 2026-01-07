export const __DEV__ =
	typeof process !== "undefined" &&
	typeof process.env !== "undefined" &&
	process.env.NODE_ENV !== "production";
