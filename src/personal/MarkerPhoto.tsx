import { useEffect, useState } from 'react';
import { loadMarkerPhoto } from './photos';

interface Props {
	markerId: string;
	hasPhoto: boolean;
	version: number;
	className?: string;
}

export default function MarkerPhoto({ markerId, hasPhoto, version, className = '' }: Props) {
	const [url, setUrl] = useState<string | null>(null);

	useEffect(() => {
		void version;
		let active = true;
		let objectUrl: string | null = null;
		setUrl(null);
		if (hasPhoto) {
			loadMarkerPhoto(markerId)
				.then((photo) => {
					if (!active || !photo) return;
					objectUrl = URL.createObjectURL(photo);
					setUrl(objectUrl);
				})
				.catch(() => undefined);
		}
		return () => {
			active = false;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [markerId, hasPhoto, version]);

	return url ? <img src={url} alt="" className={className} /> : null;
}
