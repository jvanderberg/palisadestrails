const FEEDBACK_EMAIL = 'jvanderberg@gmail.com';

export function buildTshirtRedemptionMailto(name: string, pointNames: string[]): string {
	const displayName = name.trim() || 'Trail Explorer';
	const subject = 'Palisades Trailblazer T-shirt redemption';
	const body = [
		`Name: ${displayName}`,
		'',
		'Points of interest:',
		...pointNames.map((point) => `- ${point}`),
		'',
		'my t-shirt size is [      ]',
	].join('\n');
	return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
