const X_API_KEY = process.env.PAYMENT_API_KEY;
const PAYMENT_API_URL = process.env.PAYMENT_API_URL;

export type SubscriptionPlan = "Scale" | "Start" | "Free";

type PaymentSubscriptionItem = {
	plan?: {
		nickname?: string | null;
	} | null;
};

type PaymentSubscriptionResponse = {
	success?: boolean;
	subscriptions?: PaymentSubscriptionItem[];
	[ key: string ]: unknown;
};

export async function generateCheckoutUrl(email: string, plan: string): Promise<string> {
	if (!PAYMENT_API_URL) {
		throw new Error("Missing PAYMENT_API_URL environment variable.");
	}

	if (!X_API_KEY) {
		throw new Error("Missing PAYMENT_API_KEY environment variable.");
	}

	const response = await fetch(`${PAYMENT_API_URL}/checkout`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": X_API_KEY,
		},
		body: JSON.stringify({ email, plan }),
	});

	const payload = await response.json();

	if (!response.ok || payload.success === false) {
		throw new Error("Failed to generate checkout URL.");
	}

	const checkoutUrl = payload?.url ?? payload?.checkoutUrl;

	if (!checkoutUrl || typeof checkoutUrl !== "string") {
		throw new Error("Payment API did not return a valid checkout URL.");
	}

	return checkoutUrl;
}

export async function generateSubscriptionUrl(email: string): Promise<string> {
	if (!PAYMENT_API_URL) {
		throw new Error("Missing PAYMENT_API_URL environment variable.");
	}

	if (!X_API_KEY) {
		throw new Error("Missing PAYMENT_API_KEY environment variable.");
	}

	const response = await fetch(`${PAYMENT_API_URL}/createCustomerPortal`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": X_API_KEY,
		},
		body: JSON.stringify({ email }),
	});

	const payload = await response.json();

	if (!response.ok || payload.success === false) {
		throw new Error("Failed to generate subscription management URL.");
	}

	const subscriptionUrl = payload?.url;

	if (!subscriptionUrl || typeof subscriptionUrl !== "string") {
		throw new Error("Payment API did not return a valid subscription management URL.");
	}

	return subscriptionUrl;
}

export async function getSubscription(email: string): Promise<string> {
	if (!PAYMENT_API_URL) {
		throw new Error("Missing PAYMENT_API_URL environment variable.");
	}

	if (!X_API_KEY) {
		throw new Error("Missing PAYMENT_API_KEY environment variable.");
	}

	const response = await fetch(
		`${PAYMENT_API_URL}/getSubscription?email=${encodeURIComponent(email)}`,
		{
			method: "GET",
			headers: {
				"x-api-key": X_API_KEY,
			},
		}
	);

	const payload = (await response.json()) as PaymentSubscriptionResponse;

	if (!response.ok || payload.success === false) {
		throw new Error("Failed to get subscription.");
	}

	const subscriptions = Array.isArray(payload.subscriptions) ? payload.subscriptions : [];
	const hasScale = subscriptions.some((subscription) => subscription.plan?.nickname === "Scale");
	const hasStart = subscriptions.some((subscription) => subscription.plan?.nickname === "Start");

	const plan: SubscriptionPlan = hasScale ? "Scale" : hasStart ? "Start" : "Free";

	return plan;
}

