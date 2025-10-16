import {
	type Dependency,
	type Link,
	type Subscriber,
	SubscriberFlags,
	createReactiveSystem,
} from "alien-signals";

interface SigreaComputedNode extends Dependency, Subscriber {
	update(): boolean;
}

interface SigreaEffectNode extends Subscriber {
	notify(): void;
}

const reactiveSystem = createReactiveSystem({
	updateComputed(computed: Dependency & Subscriber) {
		const node = computed as SigreaComputedNode;
		return node.update();
	},
	notifyEffect(effect: Subscriber) {
		const node = effect as SigreaEffectNode;
		node.notify();
		return true;
	},
});

const {
	propagate,
	startTracking,
	updateDirtyFlag,
	processComputedUpdate,
	processEffectNotifications,
} = reactiveSystem;

export type {
	Dependency,
	Link,
	Subscriber,
	SigreaComputedNode,
	SigreaEffectNode,
};

export {
	SubscriberFlags,
	reactiveSystem,
	propagate,
	startTracking,
	updateDirtyFlag,
	processComputedUpdate,
	processEffectNotifications,
};
