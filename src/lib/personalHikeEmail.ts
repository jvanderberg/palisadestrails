import type { PersonalHike } from '../personal/store';

const HIKE_EMAIL = 'jvanderberg@gmail.com';

export function personalHikeCsv(hike: PersonalHike): string {
	return [
		'latitude,longitude',
		...hike.segments.flatMap((segment) =>
			segment.map((point) => `${point.lat.toFixed(7)},${point.lon.toFixed(7)}`),
		),
	].join('\n');
}

export function personalHikeEmailUrl(hike: PersonalHike, name = hike.name): string {
	const hikeName = name.trim() || hike.name;
	const subject = `Palisades Trails hike: ${hikeName}`;
	const body = `Hike name: ${hikeName}\n\n${personalHikeCsv(hike)}`;
	return `mailto:${HIKE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
