import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGeolocation } from './useGeolocation';

const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');

describe('useGeolocation', () => {
	const fixes: PositionCallback[] = [];
	const getCurrentPosition = vi.fn(
		(
			success: PositionCallback,
			_error?: PositionErrorCallback | null,
			_options?: PositionOptions,
		) => fixes.push(success),
	);

	beforeEach(() => {
		vi.useFakeTimers();
		fixes.length = 0;
		getCurrentPosition.mockClear();
		window.history.replaceState({}, '', '/');
		Object.defineProperty(navigator, 'geolocation', {
			configurable: true,
			value: { getCurrentPosition },
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		if (originalGeolocation) Object.defineProperty(navigator, 'geolocation', originalGeolocation);
		else Reflect.deleteProperty(navigator, 'geolocation');
	});

	it('starts automatically and requests a fresh fix every 30 seconds', () => {
		const { result } = renderHook(() => useGeolocation());

		expect(result.current.watching).toBe(true);
		expect(getCurrentPosition).toHaveBeenCalledTimes(1);
		expect(getCurrentPosition.mock.calls[0][2]).toEqual({
			enableHighAccuracy: true,
			maximumAge: 0,
			timeout: 15000,
		});

		act(() => vi.advanceTimersByTime(29_999));
		expect(getCurrentPosition).toHaveBeenCalledTimes(1);
		act(() => vi.advanceTimersByTime(1));
		expect(getCurrentPosition).toHaveBeenCalledTimes(2);
	});

	it('updates silently in the background and recenters only after a button request', () => {
		const { result } = renderHook(() => useGeolocation());
		act(() =>
			fixes[0]({
				coords: { latitude: 42.3, longitude: -86.3, accuracy: 7 },
			} as GeolocationPosition),
		);

		expect(result.current.pos).toEqual({ lat: 42.3, lon: -86.3, accuracy: 7 });
		expect(result.current.recenter).toBeNull();

		act(() => result.current.locate());
		expect(result.current.locating).toBe(true);
		expect(getCurrentPosition).toHaveBeenCalledTimes(2);

		act(() =>
			fixes[1]({
				coords: { latitude: 42.31, longitude: -86.31, accuracy: 5 },
			} as GeolocationPosition),
		);
		expect(result.current.locating).toBe(false);
		expect(result.current.recenter).toMatchObject({ lat: 42.31, lon: -86.31, nonce: 1 });
	});
});
